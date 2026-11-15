"""Captura, orden y evaluación de ciclos productivos observados."""

from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from luumia import base
from luumia.api import app
from luumia.local_parcels import LocalParcelCreate, create_local_context
from luumia.sowing_plan import CAMPECHE_TIME_ZONE
from luumia.storage import Conflict, NotFound, Repository


@pytest.fixture
def parcel(monkeypatch):
    context = create_local_context(LocalParcelCreate(name="La Ceiba", declared_area_ha=8))
    snapshots = {1: context}

    def get(_repository, parcel_id, version=None):
        if parcel_id != context.parcel.id or (version is not None and version not in snapshots):
            raise NotFound("No existe la ficha solicitada.")
        return snapshots[max(snapshots) if version is None else version]

    def save(_repository, updated, expected):
        if expected != max(snapshots):
            raise Conflict("La ficha cambió durante el guardado.")
        snapshots[updated.context_version] = updated
        return updated

    monkeypatch.setattr(Repository, "get", get)
    monkeypatch.setattr(Repository, "save", save)
    return TestClient(app), f"/v1/contexts/{context.parcel.id}", snapshots


@pytest.fixture
def cycle():
    today = datetime.now(CAMPECHE_TIME_ZONE).date()

    def payload(version, kind, crop, start_offset, end_offset):
        return {
            "expected_context_version": version,
            "kind": kind,
            "crop_id": crop,
            "start": (today + timedelta(days=start_offset)).isoformat(),
            "end": (today + timedelta(days=end_offset)).isoformat(),
        }

    return payload


def post(client, path, payload):
    response = client.post(f"{path}/crop-cycles", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def scores(snapshot):
    return {
        row["candidate"]["steps"][0]["crop_ids"][0]:
            next(item["score"] for item in row["dimensions"] if item["dimension"] == "pest_break")
        for row in snapshot["evaluation"]["recommendations"]
    }


def test_crops_in_order_evaluate_the_latest_cycle_and_keep_prior_snapshots(parcel, cycle):
    client, path, snapshots = parcel
    recent = post(client, path, cycle(1, "previous", "maiz", -60, -20))
    backfill = post(client, path, cycle(2, "previous", "calabaza", -90, -61))
    current = post(client, path, cycle(3, "current", "frijol", -18, 45))

    assert current["context_version"] == current["evaluation"]["context_version"] == 4
    assert current["evaluation_state"] == "vigente"
    assert current["observations"] == current["weekly_cells"] == []
    assert current["evaluation"]["commercial_results"] == []
    assert [row["crop_ids"][0] for row in current["history"]] == ["calabaza", "maiz", "frijol"]
    assert [row["sequence"] for row in current["history"]] == [1, 2, 3]
    assert all(row["data_kind"] == "observed" for row in current["history"])
    assert current["evidence_blocks"]["secuencia_cultivos"]["n_observaciones"] == 3
    assert scores(recent) == scores(backfill)
    assert scores(backfill)["maiz"] < scores(backfill)["frijol"]
    assert scores(current)["frijol"] < scores(current)["maiz"]
    assert client.get(f"{path}/versions/2").json() == recent
    assert len(snapshots) == 4


@pytest.mark.parametrize(("kind", "crop", "start", "end", "message"), [
    ("current", "maiz", -3, -1, "incluya el día de hoy"),
    ("current", "maiz", 1, 5, "incluya el día de hoy"),
    ("previous", "maiz", -4, 0, "terminado antes de hoy"),
    ("previous", "maiz", -1, -4, "igual o posterior"),
    ("previous", "sorgo", -10, -5, "crop_id"),
])
def test_invalid_cycle_leaves_the_ficha_unchanged(parcel, cycle, kind, crop, start, end, message):
    client, path, snapshots = parcel
    response = client.post(f"{path}/crop-cycles", json=cycle(1, kind, crop, start, end))
    assert response.status_code == 422
    assert message in response.json()["message"]
    assert len(snapshots) == 1


def test_touching_ranges_and_stale_versions_are_rejected_and_retries_are_safe(parcel, cycle, monkeypatch):
    client, path, snapshots = parcel
    payload = cycle(1, "previous", "maiz", -40, -20)
    save = Repository.save

    def committed_by_other_request(repository, updated, expected):
        save(repository, updated, expected)
        raise Conflict("Otro guardado idéntico ya escribió la ficha.")

    monkeypatch.setattr(Repository, "save", committed_by_other_request)
    saved = post(client, path, payload)
    assert post(client, path, payload) == saved

    overlap = cycle(2, "previous", "frijol", -20, -10)
    response = client.post(f"{path}/crop-cycles", json=overlap)
    assert response.status_code == 422 and "coinciden con otro ciclo" in response.json()["message"]
    stale = cycle(1, "previous", "frijol", -19, -10)
    assert client.post(f"{path}/crop-cycles", json=stale).status_code == 409
    assert len(snapshots) == 2


def test_crop_routes_cannot_modify_the_demo(parcel, cycle):
    client, _, snapshots = parcel
    endpoint = f"/v1/contexts/{base.PARCEL_ID}/crop-cycles"
    capture = cycle(1, "current", "maiz", 0, 0)
    assert client.post(endpoint, json=capture).status_code == 404
    capture.pop("kind")
    capture["change_id"] = str(uuid4())
    assert client.put(f"{endpoint}/cycle-demo-one", json=capture).status_code == 404
    cancellation = {"expected_context_version": 1, "change_id": str(uuid4())}
    assert client.post(f"{endpoint}/cycle-demo-one/void", json=cancellation).status_code == 404
    assert len(snapshots) == 1


def test_rotation_can_be_refreshed_after_another_ficha_change(parcel, cycle):
    client, path, snapshots = parcel
    observed = post(client, path, cycle(1, "current", "maiz", -30, 50))
    area = client.put(f"{path}/registered-area", json={"expected_context_version": 2, "declared_area_ha": "12"})
    assert area.status_code == 200, area.text
    assert area.json()["evaluation_state"] == "pendiente_de_recalculo"
    assert area.json()["last_evaluation_version"] == 2

    refresh = client.post(f"{path}/crop-rotation", json={"expected_context_version": 3})
    assert refresh.status_code == 200, refresh.text
    refreshed = refresh.json()
    assert refreshed["context_version"] == refreshed["evaluation"]["context_version"] == 4
    assert refreshed["evaluation_state"] == "vigente"
    assert refreshed["history"] == observed["history"]
    assert refreshed["parcel"]["declared_area_ha"] == 12
    assert scores(refreshed) == scores(observed)
    assert snapshots[2].evaluation is not None

    unchanged = client.post(f"{path}/crop-rotation", json={"expected_context_version": 4})
    assert unchanged.json() == refreshed
    assert len(snapshots) == 4


def test_correction_and_annulments_keep_an_audit_and_recalculate_the_next_crop(parcel, cycle):
    client, path, snapshots = parcel
    first = post(client, path, cycle(1, "previous", "maiz", -60, -20))
    original = post(client, path, cycle(2, "current", "frijol", -18, 45))
    cycle_id = original["history"][-1]["id"]
    endpoint = f"{path}/crop-cycles/{cycle_id}"
    change = cycle(3, "current", "calabaza", -16, 48)
    change.pop("kind")
    change.update(change_id=str(uuid4()), reason="Verificado en la bitácora")

    response = client.put(endpoint, json=change)
    assert response.status_code == 200, response.text
    corrected = response.json()
    replacement = corrected["history"][-1]
    assert corrected["context_version"] == corrected["evaluation"]["context_version"] == 4
    assert replacement["id"] == cycle_id
    assert replacement["crop_ids"] == ["calabaza"]
    assert replacement["period"] == {field: change[field] for field in ("start", "end")}
    assert scores(original)["frijol"] == 0 and scores(original)["calabaza"] == 100
    assert scores(corrected)["frijol"] == 100 and scores(corrected)["calabaza"] == 0
    event, = corrected["crop_cycle_history"]
    assert event["change_id"] == change["change_id"]
    assert (event["action"], event["context_version"], event["reason"]) == ("corrected", 4, change["reason"])
    assert event["previous"] == original["history"][-1] and event["replacement"] == replacement
    assert datetime.fromisoformat(event["recorded_at"]).tzinfo is not None
    assert client.get(f"{path}/versions/3").json() == original

    removal = {"expected_context_version": 4, "change_id": str(uuid4()), "reason": "Captura duplicada"}
    response = client.post(f"{endpoint}/void", json=removal)
    assert response.status_code == 200, response.text
    voided = response.json()
    assert voided["context_version"] == voided["evaluation"]["context_version"] == 5
    assert voided["history"] == first["history"] and scores(voided) == scores(first)
    event = voided["crop_cycle_history"][-1]
    assert (event["action"], event["previous"], event["replacement"]) == ("voided", replacement, None)
    assert event["reason"] == removal["reason"]
    assert client.put(endpoint, json=change).json() == voided
    assert client.post(f"{endpoint}/void", json=removal).json() == voided

    last = f"{path}/crop-cycles/{first['history'][0]['id']}/void"
    response = client.post(last, json={"expected_context_version": 5, "change_id": str(uuid4())})
    assert response.status_code == 200, response.text
    emptied = response.json()
    assert emptied["history"] == [] and emptied["context_version"] == 6
    assert emptied["evaluation"] is None and emptied["evaluation_state"] is None
    assert emptied["evidence_blocks"]["secuencia_cultivos"]["n_observaciones"] == 0
    assert [event["action"] for event in emptied["crop_cycle_history"]] == ["corrected", "voided", "voided"]
    assert client.get(f"{path}/versions/4").json() == corrected
    assert sorted(snapshots) == list(range(1, 7))
    area = client.put(f"{path}/registered-area", json={"expected_context_version": 6, "declared_area_ha": "12"})
    assert area.status_code == 200, area.text
    assert area.json()["crop_cycle_history"] == emptied["crop_cycle_history"]


def test_cycle_date_correction_reorders_the_active_history(parcel, cycle):
    client, path, _ = parcel
    initial = post(client, path, cycle(1, "previous", "maiz", -90, -70))
    recent = post(client, path, cycle(2, "previous", "frijol", -60, -40))
    adjusted = cycle(3, "previous", "maiz", -35, -10)
    adjusted.pop("kind")
    adjusted["change_id"] = str(uuid4())
    response = client.put(f"{path}/crop-cycles/{initial['history'][0]['id']}", json=adjusted)
    assert response.status_code == 200, response.text
    moved = response.json()
    assert [(row["sequence"], row["crop_ids"]) for row in moved["history"]] == [(1, ["frijol"]), (2, ["maiz"])]
    assert scores(recent)["maiz"] == 100 and scores(moved)["maiz"] == 0


def test_revision_rejects_overlapping_dates_future_start_stale_versions_and_key_collision(parcel, cycle):
    client, path, snapshots = parcel
    first = post(client, path, cycle(1, "previous", "maiz", -60, -20))
    post(client, path, cycle(2, "current", "frijol", -18, 25))
    endpoint = f"{path}/crop-cycles/{first['history'][0]['id']}"
    current = cycle(3, "previous", "maiz", -19, -16)
    current.pop("kind")
    current["change_id"] = str(uuid4())
    response = client.put(endpoint, json=current)
    assert response.status_code == 422 and "coinciden con otro ciclo" in response.json()["message"]
    later = cycle(3, "current", "maiz", 30, 60)
    invalid = client.put(endpoint, json={**current, "start": later["start"], "end": later["end"]})
    assert invalid.status_code == 422
    out_of_date = client.post(f"{endpoint}/void", json={"expected_context_version": 2, "change_id": str(uuid4())})
    assert out_of_date.status_code == 409
    assert len(snapshots) == 3

    fixed = {**current, "start": first["history"][0]["period"]["start"], "end": first["history"][0]["period"]["end"], "crop_id": "calabaza"}
    saved = client.put(endpoint, json=fixed)
    assert saved.status_code == 200, saved.text
    collision = client.post(f"{endpoint}/void", json={"expected_context_version": 4, "change_id": fixed["change_id"]})
    assert collision.status_code == 409
    assert len(snapshots) == 4
