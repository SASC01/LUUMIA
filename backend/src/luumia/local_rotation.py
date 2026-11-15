"""Compara cultivos del siguiente ciclo con el historial de la parcela propia."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter
from pydantic import Field

from . import base
from .contracts import ApiError, Candidate, Contract, EvaluationRequest, EvaluationResponse, ParcelContext, RotationStep
from .evidence import build_evidence
from .service import require_version
from .sowing_plan import planning_context
from .storage import NotFound, Repository


def evaluate_local_rotation(context: ParcelContext) -> ParcelContext:
    if context.producer.persona_kind != "real":
        raise base.BaseError("La evaluación de historial corresponde a una parcela propia.")
    history = [cycle for cycle in context.history if cycle.data_kind == "observed" and cycle.period is not None]
    if not history:
        raise base.BaseError("Registra un ciclo de cultivo con fechas para comparar opciones.")

    candidates = [
        Candidate(id=f"rotation-next-{crop}", label=label[0].upper() + label[1:],
                  steps=[RotationStep(cycle_offset=1, crop_ids=[crop], arrangement="single_crop")])
        for crop, label in base.CROP_LABELS.items()
    ]
    request = EvaluationRequest(
        parcel_id=context.parcel.id, context_version=context.context_version, horizon_cycles=1,
        priorities=context.priorities, candidates=candidates, constraints=context.constraints,
    )
    # El motor recibe únicamente evidencia de la ficha propia. Los factores sin datos conservan su valor neutral.
    data = context.model_dump(mode="json")
    data["history"] = [cycle.model_dump(mode="json") for cycle in history]
    features = [row for row in data["features"] if row["data_kind"] != "synthetic"]
    result = EvaluationResponse.model_validate(base.evaluate(
        request.model_dump(mode="json"), data, features, allow_missing_regional_evidence=True,
    ))
    evaluated = context.model_copy(update={
        "evaluation": result, "evaluation_state": "vigente", "recalculation_reason": None,
        "prior_commercial": None, "last_evaluation_version": None,
    })
    return evaluated.model_copy(update={"evidence_blocks": build_evidence(evaluated)})


class LocalRotationRefresh(Contract):
    expected_context_version: Annotated[int, Field(ge=1)]


router = APIRouter(prefix="/v1/contexts/{parcel_id}", tags=["Rotación de parcelas propias"])


@router.post("/crop-rotation", response_model=ParcelContext,
             responses={status: {"model": ApiError} for status in (404, 409, 422, 503)})
def refresh_local_rotation(parcel_id: str, request: LocalRotationRefresh) -> ParcelContext:
    if not parcel_id.startswith("parcel-local-"):
        raise NotFound("La evaluación de historial corresponde a una parcela propia.")
    repository = Repository()
    context = planning_context(repository, parcel_id)
    require_version(context, request.expected_context_version)
    if context.evaluation_state == "vigente":
        return context
    staged = context.model_copy(update={"context_version": context.context_version + 1, "updated_at": datetime.now(UTC)})
    return repository.save(evaluate_local_rotation(staged), context.context_version)
