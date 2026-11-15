"""Entradas HTTP del recorrido de LuumIA."""

from datetime import UTC, datetime
from pathlib import Path as FilePath
from typing import Annotated
from zoneinfo import ZoneInfo

from fastapi import FastAPI, Path, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from . import base
from .assistant import explain, project
from .commercial import ScenarioError
from .contracts import (
    AgriculturalCycle, ApiError, AssistantContext, CollectionRequest, CollectionResult, ContextSaveRequest, EvaluationInput,
    EvaluationRequest, EvaluationResponse, ExplanationRequest, ExplanationResponse, Feature, FieldObservationRequest, ParcelContext, WeeklyCell,
)
from .cooperative_capacity import router as cooperative_capacity_router
from .crop_cycles import router as crop_cycles_router
from .crop_yield import YieldReferenceResponse, YieldReferenceUnavailable, YieldScenarioError, yield_reference
from .cycle_plan import CyclePlan, CyclePlanRequest, ProducerCatalogUnavailable, compare_cycle, producer_forecasts
from .field import save_observation
from .demo_p1 import DemoP1, build_demo_p1
from .service import demo_request, prepare_evaluation, require_version, save_evaluation, seed
from .market import router as market_router
from .kobo import router as kobo_router
from .local_parcels import router as local_parcels_router
from .local_rotation import router as local_rotation_router
from .registered_area import router as registered_area_router
from .usda_reference import router as usda_router
from .storage import Conflict, NotFound, Repository, StorageError
from .sowing_plan import router as sowing_router
from .sowing_sales import router as sowing_sales_router
from .weatherlink import router as weatherlink_router

app = FastAPI(title="LuumIA · Mi parcela", version="0.2.0", description="Rotaciones y escenarios comerciales para temporal.")
app.include_router(market_router)
app.include_router(usda_router)
app.include_router(kobo_router)
app.include_router(weatherlink_router)
app.include_router(sowing_router)
app.include_router(sowing_sales_router)
app.include_router(cooperative_capacity_router)
app.include_router(registered_area_router)
app.include_router(local_parcels_router)
app.include_router(crop_cycles_router)
app.include_router(local_rotation_router)
READ_ERRORS = {404: {"model": ApiError}, 503: {"model": ApiError}}
WRITE_ERRORS = {**READ_ERRORS, 409: {"model": ApiError}, 422: {"model": ApiError}, 501: {"model": ApiError}}


def error(status: int, code: str, message: str, module: str = "LuumIA") -> JSONResponse:
    return JSONResponse(status_code=status, content=ApiError(code=code, message=message, module=module).model_dump())


@app.exception_handler(RequestValidationError)
async def invalid_request(_request, exc):
    first = exc.errors()[0]
    location = ".".join(str(part) for part in first["loc"] if part != "body")
    message = first["msg"].removeprefix("Value error, ")
    return error(422, "validation_error", f"{location} — {message}" if location else message)


@app.exception_handler(base.BaseError)
@app.exception_handler(ScenarioError)
@app.exception_handler(YieldScenarioError)
async def invalid_calculation(_request, exc):
    return error(422, "validation_error", str(exc))


@app.exception_handler(NotFound)
async def not_found(_request, exc):
    return error(404, "not_found", str(exc))


@app.exception_handler(Conflict)
async def conflict(_request, exc):
    return error(409, "version_conflict", str(exc), "M4")


@app.exception_handler(StorageError)
async def unavailable(_request, exc):
    return error(503, "storage_unavailable", str(exc), "M4")


@app.exception_handler(YieldReferenceUnavailable)
async def yield_unavailable(_request, exc):
    return error(503, "yield_reference_unavailable", str(exc), "DGSIAP")


@app.get("/v1/yield-references/{crop_id}", response_model=YieldReferenceResponse,
         responses={status: {"model": ApiError} for status in (404, 422, 503)}, tags=["Referencias externas"])
def municipal_yield_reference(crop_id: str, cycle: Annotated[AgriculturalCycle, Query()]):
    """Consulta los cierres de temporal de Hopelchén por cultivo y ciclo agrícola."""
    if crop_id not in base.CROP_FAMILIES:
        raise NotFound("El cultivo solicitado no pertenece al catálogo de LuumIA.")
    return yield_reference(crop_id, cycle)


@app.get("/health")
def health():
    return {"status": "ok", "product": "LuumIA", "contract_version": "0.2.0", "engine_ready": True}


@app.get("/demo/don-tino/context", response_model=ParcelContext)
def fixture_context():
    return seed()


@app.get("/demo/don-tino/collection-request", response_model=CollectionRequest)
def fixture_collection():
    return base.collection_request()


@app.get("/demo/don-tino/power-snapshot", response_model=CollectionResult, responses=READ_ERRORS)
def power_snapshot():
    path = FilePath(__file__).resolve().parents[3] / "data/processed/power/don-tino-week.json"
    if not path.is_file():
        raise NotFound("El respaldo de NASA POWER no está disponible.")
    snapshot = CollectionResult.model_validate_json(path.read_text(encoding="utf-8"))
    snapshot.warnings.append("NASA POWER · respaldo de la semana de demostración, con fecha de descarga original.")
    return snapshot


@app.get("/demo/don-tino/evaluation-request", response_model=EvaluationRequest)
def fixture_evaluation():
    return demo_request()


@app.get("/demo/don-tino/p1", response_model=DemoP1)
def demo_p1():
    return build_demo_p1()


@app.post("/v1/collections", response_model=CollectionResult,
          responses={status: {"model": ApiError} for status in (422, 502, 504)})
def collect(request: CollectionRequest):
    try:
        return base.collect(request.model_dump(mode="json"))
    except TimeoutError:
        return error(504, "source_timeout", "NASA POWER tardó demasiado en responder.", "M1")
    except ConnectionError as exc:
        return error(502, "source_unavailable", str(exc), "M1")


@app.post("/v1/harmonizations", response_model=list[WeeklyCell], responses={422: {"model": ApiError}})
def harmonize(body: CollectionResult):
    return base.harmonize(body.model_dump(mode="json"))


@app.post("/v1/features", response_model=list[Feature], responses={422: {"model": ApiError}})
def features(cells: list[WeeklyCell]):
    return base.features([cell.model_dump(mode="json") for cell in cells])


@app.post("/v1/evaluations", response_model=EvaluationResponse, responses=WRITE_ERRORS)
def evaluate(body: EvaluationInput):
    request = body.request
    if request.scenario is not None:
        return error(501, "not_implemented", "El escenario climático se encuentra en el roadmap.", "M3")
    if request.contract_version == "0.1.0":
        if request.parcel_id != base.PARCEL_ID:
            raise NotFound("El caso de demostración corresponde a Don Tino.")
        current = seed()
    else:
        current = Repository().get(request.parcel_id)
    require_version(current, request.context_version)
    if current.evaluation_state == "pendiente_de_recalculo":
        raise Conflict("La ficha está pendiente de recálculo. Use la operación de guardado para recalcularla.")
    return prepare_evaluation(current, request, body.weekly_cells).evaluation


@app.get("/v1/contexts/{parcel_id}", response_model=ParcelContext, responses=READ_ERRORS)
def current_context(parcel_id: str):
    return Repository().get(parcel_id)


@app.post("/v1/contexts/{parcel_id}/cycle-plan", response_model=CyclePlan, responses=WRITE_ERRORS,
          tags=["Planeación del siguiente ciclo"])
def plan_cycle(parcel_id: str, body: CyclePlanRequest):
    context = Repository().get(parcel_id)
    require_version(context, body.context_version)
    if context.evaluation_state != "vigente" or not context.evaluation:
        raise Conflict("Recalcula la ficha para comparar el siguiente ciclo.")
    as_of = datetime.now(UTC).astimezone(ZoneInfo("America/Mexico_City")).date()
    try:
        forecasts = producer_forecasts(as_of)
    except ProducerCatalogUnavailable as exc:
        return error(503, "producer_prices_unavailable", str(exc), "Precios al productor")
    return compare_cycle(context, body, as_of, forecasts)


@app.get("/v1/contexts/{parcel_id}/versions/{version}", response_model=ParcelContext, responses=READ_ERRORS)
def historical_context(parcel_id: str, version: Annotated[int, Path(ge=1)]):
    return Repository().get(parcel_id, version)


@app.get("/demo/don-tino/assistant-context", response_model=AssistantContext)
def fixture_assistant():
    return project(seed())


@app.post("/v1/contexts/{parcel_id}/explanations", response_model=ExplanationResponse, responses=WRITE_ERRORS)
def explanation(parcel_id: str, body: ExplanationRequest):
    context = Repository().get(parcel_id)
    require_version(context, body.context_version)
    return explain(project(context, body), body.question_es)


@app.post("/v1/contexts/{parcel_id}/versions", response_model=ParcelContext, status_code=201,
          responses=WRITE_ERRORS)
def create_context(parcel_id: str, body: ContextSaveRequest):
    if parcel_id != body.request.parcel_id:
        raise base.BaseError("La parcela de la ruta debe coincidir con la de la solicitud.")
    if body.request.scenario is not None:
        return error(501, "not_implemented", "El escenario climático se encuentra en el roadmap.", "M3")
    return save_evaluation(Repository(), body)


@app.post("/v1/field-observations", response_model=ParcelContext, status_code=201,
          responses={status: {"model": ApiError} for status in (404, 409, 422, 503)})
def local_observation(body: FieldObservationRequest):
    return save_observation(Repository(), body)


@app.post("/v1/decisions", responses={501: {"model": ApiError}})
def decisions():
    return error(501, "not_implemented", "El registro de decisiones se encuentra en el roadmap.", "M4")
