"""Regresiones del comparador anual y de su política comercial."""

from datetime import date
from decimal import Decimal

import pytest

from luumia import base
from luumia.contracts import CollectionResult, WeeklyCell
from luumia.cycle_plan import CycleAssumption, CyclePlanRequest, compare_cycle, producer_forecasts
from luumia.price_forecast import MonthlyForecast
from luumia.service import demo_request, prepare_evaluation, seed

AS_OF = date(2026, 11, 14)


@pytest.fixture(scope="module")
def context():
    from luumia.api import power_snapshot

    snapshot: CollectionResult = power_snapshot()
    cells = [WeeklyCell.model_validate(row) for row in base.harmonize(snapshot.model_dump(mode="json"))]
    return prepare_evaluation(seed(), demo_request(), cells)


def plan(context, **fields):
    inputs = CyclePlanRequest(context_version=context.context_version, **fields)
    return compare_cycle(context, inputs, AS_OF, producer_forecasts(AS_OF))


def test_don_tino_three_different_choices_using_provenance(context):
    result = plan(context)
    rows = {item.crop_id: item for item in result.rows}
    assert result.sale_month == "2027-10"
    assert result.available_sale_months == [f"2027-{month:02}" for month in range(6, 12)]
    assert (result.natural_best_crop_id, result.margin_best_crop_id, result.recommended_crop_id) == (
        "frijol", "maiz", "calabaza",
    )
    assert rows["maiz"].yield_basis == "municipal_median"
    assert rows["maiz"].economics.margin_mxn == Decimal(114_000)
    assert rows["maiz"].economics.reference_series_id == "usda-ers-maiz-us"
    assert rows["frijol"].economics.reference_series_id == "usda-nass-frijol-us"
    calabaza = rows["calabaza"].economics
    assert calabaza.price_basis == "local_assumption" and calabaza.reference_series_id is None
    assert calabaza.sold_kg == 28_000 and calabaza.margin_mxn == 106_000 and calabaza.margin_low_mxn is None
    assert not rows["saladette"].viable
    assert any(item.series.series_id == "mapa-calabacin-es" and item.points for item in result.forecasts)


def test_care_and_hard_constraints_apply_to_winner(context):
    result = plan(context, sale_month="2027-09", assumptions=[
        CycleAssumption(crop_id="calabaza", soil_cover=False),
        CycleAssumption(crop_id="saladette", local_price_mxn_kg=500),
    ])
    assert result.margin_best_crop_id == "maiz"
    assert result.recommended_crop_id == "frijol"
    saladette = next(row for row in result.rows if row.crop_id == "saladette")
    assert saladette.economics.margin_mxn > 114_000 and not saladette.viable
    with pytest.raises(base.BaseError, match="cosecha"):
        plan(context, sale_month="2027-03")


def test_no_recommendation_if_options_only_have_losses_or_incomplete_inputs(context):
    result = plan(context, assumptions=[
        CycleAssumption(crop_id="frijol", capacity_kg=0),
        CycleAssumption(crop_id="calabaza", cost_mxn=300_000),
        CycleAssumption(crop_id="maiz", local_price_mxn_kg=None),
    ])
    rows = {item.crop_id: item for item in result.rows}
    assert result.recommended_crop_id is None
    assert rows["maiz"].economics is None
    assert rows["frijol"].economics.margin_mxn == Decimal(-110_000)


def test_observed_mexican_price_changes_margin_and_preserves_ranking(context):
    current = plan(context)
    observed = plan(context, price_mode="mexican_observation")
    initial = {row.crop_id: row.economics for row in current.rows}
    margins = {row.crop_id: row.economics for row in observed.rows}
    assert margins["maiz"].price_mxn_kg == Decimal("5.48")
    assert margins["maiz"].margin_mxn == Decimal(113_360)
    assert margins["frijol"].price_mxn_kg == Decimal("14.53")
    assert margins["frijol"].margin_mxn == Decimal(35_300)
    assert margins["frijol"].price_basis == "mexican_observation"
    assert margins["frijol"].reference_observed_month == date(2025, 11, 1)
    assert margins["frijol"].reference_observed_url.endswith("/diciembre2025.php")
    assert margins["frijol"].margin_low_mxn is None
    assert margins["calabaza"] == initial["calabaza"]
    assert (observed.natural_best_crop_id, observed.margin_best_crop_id, observed.recommended_crop_id) == (
        "frijol", "maiz", "calabaza",
    )
    regional = next(item for item in observed.forecasts if item.series.geography_level == "region")
    assert regional.latest_observed_month == date(2026, 9, 1)
    assert regional.series.observation_kind == "point_in_month" and regional.status == "missing"


def test_comparable_market_forecast_prefers_campeche_and_converts_units(context):
    forecasts = producer_forecasts(AS_OF)
    national = next(item for item in forecasts if item.series.series_id == "dgsiap-maiz-blanco-mx")

    def matching(series_id, geography_level, state_code, price):
        return national.model_copy(update={
            "series": national.series.model_copy(update={"series_id": series_id, "geography_level": geography_level,
                                                        "state_code": state_code, "variety_match": "aggregate", "unit": "t"}),
            "status": "available",
            "points": [MonthlyForecast(month=date(2027, 10, 1), low=price - 100, central=price, high=price + 100)],
        })

    national = matching("demo-nacional", "national", None, 5000)
    state = matching("demo-campeche", "state", "04", 5200)
    other_state = matching("demo-otroestado", "state", "01", 8000)
    request = CyclePlanRequest(context_version=context.context_version)
    proposal = compare_cycle(context, request, AS_OF, [*forecasts, national, state, other_state])
    maize = next(row.economics for row in proposal.rows if row.crop_id == "maiz")
    assert maize.price_basis == "local_forecast"
    assert maize.reference_series_id == "demo-campeche"
    assert maize.price_mxn_kg == Decimal("5.20")
    assert maize.price_low_mxn_kg == Decimal("5.10")
