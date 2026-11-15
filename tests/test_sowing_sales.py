"""Verifica la comparación de ventas capturadas con estimaciones archivadas."""

from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import Mock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from luumia.api import app
from luumia.service import seed
from luumia.sowing_plan import SowingPlanInput, SowingPlanResult, simulate
from luumia.sowing_sales import (
    PublishedSalePlan, SowingSalesRepository, ZoneSale, ZoneSaleChange, ZoneSaleCorrection, ZoneSaleVoid,
    _replayed_change, build_report,
)
from luumia.storage import Repository


BASE_PATH = "/v1/contexts/parcel-don-tino/sowing-sales"
RECORDED_AT = datetime(2026, 11, 14, 22, 0, tzinfo=UTC)


@pytest.fixture
def archived_plan(monkeypatch):
    context = seed()
    monkeypatch.setattr("luumia.sowing_plan.producer_forecasts", lambda _day: [])
    plan = simulate(context, SowingPlanInput(context_version=context.context_version, area_ha="10", zones=[
        {"zone_id": "zone-a", "crop_id": "calabaza", "area_ha": "6"},
        {"zone_id": "zone-b", "crop_id": "frijol", "area_ha": "4"},
        {"zone_id": "zone-c", "crop_id": "maiz", "area_ha": "0"},
    ]))
    metadata = PublishedSalePlan(plan_version=5, context_version=context.context_version,
                                 campaign_year=plan.campaign_year, shared_at=RECORDED_AT)
    return metadata, plan


def sale_payload(**updates):
    return {
        "sale_id": str(uuid4()), "plan_version": 5, "zone_id": "zone-a", "sold_on": "2026-11-14",
        "sold_kg": "29000", "price_mxn_kg": "6.5", "cost_mxn": "45000", "reference": "Folio de prueba",
        **updates,
    }


def test_zone_sales_accumulate_without_capping_or_mutating_the_plan(archived_plan):
    metadata, plan = archived_plan
    previous = plan.model_dump()
    first = ZoneSale(**sale_payload(), recorded_at=RECORDED_AT, revenue_mxn="188500.00", margin_mxn="143500.00")
    second = ZoneSale(**sale_payload(sold_kg="1.001", price_mxn_kg="2.5", cost_mxn="10"), recorded_at=RECORDED_AT,
                      revenue_mxn="2.50", margin_mxn="-7.50")
    report = build_report([metadata], 5, plan, [first, second])
    assert [zone.zone_id for zone in report.zones] == ["zone-a", "zone-b"]
    a, b = report.zones
    assert a.estimated_sold_kg == 28_000 and a.estimated_margin_mxn == 151_000
    assert a.actual_sold_kg == Decimal("29001.001") and a.sale_count == 2
    assert a.actual_revenue_mxn == Decimal("188502.50") and a.actual_cost_mxn == Decimal("45010.00")
    assert a.actual_margin_mxn == Decimal("143492.50") and a.margin_difference_mxn == Decimal("-7507.50")
    assert b.actual_sold_kg is None and b.actual_margin_mxn is None and b.margin_difference_mxn is None
    assert report.totals.estimated_sold_kg == 31_864
    assert report.totals.estimated_margin_mxn == plan.economics.estimated_margin_mxn
    assert report.totals.actual_margin_mxn == a.actual_margin_mxn and report.totals.sale_count == 2
    assert plan.model_dump() == previous


def test_zero_actual_margin_and_missing_archived_estimate_remain_distinct(archived_plan):
    metadata, plan = archived_plan
    legacy = SowingPlanResult.model_validate({
        **plan.model_dump(), "economics": None,
        "zones": [{**zone.model_dump(), "economics": None} for zone in plan.zones],
    })
    entry = ZoneSale(**sale_payload(sold_kg="1", price_mxn_kg="1", cost_mxn="1"), recorded_at=RECORDED_AT,
                     revenue_mxn="1.00", margin_mxn="0.00")
    report = build_report([metadata], 5, legacy, [entry])
    assert report.totals.actual_margin_mxn == 0 and report.totals.sale_count == 1
    assert report.totals.estimated_margin_mxn is None and report.totals.estimated_sold_kg is None
    assert report.totals.margin_difference_mxn is None
    empty = build_report([metadata], 5, plan, [])
    assert empty.totals.actual_margin_mxn is None and empty.totals.sale_count == 0
    assert empty.totals.estimated_margin_mxn is not None


@pytest.mark.parametrize("invalid", [
    {"sold_on": "9999-12-31"},
    {"sold_kg": "0"},
    {"sold_kg": "0.0001"},
    {"price_mxn_kg": "0.0000001"},
    {"cost_mxn": "1.001"},
    {"cost_mxn": "-1"},
    {"sale_id": "invalid"},
    {"plan_version": 0},
])
def test_invalid_zone_sale_is_rejected_before_connection(monkeypatch, invalid):
    monkeypatch.setattr(Repository, "get", lambda self, parcel_id: seed())
    with TestClient(app) as client:
        assert client.post(BASE_PATH, json=sale_payload(**invalid)).status_code == 422


def test_sales_routes_stay_within_don_tinos_demo():
    with TestClient(app) as client:
        outside = "/v1/contexts/parcel-other/sowing-sales"
        assert client.get(outside).status_code == 404
        assert client.post(outside, json=sale_payload()).status_code == 404
        assert client.put(f"{outside}/{uuid4()}", json=correction_payload()).status_code == 404
        assert client.post(f"{outside}/{uuid4()}/void", json=void_payload()).status_code == 404


def correction_payload(**updates):
    data = sale_payload()
    del data["sale_id"], data["plan_version"]
    return {**data, **void_payload(), **updates}


def void_payload(**updates):
    return {"change_id": str(uuid4()), "expected_revision": 1, "reason": "Folio revisado", **updates}


def test_report_projects_corrected_and_voided_transactions_once(archived_plan):
    metadata, plan = archived_plan
    original = ZoneSale(**sale_payload(), recorded_at=RECORDED_AT, revenue_mxn="188500.00", margin_mxn="143500.00")
    corrected = ZoneSale.model_validate({
        **original.model_dump(), "revision": 2, "sold_kg": "23000", "revenue_mxn": "149500.00", "margin_mxn": "104500.00",
    })
    other = ZoneSale(**sale_payload(zone_id="zone-b", sold_kg="1", price_mxn_kg="2", cost_mxn="1"),
                     recorded_at=RECORDED_AT, revenue_mxn="2.00", margin_mxn="1.00")
    correction = ZoneSaleChange(change_id=uuid4(), action="corrected", previous=original, replacement=corrected,
                                recorded_at=RECORDED_AT, reason="Peso ajustado")
    void = ZoneSaleChange(change_id=uuid4(), action="voided", previous=other, replacement=None, recorded_at=RECORDED_AT)
    cursor = Mock()
    cursor.execute.side_effect = [
        Mock(fetchall=Mock(return_value=[metadata.model_dump()])),
        Mock(fetchall=Mock(return_value=[
            {**original.model_dump(exclude={"revision"}), "changes": [correction.model_dump(mode="json")]},
            {**other.model_dump(exclude={"revision"}), "changes": [void.model_dump(mode="json")]},
        ])),
    ]
    report = SowingSalesRepository(Repository())._report(cursor, "parcel-don-tino", 5, plan)
    assert report.sales == [corrected]
    assert report.totals.actual_margin_mxn == Decimal("104500.00")
    assert report.totals.estimated_margin_mxn == plan.economics.estimated_margin_mxn
    assert report.zones[0].actual_sold_kg == 23_000 and report.zones[1].sale_count == 0
    assert report.zones[1].actual_margin_mxn is None
    assert len(report.history) == 2 and {item.change_id for item in report.history} == {correction.change_id, void.change_id}
    assert next(item for item in report.history if item.action == "corrected").previous == original


def test_change_replay_uses_revision_kind_and_normalized_fields():
    original = ZoneSale(**sale_payload(), recorded_at=RECORDED_AT, revenue_mxn="188500.00", margin_mxn="143500.00")
    corrected = ZoneSale.model_validate({
        **original.model_dump(), "revision": 2, "sold_kg": "23000.000", "revenue_mxn": "149500.00", "margin_mxn": "104500.00",
    })
    correction = ZoneSaleChange(change_id=uuid4(), action="corrected", previous=original, replacement=corrected,
                                recorded_at=RECORDED_AT, reason="Peso ajustado")
    retry = correction_payload(change_id=correction.change_id, sold_kg="23000", reason="  Peso ajustado  ")
    assert _replayed_change(correction, ZoneSaleCorrection.model_validate(retry))
    assert not _replayed_change(correction, ZoneSaleCorrection.model_validate({**retry, "expected_revision": 2}))
    assert not _replayed_change(correction, ZoneSaleCorrection.model_validate({**retry, "cost_mxn": "48000"}))
    assert not _replayed_change(correction, ZoneSaleVoid(change_id=correction.change_id, expected_revision=1,
                                                        reason="Peso ajustado"))


@pytest.mark.parametrize("invalid", [
    {"sold_on": "9999-12-31"}, {"sold_kg": "-1"}, {"cost_mxn": "0.002"}, {"expected_revision": 0},
    {"change_id": "invalid"}, {"reason": "x" * 241}, {"plan_version": 7},
])
def test_invalid_correction_is_rejected_before_connection(monkeypatch, invalid):
    monkeypatch.setattr(Repository, "get", lambda self, parcel_id: seed())
    with TestClient(app) as client:
        assert client.put(f"{BASE_PATH}/{uuid4()}", json=correction_payload(**invalid)).status_code == 422
