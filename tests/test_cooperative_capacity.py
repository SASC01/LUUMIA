"""Registro de cupos en una versión nueva y consumo en el simulador."""

from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from luumia import base, cooperative_capacity, sowing_plan
from luumia.api import app
from luumia.contracts import CollectionResult, WeeklyCell
from luumia.service import demo_request, prepare_evaluation, seed
from luumia.storage import Conflict, Repository


CONTEXT_URL = f"/v1/contexts/{base.PARCEL_ID}"
POST_URL = f"{CONTEXT_URL}/cooperative-capacities"


@pytest.fixture
def demo(monkeypatch):
    class Clock(datetime):
        @classmethod
        def now(cls, tz):
            return datetime(2026, 11, 15, 1, tzinfo=UTC).astimezone(tz)

    def get(_self, _parcel_id, version=None):
        return snapshots[version if version is not None else max(snapshots)]

    def save(_self, context, expected):
        if max(snapshots) != expected:
            raise Conflict("La ficha cambió durante el guardado.")
        snapshots[expected + 1] = context
        return context

    current = seed()
    snapshots = {current.context_version: current}
    monkeypatch.setattr(Repository, "get", get)
    monkeypatch.setattr(Repository, "save", save)
    monkeypatch.setattr(cooperative_capacity, "datetime", Clock)
    monkeypatch.setattr(sowing_plan, "datetime", Clock)
    monkeypatch.setattr(sowing_plan, "producer_forecasts", lambda _day: [])
    request = {
        "expected_context_version": current.context_version,
        "crop_id": "calabaza",
        "sales_period": {"start": "2027-10-10", "end": "2027-10-23"},
        "cupo_range": [20_000, 24_000],
        "confirmed_on": "2026-11-14",
        "source_name": "  Folio de prueba CC-2027-01  ",
        "source_url": "https://example.org/documentos/cc-2027-01",
    }
    return TestClient(app), snapshots, request


def test_register_archives_source_and_activates_new_capacity_without_altering_prior_snapshot(demo):
    client, snapshots, request = demo
    old_version = request["expected_context_version"]
    initial = snapshots[old_version].model_dump(mode="json")
    response = client.post(POST_URL, json=request)
    assert response.status_code == 201
    updated = response.json()
    assert updated["evaluation_state"] == initial["evaluation_state"]
    assert updated["context_version"] == old_version + 1
    assert updated["parcel"] == initial["parcel"] and updated["field_observations"] == initial["field_observations"]
    assert client.get(f"{CONTEXT_URL}/versions/{old_version}").json() == initial
    capacity, = updated["confirmed_purchase_capacities"]
    assert capacity["cupo_range"] == [20_000, 24_000]
    assert capacity["sales_structure"] == "cooperative" and capacity["cycle_offset"] == 1
    assert capacity["confirmed_at"] == "2026-11-14T00:00:00-06:00"
    assert capacity["source"]["name"] == "Folio de prueba CC-2027-01"
    assert capacity["source"]["url"] == request["source_url"]

    preview = client.post(f"{CONTEXT_URL}/sowing-plan/preview", json={
        "context_version": old_version + 1, "area_ha": 6,
        "zones": [{"zone_id": "zone-a", "crop_id": "calabaza", "area_ha": 6}],
    })
    preview.raise_for_status()
    plan = preview.json()
    assert plan["economics"]["crops"][0]["capacity_confirmation"] == capacity
    assert Decimal(plan["economics"]["estimated_margin_mxn"]) == 95_000
    assert Decimal(plan["zones"][0]["economics"]["sold_kg"]) == 20_000

    replay = client.post(POST_URL, json=request)
    assert replay.status_code == 200 and replay.json() == updated
    conflict = client.post(POST_URL, json={**request, "cupo_range": [18_000, 20_000]})
    assert conflict.status_code == 409
    assert len(snapshots) == 2


@pytest.mark.parametrize("field,value", [
    ("crop_id", "no-existe"),
    ("source_name", "  "),
    ("source_url", "http://example.org"),
    ("source_url", "https://name:password@example.org"),
    ("cupo_range", [700, 400]),
    ("cupo_range", [-1, 4]),
    ("sales_period", {"start": "2027-10-23", "end": "2027-10-10"}),
    ("sales_period", {"start": "2026-11-10", "end": "2026-11-13"}),
    ("confirmed_on", "2026-11-15"),
])
def test_reject_invalid_cooperative_confirmation_without_writing(demo, field, value):
    client, snapshots, request = demo
    assert client.post(POST_URL, json={**request, field: value}).status_code == 422
    assert len(snapshots) == 1


def test_register_preserves_historical_evaluation_and_pending_reason(demo):
    client, snapshots, request = demo
    source = Path(__file__).resolve().parents[1] / "data/processed/power/don-tino-week.json"
    collection = CollectionResult.model_validate_json(source.read_text(encoding="utf-8"))
    cells = [WeeklyCell.model_validate(row) for row in base.harmonize(collection.model_dump(mode="json"))]
    initial = prepare_evaluation(seed(), demo_request(), cells)
    snapshots[initial.context_version] = initial

    first = client.post(POST_URL, json=request)
    assert first.status_code == 201
    held = first.json()
    assert held["evaluation"] is None and held["evaluation_state"] == "pendiente_de_recalculo"
    assert held["last_evaluation_version"] == initial.context_version
    assert held["prior_commercial"]["evaluation_id"] == initial.evaluation.id
    assert held["weekly_cells"] == initial.model_dump(mode="json")["weekly_cells"]
    assert snapshots[initial.context_version].evaluation == initial.evaluation

    second = client.post(POST_URL, json={**request, "expected_context_version": held["context_version"],
                                      "crop_id": "frijol", "source_url": None})
    assert second.status_code == 201
    assert second.json()["recalculation_reason"] == held["recalculation_reason"]
    assert second.json()["prior_commercial"] == held["prior_commercial"]
    assert len(second.json()["confirmed_purchase_capacities"]) == 2


def test_post_cannot_register_outside_don_tinos_demo(demo):
    client, snapshots, request = demo
    assert client.post("/v1/contexts/parcel-other/cooperative-capacities", json=request).status_code == 404
    assert len(snapshots) == 1


def test_correction_replaces_capacity_and_cancellation_uses_backup_without_resurrecting_original(demo):
    client, snapshots, request = demo
    original = client.post(POST_URL, json=request).json()
    first_capacity, = original["confirmed_purchase_capacities"]
    correction_url = f"{POST_URL}/{first_capacity['id']}"
    correction = {
        **request, "expected_context_version": original["context_version"],
        "cupo_range": [24_000, 28_000], "source_name": "Folio corregido CC-2027-01",
        "reason": "  Rangos rectificados en el acta.  ",
    }
    corrected_response = client.put(correction_url, json=correction)
    assert corrected_response.status_code == 200
    corrected = corrected_response.json()
    assert corrected["context_version"] == original["context_version"] + 1
    replacement, = corrected["confirmed_purchase_capacities"]
    assert replacement["id"] != first_capacity["id"]
    assert replacement["cupo_range"] == [24_000, 28_000]
    correction_event, = corrected["cooperative_capacity_history"]
    assert correction_event["action"] == "corrected"
    assert correction_event["previous"] == first_capacity
    assert correction_event["replacement"] == replacement
    assert correction_event["context_version"] == corrected["context_version"]
    assert correction_event["reason"] == "Rangos rectificados en el acta."

    def preview(version, **overrides):
        response = client.post(f"{CONTEXT_URL}/sowing-plan/preview", json={
            "context_version": version, "area_ha": 6,
            "zones": [{"zone_id": "zone-a", "crop_id": "calabaza", "area_ha": 6}], **overrides,
        })
        response.raise_for_status()
        return response.json()

    plan = preview(corrected["context_version"])
    assert plan["economics"]["crops"][0]["capacity_confirmation"] == replacement
    assert Decimal(plan["economics"]["estimated_margin_mxn"]) == 123_000

    cancellation = {"expected_context_version": corrected["context_version"], "reason": "Comprador retiró el cupo."}
    cancel_url = f"{POST_URL}/{replacement['id']}/cancel"
    cancelled_response = client.post(cancel_url, json=cancellation)
    assert cancelled_response.status_code == 200
    cancelled = cancelled_response.json()
    assert cancelled["context_version"] == corrected["context_version"] + 1
    assert cancelled["confirmed_purchase_capacities"] == []
    unchanged_correction, cancellation_event = cancelled["cooperative_capacity_history"]
    assert unchanged_correction == correction_event
    assert cancellation_event["action"] == "cancelled"
    assert cancellation_event["previous"] == replacement
    assert cancellation_event["replacement"] is None
    assert cancellation_event["reason"] == cancellation["reason"]
    assert cancellation_event["context_version"] == cancelled["context_version"]
    assert client.get(f"{CONTEXT_URL}/versions/{original['context_version']}").json() == original
    assert client.get(f"{CONTEXT_URL}/versions/{corrected['context_version']}").json() == corrected

    fallback = preview(cancelled["context_version"])
    assert fallback["economics"]["crops"][0]["capacity_confirmation"] is None
    assert fallback["economics"]["crops"][0]["sale_capacity_kg"]["basis"] == "assumption"
    assert Decimal(fallback["zones"][0]["economics"]["sold_kg"]) == 28_000
    assert Decimal(fallback["economics"]["estimated_margin_mxn"]) == 151_000
    manual = preview(cancelled["context_version"], crop_economics=[{
        "crop_id": "calabaza", "sale_capacity_kg": {"value": 18_000, "basis": "assumption"},
    }])
    assert Decimal(manual["zones"][0]["economics"]["sold_kg"]) == 18_000

    assert client.put(correction_url, json=correction).json() == cancelled
    assert client.post(cancel_url, json=cancellation).json() == cancelled
    assert client.put(correction_url, json={**correction, "cupo_range": [23_000, 28_000]}).status_code == 409
    assert client.post(cancel_url, json={**cancellation, "reason": "Otro motivo"}).status_code == 409
    assert len(snapshots) == 4


def test_inactive_records_and_invalid_changes_leave_ficha_unchanged(demo):
    client, snapshots, request = demo
    original = client.post(POST_URL, json=request).json()
    capacity, = original["confirmed_purchase_capacities"]
    expected = original["context_version"]
    correction = {**request, "expected_context_version": expected}
    url = f"{POST_URL}/{capacity['id']}"
    assert client.put(url, json=correction).status_code == 422
    assert client.put(url, json={**correction, "cupo_range": [24_001, 24_000]}).status_code == 422
    assert client.post(f"{url}/cancel", json={"expected_context_version": expected, "reason": "x" * 241}).status_code == 422
    assert client.post(f"{POST_URL}/unknown/cancel", json={"expected_context_version": expected}).status_code == 404
    assert client.post(f"{url}/cancel", json={"expected_context_version": expected - 1}).status_code == 409
    assert len(snapshots) == 2
