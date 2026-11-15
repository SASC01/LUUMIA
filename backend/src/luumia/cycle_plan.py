"""Compara el primer ciclo de las rotaciones vigentes en la misma parcela."""

import json
from calendar import monthrange
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, model_validator

from . import base
from .commercial import calculate
from .contracts import CommercialScenario, Contract, Identifier, Kg, Nonnegative, ParcelContext, Period
from .crop_yield import YieldReferenceUnavailable, yield_reference
from .price_forecast import PriceForecast, ProducerPriceSeries, forecast_producer_price

CATALOG = Path(__file__).resolve().parents[3] / "data/processed/producer-prices"
SOIL_SOURCE = "https://www.nrcs.usda.gov/conservation-basics/soil/soil-health/soil-health-on-cropland"
MUNICIPAL_SOURCE = "https://nube.agricultura.gob.mx/datosAbiertos/Agricola.php"
INDEX_SERIES = {"maiz": "usda-ers-maiz-us", "frijol": "usda-nass-frijol-us"}
MEXICAN_SCENARIO_SERIES = {
    "maiz": {"dgsiap-balanza-maiz-blanco-mx", "dgsiap-maiz-blanco-mx"},
    "frijol": {"dgsiap-balanza-frijol-negro-mx", "dgsiap-frijol-negro-mx"},
}
MonthKey = Annotated[str, Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")]
LossFraction = Annotated[Decimal, Field(ge=0, le=1, decimal_places=6)]
PriceBasis = Literal["local_forecast", "mexican_observation", "international_index", "local_assumption"]
PriceMode = Literal["forecast", "mexican_observation"]


class CycleAssumption(Contract):
    crop_id: Identifier
    local_price_mxn_kg: Nonnegative | None = None
    yield_t_ha: Nonnegative | None = None
    loss_fraction: LossFraction | None = None
    cost_mxn: Nonnegative | None = None
    capacity_kg: Kg | None = None
    soil_cover: bool | None = None


class CyclePlanRequest(Contract):
    context_version: Annotated[int, Field(ge=1)]
    sale_month: MonthKey | None = None
    price_mode: PriceMode = "forecast"
    assumptions: list[CycleAssumption] = Field(default_factory=list, max_length=len(base.CROP_FAMILIES))

    @model_validator(mode="after")
    def unique_crops(self):
        if len({row.crop_id for row in self.assumptions}) != len(self.assumptions):
            raise ValueError("Envía un solo conjunto de supuestos por cultivo.")
        return self


class CycleEconomics(Contract):
    price_mxn_kg: Decimal
    price_low_mxn_kg: Decimal | None
    price_high_mxn_kg: Decimal | None
    harvest_kg: Decimal
    sold_kg: Decimal
    revenue_mxn: Decimal
    cost_mxn: Decimal
    margin_mxn: Decimal
    margin_low_mxn: Decimal | None
    margin_high_mxn: Decimal | None
    price_basis: PriceBasis
    reference_series_id: Identifier | None = None
    reference_geography: str | None = None
    reference_product: str | None = None
    reference_observed_month: date | None = None
    reference_observed_url: str | None = None


class CycleCrop(Contract):
    crop_id: Identifier
    label: str
    candidate_ids: list[Identifier]
    natural_rank: int | None = None
    natural_score: int | None
    soil_signals: list[str]
    soil_practice: str | None
    soil_pass: bool
    viable: bool
    eligibility_reason: str | None
    assumption: CycleAssumption
    yield_basis: Literal["municipal_median", "demo_assumption", "user_assumption", "missing"]
    yield_reference_url: str | None = None
    economics: CycleEconomics | None
    missing_reason: str | None


class CyclePlan(Contract):
    context_version: int
    sale_month: MonthKey
    as_of: date
    price_mode: PriceMode
    area_ha: Decimal
    agricultural_cycle: Literal["spring_summer"] = "spring_summer"
    available_sale_months: list[MonthKey]
    calendar_source_url: str = "https://nube.agricultura.gob.mx/calendario_agricola/"
    rows: list[CycleCrop]
    natural_best_crop_id: Identifier | None
    margin_best_crop_id: Identifier | None
    recommended_crop_id: Identifier | None
    recommendation_reason: str
    method_note: str
    soil_source_url: str = SOIL_SOURCE
    forecasts: list[PriceForecast]


class ProducerCatalogUnavailable(OSError):
    pass


# Los precios de partida, las mermas, los costos totales y los cupos son editables y simulados.
# Cada fila compara el mismo total de 12 ha de la demo. No representa una oferta de compra.
DEMO = {
    "maiz": ("5.50", "3.5", "0.06", "62000", 32000),
    "frijol": ("18.00", "1.05", "0.08", "110000", 10000),
    "calabaza": ("7.00", "8.0", "0.12", "90000", 28000),
    "saladette": ("8.00", "12.00", "0.15", "185000", 23000),
}


@lru_cache(maxsize=4)
def _forecasts(as_of: date, signatures: tuple[tuple[Path, int, int], ...]) -> list[PriceForecast]:
    try:
        series = []
        for path, _, _ in signatures:
            content = json.loads(path.read_text(encoding="utf-8"))
            for item in content["series"]:
                fields = {key: item[key] for key in ProducerPriceSeries.model_fields if key in item}
                if item.get("price_scope") != "producer":
                    raise ValueError("La fuente incluye registros de otra etapa de comercialización.")
                series.append(ProducerPriceSeries.model_validate(fields))
        if not series or len({item.series_id for item in series}) != len(series):
            raise ValueError("El catálogo requiere identificadores únicos por serie.")
        return [forecast_producer_price(item, as_of=as_of) for item in series]
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise ProducerCatalogUnavailable("No se pudo cargar el catálogo oficial de precios al productor.") from error


def producer_forecasts(as_of: date) -> list[PriceForecast]:
    try:
        signatures = []
        for path in sorted(CATALOG.glob("*.json")):
            metadata = path.stat()
            signatures.append((path, metadata.st_mtime_ns, metadata.st_size))
    except OSError as error:
        raise ProducerCatalogUnavailable("No se pudo consultar el catálogo de precios al productor.") from error
    return _forecasts(as_of, tuple(signatures))


def _month_after(day: date, offset: int) -> str:
    year, month = divmod(day.year * 12 + day.month - 1 + offset, 12)
    return f"{year:04d}-{month + 1:02d}"


def _sale_period(month: str) -> Period:
    first = date.fromisoformat(f"{month}-01")
    return Period(start=first, end=first.replace(day=monthrange(first.year, first.month)[1]))


def _default_assumption(context: ParcelContext, crop_id: str, override: CycleAssumption) -> tuple[CycleAssumption, str]:
    assumption = CycleAssumption(crop_id=crop_id)
    basis = "missing"
    if context.producer.persona_kind == "composite_demo" and crop_id in DEMO and context.parcel.declared_area_ha == 12:
        price, yield_guess, loss, costs, capacity = DEMO[crop_id]
        assumption = CycleAssumption(crop_id=crop_id, local_price_mxn_kg=Decimal(price), yield_t_ha=Decimal(yield_guess),
                                     loss_fraction=Decimal(loss), cost_mxn=Decimal(costs), capacity_kg=capacity, soil_cover=True)
        basis = "demo_assumption"
    if (context.parcel.country, context.parcel.state, context.parcel.municipality, context.parcel.production_system) == (
        "MX", "Campeche", "Hopelchén", "rainfed",
    ):
        try:
            reference = yield_reference(crop_id, "spring_summer").reference
        except YieldReferenceUnavailable:
            reference = None
        if reference:
            assumption = assumption.model_copy(update={"yield_t_ha": reference.median_t_ha})
            basis = "municipal_median"
    values = override.model_dump(exclude_unset=True, exclude={"crop_id"})
    if "yield_t_ha" in values:
        basis = "user_assumption" if values["yield_t_ha"] is not None else "missing"
    return assumption.model_copy(update=values), basis


def _soil(crop_id: str, previous: list[str], cover: bool | None) -> tuple[int | None, list[str], str | None, bool]:
    family = base.CROP_FAMILIES[crop_id]
    change = bool(previous) and family not in {base.CROP_FAMILIES[crop] for crop in previous}
    legume = family == "Fabaceae"
    signals = ["Alterna la familia del ciclo anterior." if change else (
        "Repite una familia del ciclo anterior." if previous else "Hace falta registrar el cultivo anterior.")]
    if legume:
        signals.append("Leguminosa con potencial de fijación de nitrógeno según el manejo.")
    practice = "Mantener cobertura con residuos o un cultivo de cobertura compatible." if cover else None
    return int(change) + int(legume) if previous else None, signals, practice, change and bool(practice)


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _price(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)


def _market_scope(projection: PriceForecast, context: ParcelContext) -> int:
    series = projection.series
    if (series.geography_code != "MEX" or series.currency != "MXN" or series.unit not in {"kg", "t"}
            or series.geography_level == "region" or series.observation_kind != "monthly"):
        return 0
    equivalent_state = "04" if context.parcel.state == "Campeche" else None
    equivalent_municipality = "006" if equivalent_state == "04" and context.parcel.municipality == "Hopelchén" else None
    if series.geography_level == "municipality" or series.municipality_code:
        return 3 if equivalent_municipality and series.state_code == equivalent_state and series.municipality_code == equivalent_municipality else 0
    if series.geography_level == "state" or series.state_code:
        return 2 if equivalent_state and series.state_code == equivalent_state else 0
    return 1


def price_for_crop(crop: str, sale_date: date, baseline: Decimal | None, context: ParcelContext,
                   forecasts: list[PriceForecast], mode: PriceMode
                   ) -> tuple[tuple[Decimal | None, Decimal | None, Decimal | None], PriceBasis, PriceForecast | None]:
    country = getattr(context.parcel, "country", None)
    country_code = {"MX": "MEX", "US": "USA", "CA": "CAN"}.get(country)
    crop_forecasts = [projection for projection in forecasts if projection.series.crop_id == crop]
    prices = [(projection, point) for projection in crop_forecasts
              for point in projection.points if point.month == sale_date]
    if mode == "mexican_observation" and country == "MX":
        benchmarks = [projection for projection in crop_forecasts if projection.latest_observed_month and _market_scope(projection, context)
                      and (projection.series.variety_match != "exact" or projection.series.series_id in MEXICAN_SCENARIO_SERIES.get(crop, set()))]
        latest = max(benchmarks, key=lambda projection: (projection.latest_observed_month, _market_scope(projection, context),
                                                         projection.series.series_id), default=None)
        if latest:
            unit_size = 1000 if latest.series.unit == "t" else 1
            observed = _price(latest.series.rows[-1].price / unit_size)
            return (observed, None, None), "mexican_observation", latest

    # Una serie de una variedad específica requiere identificarla antes de aplicarla como pronóstico directo.
    local_prices = [(projection, point) for projection, point in prices
                    if country == "MX" and _market_scope(projection, context) and projection.series.variety_match != "exact"]
    local = max(local_prices, key=lambda pair: (_market_scope(pair[0], context), pair[0].latest_observed_month,
                                                pair[0].series.series_id), default=None)
    if local:
        forecast, point = local
        unit_size = 1000 if forecast.series.unit == "t" else 1
        return (_price(point.central / unit_size), _price(point.low / unit_size), _price(point.high / unit_size)), "local_forecast", forecast
    if baseline is None:
        return (None, None, None), "local_assumption", None
    international = next(((projection, point) for projection, point in prices
                          if projection.series.series_id == INDEX_SERIES.get(crop)
                          and projection.series.geography_code != country_code), None)
    if international:
        forecast, point = international
        last = forecast.series.rows[-1].price
        scale = baseline / last
        return (_price(scale * point.central), _price(scale * point.low), _price(scale * point.high)), "international_index", forecast
    return (_price(baseline), None, None), "local_assumption", None


def _economics(context: ParcelContext, period: Period, assumption: CycleAssumption,
               forecasts: list[PriceForecast], mode: PriceMode) -> tuple[CycleEconomics | None, str | None]:
    price_range, basis, reference = price_for_crop(assumption.crop_id, period.start, assumption.local_price_mxn_kg,
                                                  context, forecasts, mode)
    central, low, high = price_range
    if any(value is None for value in (central, assumption.yield_t_ha, assumption.loss_fraction,
                                       assumption.cost_mxn, assumption.capacity_kg)):
        return None, "Hace falta precio local, rendimiento, merma, costo o cupo de venta."
    cap = assumption.capacity_kg
    scenario = CommercialScenario(
        id="cycle-plan", candidate_id="next-cycle", crop_id=assumption.crop_id, cycle_offset=1,
        sales_period=period, sales_structure="spot", cupo_range=(cap, cap), superficie_ha=context.parcel.declared_area_ha,
        precio_productor_mxn_kg=central, rendimiento_esperado_t_ha=assumption.yield_t_ha,
        agricultural_cycle="spring_summer", merma_fraccion=assumption.loss_fraction,
        costos_produccion_mxn=assumption.cost_mxn, costos_empaque_mxn=0, costos_transporte_mxn=0, costos_venta_mxn=0,
    )
    result = calculate(scenario, context.parcel.declared_area_ha)
    sold = result.bajo.kg_vendidos
    costs = result.costos_totales_mxn
    return CycleEconomics(
        price_mxn_kg=central, price_low_mxn_kg=low, price_high_mxn_kg=high,
        harvest_kg=_money(result.kg_cosechados), sold_kg=_money(sold), revenue_mxn=_money(result.bajo.ingreso_mxn),
        cost_mxn=_money(costs), margin_mxn=_money(result.bajo.margen_mxn),
        margin_low_mxn=_money(sold * low - costs) if low is not None else None,
        margin_high_mxn=_money(sold * high - costs) if high is not None else None,
        price_basis=basis, reference_series_id=reference.series.series_id if reference else None,
        reference_geography=reference.series.geography if reference else None,
        reference_product=reference.series.product if reference else None,
        reference_observed_month=reference.latest_observed_month if reference else None,
        reference_observed_url=(reference.series.rows[-1].source_url or reference.series.source_url) if reference else None,
    ), None


def compare_cycle(context: ParcelContext, request: CyclePlanRequest, as_of: date,
                  forecasts: list[PriceForecast]) -> CyclePlan:
    horizon = [_month_after(as_of, offset) for offset in range(1, 13)]
    # Calendario general DGSIAP para primavera–verano: cosecha de junio a marzo.
    cycle_year = as_of.year + (as_of.month >= 10)
    sale_months = [month for month in horizon if f"{cycle_year}-06" <= month <= f"{cycle_year + 1}-03"]
    sale_month = request.sale_month or next((month for month in sale_months if month.endswith("-10")), sale_months[0])
    if sale_month not in sale_months:
        raise base.BaseError("Selecciona un mes futuro dentro de la ventana general de cosecha primavera–verano.")
    period = _sale_period(sale_month)
    snapshot = context.evaluation.request_snapshot if context.evaluation else None
    if not snapshot:
        raise base.BaseError("Recalcula la ficha para comparar el siguiente ciclo.")
    previous = max(context.history, key=lambda step: step.sequence).crop_ids if context.history else []
    rules = [rule.model_dump(mode="json") for rule in snapshot.constraints]
    agricultural_rules = {rule["id"] for rule in rules if rule["kind"] != "market_available"}
    options: dict[str, list[str]] = {}
    # Los números de la demo son por monocultivo. Para intercalados se necesitarían superficies y cupos por cultivo.
    for candidate in snapshot.candidates:
        if candidate.steps[0].arrangement == "single_crop":
            options.setdefault(candidate.steps[0].crop_ids[0], []).append(candidate.id)
    # También se puede evaluar la calabaza como primer cultivo del caso de Don Tino.
    if context.producer.persona_kind == "composite_demo" and "maiz" in options:
        options.setdefault("calabaza", [])
    if any(override.crop_id not in options for override in request.assumptions):
        raise base.BaseError("Los supuestos deben corresponder a un cultivo del comparador.")
    overrides = {item.crop_id: item for item in request.assumptions}
    rows = []
    for crop, candidates in options.items():
        checks = base.next_crop_checks(crop, previous, rules, period.model_dump(mode="json"))
        hard = next((check for check in checks if check["outcome"] == "fail"), None)
        unresolved = next((check for check in checks if check["outcome"] == "needs_confirmation"), None)
        restriction = hard or unresolved
        agronomic = all(check["outcome"] == "pass" for check in checks if check["constraint_id"] in agricultural_rules)
        assumption, yield_basis = _default_assumption(context, crop, overrides.get(crop, CycleAssumption(crop_id=crop)))
        natural_score, signals, practice, soil_pass = _soil(crop, previous, assumption.soil_cover)
        economics, missing = _economics(context, period, assumption, forecasts, request.price_mode)
        rows.append(CycleCrop(
            crop_id=crop, label=base.CROP_LABELS[crop].capitalize().replace("saladette", "Saladette"),
            candidate_ids=candidates, natural_score=natural_score if agronomic else None, soil_signals=signals,
            soil_practice=practice, soil_pass=soil_pass and agronomic, viable=restriction is None,
            eligibility_reason=restriction["explanation"] if restriction else None, assumption=assumption,
            yield_basis=yield_basis, yield_reference_url=MUNICIPAL_SOURCE if yield_basis == "municipal_median" else None,
            economics=economics, missing_reason=missing,
        ))
    rows.sort(key=lambda row: (row.natural_score is None, -(row.natural_score or 0), row.crop_id))
    scores = sorted({row.natural_score for row in rows if row.natural_score is not None}, reverse=True)
    for row in rows:
        if row.natural_score is not None:
            row.natural_rank = scores.index(row.natural_score) + 1
    comparable = [row for row in rows if row.viable and row.economics]
    margin_order = sorted(comparable, key=lambda row: (-row.economics.margin_mxn, row.natural_rank or 99, row.crop_id))
    margin_leader = next(iter(margin_order), None)
    balanced = next((row for row in margin_order if row.soil_pass and row.economics.margin_mxn > 0), None)
    if balanced:
        reason = f"{balanced.label} tiene el mayor margen central positivo entre las opciones viables que alternan familia y contemplan proteger el suelo."
    else:
        reason = "Falta una opción viable con margen central positivo, cambio de familia y una práctica de cobertura asumida."
    return CyclePlan(
        context_version=context.context_version, sale_month=sale_month, as_of=as_of, price_mode=request.price_mode,
        area_ha=Decimal(str(context.parcel.declared_area_ha)),
        available_sale_months=sale_months, rows=rows, natural_best_crop_id=rows[0].crop_id if scores else None,
        margin_best_crop_id=margin_leader.crop_id if margin_leader else None,
        recommended_crop_id=balanced.crop_id if balanced else None, recommendation_reason=reason,
        method_note=("Un ciclo de primavera–verano con mes de venta supuesto dentro de la ventana general de cosecha "
                     "y un precio uniforme por kilo. Falta un calendario de cosecha por cultivo y parcela. "
                     "El pronóstico en MXN prioriza una serie comparable de la parcela, el estado o México con cobertura vigente. "
                     "Precio indexado = precio base editable en MXN/kg × pronóstico internacional / último precio de esa serie. "
                     "Cuando faltan ambas referencias, se usa el precio base fijo. El escenario de sensibilidad fija "
                     "el último precio mensual mexicano para los cultivos con datos del producto elegido. "
                     "La ganancia se simula con rendimiento, merma, cupo y costo total. Las señales agronómicas describen potencial según manejo."),
        forecasts=forecasts,
    )
