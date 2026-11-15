"""Registro de ventas por zona y comparación con el plan compartido."""

from collections import defaultdict
from datetime import UTC, date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Annotated, Literal
from uuid import UUID

import psycopg
from fastapi import APIRouter, Response
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from pydantic import AwareDatetime, Field, StringConstraints

from . import base
from .contracts import ApiError, Contract, Identifier, Nonnegative
from .sowing_plan import CAMPECHE_TIME_ZONE, MONEY_PRECISION, SowingPlanResult, planning_context
from .storage import Conflict, NotFound, Repository, StorageError


PublishedPlanVersion = Annotated[int, Field(ge=1, le=2**63 - 1)]
SaleRevision = Annotated[int, Field(ge=1, le=2**63 - 1)]
SoldKg = Annotated[Decimal, Field(gt=0, max_digits=12, decimal_places=3)]
SaleCost = Annotated[Decimal, Field(ge=0, max_digits=16, decimal_places=2)]
SaleChangeReason = Annotated[str, StringConstraints(strip_whitespace=True, max_length=240)]


class ZoneSaleFields(Contract):
    zone_id: Identifier
    sold_on: date
    sold_kg: SoldKg
    price_mxn_kg: Nonnegative
    cost_mxn: SaleCost
    reference: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=180)] | None = None


SALE_FIELDS = set(ZoneSaleFields.model_fields)


class ZoneSaleRegistration(ZoneSaleFields):
    sale_id: UUID
    plan_version: PublishedPlanVersion


class ZoneSale(ZoneSaleRegistration):
    revision: SaleRevision = 1
    recorded_at: AwareDatetime
    revenue_mxn: Decimal
    margin_mxn: Decimal


class ZoneSaleVoid(Contract):
    change_id: UUID
    expected_revision: SaleRevision
    reason: SaleChangeReason | None = None


class ZoneSaleCorrection(ZoneSaleFields, ZoneSaleVoid):
    pass


class ZoneSaleChange(Contract):
    change_id: UUID
    action: Literal["corrected", "voided"]
    previous: ZoneSale
    replacement: ZoneSale | None
    recorded_at: AwareDatetime
    reason: SaleChangeReason | None = None


class PublishedSalePlan(Contract):
    plan_version: PublishedPlanVersion
    context_version: PublishedPlanVersion
    campaign_year: int
    shared_at: AwareDatetime


class SaleComparison(Contract):
    estimated_margin_mxn: Decimal | None = None
    estimated_sold_kg: Decimal | None = None
    actual_sold_kg: Decimal | None = None
    actual_revenue_mxn: Decimal | None = None
    actual_cost_mxn: Decimal | None = None
    actual_margin_mxn: Decimal | None = None
    margin_difference_mxn: Decimal | None = None
    sale_count: int = 0


class ZoneSaleComparison(SaleComparison):
    zone_id: Identifier
    crop_label: str


class SowingSalesReport(Contract):
    plans: list[PublishedSalePlan]
    plan_version: PublishedPlanVersion | None
    sales: list[ZoneSale]
    zones: list[ZoneSaleComparison]
    totals: SaleComparison
    history: list[ZoneSaleChange] = Field(default_factory=list)


def _compare(sales: list[ZoneSale], estimated_sold_kg: Decimal | None, estimated_margin_mxn: Decimal | None) -> SaleComparison:
    actual_margin = sum((sale.margin_mxn for sale in sales), Decimal(0)) if sales else None
    return SaleComparison(
        estimated_margin_mxn=estimated_margin_mxn,
        estimated_sold_kg=estimated_sold_kg,
        actual_sold_kg=sum((sale.sold_kg for sale in sales), Decimal(0)) if sales else None,
        actual_revenue_mxn=sum((sale.revenue_mxn for sale in sales), Decimal(0)) if sales else None,
        actual_cost_mxn=sum((sale.cost_mxn for sale in sales), Decimal(0)) if sales else None,
        actual_margin_mxn=actual_margin,
        margin_difference_mxn=(actual_margin - estimated_margin_mxn
                               if actual_margin is not None and estimated_margin_mxn is not None else None),
        sale_count=len(sales),
    )


def build_report(plans: list[PublishedSalePlan], plan_version: int, plan: SowingPlanResult,
                 sales: list[ZoneSale], history: list[ZoneSaleChange] | None = None) -> SowingSalesReport:
    sales_by_zone = defaultdict(list)
    for sale in sales:
        sales_by_zone[sale.zone_id].append(sale)

    zones = []
    for zone in plan.zones:
        if not zone.area_ha:
            continue
        economics = zone.economics
        comparison = _compare(sales_by_zone[zone.zone_id], economics.sold_kg if economics else None,
                              economics.margin_mxn if economics else None)
        zones.append(ZoneSaleComparison(zone_id=zone.zone_id, crop_label=zone.crop_label, **comparison.model_dump()))

    # La estimación total supone el plan completo. Mostrar un subtotal de estimaciones faltantes sería engañoso.
    complete = bool(zones) and all(zone.estimated_sold_kg is not None for zone in zones)
    estimated_sold_kg = sum((zone.estimated_sold_kg for zone in zones), Decimal(0)) if complete else None
    estimate = plan.economics.estimated_margin_mxn if plan.economics else None
    return SowingSalesReport(plans=plans, plan_version=plan_version, sales=sales, zones=zones,
                            totals=_compare(sales, estimated_sold_kg, estimate), history=history or [])


def _sale_revenue(sale: ZoneSaleFields) -> Decimal:
    return (sale.sold_kg * sale.price_mxn_kg).quantize(MONEY_PRECISION, rounding=ROUND_HALF_UP)


def _validate_sale_date(sold_on: date) -> None:
    if sold_on > datetime.now(CAMPECHE_TIME_ZONE).date():
        raise base.BaseError("La fecha de la venta no puede estar en el futuro.")


def _validate_sale_zone(plan: SowingPlanResult, zone_id: str) -> None:
    if not any(zone.zone_id == zone_id and zone.area_ha > 0 for zone in plan.zones):
        raise base.BaseError("Selecciona una zona sembrada de la versión compartida.")


def _replayed_change(event: ZoneSaleChange, body: ZoneSaleVoid) -> bool:
    if event.previous.revision != body.expected_revision or event.reason != (body.reason or None):
        return False
    if isinstance(body, ZoneSaleCorrection):
        return event.replacement is not None and (
            event.replacement.model_dump(include=SALE_FIELDS) == body.model_dump(include=SALE_FIELDS))
    return event.action == "voided"


class SowingSalesRepository:
    def __init__(self, repository: Repository):
        self.repository = repository

    def _published_plan(self, cursor, parcel_id: str, version: int) -> SowingPlanResult:
        row = cursor.execute("""
            SELECT d.snapshot FROM luumia_sowing_shares s
            JOIN luumia_sowing_drafts d USING (parcel_id, plan_version)
            WHERE s.parcel_id = %s AND s.plan_version = %s
        """, (parcel_id, version)).fetchone()
        if row is None:
            raise NotFound("No existe esa versión compartida del plan de siembra.")
        return SowingPlanResult.model_validate(row["snapshot"])

    def _report(self, cursor, parcel_id: str, version: int | None,
                plan: SowingPlanResult | None = None) -> SowingSalesReport:
        rows = cursor.execute("""
            SELECT s.plan_version, d.context_version, (d.snapshot ->> 'campaign_year')::int AS campaign_year, s.shared_at
            FROM luumia_sowing_shares s JOIN luumia_sowing_drafts d USING (parcel_id, plan_version)
            WHERE s.parcel_id = %s ORDER BY s.plan_version DESC
        """, (parcel_id,)).fetchall()
        plans = [PublishedSalePlan.model_validate(row) for row in rows]
        if version is None:
            if not plans:
                return SowingSalesReport(plans=[], plan_version=None, sales=[], zones=[], totals=SaleComparison())
            version = plans[0].plan_version
        if plan is None:
            plan = self._published_plan(cursor, parcel_id, version)

        entries = cursor.execute("""
            SELECT s.sale_id, s.plan_version, s.zone_id, s.sold_on, s.sold_kg, s.price_mxn_kg, s.cost_mxn,
                   s.reference, s.recorded_at, s.revenue_mxn, s.revenue_mxn - s.cost_mxn AS margin_mxn,
                   COALESCE((
                       SELECT jsonb_agg(jsonb_build_object(
                           'change_id', changes.change_id, 'action', changes.action, 'previous', changes.previous,
                           'replacement', changes.replacement, 'recorded_at', changes.recorded_at, 'reason', changes.reason
                       ) ORDER BY changes.revision)
                       FROM luumia_zone_sale_changes changes
                       WHERE (changes.parcel_id, changes.sale_id) = (s.parcel_id, s.sale_id)
                   ), '[]'::jsonb) AS changes
            FROM luumia_zone_sales s WHERE s.parcel_id = %s AND s.plan_version = %s
        """, (parcel_id, version)).fetchall()
        sales = []
        history = []
        for row in entries:
            changes = [ZoneSaleChange.model_validate(value) for value in row.pop("changes")]
            history.extend(changes)
            current = changes[-1].replacement if changes else ZoneSale.model_validate(row)
            if current is not None:
                sales.append(current)
        sales.sort(key=lambda sale: (sale.sold_on, sale.recorded_at, sale.sale_id), reverse=True)
        history.sort(key=lambda event: (event.recorded_at, event.previous.sale_id, event.previous.revision), reverse=True)
        return build_report(plans, version, plan, sales, history)

    def report(self, parcel_id: str, version: int | None) -> SowingSalesReport:
        try:
            with self.repository.connect() as db, db.cursor(row_factory=dict_row) as cursor:
                return self._report(cursor, parcel_id, version)
        except (psycopg.Error, ValueError) as error:
            raise StorageError("No fue posible consultar las ventas de la parcela.") from error

    def _check_replay(self, cursor, parcel_id: str, sale: ZoneSaleRegistration) -> bool:
        existing = cursor.execute("""
            SELECT sale_id, plan_version, zone_id, sold_on, sold_kg, price_mxn_kg, cost_mxn, reference
            FROM luumia_zone_sales WHERE parcel_id = %s AND sale_id = %s
        """, (parcel_id, sale.sale_id)).fetchone()
        if existing is None:
            return False
        if existing != sale.model_dump():
            raise Conflict("Ese identificador ya corresponde a una venta con otros datos.")
        return True

    def record(self, parcel_id: str, sale: ZoneSaleRegistration) -> tuple[SowingSalesReport, bool]:
        _validate_sale_date(sale.sold_on)
        try:
            with self.repository.connect() as db, db.cursor(row_factory=dict_row) as cursor:
                if self._check_replay(cursor, parcel_id, sale):
                    return self._report(cursor, parcel_id, sale.plan_version), False

                plan = self._published_plan(cursor, parcel_id, sale.plan_version)
                _validate_sale_zone(plan, sale.zone_id)

                revenue = _sale_revenue(sale)
                inserted = cursor.execute("""
                    INSERT INTO luumia_zone_sales
                        (parcel_id, sale_id, plan_version, zone_id, sold_on, sold_kg, price_mxn_kg, cost_mxn, reference, revenue_mxn)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (parcel_id, sale_id) DO NOTHING RETURNING sale_id
                """, (parcel_id, sale.sale_id, sale.plan_version, sale.zone_id, sale.sold_on, sale.sold_kg,
                      sale.price_mxn_kg, sale.cost_mxn, sale.reference, revenue)).fetchone()
                if inserted is None:
                    self._check_replay(cursor, parcel_id, sale)
                return self._report(cursor, parcel_id, sale.plan_version, plan), inserted is not None
        except (Conflict, base.BaseError):
            raise
        except (psycopg.Error, ValueError) as error:
            raise StorageError("No fue posible registrar la venta de la zona.") from error

    def change(self, parcel_id: str, sale_id: UUID, body: ZoneSaleVoid) -> SowingSalesReport:
        correction = body if isinstance(body, ZoneSaleCorrection) else None
        if correction is not None:
            _validate_sale_date(correction.sold_on)
        try:
            with self.repository.connect() as db, db.cursor(row_factory=dict_row) as cursor:
                # Bloquea el registro original para serializar los cambios sin modificarlo.
                original = cursor.execute("""
                    SELECT sale_id, plan_version, zone_id, sold_on, sold_kg, price_mxn_kg, cost_mxn,
                           reference, recorded_at, revenue_mxn, revenue_mxn - cost_mxn AS margin_mxn
                    FROM luumia_zone_sales WHERE parcel_id = %s AND sale_id = %s FOR UPDATE
                """, (parcel_id, sale_id)).fetchone()
                if original is None:
                    raise NotFound("No existe esa venta en la parcela.")
                version = original["plan_version"]

                recorded = cursor.execute("""
                    SELECT change_id, action, previous, replacement, recorded_at, reason
                    FROM luumia_zone_sale_changes WHERE parcel_id = %s AND sale_id = %s AND change_id = %s
                """, (parcel_id, sale_id, body.change_id)).fetchone()
                if recorded is not None:
                    if not _replayed_change(ZoneSaleChange.model_validate(recorded), body):
                        raise Conflict("Ese identificador ya se usó para otro cambio de esta venta.")
                    return self._report(cursor, parcel_id, version)

                latest = cursor.execute("""
                    SELECT replacement FROM luumia_zone_sale_changes
                    WHERE parcel_id = %s AND sale_id = %s ORDER BY revision DESC LIMIT 1
                """, (parcel_id, sale_id)).fetchone()
                if latest is not None and latest["replacement"] is None:
                    raise Conflict("La venta ya se anuló. Consulta el historial.")
                previous = ZoneSale.model_validate(latest["replacement"] if latest is not None else original)
                if previous.revision != body.expected_revision:
                    raise Conflict("La venta cambió mientras la revisabas. Consulta sus datos vigentes.")

                plan = self._published_plan(cursor, parcel_id, version)
                next_revision = previous.revision + 1
                replacement = None
                if correction is not None:
                    _validate_sale_zone(plan, correction.zone_id)
                    updated = correction.model_dump(include=SALE_FIELDS)
                    if updated == previous.model_dump(include=SALE_FIELDS):
                        raise base.BaseError("Modifica al menos un dato antes de guardar la corrección.")
                    revenue = _sale_revenue(correction)
                    replacement = ZoneSale.model_validate({**previous.model_dump(), **updated, "revision": next_revision,
                                                           "revenue_mxn": revenue, "margin_mxn": revenue - correction.cost_mxn})

                cursor.execute("""
                    INSERT INTO luumia_zone_sale_changes
                        (parcel_id, sale_id, revision, change_id, action, previous, replacement, reason, recorded_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (parcel_id, sale_id, next_revision, body.change_id, "corrected" if replacement else "voided",
                      Jsonb(previous.model_dump(mode="json")),
                      Jsonb(replacement.model_dump(mode="json")) if replacement else None, body.reason or None,
                      datetime.now(UTC)))
                return self._report(cursor, parcel_id, version, plan)
        except (Conflict, base.BaseError):
            raise
        except (psycopg.Error, ValueError) as error:
            raise StorageError("No fue posible guardar el cambio de la venta.") from error


router = APIRouter(prefix="/v1/contexts/{parcel_id}/sowing-sales", tags=["Ventas por zona"])
_READ_ERRORS = {code: {"model": ApiError} for code in (404, 422, 503)}


@router.get("", response_model=SowingSalesReport, responses=_READ_ERRORS)
def get_sowing_sales(parcel_id: str, plan_version: PublishedPlanVersion | None = None) -> SowingSalesReport:
    repository = Repository()
    planning_context(repository, parcel_id)
    return SowingSalesRepository(repository).report(parcel_id, plan_version)


@router.post("", response_model=SowingSalesReport, status_code=201, responses={
    **_READ_ERRORS, 200: {"model": SowingSalesReport, "description": "La venta ya estaba registrada."},
    409: {"model": ApiError},
})
def create_zone_sale(parcel_id: str, body: ZoneSaleRegistration, response: Response) -> SowingSalesReport:
    repository = Repository()
    planning_context(repository, parcel_id)
    report, created = SowingSalesRepository(repository).record(parcel_id, body)
    if not created:
        response.status_code = 200
    return report


_CHANGE_ERRORS = {**_READ_ERRORS, 409: {"model": ApiError}}


@router.put("/{sale_id}", response_model=SowingSalesReport, responses=_CHANGE_ERRORS)
def correct_zone_sale(parcel_id: str, sale_id: UUID, body: ZoneSaleCorrection) -> SowingSalesReport:
    repository = Repository()
    planning_context(repository, parcel_id)
    return SowingSalesRepository(repository).change(parcel_id, sale_id, body)


@router.post("/{sale_id}/void", response_model=SowingSalesReport, responses=_CHANGE_ERRORS)
def void_zone_sale(parcel_id: str, sale_id: UUID, body: ZoneSaleVoid) -> SowingSalesReport:
    repository = Repository()
    planning_context(repository, parcel_id)
    return SowingSalesRepository(repository).change(parcel_id, sale_id, body)
