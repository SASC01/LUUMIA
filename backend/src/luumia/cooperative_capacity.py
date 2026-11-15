"""Gestiona cupos documentados de cooperativa en una ficha versionada."""

from datetime import UTC, date, datetime, time
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Response
from pydantic import AnyUrl, Field, StringConstraints, UrlConstraints, model_validator

from . import base
from .contracts import (
    ApiError, CapacityChangeReason, ConfirmedCapacity, Contract, CooperativeCapacityHistoryEntry,
    Identifier, Kg, ParcelContext, Period, PriorCommercialRef, Source,
)
from .evidence import build_evidence
from .service import require_version
from .sowing_plan import CAMPECHE_TIME_ZONE, PRODUCER_CROPS, planning_context
from .storage import Conflict, NotFound, Repository


class CooperativeCapacityRegistration(Contract):
    expected_context_version: Annotated[int, Field(ge=1)]
    crop_id: PRODUCER_CROPS
    sales_period: Period
    cupo_range: tuple[Kg, Kg]
    confirmed_on: date
    source_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=180)]
    source_url: Annotated[AnyUrl, UrlConstraints(allowed_schemes=["https"], max_length=2048, host_required=True)] | None = None

    @model_validator(mode="after")
    def check_confirmation(self):
        if self.cupo_range[0] > self.cupo_range[1]:
            raise ValueError("El cupo mínimo debe ser menor o igual al máximo.")
        if self.confirmed_on > self.sales_period.end:
            raise ValueError("La fecha de confirmación debe ser anterior o igual al último día de entrega.")
        if self.source_url and (self.source_url.username is not None or self.source_url.password is not None):
            raise ValueError("El enlace de la fuente debe estar libre de credenciales.")
        return self


class CooperativeCapacityCorrection(CooperativeCapacityRegistration):
    reason: CapacityChangeReason | None = None


class CooperativeCapacityCancellation(Contract):
    expected_context_version: Annotated[int, Field(ge=1)]
    reason: CapacityChangeReason | None = None


def _same_capacity(item: ConfirmedCapacity, capacity: ConfirmedCapacity) -> bool:
    return (
        item.sales_structure == capacity.sales_structure
        and item.cycle_offset == capacity.cycle_offset
        and item.crop_id == capacity.crop_id
        and item.sales_period == capacity.sales_period
        and item.cupo_range == capacity.cupo_range
        and item.confirmed_at.astimezone(CAMPECHE_TIME_ZONE).date() == capacity.confirmed_at.astimezone(CAMPECHE_TIME_ZONE).date()
        and item.source.name == capacity.source.name
        and item.source.url == capacity.source.url
    )


def _already_registered(context: ParcelContext, capacity: ConfirmedCapacity) -> bool:
    return any(_same_capacity(item, capacity) for item in context.confirmed_purchase_capacities)


def _new_capacity(body: CooperativeCapacityRegistration, now: datetime, *, cycle_offset: int = 1) -> ConfirmedCapacity:
    if body.confirmed_on > now.astimezone(CAMPECHE_TIME_ZONE).date():
        raise base.BaseError("La fecha de confirmación no puede estar en el futuro.")
    suffix = uuid4().hex
    return ConfirmedCapacity(
        id=f"cooperative-{suffix}",
        crop_id=body.crop_id,
        cycle_offset=cycle_offset,
        sales_period=body.sales_period,
        sales_structure="cooperative",
        cupo_range=body.cupo_range,
        confirmed_at=datetime.combine(body.confirmed_on, time.min, CAMPECHE_TIME_ZONE),
        source=Source(
            id=f"cooperative-source-{suffix}",
            name=body.source_name,
            kind="cooperative_document",
            retrieved_at=now,
            url=str(body.source_url) if body.source_url else None,
        ),
    )

def _capacity_context(
    current: ParcelContext, capacities: list[ConfirmedCapacity], now: datetime, message: str,
    event: CooperativeCapacityHistoryEntry | None = None,
) -> ParcelContext:
    previous = current.evaluation
    prior = current.prior_commercial
    if previous and previous.commercial_results:
        prior = PriorCommercialRef(
            context_version=current.context_version,
            evaluation_id=previous.id,
            scenario_ids=[result.scenario_id for result in previous.commercial_results],
        )
    history = current.cooperative_capacity_history
    pending = ParcelContext.model_validate({
        **current.model_dump(),
        "contract_version": "0.2.0",
        "context_version": current.context_version + 1,
        "updated_at": now,
        "confirmed_purchase_capacities": capacities,
        "cooperative_capacity_history": [*history, event] if event else history,
        "evaluation_state": "pendiente_de_recalculo" if previous else current.evaluation_state,
        "evaluation": None,
        "recalculation_reason": (
            f"{message} La evaluación anterior sigue disponible en el historial." if previous else current.recalculation_reason
        ),
        "prior_commercial": prior,
        "last_evaluation_version": current.context_version if previous else current.last_evaluation_version,
    })
    return pending.model_copy(update={"evidence_blocks": build_evidence(pending)})


def register_capacity(repository: Repository, parcel_id: str, body: CooperativeCapacityRegistration) -> tuple[ParcelContext, bool]:
    current = planning_context(repository, parcel_id)
    now = datetime.now(UTC)
    capacity = _new_capacity(body, now)
    if _already_registered(current, capacity):
        return current, False
    require_version(current, body.expected_context_version)

    pending = _capacity_context(current, [*current.confirmed_purchase_capacities, capacity],
                                now, "Se registró un cupo de cooperativa.")
    try:
        return repository.save(pending, body.expected_context_version), True
    except Conflict:
        latest = planning_context(repository, parcel_id)
        if _already_registered(latest, capacity):
            return latest, False
        raise


def _recorded_change(context: ParcelContext, capacity_id: str) -> CooperativeCapacityHistoryEntry | None:
    return next((event for event in context.cooperative_capacity_history if event.previous.id == capacity_id), None)


def _same_change(
    recorded: CooperativeCapacityHistoryEntry | None, replacement: ConfirmedCapacity | None, reason: str | None,
) -> bool:
    if recorded is None or recorded.reason != reason:
        return False
    if replacement is None:
        return recorded.action == "cancelled"
    return recorded.replacement is not None and _same_capacity(recorded.replacement, replacement)


def change_capacity(
    repository: Repository, parcel_id: str, capacity_id: str,
    body: CooperativeCapacityCorrection | CooperativeCapacityCancellation,
) -> ParcelContext:
    current = planning_context(repository, parcel_id)
    recorded = _recorded_change(current, capacity_id)
    previous = recorded.previous if recorded else next((item for item in current.confirmed_purchase_capacities
        if item.id == capacity_id and item.sales_structure == "cooperative"), None)
    now = datetime.now(UTC)
    replacement = (_new_capacity(body, now, cycle_offset=previous.cycle_offset)
                   if previous and isinstance(body, CooperativeCapacityCorrection) else None)
    reason = body.reason or None
    if _same_change(recorded, replacement, reason):
        return current
    require_version(current, body.expected_context_version)
    if recorded:
        raise Conflict("El cupo ya se corrigió o se canceló. Consulta su historial.")
    if previous is None:
        raise NotFound("No se encontró un cupo vigente de la cooperativa en esta ficha.")
    if replacement and _same_capacity(previous, replacement):
        raise base.BaseError("Modifica al menos un dato del cupo antes de guardar la corrección.")
    if replacement and _already_registered(current, replacement):
        raise base.BaseError("Ya existe otro cupo vigente con estos datos.")

    capacities = [item for item in current.confirmed_purchase_capacities if item.id != capacity_id]
    if replacement:
        capacities.append(replacement)
    event = CooperativeCapacityHistoryEntry(
        action="corrected" if replacement else "cancelled", previous=previous,
        replacement=replacement, recorded_at=now, context_version=current.context_version + 1, reason=reason,
    )
    message = "Se corrigió un cupo de cooperativa." if replacement else "Se canceló un cupo de cooperativa."
    pending = _capacity_context(current, capacities, now, message, event)
    try:
        return repository.save(pending, body.expected_context_version)
    except Conflict:
        latest = planning_context(repository, parcel_id)
        if _same_change(_recorded_change(latest, capacity_id), replacement, reason):
            return latest
        raise


router = APIRouter(prefix="/v1/contexts/{parcel_id}", tags=["Cooperativa"])
_WRITE_ERRORS = {status: {"model": ApiError} for status in (404, 409, 422, 503)}


@router.post(
    "/cooperative-capacities", response_model=ParcelContext, status_code=201,
    responses={
        200: {"model": ParcelContext, "description": "El cupo ya estaba registrado."},
        **_WRITE_ERRORS,
    },
)
def create_cooperative_capacity(parcel_id: str, body: CooperativeCapacityRegistration, response: Response):
    context, created = register_capacity(Repository(), parcel_id, body)
    if not created:
        response.status_code = 200
    return context


@router.put("/cooperative-capacities/{capacity_id}", response_model=ParcelContext, responses=_WRITE_ERRORS)
def correct_cooperative_capacity(parcel_id: str, capacity_id: Identifier, body: CooperativeCapacityCorrection):
    return change_capacity(Repository(), parcel_id, capacity_id, body)


@router.post("/cooperative-capacities/{capacity_id}/cancel", response_model=ParcelContext, responses=_WRITE_ERRORS)
def cancel_cooperative_capacity(parcel_id: str, capacity_id: Identifier, body: CooperativeCapacityCancellation):
    return change_capacity(Repository(), parcel_id, capacity_id, body)
