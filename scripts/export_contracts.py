"""Genera los contratos públicos de la API y el esquema de sus DTO."""

import argparse
import json
from pathlib import Path
import sys

from pydantic.json_schema import models_json_schema

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend" / "src"))


def export(check: bool):
    from luumia import cooperative_capacity, contracts, crop_cycles, crop_yield, cycle_plan, demo_p1, kobo, local_parcels, local_rotation, market, price_forecast, reference_cache, registered_area, sowing_plan, sowing_sales, usda_live, usda_reference, weatherlink
    from luumia.api import app

    modules = (cooperative_capacity, contracts, crop_cycles, crop_yield, cycle_plan, market, demo_p1, kobo, local_parcels, local_rotation, price_forecast, reference_cache, registered_area, sowing_plan, sowing_sales, usda_live, usda_reference, weatherlink)
    models = [(model, mode) for module in modules for model in vars(module).values()
              if isinstance(model, type) and issubclass(model, contracts.Contract)
              and model not in (contracts.Contract, contracts.LegacyObject)
              for mode in ("validation", "serialization")]
    _, schema = models_json_schema(list(dict.fromkeys(models)), title="Contratos LuumIA 0.2.0")
    schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
    schema["$id"] = "urn:luumia:contracts:0.2.0"
    files = {"openapi.json": app.openapi(), "schemas/luumia.schema.json": schema}
    stale = []
    for path, content in files.items():
        target = ROOT / "contracts" / path
        serialized = json.dumps(content, ensure_ascii=False, indent=2) + "\n"
        if check:
            if not target.exists() or target.read_text(encoding="utf-8") != serialized:
                stale.append(path)
        else:
            target.parent.mkdir(exist_ok=True, parents=True)
            target.write_text(serialized, encoding="utf-8")
    if stale:
        raise SystemExit("Contratos por regenerar: " + ", ".join(stale))
    print("Contratos de LuumIA sincronizados.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    export(parser.parse_args().check)
