"""Contexto nacional del maíz de México desde USDA FAS PSD Online."""

import csv
import io
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime
from hashlib import sha256
from pathlib import Path
from time import monotonic
from typing import Annotated, Literal
from zipfile import BadZipFile, ZipFile

import httpx
from pydantic import AwareDatetime, Field, model_validator

from .contracts import Contract, Nonnegative

SOURCE_URL = "https://fas.usda.gov/psdonline"
DOWNLOAD_URL = "https://apps.fas.usda.gov/psdonline/downloads/psd_grains_pulses_csv.zip"
SNAPSHOT_PATH = Path(__file__).resolve().parents[3] / "data/processed/usda/mexico-corn-production.json"
ARCHIVE_LIMIT = 8 * 1024 * 1024
CSV_LIMIT = 100 * 1024 * 1024
DOWNLOAD_SECONDS = 12
WINDOW = 5
COUNTRY_CODE = "MX"
CORN_CODE = "0440000"
PRODUCTION_ID = "028"
THOUSAND_METRIC_TONS_ID = "08"


class UsdaUnavailable(OSError):
    """La serie nacional no se pudo obtener o validar."""


class UsdaCampaign(Contract):
    market_year: Annotated[int, Field(ge=1960, le=2100)]
    value: Nonnegative
    revision_year: Annotated[int, Field(ge=1960, le=2100)]
    revision_month: Annotated[int, Field(ge=1, le=12)]


class UsdaData(Contract):
    source_name: Literal["USDA FAS · PSD Online"] = "USDA FAS · PSD Online"
    source_url: Literal["https://fas.usda.gov/psdonline"] = SOURCE_URL
    download_url: Literal["https://apps.fas.usda.gov/psdonline/downloads/psd_grains_pulses_csv.zip"] = DOWNLOAD_URL
    retrieved_at: AwareDatetime
    published_at: AwareDatetime | None
    geography: Literal["México · nacional"] = "México · nacional"
    country_code: Literal["MX"] = COUNTRY_CODE
    commodity: Literal["Maíz"] = "Maíz"
    indicator: Literal["Producción nacional"] = "Producción nacional"
    unit: Literal["miles de toneladas métricas"] = "miles de toneladas métricas"
    rows: Annotated[list[UsdaCampaign], Field(min_length=WINDOW, max_length=WINDOW)]
    scope_note: Literal[
        "Cada campaña comercial de maíz en México comienza en octubre y termina en septiembre. "
        "Las cifras de USDA son estimaciones nacionales sujetas a revisión. Se muestran como contexto, "
        "fuera del cálculo de precios, rendimientos y márgenes de Don Tino."
    ] = (
        "Cada campaña comercial de maíz en México comienza en octubre y termina en septiembre. "
        "Las cifras de USDA son estimaciones nacionales sujetas a revisión. Se muestran como contexto, "
        "fuera del cálculo de precios, rendimientos y márgenes de Don Tino."
    )
    archive_sha256: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]

    @model_validator(mode="after")
    def check_period(self):
        first = self.rows[0].market_year
        if [row.market_year for row in self.rows] != list(range(first, first + WINDOW)):
            raise ValueError("PSD requiere cinco campañas comerciales consecutivas y ordenadas.")
        return self


def download_archive() -> tuple[bytes, datetime | None]:
    deadline = monotonic() + DOWNLOAD_SECONDS
    timeout = httpx.Timeout(6, connect=3)
    with httpx.stream("GET", DOWNLOAD_URL, timeout=timeout) as response:
        response.raise_for_status()
        length = response.headers.get("content-length")
        if length and int(length) > ARCHIVE_LIMIT:
            raise UsdaUnavailable("El ZIP de USDA supera el tamaño máximo permitido.")
        published = response.headers.get("last-modified")
        archive = bytearray()
        for chunk in response.iter_bytes():
            archive.extend(chunk)
            if len(archive) > ARCHIVE_LIMIT:
                raise UsdaUnavailable("El ZIP de USDA supera el tamaño máximo permitido.")
            if monotonic() > deadline:
                raise UsdaUnavailable("La descarga de USDA superó el tiempo máximo de espera.")
    return bytes(archive), parsedate_to_datetime(published) if published else None


def read_campaigns(archive: bytes) -> list[UsdaCampaign]:
    required = {
        "Commodity_Code", "Country_Code", "Market_Year", "Calendar_Year", "Month", "Attribute_ID",
        "Unit_ID", "Unit_Description", "Value",
    }
    campaigns: dict[int, UsdaCampaign] = {}
    with ZipFile(io.BytesIO(archive)) as zipped:
        entries = zipped.infolist()
        if len(entries) != 1 or entries[0].filename != "psd_grains_pulses.csv" or entries[0].file_size > CSV_LIMIT:
            raise UsdaUnavailable("El contenido del ZIP de USDA no coincide con el extracto PSD esperado.")
        with zipped.open(entries[0]) as stream, io.TextIOWrapper(stream, encoding="utf-8-sig", newline="") as decoded:
            reader = csv.DictReader(decoded, strict=True)
            if not required.issubset(reader.fieldnames or []):
                raise UsdaUnavailable("El CSV de USDA cambió las columnas de la serie PSD.")
            for row in reader:
                if (row["Country_Code"], row["Commodity_Code"], row["Attribute_ID"]) != (
                    COUNTRY_CODE, CORN_CODE, PRODUCTION_ID,
                ):
                    continue
                if (row["Unit_ID"], row["Unit_Description"]) != (THOUSAND_METRIC_TONS_ID, "(1000 MT)"):
                    raise UsdaUnavailable("La unidad de producción de maíz de USDA cambió.")
                campaign = UsdaCampaign(
                    market_year=row["Market_Year"], value=row["Value"],
                    revision_year=row["Calendar_Year"], revision_month=row["Month"],
                )
                if campaign.market_year in campaigns:
                    raise UsdaUnavailable("USDA devolvió campañas repetidas para la serie nacional.")
                campaigns[campaign.market_year] = campaign
    return [campaigns[year] for year in sorted(campaigns)[-WINDOW:]]


def fetch_usda() -> UsdaData:
    """Lee la publicación vigente de FAS sin pedir credenciales."""
    try:
        archive, published_at = download_archive()
        return UsdaData(
            retrieved_at=datetime.now(UTC), published_at=published_at,
            archive_sha256=sha256(archive).hexdigest(), rows=read_campaigns(archive),
        )
    except httpx.HTTPError as exc:
        raise UsdaUnavailable("USDA FAS no respondió a tiempo o rechazó la consulta.") from exc
    except UsdaUnavailable:
        raise
    except (BadZipFile, ValueError, csv.Error, RuntimeError, OSError) as exc:
        raise UsdaUnavailable("El extracto publicado por USDA FAS no es válido para esta serie.") from exc


def load_usda_snapshot() -> UsdaData:
    try:
        return UsdaData.model_validate_json(SNAPSHOT_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise UsdaUnavailable("El respaldo validado de USDA FAS no está disponible.") from exc


if __name__ == "__main__":
    data = fetch_usda()
    SNAPSHOT_PATH.parent.mkdir(exist_ok=True, parents=True)
    SNAPSHOT_PATH.write_text(data.model_dump_json(indent=2) + "\n", encoding="utf-8")
    print(f"Respaldo de USDA FAS actualizado: {data.rows[0].market_year} a {data.rows[-1].market_year}.")
