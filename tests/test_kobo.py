"""Contrato OpenRosa y preservación de la ficha ante reenvíos de KoboCollect."""

from xml.etree.ElementTree import Element, SubElement, tostring

import pytest
import httpx
from fastapi.testclient import TestClient

from luumia import kobo
from luumia.api import app
from luumia.service import seed
from luumia.storage import Conflict


class TemporaryRepository:
    def __init__(self):
        self.context = seed()

    def get(self, _parcel_id):
        return self.context

    def save(self, context, expected):
        if self.context.context_version != expected:
            raise Conflict("Versión desactualizada.")
        self.context = context
        return context


@pytest.fixture
def endpoint(monkeypatch):
    repository = TemporaryRepository()
    monkeypatch.setattr(kobo, "Repository", lambda: repository)
    monkeypatch.setenv("LUUMIA_KOBO_PASSWORD", "kobo-test")
    monkeypatch.setenv("LUUMIA_KOBO_USER", "don-tino")
    return TestClient(app), repository


def instance(**overrides):
    data = Element("data", {"id": kobo.FORM_ID, "version": kobo.FORM_VERSION})
    values = {
        "parcel_id": "parcel-don-tino", "expected_context_version": "1", "rainfall_mm": "0",
        "accumulation_start": "2026-10-26T00:00:00-06:00", "accumulation_end": "2026-11-02T00:00:00-06:00",
        "observed_at": "2026-11-02T00:00:00-06:00", "author_id": "producer-don-tino", "data_kind": "synthetic",
        "confirmed": "", "note": "Prueba de pluviómetro.",
        "instance_id": "uuid:4e457e2c-5e47-4490-9efd-6cd79f0700e0",
    }
    values.update(overrides)
    instance_id = values.pop("instance_id")
    for name, value in values.items():
        SubElement(data, name).text = value
    SubElement(SubElement(data, "meta"), "instanceID").text = instance_id
    return tostring(data, encoding="utf-8", xml_declaration=True)


def post(client, xml):
    return client.post("/integrations/kobo/submission", auth=("don-tino", "kobo-test"),
                       files={"xml_submission_file": ("instance.xml", xml, "text/xml")})


def test_kobo_openrosa_discovery(endpoint):
    client, _ = endpoint
    prefix = "/integrations/kobo"
    auth = ("don-tino", "kobo-test")
    assert client.get(f"{prefix}/formList").status_code == 401
    listing = client.get(f"{prefix}/formList", auth=auth)
    assert listing.status_code == 200 and "md5:" in listing.text and kobo.FORM_VERSION in listing.text
    assert client.get(f"{prefix}/forms/don-tino-rain", auth=auth).content == kobo.FORM_PATH.read_bytes()
    preflight = client.head(f"{prefix}/submission", auth=auth)
    assert preflight.status_code == 204 and preflight.headers["X-OpenRosa-Version"] == "1.0"

    digest = httpx.DigestAuth("don-tino", "kobo-test")
    assert client.get(f"{prefix}/formList?formID={kobo.FORM_ID}", auth=digest).status_code == 200
    assert client.get(f"{prefix}/forms/don-tino-rain", auth=digest).status_code == 200
    assert client.head(f"{prefix}/submission", auth=digest).status_code == 204
    wrong = client.get(f"{prefix}/formList", auth=httpx.DigestAuth("don-tino", "incorrect"))
    assert wrong.status_code == 401


def test_kobo_versions_and_retries(endpoint):
    client, repository = endpoint
    first = post(client, instance())
    assert first.status_code == 201 and "Ficha v2" in first.text
    saved = repository.context
    assert saved.context_version == 2 and saved.evaluation_state == "pendiente_de_recalculo"
    assert saved.field_observations[-1].value == 0
    assert saved.field_observations[-1].kobo.form_version == kobo.FORM_VERSION
    assert saved.field_observations[-1].data_kind == "synthetic"
    assert post(client, instance()).content == first.content
    assert post(client, instance(rainfall_mm="0.5")).status_code == 409
    assert post(client, instance(instance_id="uuid:bc60dccd-c5b0-40f8-ab8b-51e101605a17")).status_code == 409
    assert repository.context.context_version == 2 and len(repository.context.field_observations) == 1


def test_kobo_rejects_invalid_receipts_without_writing(endpoint):
    client, repository = endpoint
    assert post(client, instance(data_kind="observed")).status_code == 422
    assert post(client, instance(accumulation_end="2026-11-02T00:00:00")).status_code == 422
    assert post(client, b"<!DOCTYPE data [<!ENTITY unsafe '9'>]><data>&unsafe;</data>").status_code == 422
    assert post(client, b"a" * kobo.LIMIT).status_code == 413
    assert repository.context.context_version == 1

    confirmed = post(client, instance(data_kind="observed", confirmed="yes"))
    assert confirmed.status_code == 201
    saved = repository.context.field_observations[0]
    assert saved.data_kind == "observed" and saved.confirmed
    assert saved.rain_gauge.source.kind == "local"
    assert saved.rain_gauge.source.id == "kobo-pluviometro-campo"
