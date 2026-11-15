"""Verifica el cálculo por zona y rechaza planes inválidos antes de persistir."""

from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from luumia import base, sowing_plan
from luumia.api import app
from luumia.contracts import ConfirmedCapacity, Period, Source
from luumia.service import seed


PLAN_URL = f"/v1/contexts/{base.PARCEL_ID}/sowing-plan"


@pytest.fixture
def endpoint(monkeypatch):
    context = seed()
    monkeypatch.setattr(sowing_plan.Repository, "get", lambda self, parcel_id: context)
    return TestClient(app), context


def test_preview_calculates_independent_zones_without_changing_the_parcel(endpoint):
    client, context = endpoint
    payload = {
        "context_version": context.context_version, "area_ha": "10",
        "zones": [
            {"zone_id": "zone-a", "crop_id": "calabaza", "area_ha": "6"},
            {"zone_id": "zone-b", "crop_id": "frijol", "area_ha": "3.5"},
            {"zone_id": "zone-c", "crop_id": "maiz", "area_ha": "0"},
        ],
    }
    original = context.model_dump(mode="json")
    preview = client.post(f"{PLAN_URL}/preview", json=payload)
    preview.raise_for_status()
    plan = preview.json()
    assert plan["agricultural_cycle"] == "spring_summer"
    assert Decimal(plan["assigned_area_ha"]) == Decimal("9.5")
    assert Decimal(plan["unassigned_area_ha"]) == Decimal("0.5")
    assert Decimal(plan["estimated_harvest_kg"]) == 51_675
    assert [Decimal(zone["estimated_harvest_kg"]) for zone in plan["zones"]] == [48_000, 3_675, 0]
    assert plan["zones"][0]["yield_basis"] == "demo_assumption"
    assert plan["zones"][2]["yield_basis"] == "municipal_median"
    assert Decimal(plan["zones"][2]["yield_t_ha"]) == Decimal("3.585342")
    assert context.model_dump(mode="json") == original


@pytest.mark.parametrize("field,value,status", [
    ("area_ha", "12.001", 422),
    ("area_ha", "5.001", 422),
    ("area_ha", "10.0005", 422),
    ("context_version", 2, 409),
    ("zones", [{"zone_id": "zone-a", "crop_id": "calabaza", "area_ha": "0"}], 422),
    ("zones", [{"zone_id": "zone-a", "crop_id": "otro", "area_ha": "3"}], 422),
    ("zones", [{"zone_id": "zone-a", "crop_id": "frijol", "area_ha": "3"}] * 2, 422),
])
def test_preview_rejects_invalid_area_zones_and_context_version(endpoint, field, value, status):
    client, context = endpoint
    payload = sowing_plan.default_input(context).model_dump(mode="json")
    payload[field] = value
    assert client.post(f"{PLAN_URL}/preview", json=payload).status_code == status


def test_other_parcels_are_outside_the_demo_scope():
    client = TestClient(app)
    assert client.get("/v1/contexts/parcel-other/sowing-plan").status_code == 404
    assert client.get("/v1/contexts/parcel-other/sowing-metrics").status_code == 404


def test_shared_crop_capacity_is_allocated_once_and_costs_cover_each_zone(endpoint, monkeypatch):
    client, context = endpoint
    monkeypatch.setattr(sowing_plan, "producer_forecasts", lambda _as_of: [])
    payload = {
        "context_version": context.context_version, "area_ha": "6",
        "zones": [
            {"zone_id": "zone-a", "crop_id": "calabaza", "area_ha": "2"},
            {"zone_id": "zone-b", "crop_id": "calabaza", "area_ha": "4"},
        ],
        "crop_economics": [{
            "crop_id": "calabaza",
            "cost_per_ha": {"value": "2000", "basis": "assumption"},
            "sale_capacity_kg": {"value": "3000.001", "basis": "reported", "source": "  Referencia de prueba  "},
        }],
    }
    preview = client.post(f"{PLAN_URL}/preview", json=payload)
    preview.raise_for_status()
    plan = preview.json()
    rows = [row["economics"] for row in plan["zones"]]
    assert [Decimal(row["marketable_kg"]) for row in rows] == [14_080, 28_160]
    assert [Decimal(row["sold_kg"]) for row in rows] == [1_000, Decimal("2000.001")]
    assert [Decimal(row["cost_mxn"]) for row in rows] == [4_000, 8_000]
    assert Decimal(plan["economics"]["estimated_margin_mxn"]) == Decimal("9000.01")
    assert plan["economics"]["crops"][0]["sale_capacity_kg"]["source"] == "Referencia de prueba"
    assert plan["economics"]["crops"][0]["price_basis"] == "local_assumption"
    assert plan["crop_economics"][0]["sale_capacity_kg"]["basis"] == "reported"


@pytest.mark.parametrize("capacity", [
    {"value": "1.0001", "basis": "assumption"},
    {"value": "1000", "basis": "reported", "source": " "},
    {"value": "-1", "basis": "assumption"},
])
def test_invalid_sale_capacity_is_rejected(endpoint, capacity):
    client, context = endpoint
    payload = sowing_plan.default_input(context).model_dump(mode="json")
    payload["crop_economics"] = [{"crop_id": "calabaza", "sale_capacity_kg": capacity}]
    assert client.post(f"{PLAN_URL}/preview", json=payload).status_code == 422


def test_zero_capacity_does_not_replace_the_input_and_missing_catalog_uses_demo(endpoint, monkeypatch):
    client, context = endpoint

    def unavailable(_as_of):
        raise sowing_plan.ProducerCatalogUnavailable()

    monkeypatch.setattr(sowing_plan, "producer_forecasts", unavailable)
    payload = sowing_plan.default_input(context).model_dump(mode="json")
    payload["crop_economics"] = [{"crop_id": "calabaza", "sale_capacity_kg": {"value": "0", "basis": "assumption"}}]
    preview = client.post(f"{PLAN_URL}/preview", json=payload)
    preview.raise_for_status()
    plan = preview.json()
    calabaza = plan["zones"][0]["economics"]
    assert Decimal(calabaza["sold_kg"]) == 0
    assert Decimal(calabaza["revenue_mxn"]) == 0
    assert Decimal(calabaza["margin_mxn"]) == -60_000
    assert {crop["price_basis"] for crop in plan["economics"]["crops"]} == {"local_assumption"}


def test_mexican_price_reference_keeps_its_product_and_date(endpoint):
    _, context = endpoint
    plan = sowing_plan.default_input(context)
    zones = [sowing_plan.SowingZoneResult(**zone.model_dump(), crop_label="Test", estimated_harvest_kg=5000,
                                          yield_t_ha="1", yield_basis="demo_assumption", yield_reference_url=None) for zone in plan.zones]
    economics, _ = sowing_plan._commercial_estimate(context, [], zones, date(2027, 10, 1), datetime(2026, 11, 14, tzinfo=UTC))
    frijol = next(row for row in economics.crops if row.crop_id == "frijol")
    assert frijol.price_mxn_kg == Decimal("14.53")
    assert frijol.price_basis == "mexican_observation"
    assert frijol.reference_product and "negro" in frijol.reference_product.lower()
    assert frijol.reference_observed_month == date(2025, 11, 1)
    assert frijol.reference_observed_url and frijol.reference_observed_url.startswith("https://")


def test_legacy_snapshot_does_not_retrospectively_estimate_margin(endpoint):
    _, context = endpoint
    data = sowing_plan.simulate(context, sowing_plan.default_input(context)).model_dump(mode="json")
    del data["economics"]
    del data["crop_economics"]
    for zone in data["zones"]:
        del zone["economics"]
    legacy = sowing_plan.SowingPlanResult.model_validate(data)
    assert legacy.economics is None and not legacy.crop_economics
    assert all(zone.economics is None for zone in legacy.zones)


AS_OF = datetime(2026, 11, 14, 12, tzinfo=UTC)
OCTOBER = Period(start=date(2027, 10, 1), end=date(2027, 10, 31))


def documented_capacity(record_id, *, bounds=(40_000, 45_000), period=OCTOBER, confirmed_at=AS_OF,
                        crop_id="calabaza", structure="cooperative", cycle=1):
    return ConfirmedCapacity(
        id=record_id, crop_id=crop_id, cycle_offset=cycle, sales_period=period, sales_structure=structure,
        cupo_range=bounds, confirmed_at=confirmed_at,
        source=Source(id="buyer-record-qa", name="Folio ficticio de prueba", kind="buyer_document", retrieved_at=AS_OF),
    )


def test_cooperative_matches_crop_channel_cycle_month_and_confirmation_timestamp(endpoint):
    _, context = endpoint
    baseline = documented_capacity("baseline", bounds=(38_000, 39_000), confirmed_at=datetime(2026, 11, 13, tzinfo=UTC))
    later = documented_capacity("later", period=Period(start=OCTOBER.end, end=date(2027, 11, 5)))
    frijol = documented_capacity("frijol-confirmation", crop_id="frijol", bounds=(3_000, 4_000))
    rejected = [
        documented_capacity("other-buyer", structure="buyer_contract", bounds=(0, 0)),
        documented_capacity("other-cycle", cycle=2, bounds=(0, 0)),
        documented_capacity("other-month", period=Period(start=date(2027, 11, 1), end=date(2027, 11, 2)), bounds=(0, 0)),
        documented_capacity("not-yet-confirmed", confirmed_at=datetime(2026, 11, 14, 13, tzinfo=UTC), bounds=(0, 0)),
        documented_capacity("other-crop", crop_id="chile", bounds=(0, 0)),
        documented_capacity("same-instant-higher-capacity", bounds=(42_000, 45_000)),
    ]
    context = context.model_copy(update={"confirmed_purchase_capacities": [later, frijol, *rejected, baseline]})
    assert sowing_plan._cooperative_capacities(context, OCTOBER.start, AS_OF) == {"calabaza": later, "frijol": frijol}


def test_confirmed_lower_capacity_takes_priority_and_is_archived_once(endpoint, monkeypatch):
    client, context = endpoint

    class TestClock(datetime):
        @classmethod
        def now(cls, tz):
            return AS_OF.astimezone(tz)

    monkeypatch.setattr(sowing_plan, "datetime", TestClock)
    monkeypatch.setattr(sowing_plan, "producer_forecasts", lambda _as_of: [])
    monkeypatch.setattr(sowing_plan.SowingRepository, "latest_draft", lambda self, parcel_id: None)
    monkeypatch.setattr(sowing_plan.SowingRepository, "latest_shared", lambda self, parcel_id: None)
    payload = {
        "context_version": context.context_version, "area_ha": "6",
        "zones": [
            {"zone_id": "zone-a", "crop_id": "calabaza", "area_ha": "2"},
            {"zone_id": "zone-b", "crop_id": "calabaza", "area_ha": "4"},
        ],
        "crop_economics": [{
            "crop_id": "calabaza",
            "sale_capacity_kg": {"value": "28000", "basis": "reported", "source": "Estimación manual de prueba"},
        }],
    }
    fallback = client.post(f"{PLAN_URL}/preview", json=payload)
    fallback.raise_for_status()
    archived = fallback.json()
    del archived["economics"]["crops"][0]["capacity_confirmation"]
    legacy = sowing_plan.SowingPlanResult.model_validate(archived)
    assert legacy.economics.estimated_margin_mxn == 151_000
    assert legacy.economics.crops[0].capacity_confirmation is None
    confirmation = documented_capacity("cooperative-qa")
    confirmed_context = context.model_copy(update={"confirmed_purchase_capacities": [confirmation]})
    monkeypatch.setattr(sowing_plan.Repository, "get", lambda self, parcel_id: confirmed_context)

    state = client.get(PLAN_URL)
    state.raise_for_status()
    assert state.json()["sale_month"] == "2027-10-01"
    assert state.json()["cooperative_capacities"] == [confirmation.model_dump(mode="json")]
    preview = client.post(f"{PLAN_URL}/preview", json=payload)
    preview.raise_for_status()
    completed = sowing_plan.SowingPlanResult.model_validate(preview.json())
    row = completed.economics.crops[0]
    assert row.capacity_confirmation == confirmation
    assert row.sale_capacity_kg.basis == "cooperative_confirmation" and row.sale_capacity_kg.value == 40_000
    assert completed.crop_economics[0].sale_capacity_kg.value == 28_000
    assert [zone.economics.sold_kg for zone in completed.zones] == [Decimal("13333.333"), Decimal("26666.667")]
    assert completed.economics.estimated_margin_mxn == 235_000
    assert sowing_plan.SowingPlanResult.model_validate_json(completed.model_dump_json()) == completed
