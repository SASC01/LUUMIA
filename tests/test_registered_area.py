"""Versionado de la superficie declarada desde Parcela."""

from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from luumia import base, sowing_plan
from luumia.api import app
from luumia.contracts import CollectionResult, WeeklyCell
from luumia.service import demo_request, prepare_evaluation, seed
from luumia.storage import Conflict, Repository


CONTEXT = f"/v1/contexts/{base.PARCEL_ID}"
REGISTERED_AREA = f"{CONTEXT}/registered-area"
SOWING_PLAN = f"{CONTEXT}/sowing-plan"


@pytest.fixture
def demo(monkeypatch):
    initial = seed()
    snapshots = {initial.context_version: initial}

    def get(_repository, _parcel, version=None):
        return snapshots[version if version is not None else max(snapshots)]

    def save(_repository, context, expected):
        if expected != max(snapshots):
            raise Conflict("La ficha cambió durante el guardado.")
        snapshots[context.context_version] = context
        return context

    monkeypatch.setattr(Repository, "get", get)
    monkeypatch.setattr(Repository, "save", save)
    monkeypatch.setattr(sowing_plan, "producer_forecasts", lambda _day: [])
    return TestClient(app), snapshots


def test_changing_area_preserves_previous_ficha_and_allows_saving_a_larger_plan(demo, monkeypatch):
    client, snapshots = demo
    version = max(snapshots)
    initial = snapshots[version].model_dump(mode="json")
    plan = {"context_version": version, "area_ha": "100", "zones": [
        {"zone_id": "zona-a", "crop_id": "calabaza", "area_ha": "60"},
        {"zone_id": "zona-b", "crop_id": "frijol", "area_ha": "40"},
    ]}
    assert client.post(f"{SOWING_PLAN}/preview", json=plan).status_code == 422

    response = client.put(REGISTERED_AREA, json={"expected_context_version": version, "declared_area_ha": "100"})
    response.raise_for_status()
    updated = response.json()
    assert updated["context_version"] == version + 1
    assert updated["parcel"] == {**initial["parcel"], "declared_area_ha": 100}
    assert updated["field_observations"] == initial["field_observations"]
    assert updated["confirmed_purchase_capacities"] == initial["confirmed_purchase_capacities"]
    assert updated["data_kind"] == initial["data_kind"]
    change, = updated["registered_area_history"]
    assert Decimal(change["previous_area_ha"]) == 12 and Decimal(change["declared_area_ha"]) == 100
    assert change["context_version"] == updated["context_version"]
    assert change["recorded_at"] == updated["updated_at"]
    assert client.get(f"{CONTEXT}/versions/{version}").json() == initial
    assert client.post(f"{SOWING_PLAN}/preview", json=plan).status_code == 409

    def save_plan(_repository, parcel, result, expected):
        assert parcel == base.PARCEL_ID and expected == 0
        return sowing_plan.SowingPlanSnapshot(plan_version=1, saved_at=datetime.now(UTC), shared_at=None, plan=result)

    monkeypatch.setattr(sowing_plan.SowingRepository, "save", save_plan)
    draft = client.put(f"{SOWING_PLAN}/draft", json={"expected_plan_version": 0,
                                                  "plan": {**plan, "context_version": updated["context_version"]}})
    draft.raise_for_status()
    assert Decimal(draft.json()["plan"]["area_ha"]) == 100
    assert Decimal(draft.json()["plan"]["estimated_harvest_kg"]) == 522_000
    assert len(snapshots) == 2


def test_numeric_retry_and_competing_updates_do_not_create_extra_versions(demo, monkeypatch):
    client, snapshots = demo
    version = max(snapshots)
    update = {"expected_context_version": version, "declared_area_ha": "4.004"}
    save = Repository.save

    def simultaneous_save(repository, context, expected):
        save(repository, context, expected)
        raise Conflict("La ficha cambió durante el guardado.")

    monkeypatch.setattr(Repository, "save", simultaneous_save)
    response = client.put(REGISTERED_AREA, json=update)
    response.raise_for_status()
    assert response.json()["parcel"]["declared_area_ha"] == 4.004
    assert client.put(REGISTERED_AREA, json={**update, "declared_area_ha": "4.0040"}).json() == response.json()
    assert client.put(REGISTERED_AREA, json={**update, "declared_area_ha": "100"}).status_code == 409
    assert client.put(REGISTERED_AREA, json={**update, "expected_context_version": 999}).status_code == 409
    assert len(snapshots) == 2


def test_area_change_keeps_the_historical_evaluation(demo):
    client, snapshots = demo
    data = Path(__file__).resolve().parents[1] / "data/processed/power/don-tino-week.json"
    collection = CollectionResult.model_validate_json(data.read_text(encoding="utf-8"))
    cells = [WeeklyCell.model_validate(row) for row in base.harmonize(collection.model_dump(mode="json"))]
    evaluated = prepare_evaluation(seed(), demo_request(), cells)
    snapshots[evaluated.context_version] = evaluated
    updated = client.put(REGISTERED_AREA, json={"expected_context_version": evaluated.context_version, "declared_area_ha": 100})
    updated.raise_for_status()
    pending = updated.json()
    assert pending["evaluation_state"] == "pendiente_de_recalculo" and pending["evaluation"] is None
    assert pending["prior_commercial"]["context_version"] == evaluated.context_version
    assert pending["last_evaluation_version"] == evaluated.context_version
    assert pending["weekly_cells"] == evaluated.model_dump(mode="json")["weekly_cells"]
    assert snapshots[evaluated.context_version].evaluation == evaluated.evaluation


@pytest.mark.parametrize("area", ["0", "-1", "4.0045", "1000000000"])
def test_area_updates_reject_values_outside_the_plan_precision(demo, area):
    client, snapshots = demo
    response = client.put(REGISTERED_AREA, json={"expected_context_version": max(snapshots), "declared_area_ha": area})
    assert response.status_code == 422
    assert len(snapshots) == 1
