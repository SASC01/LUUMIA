"""Rendimiento municipal DGSIAP y aplicación como supuesto comercial."""

import hashlib
from decimal import Decimal, ROUND_HALF_UP
from functools import lru_cache
from pathlib import Path
from statistics import median
from typing import Annotated, Literal

from pydantic import AwareDatetime, Field, model_validator

from .contracts import AgriculturalCycle, AppliedYield, CommercialScenario, Contract, Identifier, Nonnegative, Parcel, Text, YieldAssumption


CATALOG_PATH = Path(__file__).resolve().parents[3] / "data/processed/yield/hopelchen.json"
SOURCE_URL = "https://nube.agricultura.gob.mx/datosAbiertos/Agricola.php"
CYCLE_NAMES = {"spring_summer": "Primavera–verano", "fall_winter": "Otoño–invierno"}
DgsiapUrl = Annotated[str, Field(pattern=r"^https://nube[.]agricultura[.]gob[.]mx/")]
Year = Annotated[int, Field(ge=2003, le=2200)]
YIELD_PRECISION = Decimal("0.000001")


class YieldReferenceUnavailable(OSError):
    pass


class YieldScenarioError(ValueError):
    pass


class MunicipalYieldRecord(Contract):
    year: Year
    crop_id: Identifier
    crop_label: Text
    crop_code: Text
    cycle: AgriculturalCycle
    modality: Literal["rainfed"]
    harvested_area_ha: Annotated[Decimal, Field(gt=0, max_digits=16, decimal_places=6)]
    production_t: Nonnegative
    yield_t_ha: Nonnegative
    source_url: DgsiapUrl
    source_sha256: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
    retrieved_at: AwareDatetime
    source_rows: Annotated[int, Field(ge=1)]
    source_cader_codes: list[str]
    source_csv_lines: list[int]

    @model_validator(mode="after")
    def check_ratio(self):
        expected = (self.production_t / self.harvested_area_ha).quantize(YIELD_PRECISION, rounding=ROUND_HALF_UP)
        if self.yield_t_ha != expected:
            raise ValueError("El rendimiento debe ser producción entre superficie cosechada.")
        if self.source_rows != len(self.source_csv_lines) or self.source_rows != len(set(self.source_csv_lines)):
            raise ValueError("La procedencia requiere las líneas únicas del cierre municipal.")
        return self


class MunicipalYieldCatalog(Contract):
    catalog_version: Identifier
    publisher: Literal["DGSIAP"]
    source_url: DgsiapUrl
    municipality: Literal["Hopelchén"]
    state: Literal["Campeche"]
    state_code: Literal["04"]
    municipality_code: Literal["006"]
    year_start: Year
    year_end: Year
    records: list[MunicipalYieldRecord]

    @model_validator(mode="after")
    def check_unique_records(self):
        keys = {(record.crop_id, record.cycle, record.year) for record in self.records}
        if (len(keys) != len(self.records) or self.year_end < self.year_start
                or any(not self.year_start <= row.year <= self.year_end for row in self.records)):
            raise ValueError("El catálogo requiere un cierre único por cultivo, ciclo y año.")
        return self


class MunicipalYieldReference(Contract):
    reference_id: Identifier
    crop_label: Text
    cycle: AgriculturalCycle
    municipality: Text
    state: Text
    modality: Literal["rainfed"] = "rainfed"
    period_start_year: Year
    period_end_year: Year
    n: Annotated[int, Field(ge=1)]
    median_t_ha: Nonnegative
    min_t_ha: Nonnegative
    max_t_ha: Nonnegative
    max_record: MunicipalYieldRecord
    rows: list[MunicipalYieldRecord]
    evidence_tier: Literal["derived"] = "derived"


class YieldReferenceResponse(Contract):
    crop_id: Identifier
    cycle: AgriculturalCycle
    municipality: Literal["Hopelchén"] = "Hopelchén"
    state: Literal["Campeche"] = "Campeche"
    modality: Literal["rainfed"] = "rainfed"
    source_url: DgsiapUrl = SOURCE_URL
    status: Literal["available", "missing"]
    missing_reason: Text | None = None
    reference: MunicipalYieldReference | None = None


@lru_cache(maxsize=1)
def load_catalog() -> MunicipalYieldCatalog:
    try:
        return MunicipalYieldCatalog.model_validate_json(CATALOG_PATH.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise YieldReferenceUnavailable("No se pudo cargar el extracto validado de DGSIAP.") from error


def yield_reference(crop_id: str, cycle: AgriculturalCycle) -> YieldReferenceResponse:
    catalog = load_catalog()
    rows = sorted((row for row in catalog.records if row.crop_id == crop_id and row.cycle == cycle), key=lambda row: row.year)
    if not rows:
        return YieldReferenceResponse(
            crop_id=crop_id, cycle=cycle, status="missing",
            missing_reason=(f"Los cierres {catalog.year_start}–{catalog.year_end} de Hopelchén carecen de registros "
                            f"comparables para este cultivo en {CYCLE_NAMES[cycle].lower()} de temporal."),
        )
    # La identidad captura el contenido fuente y descarta la fecha en que se descargó.
    identity = "|".join(f"{row.year}:{row.source_sha256}:{row.yield_t_ha}" for row in rows)
    digest = hashlib.sha256(identity.encode()).hexdigest()[:16]
    maximum = max(rows, key=lambda row: (row.yield_t_ha, row.year))
    return YieldReferenceResponse(crop_id=crop_id, cycle=cycle, status="available", reference=MunicipalYieldReference(
        reference_id=f"dgsiap-{crop_id}-{cycle.replace('_', '-')}-{digest}", crop_label=rows[0].crop_label,
        cycle=cycle, municipality=catalog.municipality, state=catalog.state,
        period_start_year=catalog.year_start, period_end_year=catalog.year_end, n=len(rows),
        median_t_ha=median(row.yield_t_ha for row in rows).quantize(YIELD_PRECISION, rounding=ROUND_HALF_UP),
        min_t_ha=min(row.yield_t_ha for row in rows), max_t_ha=maximum.yield_t_ha,
        max_record=maximum, rows=rows,
    ))


def resolve_yield(scenario: CommercialScenario, parcel: Parcel | None) -> AppliedYield:
    assumption = scenario.yield_assumption or YieldAssumption(kind="manual")
    applied = AppliedYield(
        crop_id=scenario.crop_id, cycle_offset=scenario.cycle_offset, agricultural_cycle=scenario.agricultural_cycle,
        area_ha=scenario.superficie_ha, yield_t_ha=scenario.rendimiento_esperado_t_ha, assumption=assumption,
    )
    if assumption.kind == "manual":
        return applied
    if (not parcel or parcel.production_system != "rainfed" or parcel.state != "Campeche"
            or parcel.municipality != "Hopelchén" or not scenario.agricultural_cycle):
        raise YieldScenarioError("La referencia municipal corresponde a Hopelchén, Campeche, y agricultura de temporal.")
    reference = yield_reference(scenario.crop_id, scenario.agricultural_cycle).reference
    if (not reference or reference.reference_id != assumption.reference_id
            or reference.median_t_ha != scenario.rendimiento_esperado_t_ha):
        raise YieldScenarioError("El rendimiento no coincide con la mediana del cultivo y ciclo seleccionados. Vuelve a aplicar la referencia o ingresa un supuesto propio.")
    return applied.model_copy(update={
        "reference_source_url": SOURCE_URL, "reference_n": reference.n,
        "reference_period_start": reference.period_start_year, "reference_period_end": reference.period_end_year,
    })
