"""Prueba del contrato v2 de WeatherLink con una respuesta HTTP controlada."""

import json

from fastapi.testclient import TestClient

from luumia import weatherlink
from luumia.api import app


def test_station_requests_are_server_side_and_the_example_is_opt_in(monkeypatch):
    for name in ("WEATHERLINK_API_KEY", "WEATHERLINK_API_SECRET", "WEATHERLINK_STATION_ID"):
        monkeypatch.delenv(name, raising=False)
    client = TestClient(app)

    empty = client.get("/v1/weatherlink/current").json()
    assert (empty["status"], empty["origin"], empty["readings"]) == ("unconfigured", None, [])
    example = client.get("/v1/weatherlink/current", params={"example": True}).json()
    assert (example["status"], example["origin"], example["delivery"]) == ("available", "documentation", None)
    assert example["readings"][0]["rain_today_mm"] == 0

    monkeypatch.setenv("WEATHERLINK_API_KEY", "test-key with space")
    monkeypatch.setenv("WEATHERLINK_API_SECRET", "test-private-value")
    monkeypatch.setenv("WEATHERLINK_STATION_ID", "2")

    class FakeWeatherLink:
        calls = 0
        status = 200

        def __init__(self, host, *, timeout):
            assert host == "api.weatherlink.com" and timeout == 6

        def request(self, method, target, *, headers):
            assert method == "GET"
            assert target == "/v2/current/2?api-key=test-key+with+space&demo=true"
            assert headers["X-Api-Secret"] == "test-private-value"
            type(self).calls += 1

        def getresponse(self):
            return self

        def read(self, limit):
            assert limit == weatherlink.MAX_BODY + 1
            return json.dumps({"sensors": [
                {"lsid": 10, "data_structure_type": 23, "data": [{"ts": 1558741927, "temp": 68, "hum": 92,
                                                                   "rainfall_day_mm": 0, "rainfall_day_in": 3}]},
                {"lsid": 12, "data_structure_type": 6, "data": [{"ts": 1558741927, "temp_out": -4, "hum_out": 30,
                                                                  "rain_day_in": 0.1}]},
                {"lsid": 14, "data_structure_type": 21, "data": [{"ts": 1558741927, "temp": 72}]},
            ]}).encode()

        def close(self):
            pass

    monkeypatch.setattr(weatherlink, "HTTPSConnection", FakeWeatherLink)
    weatherlink.station_cache.cache_clear()
    response = client.get("/v1/weatherlink/current")
    assert response.status_code == 200
    assert "test-private-value" not in response.text and "test-key" not in response.text
    value = response.json()
    assert value["status"] == "available" and value["origin"] == "station" and value["delivery"] == "live"
    assert "EE. UU." in value["station_label"]
    assert [(row["temperature_c"], row["rain_today_mm"]) for row in value["readings"]] == [(20, 0), (-20, 2.54)]
    assert client.get("/v1/weatherlink/current").json()["delivery"] == "cache"
    assert FakeWeatherLink.calls == 1

    weatherlink.station_cache.cache_clear()
    FakeWeatherLink.status = 403
    rejected = client.get("/v1/weatherlink/current").json()
    assert rejected["status"] == "unavailable" and rejected["origin"] is None and rejected["readings"] == []
    assert rejected["checked_at"] and "rechazó" in rejected["message"]
    weatherlink.station_cache.cache_clear()
