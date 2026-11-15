"""Consulta las series comparables de Saladette publicadas por SNIIM."""

import hashlib
import re
from calendar import monthrange
from concurrent.futures import ThreadPoolExecutor, wait
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from html import unescape
from http.client import HTTPException
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


BASE_URL = "https://www.economia-sniim.gob.mx"
MAX_PAGE_BYTES = 512 * 1024
REQUEST_TIMEOUT = 5
RETRY_TIMEOUT = 3
BATCH_TIMEOUT = 7
YEARS = range(2021, 2026)
WEEK_START = date(2026, 9, 21)
WEEK_DAYS = {WEEK_START + timedelta(days=offset) for offset in range(5)}
CAMPECHE_TIMEZONE = ZoneInfo("America/Mexico_City")
CAMPECHE = 'Campeche: Mercado "Pedro Sáinz de Baranda", Campeche'
MERIDA = "Yucatán: Central de Abasto de Mérida"
VARIETY = "Tomate Saladette"
QUALITY = "Primera"
COLUMNS = (
    "id", "series_id", "market_id", "market", "granularity", "period_start",
    "period_end", "variety", "quality", "presentation", "origin", "original_unit",
    "original_price", "price_kind", "mxn_kg", "mxn_kg_min", "mxn_kg_max",
    "retrieved_at", "url_fuente", "missing_reason",
)
LEAF_ROWS = re.compile(r"<tr\b[^>]*>((?:(?!</?tr\b).)*?)</tr\s*>", re.I | re.S)
CELLS = re.compile(r"<td\b[^>]*>(.*?)</td\s*>", re.I | re.S)
TAGS = re.compile(r"<[^>]+>")

SOURCES = {
    f"campeche-{year}.html": f"{BASE_URL}/CuadroAnualCons.asp?"
    + urlencode({"anio": year, "dest": "T", "ori": "T", "pres": "T", "prod": 839, "uni": 1})
    for year in YEARS
}


def merida_url(start: date, end: date) -> str:
    return (
        f"{BASE_URL}/NUEVO/Consultas/MercadosNacionales/PreciosDeMercado/Agricolas/"
        "ResultadosConsultaFechaFrutasYHortalizas.aspx?"
        + urlencode({
            "Destino": MERIDA, "DestinoId": 310, "Origen": "Todos", "OrigenId": -1,
            "PreciosPorId": 2, "ProductoId": 839, "RegistrosPorPagina": 1000,
            "fechaFinal": end.strftime("%d/%m/%Y"), "fechaInicio": start.strftime("%d/%m/%Y"),
        })
    )


SOURCES["merida-2026-09.html"] = merida_url(WEEK_START, date(2026, 10, 1))


def sha256(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


class SniimUnavailable(OSError):
    """El servicio remoto no entregó un cuadro comparable y completo."""


def download_item(item: tuple[str, str], *, timeout: int = REQUEST_TIMEOUT) -> tuple[str, bytes, dict[str, str | int]]:
    name, url = item
    request = Request(url, headers={"User-Agent": "LuumIA/2.0 (SNIIM reference)", "Accept": "text/html"})
    with urlopen(request, timeout=timeout) as response:
        resolved_url = response.geturl()
        resolved = urlsplit(resolved_url)
        if resolved.scheme != "https" or resolved.hostname != "www.economia-sniim.gob.mx":
            raise ValueError("SNIIM respondió con una redirección fuera de su sitio oficial.")
        if response.headers.get_content_type() != "text/html":
            raise ValueError("SNIIM no devolvió el cuadro HTML esperado.")
        payload = response.read(MAX_PAGE_BYTES + 1)
    if len(payload) > MAX_PAGE_BYTES:
        raise ValueError("El cuadro de SNIIM supera el tamaño admitido.")
    metadata = {
        "url_fuente": url,
        "resolved_url": resolved_url,
        "retrieved_at": datetime.now(UTC).isoformat(timespec="seconds"),
        "sha256": sha256(payload),
        "bytes": len(payload),
    }
    return name, payload, metadata


def decode_page(payload: bytes) -> str:
    try:
        return payload.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            return payload.decode("cp1252")
        except UnicodeDecodeError:
            return payload.decode("latin-1")


def table_rows(page: str) -> list[list[str]]:
    return [
        [" ".join(unescape(TAGS.sub("", cell)).split()) for cell in CELLS.findall(row)]
        for row in LEAF_ROWS.findall(page)
    ]


def parse_price(value: str) -> Decimal:
    if re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", value) is None:
        raise ValueError(f"Se esperaba un precio decimal en MXN/kg: {value!r}")
    return Decimal(value)


def quote(
    source: dict, *,
    series_id: str, market_id: str, market: str, granularity: str,
    start: date, end: date, price_kind: str, value: str, missing_reason: str = "",
    presentation: str = "", origin: str = "", minimum: str = "", maximum: str = "",
) -> dict[str, str | Decimal]:
    return {
        "id": f"{series_id}-{start.isoformat()}",
        "series_id": series_id,
        "market_id": market_id,
        "market": market,
        "granularity": granularity,
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "variety": VARIETY,
        "quality": QUALITY,
        "presentation": presentation,
        "origin": origin,
        "original_unit": "MXN/kg",
        "original_price": value,
        "price_kind": price_kind,
        "mxn_kg": parse_price(value),
        "mxn_kg_min": parse_price(minimum) if minimum else "",
        "mxn_kg_max": parse_price(maximum) if maximum else "",
        "retrieved_at": source["retrieved_at"],
        "url_fuente": source["url_fuente"],
        "missing_reason": missing_reason,
    }


def campeche_quotes(page: str, year: int, source: dict) -> list[dict]:
    rows = table_rows(page)
    if (
        [f"Producto: {VARIETY} {QUALITY}"] not in rows
        or "Precios promedio por Kilogramo" not in page
        or "El promedio mensual se calcula como el promedio de los precios frecuentes diarios" not in page
        or f"Registros del Año {year}" not in TAGS.sub("", unescape(page))
    ):
        raise ValueError(f"Producto, unidad, método o año inesperado en Campeche {year}")

    selected = [row for row in rows if row and row[0] == CAMPECHE]
    if len(selected) != 1 or len(selected[0]) != 14:
        raise ValueError(f"Se esperaba un renglón con 12 meses y resumen anual en Campeche {year}")

    return [
        quote(
            source, series_id="campeche-monthly", market_id="campeche-pedro-sainz",
            market=CAMPECHE, granularity="monthly", start=date(year, month, 1),
            end=date(year, month, monthrange(year, month)[1]), price_kind="monthly_mean_frequent",
            value=value,
            missing_reason="El cuadro agregado omite presentación, origen y extremos diarios.",
        )
        for month, value in enumerate(selected[0][1:13], start=1)
    ]


def _merida_quotes(page: str, source: dict, days: set[date], series_id: str) -> list[dict]:
    rows = table_rows(page)
    if [VARIETY, QUALITY, MERIDA] not in [[cell for cell in row if cell] for row in rows]:
        raise ValueError("Producto, calidad o mercado inesperado en la consulta de Mérida")
    if "Pesos ($) por kilogramo calculado" not in page:
        raise ValueError("La consulta de Mérida debe publicar pesos por kilogramo")
    if not any(row[:6] == ["Fecha", "Presentación", "Origen", "Precio Mín", "Precio Max", "Precio Frec"] for row in rows):
        raise ValueError("El orden de columnas de la consulta diaria de Mérida cambió")

    quotes = []
    found = set()
    for row in rows:
        if not row or re.fullmatch(r"\d{2}/\d{2}/\d{4}", row[0]) is None:
            continue
        day = datetime.strptime(row[0], "%d/%m/%Y").date()
        if day not in days:
            continue
        if len(row) != 7:
            raise ValueError(f"Fila de Mérida sin siete celdas para {day}")
        _, presentation, origin, minimum, maximum, frequent, _ = row
        if not (presentation == "Caja de 14 kg." and origin == "Distrito Federal"):
            if series_id == "merida-weekly":
                raise ValueError(f"Presentación u origen ajenos al extracto de Mérida en {day}")
            continue
        if day in found:
            raise ValueError(f"Hay cotizaciones comparables duplicadas en Mérida para {day}")
        if not parse_price(minimum) <= parse_price(frequent) <= parse_price(maximum):
            raise ValueError(f"Precio frecuente fuera del intervalo publicado en Mérida para {day}")
        quotes.append(quote(
            source, series_id=series_id, market_id="merida-central-de-abasto",
            market=MERIDA, granularity="daily", start=day, end=day,
            price_kind="daily_frequent", value=frequent, presentation=presentation, origin=origin,
            minimum=minimum, maximum=maximum,
        ))
        found.add(day)
    return sorted(quotes, key=lambda row: row["period_start"])


def merida_quotes(page: str, source: dict) -> list[dict]:
    quotes = _merida_quotes(page, source, WEEK_DAYS, "merida-weekly")
    if len(quotes) != len(WEEK_DAYS):
        raise ValueError("Se esperaba una cotización comparable por día del 21 al 25 de septiembre")
    return quotes


def _live_page(name: str, url: str) -> tuple[bytes, dict[str, str | int]]:
    try:
        _, content, source = download_item((name, url), timeout=RETRY_TIMEOUT)
    except (OSError, HTTPException) as error:
        if isinstance(error, HTTPError) and error.code not in (408, 500, 502, 503, 504):
            raise
        _, content, source = download_item((name, url), timeout=RETRY_TIMEOUT)
    return content, source


def _download_year(year: int) -> list[dict]:
    name = f"campeche-{year}.html"
    content, source = _live_page(name, SOURCES[name])
    return campeche_quotes(decode_page(content), year, source)


def _download_merida() -> list[dict]:
    name = "merida-2026-09.html"
    content, source = _live_page(name, SOURCES[name])
    return merida_quotes(decode_page(content), source)


def completed_workweeks(today: date) -> tuple[set[date], ...]:
    days_since_friday = (today.weekday() - 4) % 7 or 7
    friday = today - timedelta(days=days_since_friday)
    return tuple({friday - timedelta(weeks=weeks, days=day) for day in range(5)} for weeks in range(3))


def recent_merida_quotes(page: str, source: dict, weeks: tuple[set[date], ...]) -> list[dict]:
    rows = _merida_quotes(page, source, set.union(*weeks), "merida-recent")
    for week in weeks:
        days = {day.isoformat() for day in week}
        selected = [row for row in rows if row["period_start"] in days]
        if selected:
            return selected
    raise ValueError("SNIIM no publicó cotizaciones comparables en las últimas tres semanas completas.")


def _download_recent_merida() -> list[dict]:
    weeks = completed_workweeks(datetime.now(CAMPECHE_TIMEZONE).date())
    url = merida_url(min(weeks[-1]), max(weeks[0]))
    content, source = _live_page("merida-recent.html", url)
    return recent_merida_quotes(decode_page(content), source, weeks)


def fetch_rows(series_id: str) -> list[dict]:
    """Lee la serie comparable solicitada y conserva la fecha de consulta."""
    if series_id not in {"campeche-monthly", "merida-weekly", "merida-recent"}:
        raise ValueError("Serie de SNIIM no admitida.")

    # A failed or slow yearly page must not return a misleading partial series.
    pool = ThreadPoolExecutor(max_workers=len(YEARS) if series_id == "campeche-monthly" else 1)
    try:
        if series_id == "campeche-monthly":
            tasks = [pool.submit(_download_year, year) for year in YEARS]
        else:
            loader = _download_recent_merida if series_id == "merida-recent" else _download_merida
            tasks = [pool.submit(loader)]
        _, pending = wait(tasks, timeout=BATCH_TIMEOUT)
        if pending:
            raise SniimUnavailable("SNIIM excedió el tiempo de espera del extracto.")
        return [
            {key: value if value != "" else None for key, value in row.items()}
            for task in tasks for row in task.result()
        ]
    except SniimUnavailable:
        raise
    except (OSError, HTTPException) as error:
        raise SniimUnavailable("SNIIM no respondió a la consulta de la serie.") from error
    except ValueError as error:
        raise SniimUnavailable("El cuadro de SNIIM cambió o no contiene todas las cotizaciones comparables.") from error
    finally:
        pool.shutdown(wait=False, cancel_futures=True)


