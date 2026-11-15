"""Extrae precios mensuales de primera venta publicados en las Balanzas DGSIAP."""

import argparse
import json
import os
import re
from collections import defaultdict
from datetime import UTC, datetime
from decimal import Decimal
from hashlib import sha256
from html import unescape
from pathlib import Path

from prepare_producer_prices import DESTINATION, read_price, series, source_file, without_retrieval_date


BASE = "https://nube.agricultura.gob.mx/Balanza/"
SOURCE = "DGSIAP · Balanzas Disponibilidad–Consumo"
OUTPUT = DESTINATION / "dgsiap-recent.json"
UNIT = "pesos por tonelada"
AMOUNT = r"(\d{1,3}(?:,\d{3})+)"
PRODUCTS = {
    "maiz-blanco": ("maiz", "Maíz grano blanco"),
    "maiz-amarillo": ("maiz", "Maíz grano amarillo"),
    "frijol-negro": ("frijol", "Frijol negro"),
    "frijol-pinto": ("frijol", "Frijol pinto"),
    "frijol-peruano": ("frijol", "Frijol peruano"),
}
# La fecha de cotización se toma de la redacción, que puede preceder la edición del boletín.
BULLETINS = (
    ("MaizGranoBlanco/noviembre2025", "2025-10-01", ("maiz-blanco",),
     rf"precio medio rural pagado a los productores nacionales de maíz blanco en octubre de 2025 fue de {AMOUNT} {UNIT}"),
    ("MaizGranoBlanco/diciembre2025", "2025-11-01", ("maiz-blanco",),
     rf"precio medio rural pagado al productor mexicano en noviembre de 2025 fue de {AMOUNT} {UNIT}"),
    ("MaizGranoAmarillo/octubre2025", "2025-08-01", ("maiz-amarillo",),
     rf"precio medio rural del maíz amarillo en México fue de {AMOUNT} {UNIT} en agosto de 2025"),
    ("MaizGranoAmarillo/noviembre2025", "2025-10-01", ("maiz-amarillo",),
     rf"precio medio rural pagado al productor de maíz amarillo en octubre de 2025 fue de {AMOUNT} {UNIT}"),
    ("MaizGranoAmarillo/diciembre2025", "2025-11-01", ("maiz-amarillo",),
     rf"precio medio rural pagado al productor de maíz amarillo se ubicó en {AMOUNT} {UNIT} en noviembre de 2025"),
    ("Frijol/diciembre2025", "2025-11-01", ("frijol-negro", "frijol-pinto", "frijol-peruano"),
     rf"A noviembre de 2025, el precio medio rural \(PMR\) del frijol negro y pinto se ubicó en {AMOUNT} y {AMOUNT} "
     rf"{UNIT}, respectivamente,[^.]*\. Para el frijol peruano, el pago al productor alcanzó {AMOUNT} {UNIT}"),
)


def page_text(content: bytes) -> str:
    try:
        html = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        html = content.decode("cp1252")
    return " ".join(unescape(re.sub(r"<[^>]+>", " ", html)).split())


def extract(cache: Path, *, download: bool, retrieved_at: str) -> dict:
    by_product = defaultdict(list)
    hashes = {}
    for path, month, products, pattern in BULLETINS:
        url = f"{BASE}{path}.php"
        name = f"balanza-{path.casefold().replace('/', '-')}.html"
        content = source_file(cache, name, url, download=download)
        matches = list(re.finditer(pattern, page_text(content), re.IGNORECASE))
        if len(matches) != 1:
            raise ValueError(f"El pasaje de primera venta previsto no aparece una sola vez en {url}.")
        hashes[url] = sha256(content).hexdigest()
        for product, raw in zip(products, matches[0].groups(), strict=True):
            amount_tonne = Decimal(raw.replace(",", ""))
            by_product[product].append({
                "month": month,
                "price": read_price(str(amount_tonne / 1_000)),
                "source_url": url,
                "source_note": "Precio medio rural mensual nacional. Conversión exacta de MXN/t a MXN/kg.",
            })
    result = []
    for product, (crop, label) in PRODUCTS.items():
        rows = sorted(by_product[product], key=lambda row: row["month"])
        if len(rows) != len({row["month"] for row in rows}):
            raise ValueError(f"Hay una cotización mensual repetida para {label}.")
        result.append(series(f"dgsiap-balanza-{product}-mx", crop, label, "México", "MEX", "MXN", "kg",
                             SOURCE, rows[-1]["source_url"], retrieved_at, rows, "exact"))
    return {"source": SOURCE, "download_urls": list(hashes), "retrieved_at": retrieved_at, "raw_sha256": hashes, "series": result}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    default_cache = Path(os.environ.get("LOCALAPPDATA", Path.home() / ".cache")) / "LuumIAV2/producer-prices"
    parser.add_argument("--cache", type=Path, default=default_cache, help="Ruta de los boletines originales.")
    parser.add_argument("--download", action="store_true", help="Descarga los boletines oficiales.")
    parser.add_argument("--check", action="store_true", help="Comprueba el extracto existente.")
    args = parser.parse_args()
    try:
        retrieved_at = datetime.now(UTC).isoformat(timespec="seconds")
        document = extract(args.cache, download=args.download, retrieved_at=retrieved_at)
        if args.check:
            previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
            if without_retrieval_date(previous) != without_retrieval_date(document):
                raise ValueError("El extracto difiere de los boletines en caché.")
        else:
            OUTPUT.parent.mkdir(parents=True, exist_ok=True)
            temp = OUTPUT.with_suffix(".json.tmp")
            temp.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            temp.replace(OUTPUT)
    except (OSError, ValueError) as error:
        raise SystemExit(f"No se pudo verificar el extracto de Balanzas DGSIAP. {error}") from error
    print(f"Balanzas DGSIAP. {sum(len(item['rows']) for item in document['series'])} precios con boletín y fecha de cotización.")


if __name__ == "__main__":
    main()
