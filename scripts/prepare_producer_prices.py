"""Prepara series mensuales al productor desde FAOSTAT, USDA ERS y DGSIAP."""

import argparse
import csv
import io
import json
import os
import re
from collections import defaultdict
from datetime import UTC, date, datetime
from decimal import Decimal, InvalidOperation
from hashlib import sha256
from pathlib import Path
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen
from zipfile import BadZipFile, ZipFile


ROOT = Path(__file__).resolve().parents[1]
DESTINATION = ROOT / "data/processed/producer-prices"
FAOSTAT = "https://bulks-faostat.fao.org/production/Prices_E_All_Data_(Normalized).zip"
USDA = "https://www.ers.usda.gov/media/5766/feed-grains-yearbook-tables-all-years.csv"
NASS = "https://esmis.nal.usda.gov/publication/agricultural-prices"
NASS_FILES = {
    "nass-agpr0923.txt": "c821gj76b/vt152460x/bg2590100/agpr0923.txt",
    "nass-agpr0924.txt": "c821gj76b/hd76ts06f/s4657711j/agpr0924.txt",
    "nass-agpr0925.txt": "c821gj76b/xg94kp17m/0g356g172/agpr0925.txt",
    "nass-agpr0926.txt": "796084/agpr0926.txt",
}
NASS_DOWNLOADS = {
    name: f"https://esmis.nal.usda.gov/sites/default/release-files/{path}" for name, path in NASS_FILES.items()
}
COSECHANDO = "https://numerosdelcampo.agricultura.gob.mx/publicnew"
FILENAMES = {
    "cosechando-frijol.csv": "frijol_variables_precios.csv",
    "cosechando-maiz-blanco.csv": "maiz-blanco_variables_precios.csv",
    "cosechando-maiz-amarillo.csv": "maiz-amarillo_variables_precios.csv",
}
FAO_GEOGRAPHIES = {"33": ("can", "Canadá", "CAD"), "231": ("us", "Estados Unidos", "USD")}
FAO_PRODUCTS = {
    "56": ("maiz", "Maíz grano", "aggregate"),
    "176": ("frijol", "Frijol seco", "aggregate"),
    "394": ("calabaza", "Calabazas y otras cucurbitáceas", "aggregate"),
    "388": ("saladette", "Jitomate (categoría general)", "aggregate"),
}
SPANISH_MONTHS = {
    name: number for number, name in enumerate(
        "ene feb mar abr may jun jul ago sep oct nov dic".split(), 1
    )
}
ENGLISH_MONTHS = {
    name: number for number, name in enumerate(
        "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(), 1
    )
}
NASS_MONTHLY_TABLE = re.compile(
    r"^Prices Received for Dry Edible Beans by Month - States and United States: Marketing\s+"
    r"Years (\d{4})-\d{4} and (\d{4})-\d{4}\s*\n-{20,}\n"
    r"([\s\S]+?)(?=^Prices Received |\Z)",
    re.MULTILINE,
)
NASS_COUNTRY = re.compile(r"^United States [ .]*:\s*([^\r\n]+)$", re.MULTILINE)
NASS_RECENT_TABLE = re.compile(
    r"^Prices Received for Dry Edible Beans - States and United States:\s+([A-Za-z]+) (\d{4})\s+"
    r"with Comparisons\s*\n-{20,}\n([\s\S]+?)(?=^Prices Received |\Z)",
    re.MULTILINE,
)
NASS_LISTING_FILE = "nass-agricultural-prices.html"
NASS_TXT_LINK = re.compile(r'href="(/sites/default/release-files/[^"]*/agpr(\d{2})(\d{2})\.txt)"')
NASS_LAST_HISTORICAL_MONTH = date(2026, 8, 1)
MAX_BYTES = 32 * 1024 * 1024


def read_price(raw: str) -> str:
    value = Decimal(raw)
    if not value.is_finite() or value <= 0:
        raise ValueError(f"Precio mensual no válido: {raw!r}")
    return format(value.normalize(), "f")


def source_file(cache: Path, filename: str, url: str, *, download: bool, form: str | None = None) -> bytes:
    path = cache / filename
    if download:
        data = urlencode({"nombreArchivo": form}).encode() if form else None
        request = Request(url, data=data, headers={"User-Agent": "LuumIA/2.0 (datos públicos de precios)"})
        with urlopen(request, timeout=30) as response:
            contents = response.read(MAX_BYTES + 1)
        if len(contents) > MAX_BYTES:
            raise ValueError(f"La descarga de {filename} supera el tamaño previsto.")
        cache.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_bytes(contents)
        temporary.replace(path)
    return path.read_bytes()


def nass_recent_downloads(cache: Path, *, download: bool) -> dict[str, str]:
    links = {}
    page_number = 0
    while True:
        filename = NASS_LISTING_FILE if page_number == 0 else f"nass-agricultural-prices-{page_number}.html"
        listing = source_file(cache, filename, f"{NASS}?page={page_number}", download=download)
        releases = NASS_TXT_LINK.findall(listing.decode("utf-8-sig"))
        if not releases:
            raise ValueError("El índice público de USDA NASS dejó de listar informes descargables.")
        for link, month, year in releases:
            publication_month = date(2000 + int(year), int(month), 1)
            if publication_month <= date(2026, 9, 1):
                return dict(reversed(links.items()))
            links[f"nass-agpr{month}{year}.txt"] = urljoin(NASS, link)
        page_number += 1


def month_rows(group: dict, *, flags: dict | None = None) -> list[dict]:
    return [
        {"month": month.isoformat(), "price": price, "source_flag": flags.get(month) if flags else None}
        for month, price in sorted(group.items())
    ]


def store_price(group: dict, month: date, raw: str) -> None:
    if month in group:
        raise ValueError(f"Mes duplicado en la serie: {month.isoformat()}")
    group[month] = read_price(raw)


def csv_rows(source: bytes, fields: set[str]) -> csv.DictReader:
    reader = csv.DictReader(io.StringIO(source.decode("utf-8-sig"), newline=""), strict=True)
    if not fields.issubset(reader.fieldnames or ()):
        raise ValueError("El recurso publicado no contiene las columnas de precios esperadas.")
    return reader


def series(series_id: str, crop_id: str, product: str, geography: str, geography_code: str, currency: str,
           unit: str, source_name: str, source_url: str, retrieved_at: str, rows: list[dict],
           variety_match: str, download_url: str | None = None) -> dict:
    if not rows:
        raise ValueError(f"La serie {series_id} está vacía.")
    return dict(
        series_id=series_id, crop_id=crop_id, product=product, geography=geography, geography_code=geography_code,
        currency=currency, unit=unit, source_name=source_name, source_url=source_url, retrieved_at=retrieved_at,
        price_scope="producer", variety_match=variety_match, download_url=download_url, rows=rows,
    )


def faostat_series(archive: bytes, retrieved_at: str) -> list[dict]:
    groups = defaultdict(dict)
    with ZipFile(io.BytesIO(archive)) as package:
        with package.open("Prices_E_All_Data_(Normalized).csv") as stream:
            for row in csv.DictReader(io.TextIOWrapper(stream, encoding="utf-8-sig", newline=""), strict=True):
                area, item = row["Area Code"], row["Item Code"]
                if area not in FAO_GEOGRAPHIES or item not in FAO_PRODUCTS:
                    continue
                # 5530 = precio al productor en moneda local por tonelada. 7021 = cifra anual.
                if (row["Element Code"], row["Unit"], row["Flag"]) != ("5530", "LCU", "A") or not row["Value"]:
                    continue
                month = int(row["Months Code"]) - 7000
                if 1 <= month <= 12:
                    store_price(groups[area, item], date(int(row["Year"]), month, 1), row["Value"])
    results = []
    for area, (region, geography, currency) in FAO_GEOGRAPHIES.items():
        for item, (crop, product, variety_match) in FAO_PRODUCTS.items():
            rows = groups[area, item]
            geography_code = "USA" if region == "us" else "CAN"
            results.append(series(
                f"faostat-{crop}-{region}", crop, product, geography, geography_code, currency, "t", "FAOSTAT",
                "https://www.fao.org/faostat/en/#data/PP", retrieved_at,
                month_rows(rows, flags=dict.fromkeys(rows, "A")), variety_match, FAOSTAT,
            ))
    return results


def usda_series(source: bytes, retrieved_at: str) -> list[dict]:
    rows = {}
    for row in csv_rows(source, {"table_name", "commodity", "attribute", "geography",
                                 "year", "frequency", "timeperiod", "unit", "amount"}):
        if (row["table_name"], row["commodity"], row["attribute"], row["geography"], row["frequency"], row["unit"]) != (
            "Table 9--Corn and sorghum: Prices received by farmers, United States", "Corn", "Price received by farmers",
            "United States", "Monthly", "Dollars per bushel",
        ):
            continue
        if row["amount"]:
            store_price(rows, date(int(row["year"]), ENGLISH_MONTHS[row["timeperiod"]], 1), row["amount"])
    # ERS advierte que el dato mensual más reciente es preliminar.
    return [series(
        "usda-ers-maiz-us", "maiz", "Maíz grano", "Estados Unidos", "USA", "USD", "bu", "USDA ERS / NASS",
        "https://www.ers.usda.gov/data-products/feed-grains-database/feed-grains-yearbook-tables",
        retrieved_at, month_rows(rows, flags={max(rows): "preliminary"}), "aggregate", USDA,
    )]


def nass_series(resources: dict[str, bytes], retrieved_at: str) -> list[dict]:
    rows = {}
    marketing_months = (9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8)
    # Las ediciones más recientes pueden revisar un año comercial ya publicado.
    for filename in ("nass-agpr0923.txt", "nass-agpr0924.txt", "nass-agpr0925.txt", "nass-agpr0926.txt"):
        report = resources[filename].decode("utf-8-sig").replace("\r\n", "\n")
        table = NASS_MONTHLY_TABLE.search(report)
        if not table or "dollars per cwt" not in table[3]:
            raise ValueError(f"No se encontró la tabla mensual de frijol seco en {filename}.")
        segments = [line.split() for line in NASS_COUNTRY.findall(table[3])]
        if len(segments) != 4 or any(len(segment) != 6 for segment in segments):
            raise ValueError(f"La tabla nacional de frijol seco tiene un formato inesperado en {filename}.")
        for year, prices in ((int(table[1]), segments[0] + segments[1]), (int(table[2]), segments[2] + segments[3])):
            for month, raw in zip(marketing_months, prices, strict=True):
                rows[date(year + (month < 9), month, 1)] = read_price(raw)
    for filename in resources.keys() - NASS_DOWNLOADS.keys():
        report = resources[filename].decode("utf-8-sig").replace("\r\n", "\n")
        table = NASS_RECENT_TABLE.search(report)
        if not table or "dollars per cwt" not in table[3]:
            raise ValueError(f"No se encontró la comparación mensual de frijol seco en {filename}.")
        comparisons = NASS_COUNTRY.findall(table[3])
        if len(comparisons) != 1 or len(prices := comparisons[0].split()) != 3:
            raise ValueError(f"La comparación nacional de {filename} tiene un formato inesperado.")
        month = date(int(table[2]), ENGLISH_MONTHS[table[1][:3]], 1)
        if month > NASS_LAST_HISTORICAL_MONTH:
            store_price(rows, month, prices[-1])
    return [series(
        "usda-nass-frijol-us", "frijol", "Frijol seco", "Estados Unidos", "USA", "USD", "cwt", "USDA NASS",
        NASS, retrieved_at, month_rows(rows), "aggregate",
    )]


def spanish_month(raw: str) -> date:
    text_month, year = raw.strip().lower().split("-")
    return date(2000 + int(year), SPANISH_MONTHS[text_month], 1)


def dgsiap_series(resources: dict[str, bytes], retrieved_at: str) -> list[dict]:
    bean_rows = defaultdict(dict)
    for row in csv_rows(resources["cosechando-frijol.csv"], {"tipo", "tipo_precio", "fecha", "valor"}):
        # PMR = precio medio rural de primera venta. Se excluyen mayoreo y consumidor.
        if row["tipo_precio"] == "PMR" and row["tipo"] in {"N", "PE", "PI"} and row["valor"].strip():
            store_price(bean_rows[row["tipo"]], spanish_month(row["fecha"]), row["valor"])
    results = [
        series(f"dgsiap-frijol-{variety}-mx", "frijol", f"Frijol {variety}", "México", "MEX", "MXN", "kg",
               "DGSIAP · Cosechando Números del Campo", f"{COSECHANDO}/productosAgricolas/cargarPagina/3",
               retrieved_at, month_rows(bean_rows[code]), "exact")
        for code, variety in (("N", "negro"), ("PE", "peruano"), ("PI", "pinto"))
    ]
    for variety, column, page in (("blanco", "MR", 5), ("amarillo", "precios", 4)):
        corn_rows = {}
        for row in csv_rows(resources[f"cosechando-maiz-{variety}.csv"], {"periodo", column}):
            if row[column].strip():
                store_price(corn_rows, spanish_month(row["periodo"]), row[column])
        results.append(series(
            f"dgsiap-maiz-{variety}-mx", "maiz", f"Maíz grano {variety}", "México", "MEX", "MXN", "kg",
            "DGSIAP · Cosechando Números del Campo", f"{COSECHANDO}/productosAgricolas/cargarPagina/{page}",
            retrieved_at, month_rows(corn_rows), "exact",
        ))
    return results


def snapshot(name: str, urls: list[str], resources: dict[str, bytes], result: list[dict], retrieved_at: str) -> dict:
    return {
        "source": name,
        "download_urls": urls,
        "retrieved_at": retrieved_at,
        "raw_sha256": {filename: sha256(content).hexdigest() for filename, content in resources.items()},
        "series": result,
    }


def without_retrieval_date(bundle: dict) -> dict:
    return {
        **{k: v for k, v in bundle.items() if k != "retrieved_at"},
        "series": [{k: v for k, v in item.items() if k != "retrieved_at"} for item in bundle["series"]],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    default_cache = Path(os.environ.get("LOCALAPPDATA", Path.home() / ".cache")) / "LuumIAV2/producer-prices"
    parser.add_argument("--cache", type=Path, default=default_cache, help="Ruta de los originales descargados.")
    parser.add_argument("--download", action="store_true", help="Actualiza los archivos originales de los proveedores.")
    parser.add_argument("--check", action="store_true", help="Compara con los datos precargados sin sobreescribirlos.")
    args = parser.parse_args()
    retrieved_at = datetime.now(UTC).isoformat(timespec="seconds")
    try:
        faostat = source_file(args.cache, "faostat-pp.zip", FAOSTAT, download=args.download)
        usda = source_file(args.cache, "usda-feed-grains.csv", USDA, download=args.download)
        bean_downloads = {**NASS_DOWNLOADS, **nass_recent_downloads(args.cache, download=args.download)}
        beans = {name: source_file(args.cache, name, url, download=args.download)
                 for name, url in bean_downloads.items()}
        dgsiap_url = f"{COSECHANDO}/temp/downloadCSV.php"
        mexico = {
            local: source_file(args.cache, local, dgsiap_url, download=args.download, form=published)
            for local, published in FILENAMES.items()
        }
        files = {
            "faostat": snapshot("FAOSTAT · Producer Prices", [FAOSTAT], {"faostat-pp.zip": faostat},
                                faostat_series(faostat, retrieved_at), retrieved_at),
            "usda": snapshot("USDA ERS / NASS", [USDA, *bean_downloads.values()],
                             {"usda-feed-grains.csv": usda, **beans},
                             [*usda_series(usda, retrieved_at), *nass_series(beans, retrieved_at)], retrieved_at),
            "dgsiap": snapshot("DGSIAP · Cosechando Números del Campo", [dgsiap_url], mexico,
                               dgsiap_series(mexico, retrieved_at), retrieved_at),
        }
        for name, bundle in files.items():
            destination = DESTINATION / f"{name}.json"
            if args.check:
                previous = json.loads(destination.read_text(encoding="utf-8"))
                if without_retrieval_date(bundle) != without_retrieval_date(previous):
                    raise ValueError(f"El catálogo {name} difiere del original precargado.")
            else:
                destination.parent.mkdir(parents=True, exist_ok=True)
                temporary = destination.with_suffix(".json.tmp")
                temporary.write_text(json.dumps(bundle, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                temporary.replace(destination)
            print(f"{name}.json: {len(bundle['series'])} series, {sum(len(s['rows']) for s in bundle['series'])} observaciones.")
    except (OSError, KeyError, ValueError, InvalidOperation, csv.Error, BadZipFile) as error:
        raise SystemExit(f"No se pudieron preparar los precios mensuales. {error}") from error


if __name__ == "__main__":
    main()
