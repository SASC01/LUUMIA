"""Cambio de superficie declarada con historial de la ficha."""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter
from pydantic import Field

from .contracts import ApiError, Contract, ParcelContext, PriorCommercialRef, RegisteredAreaChange
from .evidence import build_evidence
from .service import require_version
from .sowing_plan import PlanArea, planning_context
from .storage import Conflict, Repository


class ParcelAreaUpdate(Contract):
    expected_context_version: Annotated[int, Field(ge=1)]
    declared_area_ha: PlanArea


def _declared_area(context: ParcelContext) -> Decimal:
    return Decimal(str(context.parcel.declared_area_ha))


def update_registered_area(repository: Repository, parcel_id: str, update: ParcelAreaUpdate) -> ParcelContext:
    current = planning_context(repository, parcel_id)
    expected = update.expected_context_version
    area = update.declared_area_ha
    previous_area = _declared_area(current)
    if previous_area == area and expected <= current.context_version:
        return current
    require_version(current, expected)

    now = datetime.now(UTC)
    next_version = current.context_version + 1
    change = RegisteredAreaChange(context_version=next_version, previous_area_ha=previous_area,
                                  declared_area_ha=area, recorded_at=now)
    previous_evaluation = current.evaluation
    prior = current.prior_commercial
    if previous_evaluation and previous_evaluation.commercial_results:
        prior = PriorCommercialRef(context_version=current.context_version, evaluation_id=previous_evaluation.id,
                                   scenario_ids=[result.scenario_id for result in previous_evaluation.commercial_results])

    data = current.model_dump()
    data["parcel"]["declared_area_ha"] = float(area)
    data.update(
        contract_version="0.2.0", context_version=next_version, updated_at=now, evaluation=None,
        evaluation_state="pendiente_de_recalculo" if previous_evaluation else current.evaluation_state,
        recalculation_reason=("Se actualizó la superficie declarada. La evaluación anterior sigue disponible en el historial."
                              if previous_evaluation else current.recalculation_reason),
        prior_commercial=prior,
        last_evaluation_version=current.context_version if previous_evaluation else current.last_evaluation_version,
        registered_area_history=[*current.registered_area_history, change],
    )
    pending = ParcelContext.model_validate(data)
    pending = pending.model_copy(update={"evidence_blocks": build_evidence(pending)})
    try:
        return repository.save(pending, expected)
    except Conflict:
        latest = planning_context(repository, parcel_id)
        if _declared_area(latest) != area:
            raise
        return latest


router = APIRouter(prefix="/v1/contexts/{parcel_id}", tags=["Superficie de la parcela"])


@router.put("/registered-area", response_model=ParcelContext,
            responses={status: {"model": ApiError} for status in (404, 409, 422, 503)})
def put_registered_area(parcel_id: str, body: ParcelAreaUpdate) -> ParcelContext:
    return update_registered_area(Repository(), parcel_id, body)
