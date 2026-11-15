"""Proyecta procedencia sin sumar dos veces los datos de origen."""

from .contracts import BlockEvidence, Confidence, ParcelContext, ParcelEvidence, Source


def missing(unit: str, message: str) -> BlockEvidence:
    return BlockEvidence(
        evidence_tier=None, status="missing", missing_reason=message, n_observaciones=0,
        count_unit=unit, confidence=Confidence(level="unknown", reasons=[message]),
    )


def unique_sources(sources):
    return list({source.id: source for source in sources}.values())


def build_evidence(context: ParcelContext) -> ParcelEvidence:
    observations = [item for item in context.observations if item.value is not None]
    synthetic_weather = sum(item.data_kind == "synthetic" for item in observations)
    agronomic = missing("agregados semanales", "Aún faltan agregados semanales de NASA POWER.")
    if observations:
        agronomic = BlockEvidence(
            evidence_tier="simulated_assumption" if synthetic_weather else "derived",
            status="available", n_observaciones=len(observations), n_simulated=synthetic_weather,
            count_unit="agregados semanales",
            confidence=Confidence(level="low", reasons=[
                "La meteorología regional da contexto. Agua disponible y demanda por ciclo requieren datos locales.",
                "La transición de calabaza es una regla sintética del caso.",
            ]),
            sources=unique_sources(item.source for item in observations),
        )

    commercial = missing("registros comerciales directos", "Todavía no hay un margen vigente en esta ficha.")
    if context.evaluation and context.evaluation.commercial_results:
        scenarios = context.evaluation.request_snapshot.commercial_scenarios
        confirmation_ids = {s.cupo_confirmacion for s in scenarios if s.cupo_confirmacion}
        confirmations = [row for row in context.confirmed_purchase_capacities if row.id in confirmation_ids]
        sources = unique_sources([*(source for scenario in scenarios for source in scenario.fuentes_insumos.values()),
                                  *(row.source for row in confirmations)])
        commercial = BlockEvidence(
            evidence_tier="simulated_assumption", status="available", n_observaciones=len(confirmations),
            count_unit="registros comerciales verificados", sources=sources,
            confidence=Confidence(level="low", reasons=["Margen bajo supuestos comerciales editables."]),
        )

    superseded = {row.supersedes_id for row in context.field_observations if row.supersedes_id}
    local = [row for row in context.field_observations if row.id not in superseded]
    simulated_local = sum(row.data_kind == "synthetic" for row in local)
    local_block = missing("registros de campo", "Aún no hay una observación local registrada.")
    if local:
        sources = unique_sources(row.rain_gauge.source for row in local if getattr(row, "rain_gauge", None))
        verified = all(row.confirmed and getattr(row, "rain_gauge", None) for row in local)
        local_block = BlockEvidence(
            evidence_tier="observed" if verified and not simulated_local else "simulated_assumption",
            status="available", n_observaciones=len(local), n_simulated=simulated_local,
            count_unit="registros de campo", sources=sources,
            confidence=Confidence(level="low" if verified else "unknown", reasons=[
                "Medición puntual de campo." if verified else "Registro local pendiente de confirmación o simulado.",
            ]),
        )

    simulated = sum(cycle.data_kind == "synthetic" for cycle in context.history)
    sequence = missing("ciclos", "Aún no hay un historial de cultivos.")
    if context.history:
        needs_dates = any(cycle.period is None for cycle in context.history)
        sequence = BlockEvidence(
            evidence_tier="simulated_assumption" if simulated else "observed", status="available",
            n_observaciones=len(context.history), n_simulated=simulated, count_unit="ciclos",
            confidence=Confidence(level="low", reasons=[
                "Secuencia con fechas de ciclo por confirmar." if needs_dates else "Fechas declaradas en la ficha.",
            ]),
            sources=[Source(id="history-don-tino", name="Historial de campo del caso Don Tino", kind="synthetic",
                            retrieved_at=context.updated_at)] if simulated else [],
        )
    return ParcelEvidence(agronomico=agronomic, comercial=commercial, observacion_local=local_block,
                          secuencia_cultivos=sequence)
