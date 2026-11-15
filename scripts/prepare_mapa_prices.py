"""Extrae los precios mensuales al productor para tomate y calabacín de España."""

import argparse
import csv
from datetime import UTC, date, datetime
from decimal import Decimal
from hashlib import sha256
from io import StringIO
import json
from pathlib import Path

import httpx

SOURCE = "https://servicio.mapa.gob.es/ckan/es/dataset/esmapaindicespreciospreciopercibido"
DOWNLOAD = "https://servicio.mapa.gob.es/ckan/datastore/dump/23939af3-475f-4a4b-b18e-48fa9dbc4f3b"
OUTPUT = Path(__file__).resolve().parents[1] / "data/processed/producer-prices/mapa.json"
PRODUCTS = {
    "TOMATE": ("mapa-tomate-es", "saladette", "Tomate"),
    "CALABACIN": ("mapa-calabacin-es", "calabaza", "Calabacín"),
}


def extract(raw: bytes, retrieved_at: datetime) -> dict:
    rows = {name: {} for name in PRODUCTS}
    for record in csv.DictReader(StringIO(raw.decode("utf-8-sig"))):
        product = record["producto"]
        if product not in rows or record["anio_base"] != "2020" or record["grupo"] != "HORTALIZAS":
            continue
        month = date(int(record["anio"]), int(record["mes"]), 1)
        price = Decimal(record["precio_mensual"] or "0")
        # Los ceros de la descarga equivalen a guiones o cotizaciones sin publicar en los boletines.
        if price <= 0 or month >= retrieved_at.date().replace(day=1):
            continue
        if month in rows[product]:
            raise ValueError(f"Mes repetido en los precios de {product}: {month}")
        rows[product][month] = {"month": month.isoformat(), "price": format(price, "f"), "source_flag": None}

    series = []
    for product, (series_id, crop_id, label) in PRODUCTS.items():
        if not rows[product]:
            raise ValueError(f"No hay precios para {product} en la descarga de MAPA.")
        series.append({
            "series_id": series_id, "crop_id": crop_id, "product": label,
            "geography": "España", "geography_code": "ESP", "currency": "EUR", "unit": "100 kg",
            "source_name": "Ministerio de Agricultura, Pesca y Alimentación (España)", "source_url": SOURCE,
            "download_url": DOWNLOAD, "retrieved_at": retrieved_at.isoformat(),
            "price_scope": "producer", "variety_match": "aggregate",
            "rows": [rows[product][month] for month in sorted(rows[product])],
        })
    return {
        "source": SOURCE, "download_urls": [DOWNLOAD], "retrieved_at": retrieved_at.isoformat(),
        "raw_sha256": {DOWNLOAD: sha256(raw).hexdigest()}, "series": series,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, help="Usa una descarga CSV ya disponible.")
    parser.add_argument("--retrieved-at", type=datetime.fromisoformat, help="Fecha y hora ISO de la descarga local.")
    parser.add_argument("--check", action="store_true", help="Contrasta el archivo precargado sin escribirlo.")
    args = parser.parse_args()
    if args.input and (args.retrieved_at is None or args.retrieved_at.utcoffset() is None):
        parser.error("--input requiere --retrieved-at con zona horaria.")
    if args.retrieved_at and not args.input:
        parser.error("--retrieved-at solo aplica al usar --input.")

    if args.input:
        raw = args.input.read_bytes()
        retrieved_at = args.retrieved_at
    else:
        with httpx.Client(follow_redirects=True, timeout=40, transport=httpx.HTTPTransport(retries=2)) as client:
            response = client.get(DOWNLOAD)
            response.raise_for_status()
            raw = response.content
        retrieved_at = datetime.now(UTC).replace(microsecond=0)
    if args.check:
        existing = json.loads(OUTPUT.read_text(encoding="utf-8"))
        if extract(raw, datetime.fromisoformat(existing["retrieved_at"])) != existing:
            raise SystemExit("El extracto mensual de MAPA difiere de los datos precargados.")
        print("Extracto mensual de MAPA sincronizado.")
        return
    document = extract(raw, retrieved_at)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(document, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
