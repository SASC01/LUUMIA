from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from luumia.price_forecast import MonthlyProducerPrice, ProducerPriceSeries, forecast_producer_price


def producer_series(*, missing_months: set[date] = frozenset(), post_cutoff: bool = False,
                    price_jump: bool = False) -> ProducerPriceSeries:
    rows = [MonthlyProducerPrice(month=date(year, month, 1), price=Decimal(month + 20), source_flag="A")
            for year in range(2018, 2024) for month in range(1, 13)
            if date(year, month, 1) not in missing_months]
    if post_cutoff:
        rows.extend(MonthlyProducerPrice(month=date(2024, month, 1), price=9999) for month in [2, 3])
    if price_jump:
        rows = [row.model_copy(update={"price": Decimal(row.month.year - 2017)}) for row in rows]
        rows[-1] = rows[-1].model_copy(update={"price": Decimal("0.10")})
    return ProducerPriceSeries(
        series_id="maiz-test", crop_id="maiz", product="Maíz", geography="Estados Unidos", geography_code="US",
        currency="USD", unit="USD/bu", source_name="Test", source_url="https://example.test/precio", rows=rows,
    )


def test_monthly_forecast_skips_open_month_and_rolls_for_full_12_month_window():
    cutoff = date(2024, 2, 9)
    forecast = forecast_producer_price(producer_series(post_cutoff=True), as_of=cutoff)
    assert forecast == forecast_producer_price(producer_series(), as_of=cutoff)
    assert forecast.status == "available"
    assert forecast.latest_observed_month == date(2023, 12, 1)
    assert forecast.series.rows[-1].source_flag == "A"
    assert forecast.series.geography == "Estados Unidos"
    assert forecast.series.unit == "USD/bu"
    assert [point.month for point in forecast.points] == [date(2024, month, 1) for month in range(3, 13)] + [
        date(2025, 1, 1), date(2025, 2, 1),
    ]
    assert forecast.validation.method == "seasonal_naive"
    assert forecast.validation.mae == 0
    assert forecast.validation.last_price_mae > 0
    assert forecast.validation.horizon_start == 3
    assert forecast.validation.horizon_end == 14
    assert forecast.points[0].central == Decimal(23)
    assert forecast.annual.period_start == date(2024, 3, 1)
    assert forecast.annual.period_end == date(2025, 2, 1)
    assert forecast.annual.central == Decimal("26.5")


def test_forecast_prices_have_nonnegative_low_and_empirical_error_width():
    forecast = forecast_producer_price(producer_series(price_jump=True), as_of=date(2024, 1, 15))
    assert forecast.status == "available"
    assert forecast.validation.method == "last_price"
    assert forecast.validation.mae > 0
    assert forecast.validation.observations > 0
    assert forecast.validation.scenario_error_percentile == 80
    assert any(point.low == 0 for point in forecast.points)
    assert all(0 <= point.low <= point.central <= point.high for point in forecast.points)
    assert forecast.annual.low < forecast.annual.central < forecast.annual.high


def test_stale_and_sparse_series_keep_their_observations_without_a_forecast():
    stale = forecast_producer_price(producer_series(), as_of=date(2024, 5, 1))
    assert stale.status == "missing"
    assert stale.latest_observed_month == date(2023, 12, 1)
    assert len(stale.series.rows) == 72
    assert "tres meses" in stale.missing_reason
    assert stale.points == [] and stale.annual is None and stale.validation is None

    # A hole in the same season of the last three years must not be silently filled.
    missing = {date(year, 11, 1) for year in range(2021, 2024)}
    sparse = forecast_producer_price(producer_series(missing_months=missing), as_of=date(2024, 1, 1))
    assert sparse.status == "missing"
    assert "cada mes" in sparse.missing_reason
    assert not missing.intersection(row.month for row in sparse.series.rows)


def test_duplicate_rows_and_day_level_records_are_rejected():
    series = producer_series()
    with pytest.raises(ValidationError, match="precio único"):
        ProducerPriceSeries.model_validate({**series.model_dump(), "rows": [*series.rows, series.rows[-1]]})
    with pytest.raises(ValidationError, match="primer día"):
        MonthlyProducerPrice(month=date(2024, 3, 2), price=1)
