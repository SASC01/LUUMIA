"""Orquestación de evaluación y escritura de una nueva ficha."""

from math import isclose
from urllib.parse import parse_qs, urlsplit

from . import base
from .commercial import calculate_all, comparable_scores
from .contracts import ContextSaveRequest, EvaluationRequest, ParcelContext, WeeklyCell
from .evidence import build_evidence
from .field import compare_rain
from .storage import Conflict, Repository


def seed() -> ParcelContext:
    context = ParcelContext.model_validate(base.seed_context())
    return context.model_copy(update={"evidence_blocks": build_evidence(context)})


def demo_request() -> EvaluationRequest:
    demo = base.demo_request()
    shared = {
        "cycle_offset": 1, "sales_period": base.SALES_WINDOW, "sales_structure": "spot",
        "cupo_range": [6000, 12000], "superficie_ha": "12", "precio_productor_mxn_kg": "10",
        "rendimiento_esperado_t_ha": "1", "merma_fraccion": "0",
        "costos_produccion_mxn": "60000", "costos_empaque_mxn": "8000",
        "costos_transporte_mxn": "9000", "costos_venta_mxn": "3000",
        "supuestos": ["Precio al productor, rendimiento, costos y cupo hipotéticos de la demo."],
    }
    demo["commercial_scenarios"] = [
        dict(shared, id="scenario-maiz", candidate_id="rotation-example-a", crop_id="maiz"),
        dict(shared, id="scenario-saladette", candidate_id="rotation-saladette", crop_id="saladette"),
    ]
    return EvaluationRequest.model_validate(demo)


def prepare_evaluation(
    context: ParcelContext, request: EvaluationRequest, cells: list[WeeklyCell],
) -> ParcelContext:
    if not cells or any(cell.parcel_id != request.parcel_id for cell in cells):
        raise base.BaseError("Envíe las celdas semanales de NASA POWER correspondientes a la parcela.")
    if request.contract_version == "0.2.0":
        verify_power_point(context, cells)
    rows = [cell.model_dump(mode="json") for cell in cells]
    calculated_features = base.features(rows)
    if not calculated_features:
        raise base.BaseError("La evidencia semanal no contiene variables de NASA POWER utilizables.")
    prepared = context.model_dump(mode="json")
    prepared.update(
        context_version=request.context_version, contract_version=request.contract_version,
        priorities=request.priorities.model_dump(), constraints=request.model_dump(mode="json")["constraints"],
        features=calculated_features,
        observations=[item for cell in rows for item in cell["observations"]],
        warnings=list(dict.fromkeys(warning for cell in rows for warning in cell["warnings"])),
        evaluation=None, weekly_cells=rows, evaluation_state=None, prior_commercial=None,
        recalculation_reason=None, last_evaluation_version=None,
    )
    results = calculate_all(request, context)
    # Los campos opcionales ausentes conservan la identidad de los cálculos anteriores.
    new_fields = ("precio_volumen", "agricultural_cycle", "yield_assumption")
    omitted_fields = {index: {field for field in new_fields if getattr(scenario, field) is None}
                      for index, scenario in enumerate(request.commercial_scenarios)}
    snapshot = request.model_dump(mode="json", exclude={"commercial_scenarios": omitted_fields})
    evaluation = base.evaluate(snapshot, prepared, calculated_features)
    eligible = {row["candidate"]["id"] for row in evaluation["recommendations"]}
    scores = comparable_scores(request, eligible, results)
    if scores:
        evaluation = base.evaluate(snapshot, prepared, calculated_features, market_scores=scores)
    evaluation.update(contract_version=request.contract_version, commercial_results=list(results.values()))
    prepared.update(evaluation=evaluation, evaluation_state="vigente", updated_at=evaluation["created_at"],
                    warnings=evaluation["warnings"])
    evaluated = ParcelContext.model_validate(prepared)
    return evaluated.model_copy(update={"evidence_blocks": build_evidence(evaluated),
                                        "rain_comparison": compare_rain(evaluated)})


def verify_power_point(context: ParcelContext, cells: list[WeeklyCell]) -> None:
    if context.parcel.geometry_kind == "unavailable":
        raise base.BaseError("La ficha requiere un polígono para asociar datos de NASA POWER.")
    outer_ring = context.parcel.geometry["coordinates"][0]
    lon, lat = zip(*outer_ring)
    expected = ((min(lon) + max(lon)) / 2, (min(lat) + max(lat)) / 2)
    for cell in cells:
        for item in cell.observations:
            try:
                source = urlsplit(item.source.url or "")
                query = parse_qs(source.query)
                actual = (float(query["longitude"][0]), float(query["latitude"][0]))
                if source.hostname == "power.larc.nasa.gov" and all(
                    isclose(given, target, rel_tol=0, abs_tol=0.000001) for given, target in zip(actual, expected)
                ):
                    continue
            except (ValueError, KeyError, IndexError):
                pass
            raise base.BaseError("La ubicación en la fuente POWER no coincide con la geometría guardada de la parcela.")


def require_version(context: ParcelContext, expected: int) -> None:
    if context.context_version != expected:
        raise Conflict(f"La versión vigente de la ficha es {context.context_version}.")


def save_evaluation(repository: Repository, body: ContextSaveRequest) -> ParcelContext:
    current = repository.get(body.request.parcel_id)
    expected = body.expected_context_version
    require_version(current, expected)
    request = body.request.model_copy(update={"context_version": expected + 1, "contract_version": "0.2.0"})
    return repository.save(prepare_evaluation(current, request, body.weekly_cells), expected)
