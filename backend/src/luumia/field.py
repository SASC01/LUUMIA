"""Captura de pluviómetro y comparación de ventanas de acumulación equivalentes."""

from datetime import UTC, datetime, time, timedelta, timezone
from math import floor, isfinite

from .base import BaseError
from .contracts import FieldObservation, FieldObservationRequest, KoboReceipt, ParcelContext, PriorCommercialRef, RainComparison
from .evidence import build_evidence
from .storage import Repository


def compare_rain(context: ParcelContext) -> RainComparison | None:
    corrected_ids = {item.supersedes_id for item in context.field_observations}
    local = next((item for item in reversed(context.field_observations)
                  if item.rain_gauge and item.id not in corrected_ids), None)
    if not local or not local.rain_gauge:
        return None
    window = local.rain_gauge
    matching = [obs for obs in context.observations if obs.variable == "precipitation"
                and obs.spatial_support == "regional" and obs.source.kind == "nasa" and obs.aggregation == "sum"
                and obs.unit == "mm"]
    fallback = max(matching, key=lambda obs: obs.period.end, default=None)
    if fallback is None:
        return RainComparison(status="missing", missing_reason="Falta lluvia semanal de POWER.", local=local, power=None)
    try:
        longitude_ring = [point[0] for point in context.parcel.geometry["coordinates"][0]]
        midpoint = (min(longitude_ring) + max(longitude_ring)) / 2
    except (KeyError, IndexError, TypeError, ValueError):
        midpoint = None
    if midpoint is None or not isfinite(midpoint):
        return RainComparison(status="missing", missing_reason="Falta la ubicación para comparar las ventanas de lluvia.",
                              local=local, power=fallback)
    lst = timezone(timedelta(hours=max(-12, min(12, floor((midpoint + 7.5) / 15)))))
    for power in matching:
        start = datetime.combine(power.period.start, time.min, lst)
        end = datetime.combine(power.period.end + timedelta(days=1), time.min, lst)
        if (start, end) == (window.accumulation_start, window.accumulation_end):
            message = None if power.value is not None else power.missing_reason or "Falta cobertura semanal de POWER."
            return RainComparison(status="missing" if message else "available", missing_reason=message,
                                  local=local, power=power)
    return RainComparison(status="missing",
                          missing_reason="La ventana del pluviómetro no coincide con una semana de POWER en hora solar local.",
                          local=local, power=fallback)


def save_observation(repository: Repository, body: FieldObservationRequest, *, kobo: KoboReceipt | None = None) -> ParcelContext:
    from .service import require_version

    measurement = body.observation
    current = repository.get(measurement.parcel_id)
    require_version(current, body.expected_context_version)
    now = datetime.now(UTC)
    if measurement.observed_at > now:
        raise BaseError("La lectura del pluviómetro debe haber ocurrido antes de guardarse.")
    previous_ids = {entry.id for entry in current.field_observations}
    corrected_ids = {entry.supersedes_id for entry in current.field_observations}
    if measurement.id in previous_ids or any(
        item.id == measurement.id for item in [*current.observations, *current.features]
    ):
        raise BaseError("Ya existe un registro de evidencia con ese identificador.")
    if measurement.supersedes_id and (
        measurement.supersedes_id not in previous_ids or measurement.supersedes_id in corrected_ids
    ):
        raise BaseError("La observación a corregir debe existir y seguir vigente en esta parcela.")

    entry = FieldObservation.model_validate({**measurement.model_dump(), "recorded_at": now, "kobo": kobo})
    prior = current.prior_commercial
    if current.evaluation and current.evaluation.commercial_results:
        prior = PriorCommercialRef(context_version=current.context_version, evaluation_id=current.evaluation.id,
                                   scenario_ids=[item.scenario_id for item in current.evaluation.commercial_results])
    needs_recalculation = (current.producer.persona_kind == "composite_demo" or current.evaluation is not None
                           or current.evaluation_state == "pendiente_de_recalculo")
    reason = ("Se guardó una observación de lluvia desde KoboCollect. Recalcule la ficha para actualizar el margen."
              if kobo else "Se guardó una nueva observación local de lluvia. Recalcule la ficha para actualizar el margen.")
    if current.producer.persona_kind == "real":
        reason = "Se guardó una observación de lluvia. Actualiza la evaluación desde Cultivos y rotaciones."
    data = current.model_dump()
    data.update(
        contract_version="0.2.0", context_version=current.context_version + 1, updated_at=now,
        evaluation_state="pendiente_de_recalculo" if needs_recalculation else None, evaluation=None, prior_commercial=prior,
        recalculation_reason=reason if needs_recalculation else None,
        last_evaluation_version=current.context_version if current.evaluation else current.last_evaluation_version,
        field_observations=[*current.field_observations, entry], data_kind=current.data_kind
        if measurement.data_kind == "observed" else "synthetic",
    )
    pending = ParcelContext.model_validate(data)
    pending = pending.model_copy(update={"evidence_blocks": build_evidence(pending), "rain_comparison": compare_rain(pending)})
    return repository.save(pending, body.expected_context_version)
