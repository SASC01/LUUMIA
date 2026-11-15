"""Proyección mensual de referencias al productor en su unidad original."""

from collections import Counter
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from statistics import mean
from typing import Annotated, Literal

from pydantic import AfterValidator, AwareDatetime, Field, model_validator

from .contracts import Contract, Identifier, Text

ForecastMethod = Literal["last_price", "seasonal_naive"]
PositivePrice = Annotated[Decimal, Field(gt=0, max_digits=20, decimal_places=8)]
Currency = Annotated[str, Field(pattern=r"^[A-Z]{3}$")]
SourceUrl = Annotated[str, Field(pattern=r"^https://")]
HorizonErrors = dict[int, list[Decimal]]
FORECAST_MONTHS = 12
MAX_MISSING_RECENT_MONTHS = 3
MIN_ROWS = 30
RECENT_MONTHS = 36
BACKTEST_MONTHS = 48
MIN_ERRORS_PER_HORIZON = 8
SCENARIO_PERCENTILE = 80
PRICE_PRECISION = Decimal("0.000001")


def _first_of_month(value: date) -> date:
    if value.day != 1:
        raise ValueError("Cada registro debe identificarse por el primer día del mes.")
    return value


Month = Annotated[date, AfterValidator(_first_of_month)]


class MonthlyProducerPrice(Contract):
    month: Month
    price: PositivePrice
    source_flag: Text | None = None
    source_url: SourceUrl | None = None
    source_note: Text | None = None


class ProducerPriceSeries(Contract):
    series_id: Identifier
    crop_id: Identifier
    product: Text
    geography: Text
    geography_code: Text | None = None
    state_code: Text | None = None
    municipality_code: Text | None = None
    geography_level: Literal["national", "region", "state", "municipality"] = "national"
    observation_kind: Literal["monthly", "point_in_month"] = "monthly"
    currency: Currency
    unit: Text
    source_name: Text
    source_url: SourceUrl
    download_url: SourceUrl | None = None
    retrieved_at: AwareDatetime | None = None
    price_scope: Literal["producer"] = "producer"
    variety_match: Literal["exact", "aggregate"] | None = None
    rows: list[MonthlyProducerPrice]

    @model_validator(mode="after")
    def unique_months(self):
        if len({row.month for row in self.rows}) != len(self.rows):
            raise ValueError("La serie requiere un precio único por mes para el mismo producto y mercado.")
        return self


class MonthlyForecast(Contract):
    month: Month
    low: Decimal
    central: Decimal
    high: Decimal


class AnnualPriceForecast(Contract):
    period_start: Month
    period_end: Month
    low: Decimal
    central: Decimal
    high: Decimal
    aggregation: Literal["mean_of_monthly_scenarios"] = "mean_of_monthly_scenarios"


class ForecastValidation(Contract):
    method: ForecastMethod
    method_version: Literal["producer-price-rolling-1"] = "producer-price-rolling-1"
    mae: Decimal
    last_price_mae: Decimal
    seasonal_naive_mae: Decimal | None
    observations: int
    horizon_start: int
    horizon_end: int
    scenario_error_percentile: Literal[80] = SCENARIO_PERCENTILE


class PriceForecast(Contract):
    series: ProducerPriceSeries
    as_of: date
    status: Literal["available", "missing"]
    missing_reason: Text | None = None
    latest_observed_month: Month | None = None
    points: list[MonthlyForecast] = Field(default_factory=list)
    annual: AnnualPriceForecast | None = None
    validation: ForecastValidation | None = None


def _index(month: date) -> int:
    return (month.year - 1) * 12 + month.month - 1


def _month(index: int) -> date:
    year, month = divmod(index, 12)
    return date(year + 1, month + 1, 1)


def _seasonal(prices: dict[int, Decimal], origin: int, target: int) -> Decimal | None:
    same_season = origin - (origin - target) % 12
    return prices.get(same_season, prices.get(same_season - 12))


def _backtest(prices: dict[int, Decimal], latest: int, horizons: range) -> tuple[HorizonErrors, HorizonErrors, HorizonErrors]:
    # Cada precio de prueba está en un mes posterior al último visto en ese pronóstico.
    # Al comparar métodos se usa el mismo conjunto de meses y horizontes.
    last_errors: HorizonErrors = {horizon: [] for horizon in horizons}
    paired_last: HorizonErrors = {horizon: [] for horizon in horizons}
    paired_seasonal: HorizonErrors = {horizon: [] for horizon in horizons}
    for target in range(latest - BACKTEST_MONTHS + 1, latest + 1):
        if target not in prices:
            continue
        for horizon in horizons:
            origin = target - horizon
            if origin not in prices:
                continue
            error = abs(prices[target] - prices[origin])
            last_errors[horizon].append(error)
            seasonal = _seasonal(prices, origin, target)
            if seasonal is not None:
                paired_last[horizon].append(error)
                paired_seasonal[horizon].append(abs(prices[target] - seasonal))
    return last_errors, paired_last, paired_seasonal


def _enough_errors(errors: HorizonErrors) -> bool:
    return all(len(values) >= MIN_ERRORS_PER_HORIZON for values in errors.values())


def _mae(errors: HorizonErrors) -> Decimal:
    return mean(mean(values) for values in errors.values())


def _width(errors: list[Decimal]) -> Decimal:
    rank = (SCENARIO_PERCENTILE * len(errors) + 99) // 100
    return sorted(errors)[rank - 1]


def _rounded(value: Decimal) -> Decimal:
    return value.quantize(PRICE_PRECISION, rounding=ROUND_HALF_UP)


def forecast_producer_price(series: ProducerPriceSeries, *, as_of: date) -> PriceForecast:
    """Proyecta los próximos 12 meses completos si la referencia tiene cobertura suficiente."""
    cutoff = as_of.replace(day=1)
    history = sorted((row for row in series.rows if row.month < cutoff), key=lambda row: row.month)
    historical_series = series.model_copy(update={"rows": history})
    common = {
        "series": historical_series, "as_of": as_of,
        "latest_observed_month": history[-1].month if history else None,
    }

    def missing(reason: str) -> PriceForecast:
        return PriceForecast(**common, status="missing", missing_reason=reason)

    if series.observation_kind == "point_in_month":
        return missing("La fuente publica cotizaciones puntuales del mes. El pronóstico requiere precios mensuales comparables.")
    if not history:
        return missing("La serie carece de precios mensuales para meses completos al corte.")

    prices = {_index(row.month): row.price for row in history}
    latest = _index(history[-1].month)
    current = _index(cutoff)
    if current - latest - 1 > MAX_MISSING_RECENT_MONTHS:
        return missing("La referencia supera tres meses completos sin cotización. Hace falta una actualización para proyectar.")

    seasons = Counter(index % 12 for index in prices if index > latest - RECENT_MONTHS)
    if sum(seasons.values()) < MIN_ROWS or any(seasons[month] < 2 for month in range(12)):
        return missing("La serie requiere 30 precios en 36 meses, con al menos dos registros para cada mes del año.")

    first_horizon = current + 1 - latest
    horizons = range(first_horizon, first_horizon + FORECAST_MONTHS)
    last_errors, paired_last, paired_seasonal = _backtest(prices, latest, horizons)
    if not _enough_errors(last_errors):
        return missing("Faltan pruebas retrospectivas para estimar los 12 horizontes del pronóstico.")

    seasonal = [_seasonal(prices, latest, latest + horizon) for horizon in horizons]
    can_compare = _enough_errors(paired_seasonal) and None not in seasonal
    seasonal_mae = _mae(paired_seasonal) if can_compare else None
    base_mae = _mae(paired_last if can_compare else last_errors)
    use_seasonal = seasonal_mae is not None and seasonal_mae < base_mae
    selected_errors = paired_seasonal if use_seasonal else paired_last if can_compare else last_errors
    projected = seasonal if use_seasonal else [prices[latest]] * FORECAST_MONTHS

    points = []
    for horizon, level in zip(horizons, projected, strict=True):
        assert level is not None
        width = _width(selected_errors[horizon])
        points.append(MonthlyForecast(
            month=_month(latest + horizon), low=_rounded(max(Decimal(0), level - width)),
            central=_rounded(level), high=_rounded(level + width),
        ))

    return PriceForecast(
        **common, status="available", points=points,
        annual=AnnualPriceForecast(
            period_start=points[0].month, period_end=points[-1].month,
            low=_rounded(mean(point.low for point in points)),
            central=_rounded(mean(point.central for point in points)),
            high=_rounded(mean(point.high for point in points)),
        ),
        validation=ForecastValidation(
            method="seasonal_naive" if use_seasonal else "last_price", mae=_rounded(_mae(selected_errors)),
            last_price_mae=_rounded(base_mae),
            seasonal_naive_mae=_rounded(seasonal_mae) if seasonal_mae is not None else None,
            observations=sum(map(len, selected_errors.values())),
            horizon_start=horizons.start, horizon_end=horizons.stop - 1,
        ),
    )
