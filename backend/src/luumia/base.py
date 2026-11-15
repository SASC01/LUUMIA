"""Datos regionales de POWER y reglas de rotación."""

from collections import defaultdict
from copy import deepcopy
from datetime import UTC, date, datetime, timedelta
from hashlib import sha256
from http.client import HTTPException
import json
from math import fsum, isfinite
from statistics import mean
from typing import Any, NamedTuple
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import urlopen


Json = dict[str, Any]
PARCEL_ID = "parcel-don-tino"
PRODUCER_ID = "producer-don-tino"
POWER_POINT = "https://power.larc.nasa.gov/api/temporal/daily/point"
POWER_CITATION = "https://power.larc.nasa.gov/docs/referencing/"
SALES_WINDOW = {"start": "2027-03-01", "end": "2027-03-31"}
REVIEW_DATE = "2026-11-14T15:30:00Z"
CROP_FAMILIES = {
    "maiz": "Poaceae", "frijol": "Fabaceae", "calabaza": "Cucurbitaceae",
    "saladette": "Solanaceae",
}
CROP_LABELS = {"maiz": "maíz", "frijol": "frijol", "calabaza": "calabaza", "saladette": "jitomate Saladette"}
PRIORITIES = {
    "nitrogen": 20, "erosion_cover": 20, "organic_matter": 15, "pest_break": 15,
    "water_fit": 20, "forage": 0, "market": 10,
}
CONSTRAINT_ORDER = ("crop_transition", "water_budget", "equipment_available", "market_available")
NEUTRAL_DIMENSIONS = {
    "nitrogen": "Faltan datos de suelo y manejo para comparar el aporte de nitrógeno.",
    "erosion_cover": "Faltan registros de cobertura por ciclo para comparar erosión.",
    "organic_matter": "Faltan análisis de materia orgánica y registros del manejo de residuos.",
    "forage": "Faltan datos de producción y aprovechamiento forrajero.",
    "market": "Faltan insumos comerciales comparables para todas las rotaciones elegibles.",
}


class BaseError(ValueError):
    """Entrada incompatible con los cálculos o con el caso de demostración."""


class WeatherVariable(NamedTuple):
    parameter: str
    provider_unit: str
    unit: str
    operation: str
    feature_name: str


WEATHER = {
    "precipitation": WeatherVariable("PRECTOTCORR", "mm/day", "mm", "sum", "weekly_precipitation_total"),
    "air_temperature_mean": WeatherVariable("T2M", "C", "degC", "mean", "weekly_air_temperature_mean"),
}


def _date(value: str | date) -> date:
    try:
        return value if isinstance(value, date) else date.fromisoformat(value)
    except (ValueError, TypeError) as error:
        raise BaseError("Usa fechas locales con formato AAAA-MM-DD.") from error


def _period(start: date, end: date) -> Json:
    return {"start": start.isoformat(), "end": end.isoformat()}


def _stable_id(prefix: str, material: Any) -> str:
    payload = json.dumps(material, ensure_ascii=False, sort_keys=True, separators=(",", ":"), default=str)
    return f"{prefix}-{sha256(payload.encode('utf-8')).hexdigest()[:24]}"


def _confidence(level: str, *reasons: str) -> Json:
    return {
        "level": level, "reasons": list(reasons), "spatial_resolution_m": None,
        "age_days": None, "source_agreement": "not_checked",
    }


def _source(id_: str, name: str, kind: str, product: str, version: str,
            url: str | None, time: str, note: str) -> Json:
    return {
        "id": id_, "name": name, "kind": kind, "product": product,
        "product_version": version, "url": url, "retrieved_at": time, "license_note": note,
    }


def _geometry() -> Json:
    west, east, south, north = -89.843, -89.840, 19.740, 19.7436
    ring = [[west, south], [east, south], [east, north], [west, north], [west, south]]
    return {"type": "Polygon", "coordinates": [ring]}


def collection_request() -> Json:
    return {
        "contract_version": "0.1.0", "parcel_id": PARCEL_ID, "geometry": _geometry(),
        "period": {"start": "2026-10-26", "end": "2026-11-01"},
        "variables": list(WEATHER),
    }


def _transition() -> Json:
    return {
        "id": "constraint-demo-transition", "kind": "crop_transition", "confirmed": True,
        "note": "Condición sintética del caso. La calabaza requiere maíz en el ciclo inmediato anterior.",
        "crop_id": "calabaza", "required_previous_crop_id": "maiz",
    }


def seed_context() -> Json:
    return {
        "contract_version": "0.2.0", "id": "context-don-tino", "context_version": 1,
        "cycle_id": "cycle-demo-current", "updated_at": REVIEW_DATE, "data_kind": "synthetic",
        "producer": {"id": PRODUCER_ID, "display_name": "Don Tino", "persona_kind": "composite_demo"},
        "parcel": {
            "id": PARCEL_ID, "name": "Parcela de Don Tino", "municipality": "Hopelchén",
            "state": "Campeche", "country": "MX", "timezone": "America/Mexico_City",
            "geometry": _geometry(), "geometry_kind": "synthetic", "declared_area_ha": 12,
            "area_note": "Las 12 ha son declaradas para la demo. El polígono es sintético.",
            "production_system": "rainfed",
        },
        "history": [
            {
                "id": f"cycle-demo-{number}", "sequence": number, "label": f"Ciclo previo {number}",
                "period": None, "crop_ids": ["maiz"], "arrangement": "single_crop",
                "data_kind": "synthetic", "note": "Registro narrativo de maíz. Fecha sin registrar.",
            }
            for number in range(1, 7)
        ],
        "priorities": dict(PRIORITIES), "constraints": [_transition()], "soil": [], "observations": [],
        "features": [], "field_observations": [], "evaluation": None, "decisions": [],
        "pending_questions": ["¿Cuándo fueron los seis ciclos?", "¿Qué mediciones de suelo tiene?"],
        "warnings": ["Caso de demostración. La identidad, el polígono y el historial son sintéticos."],
    }


def _candidate(id_: str, title: str, *crop_ids: str) -> Json:
    return {
        "id": id_, "label": title,
        "steps": [
            {"cycle_offset": offset, "crop_ids": [crop], "arrangement": "single_crop"}
            for offset, crop in enumerate(crop_ids, start=1)
        ],
    }


def demo_request() -> Json:
    buyer_source = _source(
        "comprador-demo", "Registro de comprador de la demo", "synthetic",
        "Respuesta comercial simulada", "1", None, REVIEW_DATE, "Registro sintético de LuumIA.",
    )
    return {
        "contract_version": "0.2.0", "parcel_id": PARCEL_ID, "context_version": 1,
        "horizon_cycles": 3, "priorities": dict(PRIORITIES), "scenario": None,
        "constraints": [
            _transition(),
            {
                "id": "demo-buyer", "kind": "market_available", "confirmed": True,
                "note": "Listado y rechazo sintéticos del comprador de la demo.",
                "crop_ids": ["maiz", "frijol", "calabaza"],
                "buyer_refusals": [{
                    "crop_id": "saladette", "cycle_offset": 1, "sales_period": dict(SALES_WINDOW),
                    "documented_at": REVIEW_DATE, "source": buyer_source, "data_kind": "synthetic",
                }],
            },
        ],
        "candidates": [
            _candidate("rotation-example-a", "Maíz → frijol → maíz", "maiz", "frijol", "maiz"),
            _candidate("rotation-example-b", "Maíz → calabaza → frijol", "maiz", "calabaza", "frijol"),
            _candidate("rotation-example-c", "Frijol → calabaza → maíz", "frijol", "calabaza", "maiz"),
            _candidate("rotation-saladette", "Jitomate Saladette → frijol → maíz", "saladette", "frijol", "maiz"),
        ],
        "commercial_scenarios": [],
    }


def _read_power(url: str) -> Json:
    try:
        with urlopen(url, timeout=12) as response:
            payload = json.load(response)
    except URLError as error:
        if isinstance(error.reason, TimeoutError):
            raise TimeoutError("NASA POWER tardó demasiado en responder.") from error
        raise ConnectionError("No se pudo consultar NASA POWER.") from error
    except TimeoutError:
        raise
    except (OSError, HTTPException, ValueError) as error:
        raise ConnectionError("NASA POWER devolvió una respuesta inutilizable.") from error
    if not isinstance(payload, dict):
        raise ConnectionError("El formato de respuesta de NASA POWER cambió.")
    return payload


def _finite(value: Any) -> bool:
    try:
        return type(value) in (int, float) and isfinite(value)
    except OverflowError:
        return False


def _query_point(geometry: Json) -> tuple[str, str]:
    rings = geometry.get("coordinates")
    if geometry.get("type") != "Polygon" or not isinstance(rings, list) or not rings:
        raise BaseError("La geometría debe ser un polígono GeoJSON con anillo exterior.")
    for ring in rings:
        valid_positions = isinstance(ring, list) and all(
            isinstance(position, list) and len(position) == 2
            and all(_finite(value) for value in position)
            and -180 <= position[0] <= 180 and -90 <= position[1] <= 90
            for position in ring
        )
        if not valid_positions or len(ring) < 4 or ring[0] != ring[-1]:
            raise BaseError("Cada anillo debe ser cerrado y tener coordenadas WGS84 válidas.")
        if len({tuple(position) for position in ring[:-1]}) < 3:
            raise BaseError("Cada anillo requiere al menos tres vértices distintos.")
        twice_area = sum(a[0] * b[1] - a[1] * b[0] for a, b in zip(ring, ring[1:]))
        if abs(twice_area) <= 1e-12:
            raise BaseError("Un anillo del polígono tiene un área igual a cero.")
    longitudes, latitudes = zip(*rings[0])
    lon = (max(longitudes) + min(longitudes)) / 2
    lat = (max(latitudes) + min(latitudes)) / 2
    return f"{lon:.6f}", f"{lat:.6f}"


def _observation(
    id_: str, parcel_id: str, variable: str, value: float | None, period: Json,
    source: Json, data_kind: str, reason: str | None,
) -> Json:
    spec = WEATHER[variable]
    message = "Los valores de NASA POWER describen condiciones regionales."
    return {
        "id": id_, "parcel_id": parcel_id, "variable": variable, "unit": spec.unit, "value": value,
        "status": "missing" if reason else "available", "missing_reason": reason, "period": period,
        "source": source, "data_kind": data_kind, "spatial_support": "regional",
        "aggregation": spec.operation, "confidence": _confidence("unknown" if reason else "low", reason or message),
    }


def collect(body: Json) -> Json:
    variables = list(dict.fromkeys(body["variables"]))
    if not variables or any(variable not in WEATHER for variable in variables):
        raise BaseError("Las variables disponibles son precipitation y air_temperature_mean.")
    start, end = (_date(body["period"][key]) for key in ("start", "end"))
    if start > end:
        raise BaseError("El inicio de la consulta debe preceder su fin.")
    point = _query_point(body["geometry"])
    query = urlencode({
        "longitude": point[0], "latitude": point[1], "community": "AG",
        "start": start.strftime("%Y%m%d"), "end": end.strftime("%Y%m%d"),
        "parameters": ",".join(WEATHER[item].parameter for item in variables),
        "format": "JSON", "time-standard": "LST",
    })
    url = f"{POWER_POINT}?{query}"
    payload = _read_power(url)
    timestamp = datetime.now(UTC).isoformat()
    try:
        header = payload["header"]
        version, names, fill = header["api"]["version"], header["sources"], header["fill_value"]
        values = payload["properties"]["parameter"]
        units = payload["parameters"]
        if header["time_standard"] != "LST" or not _finite(fill):
            raise ValueError("Convención horaria o valor de ausencia incompatible.")
        if not isinstance(version, str) or not version or not isinstance(names, list):
            raise ValueError("Metadatos de origen ausentes.")
        source_names = ", ".join(names) or "origen no declarado"
        for variable in variables:
            spec = WEATHER[variable]
            if units[spec.parameter]["units"] != spec.provider_unit or not isinstance(values[spec.parameter], dict):
                raise ValueError(f"Formato incompatible para {spec.parameter}.")
    except (KeyError, TypeError, ValueError) as error:
        raise ConnectionError("NASA POWER devolvió unidades o metadatos inesperados.") from error

    observations = []
    for variable in variables:
        parameter = WEATHER[variable].parameter
        source = _source(
            f"nasa-power-{parameter.lower()}", "NASA POWER", "nasa",
            f"Daily Point LST / {parameter} / {source_names}", version, url, timestamp,
            f"Atribución a NASA POWER. {POWER_CITATION}",
        )
        for offset in range((end - start).days + 1):
            day = start + timedelta(days=offset)
            number = values[parameter].get(day.strftime("%Y%m%d"))
            if number is not None and not _finite(number):
                raise ConnectionError(f"NASA POWER devolvió un valor no numérico para {day}.")
            missing = number is None or number == fill
            observations.append(_observation(
                _stable_id("power-day", [body["parcel_id"], point, variable, day]), body["parcel_id"],
                variable, None if missing else number, _period(day, day), source, "observed",
                "NASA POWER no publicó un valor para este día." if missing else None,
            ))
    return {
        "contract_version": "0.1.0", "request": body, "observations": observations,
        "warnings": ["NASA POWER Daily Point se consultó en el centro de la caja del polígono.",
                     "La serie es regional y las fechas están en hora solar local (LST)."],
    }


def _weather_spec(row: Json, kind: str) -> WeatherVariable:
    variable = row["variable"]
    spec = WEATHER.get(variable)
    source = row["source"]
    if (
        spec is None or row["unit"] != spec.unit or row["aggregation"] != spec.operation
        or row["data_kind"] != kind or row["spatial_support"] != "regional"
        or source["kind"] != "nasa" or source["name"] != "NASA POWER"
        or not isinstance(source.get("product"), str)
        or not source["product"].startswith(f"Daily Point LST / {spec.parameter} / ")
    ):
        raise BaseError(f"Observación incompatible con NASA POWER LST: {row['id']}.")
    value, missing = row["value"], row["missing_reason"]
    if row["status"] == "available" and (not _finite(value) or missing is not None):
        raise BaseError(f"El valor disponible de {row['id']} debe ser un número finito.")
    if variable == "precipitation" and value is not None and value < 0:
        raise BaseError(f"La precipitación de {row['id']} debe ser mayor o igual a cero.")
    if row["status"] == "missing" and (value is not None or not missing):
        raise BaseError(f"El valor ausente de {row['id']} requiere un motivo.")
    return spec


def harmonize(body: Json) -> list[Json]:
    rows = body["observations"]
    if not rows:
        return []
    request = body["request"]
    parcel = request["parcel_id"]
    start, end = (_date(request["period"][key]) for key in ("start", "end"))
    variables = set(request["variables"])
    if {row["variable"] for row in rows} != variables:
        raise BaseError("Las variables de la colección deben coincidir con las solicitadas.")
    weekly = defaultdict(dict)
    sources: dict[str, Json] = {}
    for row in rows:
        _weather_spec(row, "observed")
        variable = row["variable"]
        day = _date(row["period"]["start"])
        if row["parcel_id"] != parcel or _date(row["period"]["end"]) != day or not start <= day <= end:
            raise BaseError("Se esperaba un dato diario dentro del periodo y la parcela solicitados.")
        monday = day - timedelta(days=day.weekday())
        key = (variable, day)
        if key in weekly[monday]:
            raise BaseError(f"La colección repite {variable} para el {day}.")
        if sources.setdefault(variable, row["source"]) != row["source"]:
            raise BaseError(f"La serie {variable} contiene más de una procedencia.")
        weekly[monday][key] = row

    cells = []
    for monday, entries in sorted(weekly.items()):
        try:
            period = _period(monday, monday + timedelta(days=6))
        except OverflowError as error:
            raise BaseError("La semana está fuera del rango de fechas.") from error
        observations, counts = [], []
        for variable in sorted(variables):
            available = [
                row for (name, _day), row in sorted(entries.items())
                if name == variable and row["value"] is not None
            ]
            values = [row["value"] for row in available]
            counts.append(len(values))
            reason = None if len(values) == 7 else f"{variable}: {len(values)}/7 días disponibles."
            value = None
            if reason is None:
                try:
                    value = fsum(values) if WEATHER[variable].operation == "sum" else mean(values)
                except (OverflowError, ValueError) as error:
                    raise BaseError("El agregado semanal está fuera del rango numérico.") from error
            observation = _observation(
                _stable_id("power-week", [parcel, monday, variable]), parcel, variable, value,
                period, sources[variable], "derived", reason,
            )
            if any(row["confidence"]["level"] == "unknown" for row in available):
                observation["confidence"]["level"] = "unknown"
                observation["confidence"]["reasons"].append("Hay datos diarios con confianza desconocida.")
            observations.append(observation)
        cells.append({
            "parcel_id": parcel, "week": period, "observations": observations,
            "coverage_fraction": sum(counts) / (7 * len(variables)),
            "warnings": [*body["warnings"], *(row["missing_reason"] for row in observations if row["missing_reason"])],
        })
    return cells


def _feature(observation: Json, name: str, unit: str, value: float | None, method: str) -> Json:
    return {
        "id": _stable_id("power-feature", [observation["id"], name]),
        "parcel_id": observation["parcel_id"], "name": name, "value": value, "unit": unit,
        "status": observation["status"], "missing_reason": observation["missing_reason"],
        "period": observation["period"], "reference_period": None, "method": method,
        "method_version": "0.1.0", "confidence": observation["confidence"], "data_kind": "derived",
        "evidence": [{"kind": "observation", "id": observation["id"]}],
    }


def features(cells: list[Json]) -> list[Json]:
    output: list[Json] = []
    keys, ids = set(), set()
    for cell in cells:
        monday, sunday = (_date(cell["week"][key]) for key in ("start", "end"))
        if monday.weekday() != 0 or (sunday - monday).days != 6:
            raise BaseError("Cada celda debe cubrir una semana de lunes a domingo.")
        cell_key = cell["parcel_id"], monday
        if cell_key in keys:
            raise BaseError(f"Hay celdas duplicadas para la semana de {monday}.")
        keys.add(cell_key)
        variables = set()
        for row in cell["observations"]:
            spec = _weather_spec(row, "derived")
            variable = row["variable"]
            if row["period"] != cell["week"] or row["parcel_id"] != cell["parcel_id"]:
                raise BaseError("Hay un agregado cuya parcela o periodo no coincide con su celda.")
            if row["id"] in ids or variable in variables:
                raise BaseError("La evidencia semanal contiene una observación duplicada.")
            variables.add(variable)
            ids.add(row["id"])
            value = row["value"]
            output.append(_feature(row, spec.feature_name, spec.unit, value, "weekly_observation_value"))
            if variable == "precipitation":
                output.append(_feature(
                    row, "weekly_precipitation_daily_mean", "mm/day",
                    None if value is None else value / 7, "weekly_precipitation_divided_by_seven",
                ))
    return sorted(output, key=lambda row: (row["parcel_id"], _date(row["period"]["start"]), row["name"]))


def _check(
    rule: Json, outcome: str, explanation: str, tier: str | None = None,
    *, source: Json | None = None, documented_at: str | None = None,
) -> Json:
    result = {
        "constraint_id": rule["id"], "outcome": outcome, "explanation": explanation,
        "evidence_tier": tier, "evidence": [{"kind": "rule", "id": rule["id"]}],
    }
    if source is not None:
        result.update(source=source, documented_at=documented_at)
    return result


def _check_transition(rule: Json, candidate: Json, previous: list[str]) -> Json:
    required, target = rule["required_previous_crop_id"], rule["crop_id"]
    demo_source = _source(
        "transicion-demo", "Regla de transición de Don Tino", "synthetic",
        "Caso demostrativo de rotación", "2", None, REVIEW_DATE, "Ejemplo sintético de LuumIA.",
    ) if rule["id"] == "constraint-demo-transition" else None
    unknown = False
    for step in candidate["steps"]:
        if target in step["crop_ids"] and required not in previous:
            if not previous:
                unknown = True
            else:
                cycle = step["cycle_offset"]
                return _check(
                    rule, "fail", f"El ciclo {cycle} de {CROP_LABELS[target]} requiere "
                    f"{CROP_LABELS[required]} en el ciclo anterior.",
                    "simulated_assumption", source=demo_source, documented_at=REVIEW_DATE,
                )
        previous = step["crop_ids"]
    if unknown:
        return _check(rule, "needs_confirmation", "Falta registrar el ciclo anterior.", "simulated_assumption")
    return _check(rule, "pass", "Cada aparición cumple la transición del caso.", "simulated_assumption")


def _market_check(rule: Json, candidate: Json, request: Json, *, overlapping_windows: bool = False) -> Json:
    crop_cycles = {(
        crop, step["cycle_offset"],
    ) for step in candidate["steps"] for crop in step["crop_ids"]}
    windows = defaultdict(list)
    for scenario in request.get("commercial_scenarios", []):
        if scenario["candidate_id"] == candidate["id"]:
            windows[scenario["crop_id"], scenario["cycle_offset"]].append(scenario["sales_period"])
    missing_window = None
    for refusal in rule.get("buyer_refusals", []):
        scope = refusal["crop_id"], refusal["cycle_offset"]
        if scope not in crop_cycles:
            continue
        tier = "simulated_assumption" if refusal["data_kind"] == "synthetic" else "observed"
        crop = CROP_LABELS[refusal["crop_id"]]
        if not windows[scope] and missing_window is None:
            missing_window = _check(
                rule, "needs_confirmation",
                f"Falta la ventana de venta del ciclo {refusal['cycle_offset']} de {crop} para comprobar "
                "si aplica la negativa registrada del comprador.",
                tier, source=refusal["source"], documented_at=refusal["documented_at"],
            )
        period = refusal["sales_period"]
        overlaps = overlapping_windows and any(
            _date(window["start"]) <= _date(period["end"]) and _date(window["end"]) >= _date(period["start"])
            for window in windows[scope]
        )
        if period in windows[scope] or overlaps:
            source = refusal["source"]
            return _check(
                rule, "fail",
                f"El comprador rechazó {crop} para la ventana del {period['start']} al {period['end']}. "
                f"Fuente: {source['name']}, {str(refusal['documented_at'])[:10]}.",
                tier, source=source, documented_at=refusal["documented_at"],
            )
    if missing_window:
        return missing_window
    crops = {crop for crop, _cycle in crop_cycles}
    unconfirmed = sorted(crops.difference(rule["crop_ids"]))
    if unconfirmed:
        return _check(
            rule, "needs_confirmation",
            f"Falta confirmar salida con comprador para {', '.join(CROP_LABELS[crop] for crop in unconfirmed)}.",
        )
    return _check(rule, "pass", "Los cultivos están en el listado de venta del caso.", "simulated_assumption")


def _evaluate_rule(rule: Json, candidate: Json, history: list[str], request: Json) -> Json:
    kind = rule["kind"]
    if not rule["confirmed"]:
        return _check(rule, "needs_confirmation", "Falta confirmar la condición de la ficha.")
    if kind == "crop_transition":
        return _check_transition(rule, candidate, history)
    if kind == "market_available":
        return _market_check(rule, candidate, request)
    if kind == "water_budget":
        return _check(rule, "needs_confirmation", "Faltan la demanda hídrica por cultivo y el periodo comparable.")
    return _check(rule, "needs_confirmation", "Faltan requisitos de maquinaria por cultivo y operación.")


def next_crop_checks(crop_id: str, previous: list[str], rules: list[Json], sales_period: Json) -> list[Json]:
    """Aplica las restricciones de la ficha al cultivo y a la ventana del siguiente ciclo."""
    candidate = _candidate("next-cycle", CROP_LABELS[crop_id], crop_id)
    request = {"commercial_scenarios": [{"candidate_id": candidate["id"], "crop_id": crop_id,
                                         "cycle_offset": 1, "sales_period": sales_period}]}
    ordered = sorted(rules, key=lambda rule: (CONSTRAINT_ORDER.index(rule["kind"]), rule["id"]))
    return [
        _market_check(rule, candidate, request, overlapping_windows=True)
        if rule["kind"] == "market_available" and rule["confirmed"] else _evaluate_rule(rule, candidate, previous, request)
        for rule in ordered
    ]


def _catalog_check(request: Json, context: Json) -> None:
    crops = {crop for cycle in context["history"] for crop in cycle["crop_ids"]}
    for candidate in request["candidates"]:
        crops.update(crop for step in candidate["steps"] for crop in step["crop_ids"])
    for rule in request["constraints"]:
        crops.update(rule.get("crop_ids", []))
        crops.update(item["crop_id"] for item in rule.get("buyer_refusals", []))
        crops.update(rule[key] for key in ("crop_id", "required_previous_crop_id") if key in rule)
    outside = sorted(crops.difference(CROP_FAMILIES))
    if outside:
        raise BaseError(f"Cultivos fuera del catálogo: {', '.join(outside)}.")


def _reason(code: str, message: str, *refs: tuple[str, str]) -> Json:
    return {"code": code, "text": message, "evidence": [{"kind": kind, "id": ref} for kind, ref in refs]}


def _family_score(candidate: Json, previous: list[str]) -> tuple[float, Json]:
    if not previous:
        return 50, _reason("no_history", "Puntaje neutral de 50. Falta el ciclo previo.",
                           ("rule", "family-alternation-v1"))
    before = {CROP_FAMILIES[crop] for crop in previous}
    changes = 0
    for step in candidate["steps"]:
        after = {CROP_FAMILIES[crop] for crop in step["crop_ids"]}
        changes += before.isdisjoint(after)
        before = after
    horizon = len(candidate["steps"])
    reason = _reason(
        "family_alternation", f"{changes} de {horizon} transiciones cambian todas las familias del ciclo anterior.",
        ("rule", "family-alternation-v1"),
    )
    return 100 * changes / horizon, reason


def _dimensions(
    candidate: Json, previous: list[str], weekly: list[Json], priorities: Json,
    market: tuple[float, str] | None,
) -> list[Json]:
    scores = {
        key: (50, _reason("insufficient_evidence", f"Puntaje neutral de 50. {message}",
                          ("rule", "neutral-when-insufficient-v1")))
        for key, message in NEUTRAL_DIMENSIONS.items()
    }
    scores["pest_break"] = _family_score(candidate, previous)
    latest = max((_date(feature["period"]["start"]) for feature in weekly), default=None)
    recent = [feature for feature in weekly if _date(feature["period"]["start"]) == latest]
    refs = [("feature", feature["id"]) for feature in recent]
    summary = "Falta la semana regional de referencia."
    if recent:
        week = recent[0]["period"]
        summary = f"Semana regional del {week['start']} al {week['end']}."
    scores["water_fit"] = (50, _reason(
        "regional_water_context",
        f"Puntaje neutral de 50. {summary} Faltan demanda y agua disponible por ciclo.",
        ("rule", "regional-water-v1"), *refs,
    ))
    if market is not None:
        score, note = market
        scores["market"] = score, _reason("market_volume_coverage", note, ("rule", "market-low-cupo-v1"))
    total = sum(priorities.values())
    return [
        {
            "dimension": dimension, "score": scores[dimension][0], "weight": weight,
            "contribution": scores[dimension][0] * weight / total, "reasons": [scores[dimension][1]],
        }
        for dimension, weight in priorities.items()
    ]


def evaluate(
    request: Json, context: Json, features: list[Json], *,
    market_scores: dict[str, tuple[float, str]] | None = None,
    allow_missing_regional_evidence: bool = False,
) -> Json:
    parcel_id = context["parcel"]["id"]
    if request["parcel_id"] != parcel_id or request["context_version"] != context["context_version"]:
        raise BaseError("Parcela o versión de solicitud incompatible con la ficha.")
    if any(feature["parcel_id"] != parcel_id for feature in features):
        raise BaseError("La evaluación recibió evidencia semanal de otra parcela.")
    if not features and not allow_missing_regional_evidence:
        raise BaseError("Incluye al menos una celda semanal con observaciones de NASA POWER.")
    _catalog_check(request, context)
    previous = context["history"][-1]["crop_ids"] if context["history"] else []
    demo = context["producer"]["persona_kind"] == "composite_demo"
    confidence_reason = (
        "Las reglas de la demo combinan evidencia regional y supuestos." if demo
        else "La alternancia de familias se calcula con el último ciclo registrado. Los factores sin evidencia conservan el puntaje neutral."
    )
    rules = sorted(request["constraints"], key=lambda rule: (CONSTRAINT_ORDER.index(rule["kind"]), rule["id"]))
    recommendations, excluded = [], []
    for candidate in request["candidates"]:
        checks = [_evaluate_rule(rule, candidate, previous, request) for rule in rules]
        failures = [check for check in checks if check["outcome"] == "fail"]
        pending = [check for check in checks if check["outcome"] == "needs_confirmation"]
        if failures or pending:
            excluded.append({
                "candidate_id": candidate["id"], "checks": checks,
                "primary_constraint_id": (failures or pending)[0]["constraint_id"],
            })
            continue
        dimensions = _dimensions(
            candidate, previous, features, request["priorities"], (market_scores or {}).get(candidate["id"]),
        )
        recommendations.append({
            "candidate": candidate, "rank": 0,
            "total_score": min(100.0, fsum(item["contribution"] for item in dimensions)),
            "dimensions": dimensions, "constraint_checks": checks,
            "confidence": _confidence("low", confidence_reason),
        })

    recommendations.sort(key=lambda row: (-row["total_score"], row["candidate"]["id"]))
    for number, row in enumerate(recommendations, start=1):
        row["rank"] = number
    status = "computed"
    if not recommendations:
        status = "needs_confirmation" if any(
            all(check["outcome"] != "fail" for check in row["checks"]) for row in excluded
        ) else "no_viable_options"
    versions = ["0.2.0", "0.2.0", "0.2.0"]
    provenance = [
        {key: row["source"].get(key) for key in ("id", "product", "product_version", "url")}
        for row in sorted(context.get("observations", []), key=lambda observation: observation["id"])
    ]
    identity = [
        request, context["history"], features, provenance, context.get("field_observations", []),
        market_scores, versions,
    ]
    warnings = ["El puntaje neutral de 50 indica que falta evidencia para distinguir opciones."]
    if demo:
        warnings.append("El resultado corresponde a una ficha de demostración con historial sintético.")
    if not features:
        warnings.append("Sin datos regionales de NASA POWER para esta ficha. La aptitud hídrica conserva el puntaje neutral.")
    return {
        "contract_version": request.get("contract_version", "0.2.0"),
        "id": _stable_id("rotation-evaluation", identity), "parcel_id": parcel_id,
        "context_version": context["context_version"], "created_at": datetime.now(UTC).isoformat(),
        "engine_version": versions[0], "rules_version": versions[1], "catalog_version": versions[2],
        "request_snapshot": deepcopy(request), "data_kind": "synthetic" if context["data_kind"] == "synthetic" else "derived",
        "status": status, "horizon_cycles": request["horizon_cycles"], "scenario": request["scenario"],
        "recommendations": recommendations, "excluded": sorted(excluded, key=lambda row: row["candidate_id"]),
        "warnings": warnings,
        "commercial_results": [],
    }

