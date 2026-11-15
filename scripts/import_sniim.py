"""Importa los dos extractos públicos curados de SNIIM para LuumIA.

Sin opciones, lee las fuentes locales y comprueba sus huellas. Usa --refresh
para descargar capturas nuevas, o --check para verificar el CSV sin editarlo.
"""

import argparse
import csv
import io
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend" / "src"))

from luumia.sniim_live import (
    COLUMNS, SOURCES, YEARS, campeche_quotes, decode_page, download_item, merida_quotes, sha256,
)

RAW = ROOT / "data/raw/sniim"
DESTINATION = ROOT / "data/processed/sniim/quotes.csv"
MANIFEST = RAW / "manifest.json"


def read_captures() -> tuple[dict[str, bytes], dict[str, dict]]:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    metadata = manifest["files"]
    if manifest["schema_version"] != 1 or set(metadata) != set(SOURCES):
        raise ValueError("El manifiesto no contiene las seis capturas previstas")

    files = {}
    for name, url in SOURCES.items():
        payload = (RAW / name).read_bytes()
        entry = metadata[name]
        if entry["url_fuente"] != url or entry["sha256"] != sha256(payload) or entry["bytes"] != len(payload):
            raise ValueError(f"La fuente o huella de {name} difiere del manifiesto")
        if datetime.fromisoformat(entry["retrieved_at"]).utcoffset() != timedelta(0):
            raise ValueError(f"La fecha de descarga de {name} debe estar en UTC")
        files[name] = payload
    return files, metadata


def import_quotes(files: dict[str, bytes], metadata: dict[str, dict]) -> str:
    rows = []
    for year in YEARS:
        name = f"campeche-{year}.html"
        rows.extend(campeche_quotes(decode_page(files[name]), year, metadata[name]))
    name = "merida-2026-09.html"
    rows.extend(merida_quotes(decode_page(files[name]), metadata[name]))
    if len(rows) != 65 or len({row["id"] for row in rows}) != 65:
        raise ValueError("El CSV debe contener 65 cotizaciones con ID único")

    output = io.StringIO(newline="")
    writer = csv.DictWriter(output, fieldnames=COLUMNS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return output.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--refresh", action="store_true")
    mode.add_argument("--check", action="store_true")
    args = parser.parse_args()

    if args.refresh:
        with ThreadPoolExecutor(max_workers=3) as workers:
            captures = list(workers.map(download_item, SOURCES.items()))
        files = {name: payload for name, payload, _ in captures}
        metadata = {name: entry for name, _, entry in captures}
    else:
        files, metadata = read_captures()
    output = import_quotes(files, metadata).encode("utf-8")

    if args.check:
        if DESTINATION.read_bytes() != output:
            raise SystemExit("CSV de SNIIM desactualizado, ejecuta scripts/import_sniim.py")
    else:
        if args.refresh:
            RAW.mkdir(parents=True, exist_ok=True)
            for name, payload in files.items():
                (RAW / name).write_bytes(payload)
            manifest = {"schema_version": 1, "source": "SNIIM", "files": metadata}
            MANIFEST.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        DESTINATION.parent.mkdir(parents=True, exist_ok=True)
        DESTINATION.write_bytes(output)
    print("SNIIM: 60 cotizaciones mensuales de Campeche y 5 cotizaciones diarias de Mérida")


if __name__ == "__main__":
    main()
