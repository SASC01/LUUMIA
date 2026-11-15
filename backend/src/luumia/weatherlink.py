"""Condiciones observadas mediante la API v2 de Davis WeatherLink."""

import json
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from functools import lru_cache
from http.client import HTTPSConnection, HTTPException as TransportError
from math import isfinite
from os import getenv
from typing import Literal
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter
from pydantic import AwareDatetime, Field

from .contracts import Contract
from .reference_cache import ReferenceCache

DOCS = "https://weatherlink.github.io/v2-api/api-response"
API_HOST = "api.weatherlink.com"
MAX_BODY = 1024 * 1024
# Las claves y unidades por tipo de registro provienen del catálogo de sensores de Davis.
ISS_CURRENT_FIELDS = {
    6: ("temp_out", "hum_out", "rain_day"),
    10: ("temp", "hum", "rainfall_daily"),
    23: ("temp", "hum", "rainfall_day"),
}


class StationReading(Contract):
    sensor_id: int
    observed_at: AwareDatetime
    temperature_c: float | None
    humidity_pct: float | None
    rain_today_mm: float | None


class WeatherLinkResponse(Contract):
    status: Literal["available", "unconfigured", "unavailable"]
    origin: Literal["station", "documentation"] | None = None
    delivery: Literal["live", "cache"] | None = None
    checked_at: AwareDatetime | None = None
    message: str | None = None
    source_url: str = DOCS
    station_label: str | None = None
    readings: list[StationReading] = Field(default_factory=list)


@dataclass(frozen=True)
class Station:
    identifier: str
    key: str = field(repr=False)
    secret: str = field(repr=False)
    label: str | None = None
    demo: bool = False


def configured_station() -> Station | None:
    key = getenv("WEATHERLINK_API_KEY", "").strip()
    secret = getenv("WEATHERLINK_API_SECRET", "").strip()
    station_id = getenv("WEATHERLINK_STATION_ID", "").strip()
    if not (key and secret and station_id):
        return None
    if station_id.isascii() and station_id.isdecimal() and 0 < len(station_id) <= 15:
        station_id = str(int(station_id))
    else:
        try:
            station_id = str(UUID(station_id))
        except ValueError:
            return None
    demo = station_id in {"2", "9722cfc3-a4ef-47b9-befb-72f52592d6ed"}
    label = "Estación de demostración de Davis Instruments (EE. UU.)" if demo else (
        getenv("WEATHERLINK_STATION_LABEL", "").strip() or "Estación configurada en WeatherLink"
    )
    return Station(station_id, key, secret, label, demo)


def _numeric(value: object, *, minimum: float, maximum: float) -> float | None:
    if type(value) in (int, float) and minimum <= value <= maximum and isfinite(value):
        return float(value)
    return None


def parse_readings(payload: dict) -> list[StationReading]:
    readings = {}
    for sensor in payload.get("sensors", []):
        kind = sensor.get("data_structure_type")
        fields = ISS_CURRENT_FIELDS.get(kind)
        lsid = sensor.get("lsid")
        if not fields or type(lsid) is not int or lsid < 1:
            continue
        temp_key, humidity_key, rain_key = fields
        for entry in sensor.get("data", []):
            ts = entry.get("ts")
            if type(ts) is not int or not 0 < ts < 4_102_444_800:
                continue
            temp = _numeric(entry.get(temp_key), minimum=-150, maximum=200)
            humidity = _numeric(entry.get(humidity_key), minimum=0, maximum=100)
            rain = _numeric(entry.get(f"{rain_key}_mm"), minimum=0, maximum=5000)
            if rain is None:
                inches = _numeric(entry.get(f"{rain_key}_in"), minimum=0, maximum=196.85)
                rain = round(inches * 25.4, 3) if inches is not None else None
            if temp is None and humidity is None and rain is None:
                continue
            observed = datetime.fromtimestamp(ts, UTC)
            previous = readings.get(lsid)
            if previous is None or observed > previous.observed_at:
                readings[lsid] = StationReading(
                    sensor_id=lsid, observed_at=observed, temperature_c=round((temp - 32) * 5 / 9, 2) if temp is not None else None,
                    humidity_pct=humidity, rain_today_mm=rain,
                )
    return sorted(readings.values(), key=lambda reading: reading.sensor_id)


def read_station(station: Station) -> WeatherLinkResponse:
    parameters = {"api-key": station.key}
    if station.demo:
        parameters["demo"] = "true"
    connection = HTTPSConnection(API_HOST, timeout=6)
    try:
        connection.request("GET", f"/v2/current/{station.identifier}?{urlencode(parameters)}",
                           headers={"X-Api-Secret": station.secret, "Accept": "application/json"})
        response = connection.getresponse()
        if response.status in {401, 403}:
            return WeatherLinkResponse(status="unavailable", message="WeatherLink rechazó la credencial o el acceso a la estación.")
        if response.status != 200:
            raise OSError("La consulta de WeatherLink no está disponible.")
        raw = response.read(MAX_BODY + 1)
        if len(raw) > MAX_BODY:
            raise ValueError("Respuesta WeatherLink fuera del tamaño esperado.")
        payload = json.loads(raw)
        readings = parse_readings(payload)
    except (TransportError, AttributeError, TypeError) as error:
        raise ValueError("Respuesta WeatherLink no utilizable.") from error
    finally:
        connection.close()
    if not readings:
        return WeatherLinkResponse(status="unavailable", message="WeatherLink no devolvió lecturas exteriores de una estación compatible.")
    now = datetime.now(UTC)
    note = "Lecturas de la estación configurada. Consulta la fecha de cada sensor."
    if all(now - reading.observed_at > timedelta(hours=2) for reading in readings):
        note = "La estación devolvió lecturas de hace más de dos horas. Consulta la fecha de cada sensor."
    return WeatherLinkResponse(status="available", origin="station", message=note,
                               station_label=station.label, readings=readings)


@lru_cache(maxsize=2)
def station_cache(station: Station) -> ReferenceCache[WeatherLinkResponse]:
    return ReferenceCache(live_ttl=60, retry_delay=30)


def official_example() -> WeatherLinkResponse:
    # Extracto del ejemplo WeatherLink Live de la documentación de respuestas v2.
    payload = {"sensors": [{"data_structure_type": 10, "lsid": 5271273, "data": [{
        "ts": 1558741927, "temp": 73.3, "hum": 42.7, "rainfall_daily_mm": 0,
    }]}]}
    return WeatherLinkResponse(status="available", origin="documentation", station_label="Ejemplo oficial de WeatherLink Live",
                               message="Ejemplo de la documentación de Davis, ajeno a la parcela de Don Tino.",
                               readings=parse_readings(payload))


router = APIRouter(tags=["Referencias externas"])


@router.get("/v1/weatherlink/current", response_model=WeatherLinkResponse)
def weatherlink_current(example: bool = False) -> WeatherLinkResponse:
    """Consulta una estación configurada por el servidor o muestra el ejemplo documental."""
    if example:
        return official_example()
    station = configured_station()
    if station is None:
        return WeatherLinkResponse(status="unconfigured", message="Falta configurar una estación WeatherLink y sus credenciales en el servidor.")
    failure = "WeatherLink no respondió con datos válidos. Consulta la estación más tarde."
    result = station_cache(station).get(lambda: read_station(station),
                                       lambda: WeatherLinkResponse(status="unavailable", message=failure), failure)
    return result.data.model_copy(update={
        "checked_at": result.delivery.attempted_at,
        "delivery": result.delivery.mode if result.data.status == "available" else None,
    })
