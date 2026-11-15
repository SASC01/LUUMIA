"""Registro de ciclos observados en la ficha versionada de una parcela."""

from datetime import UTC, date, datetime
from typing import Literal
from uuid import UUID, uuid4

from fastapi import APIRouter

from .base import BaseError
from .contracts import ApiError, Contract, CropCycle, CropCycleChange, CropCycleChangeReason, Identifier, ParcelContext, Period
from .evidence import build_evidence
from .local_rotation import evaluate_local_rotation
from .service import require_version
from .sowing_plan import CAMPECHE_TIME_ZONE, PRODUCER_CROPS, ContextVersion, planning_context
from .storage import Conflict, NotFound, Repository


class CropCycleRegistration(Contract):
    expected_context_version: ContextVersion
    kind: Literal["current", "previous"]
    crop_id: PRODUCER_CROPS
    start: date
    end: date


class CropCycleVoid(Contract):
    expected_context_version: ContextVersion
    change_id: UUID
    reason: CropCycleChangeReason | None = None


class CropCycleCorrection(CropCycleVoid):
    crop_id: PRODUCER_CROPS
    start: date
    end: date


def _parcel_for_crops(repository: Repository, parcel_id: str) -> ParcelContext:
    if not parcel_id.startswith("parcel-local-"):
        raise NotFound("El registro de cultivos está disponible en las parcelas propias.")
    return planning_context(repository, parcel_id)


def _crop_period(start: date, end: date) -> Period:
    if start > end:
        raise BaseError("La fecha de fin debe ser igual o posterior a la fecha de inicio.")
    return Period(start=start, end=end)


def _ordered_cycles(cycles: list[CropCycle]) -> list[CropCycle]:
    ordered = sorted(cycles, key=lambda cycle: (cycle.period.start if cycle.period else date.min, cycle.sequence))
    return [cycle.model_copy(update={"sequence": index}) for index, cycle in enumerate(ordered, start=1)]


def _updated_ficha(
    current: ParcelContext, history: list[CropCycle], now: datetime, event: CropCycleChange | None = None,
) -> ParcelContext:
    staged = current.model_copy(update={
        "contract_version": "0.2.0",
        "context_version": current.context_version + 1,
        "updated_at": now,
        "history": history,
        "crop_cycle_history": [*current.crop_cycle_history, event] if event else current.crop_cycle_history,
        "evaluation": None,
        "evaluation_state": None,
        "recalculation_reason": None,
        "prior_commercial": None,
        "last_evaluation_version": None,
    })
    if any(cycle.data_kind == "observed" and cycle.period for cycle in history):
        return evaluate_local_rotation(staged)
    return staged.model_copy(update={"evidence_blocks": build_evidence(staged)})


def _already_registered(context: ParcelContext, crop_id: str, period: Period) -> bool:
    return any(cycle.period == period and cycle.crop_ids == [crop_id] and cycle.data_kind == "observed"
               for cycle in context.history)


def _ensure_no_overlap(cycles: list[CropCycle], period: Period) -> None:
    if any(cycle.period and period.start <= cycle.period.end and cycle.period.start <= period.end for cycle in cycles):
        raise BaseError("Las fechas coinciden con otro ciclo de esta parcela. Revisa el historial.")


def _validate_registration(kind: str, period: Period, today: date) -> None:
    if kind == "current" and not period.start <= today <= period.end:
        raise BaseError("El cultivo actual debe tener un período que incluya el día de hoy.")
    if kind == "previous" and period.end >= today:
        raise BaseError("El ciclo anterior debe haber terminado antes de hoy.")


def register_crop_cycle(repository: Repository, parcel_id: str, body: CropCycleRegistration) -> ParcelContext:
    current = _parcel_for_crops(repository, parcel_id)
    period = _crop_period(body.start, body.end)
    expected = body.expected_context_version
    if expected <= current.context_version and _already_registered(current, body.crop_id, period):
        return current
    require_version(current, expected)
    now = datetime.now(UTC)
    _validate_registration(body.kind, period, now.astimezone(CAMPECHE_TIME_ZONE).date())
    _ensure_no_overlap(current.history, period)

    entry = CropCycle(id=f"crop-cycle-{uuid4().hex}", sequence=len(current.history) + 1,
                      period=period, crop_ids=[body.crop_id], data_kind="observed")
    evaluated = _updated_ficha(current, _ordered_cycles([*current.history, entry]), now)
    try:
        return repository.save(evaluated, expected)
    except Conflict:
        latest = _parcel_for_crops(repository, parcel_id)
        if not _already_registered(latest, body.crop_id, period):
            raise
        return latest


def _replayed_change(context: ParcelContext, cycle_id: str, body: CropCycleVoid) -> bool:
    event = next((item for item in context.crop_cycle_history if item.change_id == body.change_id), None)
    if event is None:
        return False
    common_fields = (
        event.previous.id == cycle_id
        and event.context_version == body.expected_context_version + 1
        and event.reason == (body.reason or None)
    )
    if isinstance(body, CropCycleCorrection):
        replacement = event.replacement
        same_change = (replacement is not None and replacement.crop_ids == [body.crop_id]
                       and replacement.period is not None and replacement.period.start == body.start
                       and replacement.period.end == body.end)
    else:
        same_change = event.action == "voided"
    if not common_fields or not same_change:
        raise Conflict("Ese identificador ya se usó para otro cambio de cultivo.")
    return True


def change_crop_cycle(repository: Repository, parcel_id: str, cycle_id: str, body: CropCycleVoid) -> ParcelContext:
    current = _parcel_for_crops(repository, parcel_id)
    if _replayed_change(current, cycle_id, body):
        return current
    expected = body.expected_context_version
    require_version(current, expected)
    previous = next((cycle for cycle in current.history if cycle.id == cycle_id and cycle.data_kind == "observed"), None)
    if previous is None:
        if any(event.previous.id == cycle_id and event.action == "voided" for event in current.crop_cycle_history):
            raise Conflict("El ciclo ya se anuló. Consulta el historial.")
        raise NotFound("No se encontró un ciclo vigente en esta parcela.")

    now = datetime.now(UTC)
    others = [cycle for cycle in current.history if cycle.id != cycle_id]
    replacement = None
    if isinstance(body, CropCycleCorrection):
        period = _crop_period(body.start, body.end)
        if period.start > now.astimezone(CAMPECHE_TIME_ZONE).date():
            raise BaseError("La fecha de inicio del ciclo no puede estar en el futuro.")
        if previous.crop_ids == [body.crop_id] and previous.period == period:
            raise BaseError("Modifica el cultivo o las fechas antes de guardar la corrección.")
        _ensure_no_overlap(others, period)
        proposed = previous.model_copy(update={"crop_ids": [body.crop_id], "period": period})
        history = _ordered_cycles([*others, proposed])
        replacement = next(cycle for cycle in history if cycle.id == cycle_id)
    else:
        history = _ordered_cycles(others)
    event = CropCycleChange(
        change_id=body.change_id, action="corrected" if replacement else "voided",
        recorded_at=now, context_version=expected + 1, previous=previous,
        replacement=replacement, reason=body.reason or None,
    )
    updated = _updated_ficha(current, history, now, event)
    try:
        return repository.save(updated, expected)
    except Conflict:
        latest = _parcel_for_crops(repository, parcel_id)
        if _replayed_change(latest, cycle_id, body):
            return latest
        raise


router = APIRouter(prefix="/v1/contexts/{parcel_id}", tags=["Cultivos de la parcela"])


@router.post("/crop-cycles", response_model=ParcelContext, status_code=201,
             responses={status: {"model": ApiError} for status in (404, 409, 422, 503)})
def post_crop_cycle(parcel_id: str, body: CropCycleRegistration) -> ParcelContext:
    """Agrega un ciclo observado y guarda la rotación calculada con la misma versión."""
    return register_crop_cycle(Repository(), parcel_id, body)


@router.put("/crop-cycles/{cycle_id}", response_model=ParcelContext,
            responses={status: {"model": ApiError} for status in (404, 409, 422, 503)})
def correct_crop_cycle(parcel_id: str, cycle_id: Identifier, body: CropCycleCorrection) -> ParcelContext:
    return change_crop_cycle(Repository(), parcel_id, cycle_id, body)


@router.post("/crop-cycles/{cycle_id}/void", response_model=ParcelContext,
             responses={status: {"model": ApiError} for status in (404, 409, 422, 503)})
def void_crop_cycle(parcel_id: str, cycle_id: Identifier, body: CropCycleVoid) -> ParcelContext:
    return change_crop_cycle(Repository(), parcel_id, cycle_id, body)
