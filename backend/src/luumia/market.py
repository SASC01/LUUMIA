"""Referencias mayoristas de SNIIM en vivo con respaldo precargado."""

import csv
from datetime import date
from pathlib import Path
from statistics import median
from typing import Annotated, Literal

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from pydantic import AwareDatetime, Field, model_validator

from .contracts import ApiError, Contract, Identifier, Nonnegative, Period, Text
from .reference_cache import ReferenceCache, ReferenceDelivery
from .sniim_live import fetch_rows

SeriesId = Literal["campeche-monthly", "merida-weekly", "merida-recent"]
Granularity = Literal["monthly", "daily"]
PriceKind = Literal["monthly_mean_frequent", "daily_frequent"]
Month = Annotated[int, Field(ge=1, le=12)]
CSV_PATH = Path(__file__).resolve().parents[3] / "data/processed/sniim/quotes.csv"
SERIES_COUNTS = {"campeche-monthly": 60, "merida-weekly": 5}


class MarketQuote(Contract):
    id: Identifier
    series_id: SeriesId
    market_id: Identifier
    market: Text
    granularity: Granularity
    period_start: date
    period_end: date
    variety: Text
    quality: Text
    presentation: Text | None
    origin: Text | None
    original_unit: Literal["MXN/kg"]
    original_price: Nonnegative
    price_kind: PriceKind
    mxn_kg: Nonnegative
    mxn_kg_min: Nonnegative | None
    mxn_kg_max: Nonnegative | None
    retrieved_at: AwareDatetime
    url_fuente: Annotated[str, Field(pattern=r"^https://www[.]economia-sniim[.]gob[.]mx/")]
    missing_reason: Text | None

    @model_validator(mode="after")
    def check_quote(self):
        if self.period_end < self.period_start:
            raise ValueError("Fechas de cotización invertidas.")
        if self.original_price != self.mxn_kg:
            raise ValueError("El precio original en MXN/kg se conserva sin conversión.")
        if self.granularity == "monthly":
            if self.price_kind != "monthly_mean_frequent":
                raise ValueError("El CSV mensual contiene el promedio de precios frecuentes diarios.")
        elif (
            self.price_kind != "daily_frequent"
            or self.period_start != self.period_end
            or self.mxn_kg_min is None
            or self.mxn_kg_max is None
            or not self.mxn_kg_min <= self.mxn_kg <= self.mxn_kg_max
        ):
            raise ValueError("La cotización diaria requiere precio frecuente dentro del rango publicado.")
        optional = (self.presentation, self.origin, self.mxn_kg_min, self.mxn_kg_max)
        if any(value is None for value in optional) != (self.missing_reason is not None):
            raise ValueError("Las ausencias de la fila requieren motivo.")
        return self


class MarketSummary(Contract):
    status: Literal["available", "missing"]
    n: Annotated[int, Field(ge=0)]
    minimum_mxn_kg: Nonnegative | None
    median_mxn_kg: Nonnegative | None
    maximum_mxn_kg: Nonnegative | None
    missing_reason: Text | None

    @model_validator(mode="after")
    def check_summary(self):
        values = (self.minimum_mxn_kg, self.median_mxn_kg, self.maximum_mxn_kg)
        if self.status == "missing":
            if self.n or any(value is not None for value in values) or self.missing_reason is None:
                raise ValueError("Un resumen sin datos requiere motivo y conteo cero.")
        elif not (
            self.n and self.missing_reason is None
            and all(value is not None for value in values)
            and self.minimum_mxn_kg <= self.median_mxn_kg <= self.maximum_mxn_kg
        ):
            raise ValueError("Un resumen disponible requiere conteo positivo y precios ordenados.")
        return self


class MarketReferenceResponse(Contract):
    contract_version: Literal["0.2.0"] = "0.2.0"
    series_id: SeriesId
    market_id: Identifier
    market: Text
    granularity: Granularity
    period: Period
    variety: Text
    quality: Text
    source_name: Literal["SNIIM"] = "SNIIM"
    price_scope: Literal["wholesale"] = "wholesale"
    selected_month: Month
    rows: Annotated[list[MarketQuote], Field(min_length=1)]
    seasonal: MarketSummary
    weekly: MarketSummary
    delivery: ReferenceDelivery


def validate_series(series_id: str, data: list[dict]) -> list[MarketQuote]:
    rows = [MarketQuote.model_validate({key: value if value != "" else None for key, value in row.items()}) for row in data]
    periods = {(row.period_start, row.period_end) for row in rows}
    metadata = {(row.market_id, row.market, row.variety, row.quality, row.granularity) for row in rows}
    expected_granularity = "monthly" if series_id == "campeche-monthly" else "daily"
    valid_count = 1 <= len(rows) <= 5 if series_id == "merida-recent" else len(rows) == SERIES_COUNTS[series_id]
    if (
        not valid_count
        or len(periods) != len(rows)
        or len({row.id for row in rows}) != len(rows)
        or len(metadata) != 1
        or rows[0].granularity != expected_granularity
        or {row.series_id for row in rows} != {series_id}
    ):
        raise ValueError("El extracto de SNIIM no cumple la cobertura o composición prevista.")
    return sorted(rows, key=lambda row: row.period_start)


def load_series(series_id: SeriesId) -> list[MarketQuote]:
    backup_id = "merida-weekly" if series_id == "merida-recent" else series_id
    with CSV_PATH.open(encoding="utf-8", newline="") as stream:
        return validate_series(backup_id, [row for row in csv.DictReader(stream, strict=True)
                                           if row.get("series_id") == backup_id])


def summarize(rows: list[MarketQuote], missing_reason: str) -> MarketSummary:
    if not rows:
        return MarketSummary(
            status="missing", n=0, minimum_mxn_kg=None, median_mxn_kg=None,
            maximum_mxn_kg=None, missing_reason=missing_reason,
        )
    prices = [row.mxn_kg for row in rows]
    return MarketSummary(
        status="available", n=len(prices), minimum_mxn_kg=min(prices), median_mxn_kg=median(prices),
        maximum_mxn_kg=max(prices), missing_reason=None,
    )


router = APIRouter(tags=["Referencias externas"])
CACHES = {series: ReferenceCache[list[MarketQuote]]() for series in (*SERIES_COUNTS, "merida-recent")}


@router.get(
    "/v1/market-references/{series_id}",
    response_model=MarketReferenceResponse,
    responses={status: {"model": ApiError} for status in (404, 422, 503)},
)
def market_reference(
    series_id: str,
    month: Annotated[int, Query(ge=1, le=12, description="Mes para el resumen estacional.")] = 9,
    refresh: Annotated[bool, Query(description="Volver a consultar SNIIM.")] = False,
) -> MarketReferenceResponse | JSONResponse:
    """Consulta SNIIM y resume los precios de la serie solicitada."""
    if series_id not in CACHES:
        error = ApiError(code="not_found", message="Serie mayorista inexistente.", module="SNIIM")
        return JSONResponse(status_code=404, content=error.model_dump())

    try:
        fallback_reason = ("SNIIM no devolvió una semana reciente comparable. Se muestra la semana histórica precargada de Mérida."
                           if series_id == "merida-recent" else
                           "SNIIM no devolvió un extracto completo y válido en esta consulta. Se muestra el respaldo local.")
        result = CACHES[series_id].get(lambda: validate_series(series_id, fetch_rows(series_id)),
                                       lambda: load_series(series_id), fallback_reason, refresh=refresh)
        rows = result.data
        first = rows[0]
        monthly = first.granularity == "monthly"
        seasonal_rows = [row for row in rows if monthly and row.period_start.month == month]
        return MarketReferenceResponse(
            series_id=series_id, market_id=first.market_id, market=first.market,
            granularity=first.granularity, period=Period(start=first.period_start, end=rows[-1].period_end),
            variety=first.variety, quality=first.quality, selected_month=month, rows=rows,
            seasonal=summarize(seasonal_rows, "Faltan cotizaciones del mismo mes en años previos para esta plaza."),
            weekly=summarize([] if monthly else rows, "El extracto de esta plaza contiene promedios mensuales."),
            delivery=result.delivery,
        )
    except (OSError, ValueError, csv.Error):
        error = ApiError(
            code="market_data_unavailable", message="La consulta de SNIIM y el respaldo de esta serie no están disponibles.",
            module="SNIIM",
        )
        return JSONResponse(status_code=503, content=error.model_dump())
