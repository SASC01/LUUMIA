"""Simulación de venta para un cultivo, superficie y ventana explícitos."""

from decimal import Decimal, localcontext
from itertools import groupby

from .contracts import CommercialEndpoint, CommercialResult, CommercialScenario, ConfirmedCapacity, EvaluationRequest, Parcel, ParcelContext
from .crop_yield import resolve_yield

METHOD_VERSION = "commercial-capacity-1"
PRICE_VOLUME_METHOD_VERSION = "commercial-price-volume-1"


class ScenarioError(ValueError):
    pass


def calculate(scenario: CommercialScenario, area_limit: float, confirmation: ConfirmedCapacity | None = None,
              *, parcel: Parcel | None = None) -> CommercialResult:
    if scenario.superficie_ha > Decimal(str(area_limit)):
        raise ScenarioError("La superficie evaluada supera las hectáreas declaradas de la parcela.")
    if scenario.cupo_confirmacion and (not confirmation or (
        confirmation.id, confirmation.crop_id, confirmation.cycle_offset, confirmation.sales_period,
        confirmation.sales_structure, confirmation.cupo_range,
    ) != (
        scenario.cupo_confirmacion, scenario.crop_id, scenario.cycle_offset, scenario.sales_period,
        scenario.sales_structure, scenario.cupo_range,
    )):
        raise ScenarioError("La confirmación no coincide con el cultivo, ventana, estructura y cupo del escenario.")

    applied_yield = resolve_yield(scenario, parcel)
    with localcontext() as arithmetic:
        arithmetic.prec = 60
        cosecha = applied_yield.area_ha * applied_yield.yield_t_ha * 1000
        disponibles = cosecha * (1 - scenario.merma_fraccion)
        costos = sum((scenario.costos_produccion_mxn, scenario.costos_empaque_mxn,
                      scenario.costos_transporte_mxn, scenario.costos_venta_mxn), Decimal(0))
        extremos = []
        precio_base = scenario.precio_productor_mxn_kg
        tramos = scenario.precio_volumen
        for cupo in scenario.cupo_range:
            vendidos = min(disponibles, Decimal(cupo))
            kg_base = min(vendidos, Decimal(tramos.umbral_kg)) if tramos else vendidos
            ingreso = kg_base * precio_base
            if tramos:
                ingreso += (vendidos - kg_base) * tramos.precio_excedente_mxn_kg
            extremos.append(CommercialEndpoint(
                cupo_kg=cupo, kg_disponibles=disponibles, kg_vendidos=vendidos,
                kg_sin_salida=disponibles - vendidos,
                ingreso_mxn=ingreso, precio_efectivo_mxn_kg=ingreso / vendidos if vendidos else None,
                margen_mxn=ingreso - costos,
                precio_equilibrio_mxn_kg=costos / vendidos if vendidos else None,
                precio_equilibrio_status="available" if vendidos else "missing",
                precio_equilibrio_missing_reason=None if vendidos else "Se venderían cero kilos en este extremo.",
            ))
    bajo, alto = extremos
    return CommercialResult(
        scenario_id=scenario.id, method_version=PRICE_VOLUME_METHOD_VERSION if tramos else METHOD_VERSION,
        evidence_tier="simulated_assumption", precio_base_mxn_kg=precio_base, precio_volumen=tramos, applied_yield=applied_yield,
        label_es="Margen bajo supuestos comerciales", cupo_centro_kg=Decimal(sum(scenario.cupo_range)) / 2,
        cupo_amplitud_kg=scenario.cupo_range[1] - scenario.cupo_range[0], kg_cosechados=cosecha,
        costos_totales_mxn=costos, bajo=bajo, alto=alto, margen_min_mxn=bajo.margen_mxn,
        margen_max_mxn=alto.margen_mxn,
    )


def comparable_scores(
    request: EvaluationRequest, eligible: set[str], results: dict[str, CommercialResult],
) -> dict[str, tuple[float, str]]:
    relevant = sorted(
        (s for s in request.commercial_scenarios if s.candidate_id in eligible), key=lambda s: s.candidate_id,
    )
    pairs = {candidate: list(group) for candidate, group in groupby(relevant, key=lambda s: s.candidate_id)}
    if len(eligible) < 2 or pairs.keys() != eligible or any(len(group) != 1 for group in pairs.values()):
        return {}
    scopes = {(s.cycle_offset, s.agricultural_cycle, s.sales_period.start, s.sales_period.end, s.superficie_ha, s.sales_structure,
               bool(s.cupo_confirmacion)) for s in relevant}
    if len(scopes) != 1 or any(results[s.id].bajo.kg_disponibles == 0 for s in relevant):
        return {}
    return {s.candidate_id: (
        float(100 * results[s.id].bajo.kg_vendidos / results[s.id].bajo.kg_disponibles),
        "Porcentaje de cosecha con salida usando el cupo bajo, bajo supuestos comerciales comparables.",
    ) for s in relevant}


def calculate_all(request: EvaluationRequest, context: ParcelContext) -> dict[str, CommercialResult]:
    confirmations = {item.id: item for item in context.confirmed_purchase_capacities}
    return {scenario.id: calculate(scenario, context.parcel.declared_area_ha,
                                   confirmations.get(scenario.cupo_confirmacion or ""), parcel=context.parcel)
            for scenario in request.commercial_scenarios}
