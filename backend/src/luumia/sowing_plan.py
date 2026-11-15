"""Simulación y registro de repartos de hectáreas por parcela."""

from calendar import monthrange
from datetime import date, datetime
from decimal import Decimal, ROUND_DOWN, ROUND_HALF_UP
from typing import Annotated, Literal
from zoneinfo import ZoneInfo

import psycopg
from fastapi import APIRouter
from psycopg.types.json import Jsonb
from pydantic import AwareDatetime, Field, StringConstraints, model_validator

from . import base
from .contracts import ApiError, ConfirmedCapacity, Contract, Identifier, Nonnegative, ParcelContext
from .crop_yield import YieldReferenceUnavailable, yield_reference
from .cycle_plan import DEMO, MUNICIPAL_SOURCE, PriceBasis, ProducerCatalogUnavailable, price_for_crop, producer_forecasts
from .service import require_version
from .storage import Conflict, NotFound, Repository, StorageError


PRODUCER_CROPS = Literal["calabaza", "frijol", "maiz", "saladette"]
YieldBasis = Literal["municipal_median", "demo_assumption", "user_assumption", "reported", "missing"]
MissingSowingField = Literal["yield_t_ha", "price_mxn_kg", "loss_fraction", "cost_per_ha", "sale_capacity_kg"]
PlanArea = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=3)]
ZoneArea = Annotated[Decimal, Field(ge=0, max_digits=12, decimal_places=3)]
ContextVersion = Annotated[int, Field(ge=1)]
PlanVersion = Annotated[int, Field(ge=0)]
CAMPECHE_TIME_ZONE = ZoneInfo("America/Mexico_City")
KG_PRECISION = Decimal("0.001")
MONEY_PRECISION = Decimal("0.01")
DEMO_BASE_AREA_HA = Decimal(12)


class SowingEconomicsInputValue(Contract):
    value: Nonnegative
    basis: Literal["assumption", "reported"]
    source: Annotated[str, StringConstraints(strip_whitespace=True, max_length=180)] | None = None

    @model_validator(mode="after")
    def reported_requires_source(self):
        if self.basis == "reported" and not self.source:
            raise ValueError("Indica el documento o registro que respalda el dato reportado.")
        return self


class SowingCropEconomicsInput(Contract):
    crop_id: PRODUCER_CROPS
    cost_per_ha: SowingEconomicsInputValue | None = None
    sale_capacity_kg: SowingEconomicsInputValue | None = None
    yield_t_ha: SowingEconomicsInputValue | None = None
    price_mxn_kg: SowingEconomicsInputValue | None = None
    loss_fraction: SowingEconomicsInputValue | None = None

    @model_validator(mode="after")
    def validate_inputs(self):
        if self.sale_capacity_kg and self.sale_capacity_kg.value % KG_PRECISION:
            raise ValueError("El cupo de venta admite hasta tres decimales de kg.")
        if self.loss_fraction and self.loss_fraction.value > 1:
            raise ValueError("La merma debe ser una fracción entre cero y uno.")
        return self


class SowingCropEconomicsDefaults(Contract):
    crop_id: PRODUCER_CROPS
    cost_per_ha: SowingEconomicsInputValue
    sale_capacity_kg: SowingEconomicsInputValue


class SowingAppliedCapacity(Contract):
    value: Nonnegative
    basis: Literal["assumption", "reported", "cooperative_confirmation"]
    source: Annotated[str, StringConstraints(strip_whitespace=True, max_length=180)] | None = None


class SowingCropEconomics(Contract):
    crop_id: PRODUCER_CROPS
    cost_per_ha: SowingEconomicsInputValue
    sale_capacity_kg: SowingAppliedCapacity
    capacity_confirmation: ConfirmedCapacity | None = None
    loss_fraction: Decimal
    loss_input: SowingEconomicsInputValue | None = None
    price_mxn_kg: Decimal
    price_basis: PriceBasis
    price_input: SowingEconomicsInputValue | None = None
    reference_geography: str | None = None
    reference_product: str | None = None
    reference_observed_month: date | None = None
    reference_observed_url: str | None = None


class SowingZoneEconomics(Contract):
    marketable_kg: Decimal
    sold_kg: Decimal
    revenue_mxn: Decimal
    cost_mxn: Decimal
    margin_mxn: Decimal


class SowingCropMissingInputs(Contract):
    crop_id: PRODUCER_CROPS
    fields: list[MissingSowingField]


class SowingPlanEconomics(Contract):
    sale_month: date
    estimated_margin_mxn: Decimal | None
    crops: list[SowingCropEconomics]
    missing_inputs: list[SowingCropMissingInputs] = Field(default_factory=list)


class SowingZoneInput(Contract):
    zone_id: Identifier
    crop_id: PRODUCER_CROPS
    area_ha: ZoneArea


class SowingPlanInput(Contract):
    context_version: ContextVersion
    area_ha: PlanArea
    zones: list[SowingZoneInput] = Field(min_length=1, max_length=6)
    crop_economics: list[SowingCropEconomicsInput] = Field(default_factory=list, max_length=4)

    @model_validator(mode="after")
    def valid_area_allocation(self):
        if len({zone.zone_id for zone in self.zones}) != len(self.zones):
            raise ValueError("Cada zona debe tener un identificador distinto.")
        assigned = sum((zone.area_ha for zone in self.zones), Decimal(0))
        if assigned > self.area_ha:
            raise ValueError("El reparto supera la superficie del plan. Reduce las hectáreas de una zona.")
        if assigned == 0:
            raise ValueError("Asigna hectáreas a por lo menos un cultivo.")
        if len({inputs.crop_id for inputs in self.crop_economics}) != len(self.crop_economics):
            raise ValueError("Indica un solo costo y cupo por cultivo.")
        return self


class SowingCropOption(Contract):
    crop_id: PRODUCER_CROPS
    label: str
    yield_t_ha: Decimal | None
    yield_basis: YieldBasis
    yield_reference_url: str | None


class SowingZoneResult(SowingZoneInput):
    crop_label: str
    estimated_harvest_kg: Decimal | None
    yield_t_ha: Decimal | None
    yield_basis: YieldBasis
    yield_reference_url: str | None
    yield_input: SowingEconomicsInputValue | None = None
    economics: SowingZoneEconomics | None = None


class SowingPlanResult(Contract):
    context_version: ContextVersion
    agricultural_cycle: Literal["spring_summer"] = "spring_summer"
    campaign_year: int
    area_ha: PlanArea
    assigned_area_ha: ZoneArea
    unassigned_area_ha: ZoneArea
    estimated_harvest_kg: Decimal | None
    zones: list[SowingZoneResult]
    crop_economics: list[SowingCropEconomicsInput] = Field(default_factory=list)
    economics: SowingPlanEconomics | None = None


class SowingPlanSnapshot(Contract):
    plan_version: PlanVersion
    saved_at: AwareDatetime
    shared_at: AwareDatetime | None
    plan: SowingPlanResult


class SowingPlanState(Contract):
    context_version: ContextVersion
    declared_area_ha: Decimal
    sale_month: date
    crop_options: list[SowingCropOption]
    default_crop_economics: list[SowingCropEconomicsDefaults]
    cooperative_capacities: list[ConfirmedCapacity] = Field(default_factory=list)
    default_input: SowingPlanInput
    draft: SowingPlanSnapshot | None
    shared_version: int | None


class DraftWrite(Contract):
    expected_plan_version: PlanVersion
    plan: SowingPlanInput


class PlanShare(Contract):
    expected_plan_version: Annotated[int, Field(ge=1)]


class SowingMetrics(Contract):
    parcel_id: Identifier
    producer_name: str
    municipality: str
    state: str
    current_context_version: ContextVersion
    shared_plan: SowingPlanSnapshot | None


def planning_context(repository: Repository, parcel_id: str) -> ParcelContext:
    demo = parcel_id == base.PARCEL_ID
    if not demo and not parcel_id.startswith("parcel-local-"):
        raise NotFound("No existe la parcela solicitada.")
    context = repository.get(parcel_id)
    expected_kind = "composite_demo" if demo else "real"
    if (context.parcel.id != parcel_id or context.producer.persona_kind != expected_kind
            or (demo and context.producer.id != base.PRODUCER_ID)):
        raise NotFound("No existe la parcela solicitada.")
    return context


def crop_options(context: ParcelContext) -> list[SowingCropOption]:
    demo = context.producer.persona_kind == "composite_demo"
    use_municipal = (context.parcel.state, context.parcel.municipality, context.parcel.production_system) == (
        "Campeche", "Hopelchén", "rainfed",
    )
    options = []
    for crop_id in ("calabaza", "frijol", "maiz", "saladette"):
        reference = None
        if use_municipal:
            try:
                reference = yield_reference(crop_id, "spring_summer").reference
            except YieldReferenceUnavailable:
                pass
        value = reference.median_t_ha if reference else Decimal(DEMO[crop_id][1]) if demo else None
        options.append(SowingCropOption(
            crop_id=crop_id, label=base.CROP_LABELS[crop_id].capitalize().replace("saladette", "Saladette"),
            yield_t_ha=value, yield_basis="municipal_median" if reference else "demo_assumption" if demo else "missing",
            yield_reference_url=MUNICIPAL_SOURCE if reference else None,
        ))
    return options


def default_input(context: ParcelContext) -> SowingPlanInput:
    declared = Decimal(str(context.parcel.declared_area_ha)).quantize(Decimal("0.001"), rounding=ROUND_DOWN)
    if declared <= 0:
        raise base.BaseError("La parcela necesita por lo menos 0,001 ha disponibles para crear un plan.")
    if context.producer.persona_kind != "composite_demo":
        return SowingPlanInput(context_version=context.context_version, area_ha=declared, zones=[
            SowingZoneInput(zone_id="zone-a", crop_id="maiz", area_ha=declared),
        ])
    first_area = (declared * Decimal(2) / 3).quantize(Decimal("0.001"), rounding=ROUND_HALF_UP)
    return SowingPlanInput(context_version=context.context_version, area_ha=declared, zones=[
        SowingZoneInput(zone_id="zone-a", crop_id="calabaza", area_ha=first_area),
        SowingZoneInput(zone_id="zone-b", crop_id="frijol", area_ha=declared - first_area),
    ])


def default_crop_economics() -> list[SowingCropEconomicsDefaults]:
    return [
        SowingCropEconomicsDefaults(
            crop_id=crop_id,
            cost_per_ha=SowingEconomicsInputValue(
                value=(Decimal(cost) / DEMO_BASE_AREA_HA).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP),
                basis="assumption", source="Escenario de Don Tino: costo simulado de 12 ha prorrateado por hectárea.",
            ),
            sale_capacity_kg=SowingEconomicsInputValue(
                value=Decimal(capacity), basis="assumption", source="Cupo simulado del escenario de Don Tino.",
            ),
        )
        for crop_id, (_, _, _, cost, capacity) in DEMO.items()
    ]


def _plan_sale_month(day: date) -> date:
    return date(day.year + (day.month >= 10), 10, 1)


def _cooperative_capacities(context: ParcelContext, sale_month: date, as_of: datetime) -> dict[str, ConfirmedCapacity]:
    sale_end = sale_month.replace(day=monthrange(sale_month.year, sale_month.month)[1])
    matching = [
        item for item in context.confirmed_purchase_capacities
        if item.crop_id in DEMO and item.sales_structure == "cooperative" and item.cycle_offset == 1
        and item.confirmed_at <= as_of
        and item.sales_period.start <= sale_end and item.sales_period.end >= sale_month
    ]
    selected = {}
    # Una confirmación más reciente puede sustituir la anterior. La ficha no identifica compradores para sumar cupos.
    for item in sorted(matching, key=lambda row: (row.confirmed_at, -row.cupo_range[0], -row.cupo_range[1], row.id)):
        selected[item.crop_id] = item
    return selected


def _allocate_sales(marketable: dict[str, Decimal], capacity: Decimal) -> dict[str, Decimal]:
    # Reparte el cupo del cultivo en unidades de gramos. Los restos más grandes reciben el redondeo.
    weights = {zone_id: int(weight / KG_PRECISION) for zone_id, weight in marketable.items()}
    total = sum(weights.values())
    units_to_sell = min(total, int(capacity / KG_PRECISION))
    if not total:
        return dict.fromkeys(weights, Decimal(0))
    parts = {zone_id: divmod(units_to_sell * weight, total) for zone_id, weight in weights.items()}
    missing = units_to_sell - sum(units for units, _ in parts.values())
    ordered = sorted(parts, key=lambda zone_id: (-parts[zone_id][1], zone_id))
    rounded_up = set(ordered[:missing])
    return {zone_id: (units + (zone_id in rounded_up)) * KG_PRECISION for zone_id, (units, _) in parts.items()}


def _commercial_estimate(context: ParcelContext, overrides: list[SowingCropEconomicsInput],
                         zones: list[SowingZoneResult], sale_month: date, as_of: datetime
                         ) -> tuple[SowingPlanEconomics, dict[str, SowingZoneEconomics]]:
    try:
        forecasts = producer_forecasts(as_of.date())
    except ProducerCatalogUnavailable:
        forecasts = []
    demo = context.producer.persona_kind == "composite_demo"
    inputs = {row.crop_id: row for row in overrides}
    defaults = {row.crop_id: row for row in default_crop_economics()} if demo else {}
    confirmations = _cooperative_capacities(context, sale_month, as_of)
    planted = [zone for zone in zones if zone.area_ha]
    results = {}
    crops = []
    missing_inputs = []
    for crop_id in dict.fromkeys(zone.crop_id for zone in planted):
        crop_zones = [zone for zone in planted if zone.crop_id == crop_id]
        default = defaults.get(crop_id)
        override = inputs.get(crop_id) or SowingCropEconomicsInput(crop_id=crop_id)
        cost = override.cost_per_ha or (default.cost_per_ha if default else None)
        fallback = override.sale_capacity_kg or (default.sale_capacity_kg if default else None)
        confirmation = confirmations.get(crop_id)
        capacity = (SowingAppliedCapacity(value=Decimal(confirmation.cupo_range[0]), basis="cooperative_confirmation")
                    if confirmation else SowingAppliedCapacity(**fallback.model_dump()) if fallback else None)
        baseline = Decimal(DEMO[crop_id][0]) if demo else None
        loss = override.loss_fraction.value if override.loss_fraction else Decimal(DEMO[crop_id][2]) if demo else None
        if override.price_mxn_kg:
            price, basis, reference = override.price_mxn_kg.value, "local_assumption", None
        else:
            values, basis, reference = price_for_crop(crop_id, sale_month, baseline, context, forecasts, "forecast")
            if basis != "local_forecast":
                observed = price_for_crop(crop_id, sale_month, baseline, context, forecasts, "mexican_observation")
                if observed[1] == "mexican_observation":
                    values, basis, reference = observed
            price = values[0] if values[0] is not None else baseline

        fields = [name for name, value in (
            ("yield_t_ha", crop_zones[0].yield_t_ha), ("price_mxn_kg", price), ("loss_fraction", loss),
            ("cost_per_ha", cost), ("sale_capacity_kg", capacity),
        ) if value is None]
        if fields:
            missing_inputs.append(SowingCropMissingInputs(crop_id=crop_id, fields=fields))
        if price is None or loss is None or cost is None or capacity is None:
            continue
        crops.append(SowingCropEconomics(
            crop_id=crop_id, cost_per_ha=cost, sale_capacity_kg=capacity, capacity_confirmation=confirmation, loss_fraction=loss,
            loss_input=override.loss_fraction, price_mxn_kg=price, price_basis=basis, price_input=override.price_mxn_kg,
            reference_geography=reference.series.geography if reference else None,
            reference_product=reference.series.product if reference else None,
            reference_observed_month=reference.latest_observed_month if reference else None,
            reference_observed_url=(reference.series.rows[-1].source_url or reference.series.source_url) if reference else None,
        ))
        marketable = {zone.zone_id: (zone.estimated_harvest_kg * (1 - loss)).quantize(KG_PRECISION, rounding=ROUND_HALF_UP)
                      for zone in crop_zones if zone.estimated_harvest_kg is not None}
        if len(marketable) != len(crop_zones):
            continue
        sold = _allocate_sales(marketable, capacity.value)
        for zone in crop_zones:
            revenue = (sold[zone.zone_id] * price).quantize(MONEY_PRECISION, rounding=ROUND_HALF_UP)
            total_cost = (zone.area_ha * cost.value).quantize(MONEY_PRECISION, rounding=ROUND_HALF_UP)
            results[zone.zone_id] = SowingZoneEconomics(marketable_kg=marketable[zone.zone_id], sold_kg=sold[zone.zone_id],
                                                       revenue_mxn=revenue, cost_mxn=total_cost, margin_mxn=revenue - total_cost)
    margin = sum((zone.margin_mxn for zone in results.values()), Decimal(0)) if len(results) == len(planted) else None
    return SowingPlanEconomics(sale_month=sale_month, estimated_margin_mxn=margin, crops=crops,
                               missing_inputs=missing_inputs), results


def simulate(context: ParcelContext, plan: SowingPlanInput) -> SowingPlanResult:
    require_version(context, plan.context_version)
    if plan.area_ha > Decimal(str(context.parcel.declared_area_ha)):
        raise base.BaseError("La superficie del plan supera las hectáreas declaradas de la parcela.")
    options = {option.crop_id: option for option in crop_options(context)}
    inputs = {row.crop_id: row for row in plan.crop_economics}
    zones = []
    for zone in plan.zones:
        option = options[zone.crop_id]
        terms = inputs.get(zone.crop_id)
        reported_yield = terms.yield_t_ha if terms else None
        yield_t_ha = reported_yield.value if reported_yield else option.yield_t_ha
        yield_basis = option.yield_basis
        if reported_yield:
            yield_basis = "reported" if reported_yield.basis == "reported" else "user_assumption"
        harvest = None
        if yield_t_ha is not None:
            harvest = (zone.area_ha * yield_t_ha * 1000).quantize(KG_PRECISION, rounding=ROUND_HALF_UP)
        zones.append(SowingZoneResult(
            **zone.model_dump(), crop_label=option.label, estimated_harvest_kg=harvest,
            yield_t_ha=yield_t_ha, yield_basis=yield_basis, yield_input=reported_yield,
            yield_reference_url=None if reported_yield else option.yield_reference_url,
        ))
    now = datetime.now(CAMPECHE_TIME_ZONE)
    sale_month = _plan_sale_month(now.date())
    economics, zone_economics = _commercial_estimate(context, plan.crop_economics, zones, sale_month, now)
    zones = [zone.model_copy(update={"economics": zone_economics.get(zone.zone_id)}) for zone in zones]
    assigned = sum((zone.area_ha for zone in zones), Decimal(0))
    harvest_complete = all(zone.estimated_harvest_kg is not None for zone in zones if zone.area_ha)
    total_harvest = sum((zone.estimated_harvest_kg or Decimal(0) for zone in zones), Decimal(0))
    return SowingPlanResult(context_version=plan.context_version, area_ha=plan.area_ha,
                            campaign_year=sale_month.year, zones=zones, crop_economics=plan.crop_economics, economics=economics,
                            assigned_area_ha=assigned, unassigned_area_ha=plan.area_ha - assigned,
                            estimated_harvest_kg=total_harvest if harvest_complete else None)


def _snapshot(row) -> SowingPlanSnapshot | None:
    if row is None:
        return None
    version, saved_at, shared_at, data = row
    return SowingPlanSnapshot(plan_version=version, saved_at=saved_at, shared_at=shared_at,
                              plan=SowingPlanResult.model_validate(data))


class SowingRepository:
    def __init__(self, repository: Repository):
        self.repository = repository

    def latest_draft(self, parcel_id: str) -> SowingPlanSnapshot | None:
        try:
            with self.repository.connect() as db:
                row = db.execute("""
                    SELECT d.plan_version, d.saved_at, s.shared_at, d.snapshot
                    FROM luumia_sowing_drafts d
                    LEFT JOIN luumia_sowing_shares s USING (parcel_id, plan_version)
                    WHERE d.parcel_id = %s ORDER BY d.plan_version DESC LIMIT 1
                """, (parcel_id,)).fetchone()
            return _snapshot(row)
        except (psycopg.Error, ValueError) as error:
            raise StorageError("No fue posible leer el borrador de siembra.") from error

    def latest_shared(self, parcel_id: str) -> SowingPlanSnapshot | None:
        try:
            with self.repository.connect() as db:
                row = db.execute("""
                    SELECT d.plan_version, d.saved_at, s.shared_at, d.snapshot
                    FROM luumia_sowing_shares s
                    JOIN luumia_sowing_drafts d USING (parcel_id, plan_version)
                    WHERE s.parcel_id = %s ORDER BY s.plan_version DESC LIMIT 1
                """, (parcel_id,)).fetchone()
            return _snapshot(row)
        except (psycopg.Error, ValueError) as error:
            raise StorageError("No fue posible leer el plan compartido.") from error

    def save(self, parcel_id: str, plan: SowingPlanResult, expected: int) -> SowingPlanSnapshot:
        try:
            with self.repository.connect() as db:
                db.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (f"sowing-plan:{parcel_id}",))
                row = db.execute("""
                    INSERT INTO luumia_sowing_drafts (parcel_id, plan_version, context_version, snapshot)
                    SELECT %s, %s, %s, %s
                    WHERE %s = (SELECT coalesce(max(plan_version), 0) FROM luumia_sowing_drafts WHERE parcel_id = %s)
                    AND %s = (SELECT max(context_version) FROM milpia_context_versions WHERE parcel_id = %s)
                    ON CONFLICT DO NOTHING RETURNING plan_version, saved_at, NULL, snapshot
                """, (parcel_id, expected + 1, plan.context_version, Jsonb(plan.model_dump(mode="json")),
                      expected, parcel_id, plan.context_version, parcel_id)).fetchone()
            snapshot = _snapshot(row)
        except (psycopg.Error, ValueError) as error:
            raise StorageError("No fue posible guardar el borrador de siembra.") from error
        if snapshot is None:
            raise Conflict("La ficha o el plan cambió. Carga su versión vigente antes de volver a guardar.")
        return snapshot

    def share(self, parcel_id: str, expected: int) -> SowingPlanSnapshot:
        try:
            with self.repository.connect() as db:
                db.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (f"sowing-plan:{parcel_id}",))
                plan = db.execute("""
                    SELECT d.plan_version, d.saved_at, s.shared_at, d.snapshot
                    FROM luumia_sowing_drafts d
                    LEFT JOIN luumia_sowing_shares s USING (parcel_id, plan_version)
                    WHERE d.parcel_id = %s AND d.plan_version = %s
                    AND d.plan_version = (SELECT max(plan_version) FROM luumia_sowing_drafts WHERE parcel_id = d.parcel_id)
                    AND (s.shared_at IS NOT NULL OR d.context_version = (
                        SELECT max(context_version) FROM milpia_context_versions WHERE parcel_id = d.parcel_id
                    ))
                """, (parcel_id, expected)).fetchone()
                if plan is None:
                    raise Conflict("Guarda el plan vigente con la ficha actual antes de compartirlo.")
                version, saved_at, shared_at, data = plan
                if shared_at is None:
                    shared_at, = db.execute("""
                        INSERT INTO luumia_sowing_shares (parcel_id, plan_version) VALUES (%s, %s) RETURNING shared_at
                    """, (parcel_id, version)).fetchone()
            snapshot = SowingPlanSnapshot(plan_version=version, saved_at=saved_at, shared_at=shared_at,
                                          plan=SowingPlanResult.model_validate(data))
        except Conflict:
            raise
        except (psycopg.Error, ValueError) as error:
            raise StorageError("No fue posible compartir el plan de siembra.") from error
        return snapshot


router = APIRouter(prefix="/v1/contexts/{parcel_id}", tags=["Siembra por zonas"])
_READ_ERRORS = {404: {"model": ApiError}, 503: {"model": ApiError}}
_WRITE_ERRORS = {**_READ_ERRORS, 409: {"model": ApiError}, 422: {"model": ApiError}}


@router.get("/sowing-plan", response_model=SowingPlanState, responses=_READ_ERRORS)
def get_sowing_plan(parcel_id: str) -> SowingPlanState:
    repository = Repository()
    context = planning_context(repository, parcel_id)
    storage = SowingRepository(repository)
    shared = storage.latest_shared(parcel_id)
    now = datetime.now(CAMPECHE_TIME_ZONE)
    sale_month = _plan_sale_month(now.date())
    return SowingPlanState(context_version=context.context_version,
                           declared_area_ha=Decimal(str(context.parcel.declared_area_ha)), sale_month=sale_month,
                           crop_options=crop_options(context), default_input=default_input(context),
                           default_crop_economics=default_crop_economics() if context.producer.persona_kind == "composite_demo" else [],
                           cooperative_capacities=list(_cooperative_capacities(context, sale_month, now).values()),
                           draft=storage.latest_draft(parcel_id), shared_version=shared.plan_version if shared else None)


@router.post("/sowing-plan/preview", response_model=SowingPlanResult, responses=_WRITE_ERRORS)
def preview_sowing_plan(parcel_id: str, body: SowingPlanInput) -> SowingPlanResult:
    return simulate(planning_context(Repository(), parcel_id), body)


@router.put("/sowing-plan/draft", response_model=SowingPlanSnapshot, responses=_WRITE_ERRORS)
def save_sowing_plan(parcel_id: str, body: DraftWrite) -> SowingPlanSnapshot:
    repository = Repository()
    result = simulate(planning_context(repository, parcel_id), body.plan)
    return SowingRepository(repository).save(parcel_id, result, body.expected_plan_version)


@router.post("/sowing-plan/share", response_model=SowingPlanSnapshot, responses=_WRITE_ERRORS)
def share_sowing_plan(parcel_id: str, body: PlanShare) -> SowingPlanSnapshot:
    repository = Repository()
    planning_context(repository, parcel_id)
    return SowingRepository(repository).share(parcel_id, body.expected_plan_version)


@router.get("/sowing-metrics", response_model=SowingMetrics, responses=_READ_ERRORS)
def get_sowing_metrics(parcel_id: str) -> SowingMetrics:
    repository = Repository()
    context = planning_context(repository, parcel_id)
    return SowingMetrics(parcel_id=parcel_id, producer_name=context.producer.display_name,
                         municipality=context.parcel.municipality, state=context.parcel.state,
                         current_context_version=context.context_version,
                         shared_plan=SowingRepository(repository).latest_shared(parcel_id))
