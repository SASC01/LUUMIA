from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from luumia import base, sowing_plan
from luumia.api import app
from luumia.service import seed
from luumia.storage import NotFound, Repository


@pytest.fixture
def client(monkeypatch):
    contexts = {base.PARCEL_ID: seed()}

    def create(_self, context):
        contexts[context.parcel.id] = context
        return context

    def get(_self, parcel_id, _version=None):
        if parcel_id not in contexts:
            raise NotFound("No existe la parcela.")
        return contexts[parcel_id]

    def list_local(_self):
        return [context for context in contexts.values() if context.parcel.id.startswith("parcel-local-")]

    monkeypatch.setattr(Repository, "create", create)
    monkeypatch.setattr(Repository, "get", get)
    monkeypatch.setattr(Repository, "list_local", list_local)
    monkeypatch.setattr(sowing_plan.SowingRepository, "latest_shared", lambda *_: None)
    monkeypatch.setattr(sowing_plan.SowingRepository, "latest_draft", lambda *_: None)
    monkeypatch.setattr(sowing_plan, "producer_forecasts", lambda _: [])
    return TestClient(app)


def register(client, **values):
    response = client.post("/v1/parcels", json={"name": "Mi terreno", "declared_area_ha": "10", **values})
    assert response.status_code == 201, response.text
    return response.json()


def test_local_parcels_start_without_demo_data_or_assumptions(client):
    assert client.get("/v1/parcels").json() == []
    context = register(client, name="  La Ceiba  ", declared_area_ha="100", production_system="irrigated")
    parcel_id = context["parcel"]["id"]
    assert parcel_id.startswith("parcel-local-")
    assert context["context_version"] == 1
    assert context["producer"]["display_name"] == "La Ceiba"
    assert context["producer"]["persona_kind"] == "real"
    assert context["parcel"]["geometry_kind"] == "unavailable"
    assert context["parcel"]["geometry"] == {}
    assert context["parcel"]["production_system"] == "irrigated"
    for key in ("history", "constraints", "observations", "field_observations", "confirmed_purchase_capacities"):
        assert context[key] == []
    listed = client.get("/v1/parcels").json()
    assert [(item["parcel_id"], item["name"]) for item in listed] == [(parcel_id, "La Ceiba")]
    assert Decimal(listed[0]["declared_area_ha"]) == 100
    assert listed[0]["municipality"] == "Sin registrar"

    plan = client.get(f"/v1/contexts/{parcel_id}/sowing-plan")
    assert plan.status_code == 200, plan.text
    plan = plan.json()
    assert plan["default_crop_economics"] == []
    assert all(crop["yield_t_ha"] is None for crop in plan["crop_options"])
    assert Decimal(plan["default_input"]["area_ha"]) == 100

    demo = client.get(f"/v1/contexts/{base.PARCEL_ID}/sowing-plan").json()
    assert Decimal(demo["declared_area_ha"]) == 12
    assert demo["default_crop_economics"]


def test_local_simulation_reports_missing_inputs_and_calculates_with_personal_terms(client):
    parcel_id = register(client)["parcel"]["id"]
    url = f"/v1/contexts/{parcel_id}/sowing-plan/preview"
    plan = {
        "context_version": 1, "area_ha": "10",
        "zones": [{"zone_id": "zone-a", "crop_id": "maiz", "area_ha": "5"},
                  {"zone_id": "zone-b", "crop_id": "maiz", "area_ha": "3"}],
    }
    empty = client.post(url, json=plan).json()
    assert empty["estimated_harvest_kg"] is None
    assert empty["economics"]["estimated_margin_mxn"] is None
    assert empty["economics"]["crops"] == []
    assert set(empty["economics"]["missing_inputs"][0]["fields"]) == {
        "yield_t_ha", "price_mxn_kg", "loss_fraction", "cost_per_ha", "sale_capacity_kg",
    }

    own_yield = {"value": "2", "basis": "reported", "source": "Bitácora de cosechas"}
    plan["crop_economics"] = [{"crop_id": "maiz", "yield_t_ha": own_yield}]
    partial = client.post(url, json=plan).json()
    assert Decimal(partial["estimated_harvest_kg"]) == 16_000
    assert partial["economics"]["estimated_margin_mxn"] is None
    assert partial["zones"][0]["yield_basis"] == "reported"
    assert partial["zones"][0]["yield_input"]["source"] == "Bitácora de cosechas"

    own_price = {"value": "7.50", "basis": "reported", "source": "Cotización del comprador"}
    plan["crop_economics"][0].update({
        "price_mxn_kg": own_price, "loss_fraction": {"value": "0.1", "basis": "assumption"},
        "sale_capacity_kg": {"value": "12000", "basis": "assumption"},
        "cost_per_ha": {"value": "1200", "basis": "assumption"},
    })
    response = client.post(url, json=plan)
    assert response.status_code == 200, response.text
    report = response.json()
    assert report["economics"]["missing_inputs"] == []
    assert Decimal(report["economics"]["estimated_margin_mxn"]) == 80_400
    assert [Decimal(zone["economics"]["sold_kg"]) for zone in report["zones"]] == [7500, 4500]
    assert report["economics"]["crops"][0]["price_input"]["source"] == "Cotización del comprador"
    assert report["economics"]["crops"][0]["loss_input"]["basis"] == "assumption"

    plan["crop_economics"][0]["loss_fraction"]["value"] = "1.01"
    assert client.post(url, json=plan).status_code == 422


def test_local_plan_rejects_area_above_declared_size(client):
    parcel_id = register(client, declared_area_ha="3.5")["parcel"]["id"]
    result = client.post(f"/v1/contexts/{parcel_id}/sowing-plan/preview", json={
        "context_version": 1, "area_ha": "4",
        "zones": [{"zone_id": "zone-a", "crop_id": "maiz", "area_ha": "4"}],
    })
    assert result.status_code == 422
    assert "supera" in result.json()["message"]
