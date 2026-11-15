"""Prepara la referencia de rendimiento municipal con los cierres DGSIAP 2021–2025."""

import argparse
import csv
import io
import json
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from hashlib import sha256
from pathlib import Path
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data/processed/yield/hopelchen.json"
CATALOG = "https://nube.agricultura.gob.mx/datosAbiertos/Agricola.php"
CLOSURE = "https://nube.agricultura.gob.mx/index.php?view=10AE434F-A2158368-A120BC5A-EDF4AFAA&ANIO={}"
YEARS = range(2021, 2026)
CROPS = {"7490000": ("maiz", "Maíz grano"), "6840000": ("frijol", "Frijol"), "5760000": ("calabaza", "Calabaza")}
CYCLES = {"1": ("fall_winter", "Otoño-Invierno"), "2": ("spring_summer", "Primavera-Verano")}
# El cierre municipal desglosa Hopelchén en el DDR 9, CADER 2 y 3. Solo se agregan sus filas de detalle.
DISTRICTS = {("9", "2"), ("9", "3")}
FIELDS = {
    "Anio", "Idestado", "Nomestado", "Idddr", "Idcader", "Idmunicipio", "Nommunicipio", "Idciclo",
    "Nomcicloproductivo", "Idmodalidad", "Nommodalidad", "Idunidadmedida", "Nomunidad", "Idcultivo",
    "Nomcultivo", "Cosechada", "Volumenproduccion",
}
MAX_BYTES = 16 * 1024 * 1024


def decimal(value: str) -> Decimal:
    result = Decimal(value)
    if not result.is_finite() or result < 0:
        raise ValueError(f"Magnitud no válida en el cierre: {value!r}")
    return result


def parse_csv(data: bytes) -> str:
    try:
        return data.decode("utf-8-sig")
    except UnicodeDecodeError:
        return data.decode("cp1252")


def summarize_year(year: int, data: bytes, retrieved_at: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(parse_csv(data), newline=""), strict=True)
    if not FIELDS.issubset(reader.fieldnames or ()):
        raise ValueError(f"Campos requeridos ausentes en el cierre {year}.")

    candidates = defaultdict(dict)
    for row in reader:
        if (row["Idestado"], row["Idmunicipio"], row["Idmodalidad"]) != ("4", "6", "2"):
            continue
        crop_code, cycle_code = row["Idcultivo"], row["Idciclo"]
        if crop_code not in CROPS or cycle_code not in CYCLES:
            continue
        if (row["Idunidadmedida"], row["Nomunidad"]) != ("200201", "Tonelada"):
            continue
        if (row["Anio"], row["Nomestado"], row["Nommunicipio"], row["Nommodalidad"],
            row["Nomcultivo"], row["Nomcicloproductivo"]) != (
            str(year), "Campeche", "Hopelchén", "Temporal", CROPS[crop_code][1], CYCLES[cycle_code][1],
        ):
            raise ValueError(f"Los nombres y códigos no coinciden en el cierre {year}, línea {reader.line_num}.")
        district = row["Idddr"], row["Idcader"]
        group = candidates[crop_code, cycle_code]
        if district not in DISTRICTS or district in group:
            raise ValueError(f"Desglose territorial inesperado o repetido en {year}, línea {reader.line_num}.")
        area = decimal(row["Cosechada"])
        production = decimal(row["Volumenproduccion"])
        if not area and production:
            raise ValueError(f"Producción sin superficie cosechada en {year}, línea {reader.line_num}.")
        group[district] = area, production, reader.line_num

    source_sha256 = sha256(data).hexdigest()
    results = []
    for (crop_code, cycle_code), group in sorted(candidates.items()):
        if crop_code == "7490000" and cycle_code == "2" and set(group) != DISTRICTS:
            raise ValueError(f"El desglose de maíz grano en {year} no cubre los dos CADER previstos.")
        harvested = sum(area for area, _, _ in group.values())
        production = sum(volume for _, volume, _ in group.values())
        if not harvested:
            continue
        yield_t_ha = (production / harvested).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
        crop_id, crop_label = CROPS[crop_code]
        results.append({
            "year": year,
            "crop_id": crop_id,
            "crop_label": crop_label,
            "crop_code": crop_code,
            "cycle": CYCLES[cycle_code][0],
            "modality": "rainfed",
            "harvested_area_ha": str(harvested),
            "production_t": str(production),
            "yield_t_ha": str(yield_t_ha),
            "source_url": CLOSURE.format(year),
            "source_sha256": source_sha256,
            "retrieved_at": retrieved_at,
            "source_rows": len(group),
            "source_cader_codes": [district[1] for district in sorted(group)],
            "source_csv_lines": [group[district][2] for district in sorted(group)],
        })
    return results


def fetch_year(year: int) -> list[dict]:
    request = Request(CLOSURE.format(year), headers={"User-Agent": "LuumIA/2.0 (referencia municipal DGSIAP)"})
    with urlopen(request, timeout=20) as response:
        data = response.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError(f"El cierre {year} supera el tamaño previsto.")
    return summarize_year(year, data, datetime.now(UTC).isoformat(timespec="seconds"))


def without_retrieval_dates(catalog: dict) -> dict:
    return {**catalog, "records": [{k: v for k, v in record.items() if k != "retrieved_at"}
                                  for record in catalog["records"]]}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Vuelve a consultar el proveedor y comprueba los datos y huellas.")
    args = parser.parse_args()
    try:
        with ThreadPoolExecutor(max_workers=3) as pool:
            records = [record for annual_records in pool.map(fetch_year, YEARS) for record in annual_records]
    except (OSError, ValueError, InvalidOperation, csv.Error) as error:
        raise SystemExit(f"No se pudo preparar la referencia municipal de DGSIAP. {error}") from error

    if {row["year"] for row in records if row["crop_id"] == "maiz" and row["cycle"] == "spring_summer"} != set(YEARS):
        raise SystemExit("Falta al menos un cierre de maíz de temporal de primavera-verano en Hopelchén.")
    catalog = {
        "catalog_version": "dgsiap-2021-2025-v1",
        "publisher": "DGSIAP",
        "source_url": CATALOG,
        "municipality": "Hopelchén",
        "state": "Campeche",
        "state_code": "04",
        "municipality_code": "006",
        "year_start": YEARS.start,
        "year_end": YEARS.stop - 1,
        "records": records,
    }
    if args.check:
        previous = json.loads(OUTPUT.read_text(encoding="utf-8"))
        if without_retrieval_dates(catalog) != without_retrieval_dates(previous):
            raise SystemExit("El origen o los rendimientos difieren del catálogo precargado. Revise la publicación nueva.")
    else:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"DGSIAP. {len(records)} registros municipales verificados para Hopelchén, {YEARS.start}–{YEARS.stop - 1}.")


if __name__ == "__main__":
    main()
