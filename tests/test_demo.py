"""Regresiones del recorrido P0 con el respaldo documentado de POWER."""

from copy import deepcopy
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from luumia import base, market, usda_reference
from luumia.api import app
from luumia.assistant import explain, project
from luumia.contracts import CollectionResult, EvaluationRequest, EvaluationResponse, ExplanationRequest, WeeklyCell
from luumia.crop_yield import YieldScenarioError, yield_reference
from luumia.service import demo_request, prepare_evaluation, seed
from luumia.reference_cache import ReferenceCache


@pytest.fixture
def cells():
    snapshot = Path(__file__).resolve().parents[1] / "data/processed/power/don-tino-week.json"
    collection = CollectionResult.model_validate_json(snapshot.read_text(encoding="utf-8"))
    return [WeeklyCell.model_validate(row) for row in base.harmonize(collection.model_dump(mode="json"))]


@pytest.mark.parametrize("kind,cupo,margin,equilibrium", [
    ("spot", [6000, 12000], [-20000, 40000], Decimal("13.33")),
    ("cooperative", [8000, 10000], [0, 20000], Decimal("10.00")),
    ("spot", [0, 12000], [-80000, 40000], None),
])
def test_margin_and_evidence(cells, kind, cupo, margin, equilibrium):
    request = demo_request().model_dump(mode="json")
    request["commercial_scenarios"][0].update(sales_structure=kind, cupo_range=cupo)
    context = prepare_evaluation(seed(), EvaluationRequest.model_validate(request), cells)
    assert context.evaluation_state == "vigente"
    assert context.evidence_blocks.agronomico.n_observaciones == 2
    assert context.evidence_blocks.comercial.evidence_tier == "simulated_assumption"
    assert context.evidence_blocks.secuencia_cultivos.n_simulated == 6
    result = context.evaluation.commercial_results[0]
    assert [result.margen_min_mxn, result.margen_max_mxn] == margin
    for side in (result.bajo, result.alto):
        assert side.kg_vendidos + side.kg_sin_salida == side.kg_disponibles == 12000
    if equilibrium is None:
        assert result.bajo.precio_equilibrio_status == "missing"
        assert result.bajo.precio_equilibrio_missing_reason
        assert result.bajo.precio_equilibrio_mxn_kg is None
    else:
        assert result.bajo.precio_equilibrio_mxn_kg.quantize(Decimal("0.01")) == equilibrium


@pytest.mark.parametrize("cupo,area,excedente,ingresos,efectivos", [
    ([6000, 12000], "12", "8", [60000, 108000], [10, 9]),
    ([0, 12000], "5", "8", [0, 50000], [None, 10]),
    ([6000, 12000], "12", "0", [60000, 60000], [10, 5]),
])
def test_simulated_price_tiers_use_sold_kg(cells, cupo, area, excedente, ingresos, efectivos):
    request = demo_request().model_dump(mode="json")
    scenario = request["commercial_scenarios"][0]
    scenario.update(cupo_range=cupo, superficie_ha=area)
    fixed = prepare_evaluation(seed(), EvaluationRequest.model_validate(request), cells).evaluation
    scenario["precio_volumen"] = {"umbral_kg": 6000, "precio_excedente_mxn_kg": excedente}
    simulated = prepare_evaluation(seed(), EvaluationRequest.model_validate(request), cells).evaluation
    result = simulated.commercial_results[0]
    assert result.method_version == "commercial-price-volume-1"
    assert result.precio_volumen.evidence_tier == "simulated_assumption"
    assert simulated.request_snapshot.commercial_scenarios[0].precio_volumen == result.precio_volumen
    assert [result.bajo.ingreso_mxn, result.alto.ingreso_mxn] == ingresos
    assert [result.bajo.precio_efectivo_mxn_kg, result.alto.precio_efectivo_mxn_kg] == efectivos
    assert [result.margen_min_mxn, result.margen_max_mxn] == [value - 80000 for value in ingresos]
    assert result.bajo.precio_equilibrio_mxn_kg == fixed.commercial_results[0].bajo.precio_equilibrio_mxn_kg
    assert simulated.recommendations == fixed.recommendations and simulated.id != fixed.id


def test_price_tiers_require_valid_assumptions(cells):
    request = demo_request().model_dump(mode="json")
    scenario = request["commercial_scenarios"][0]
    for terms in (
        {"umbral_kg": 0, "precio_excedente_mxn_kg": "8"},
        {"umbral_kg": 6000, "precio_excedente_mxn_kg": "-1"},
        {"umbral_kg": 6000, "precio_excedente_mxn_kg": "8", "evidence_tier": "observed"},
    ):
        scenario["precio_volumen"] = terms
        with pytest.raises(ValidationError):
            EvaluationRequest.model_validate(request)

    historical = prepare_evaluation(seed(), demo_request(), cells).evaluation.model_dump(mode="json")
    for result in historical["commercial_results"]:
        result.pop("precio_volumen")
        result.pop("precio_base_mxn_kg")
        for side in (result["bajo"], result["alto"]):
            side.pop("ingreso_mxn")
            side.pop("precio_efectivo_mxn_kg")
    loaded = EvaluationResponse.model_validate(historical)
    assert loaded.commercial_results[0].margen_max_mxn == 40000
    assert loaded.commercial_results[0].alto.precio_efectivo_mxn_kg is None


def test_municipal_yield_keeps_crop_and_agricultural_cycle_separate():
    client = TestClient(app)
    route = "/v1/yield-references"
    response = client.get(f"{route}/maiz?cycle=spring_summer")
    response.raise_for_status()
    payload = response.json()
    ref = payload["reference"]
    assert payload["status"] == "available" and ref["evidence_tier"] == "derived"
    assert ref["n"] == 5 and ref["median_t_ha"] == "3.585342"
    assert [record["year"] for record in ref["rows"]] == list(range(2021, 2026))
    assert ref["max_record"]["year"] == 2025 and ref["max_record"]["harvested_area_ha"] == "43492"
    for crop, cycle in (("maiz", "fall_winter"), ("saladette", "spring_summer"), ("frijol", "spring_summer")):
        missing = client.get(f"{route}/{crop}?cycle={cycle}").json()
        assert missing["status"] == "missing" and missing["missing_reason"] and missing["reference"] is None


def test_municipal_median_only_applies_when_explicitly_selected(cells):
    ref = yield_reference("maiz", "spring_summer").reference
    payload = demo_request().model_dump(mode="json")
    scenario = payload["commercial_scenarios"][0]
    scenario.update(agricultural_cycle="spring_summer", merma_fraccion="0.10")
    manual = prepare_evaluation(seed(), EvaluationRequest.model_validate(payload), cells).evaluation.commercial_results[0]
    assert manual.applied_yield.assumption.kind == "manual" and manual.kg_cosechados == 12000

    scenario.update(rendimiento_esperado_t_ha=str(ref.median_t_ha),
                    yield_assumption={"kind": "municipal_median", "reference_id": ref.reference_id})
    assessment = prepare_evaluation(seed(), EvaluationRequest.model_validate(payload), cells).evaluation
    result = assessment.commercial_results[0]
    assert result.kg_cosechados == Decimal("43024.104")
    assert result.alto.kg_disponibles == Decimal("38721.6936")
    assert result.alto.kg_vendidos == 12000 and result.alto.kg_sin_salida == Decimal("26721.6936")
    assert result.applied_yield.reference_n == 5 and result.applied_yield.evidence_tier == "simulated_assumption"
    assert assessment.request_snapshot.commercial_scenarios[0].yield_assumption == result.applied_yield.assumption

    scenario["rendimiento_esperado_t_ha"] = "0"
    with pytest.raises(YieldScenarioError, match="no coincide"):
        prepare_evaluation(seed(), EvaluationRequest.model_validate(payload), cells)
    scenario["rendimiento_esperado_t_ha"] = str(ref.median_t_ha)
    scenario["agricultural_cycle"] = "fall_winter"
    with pytest.raises(YieldScenarioError, match="no coincide"):
        prepare_evaluation(seed(), EvaluationRequest.model_validate(payload), cells)
    scenario["yield_assumption"] = {"kind": "manual"}
    scenario["rendimiento_esperado_t_ha"] = "0"
    unavailable_crop = prepare_evaluation(seed(), EvaluationRequest.model_validate(payload), cells).evaluation.commercial_results[0]
    assert unavailable_crop.kg_cosechados == unavailable_crop.alto.kg_vendidos == 0


def test_market_reference_from_real_extracts(monkeypatch):
    def unavailable(_series_id):
        raise OSError("SNIIM temporalmente inaccesible")

    monkeypatch.setattr(market, "fetch_rows", unavailable)
    monkeypatch.setattr(market, "CACHES", {series: ReferenceCache() for series in market.CACHES})
    client = TestClient(app)
    campeche = client.get("/v1/market-references/campeche-monthly?month=9").json()
    merida = client.get("/v1/market-references/merida-weekly?month=9").json()
    assert len(campeche["rows"]) == 60
    assert campeche["seasonal"]["n"] == len(merida["rows"]) == 5
    assert campeche["seasonal"]["median_mxn_kg"] == "11.32"
    assert merida["seasonal"]["status"] == "missing" and merida["seasonal"]["missing_reason"]
    assert merida["weekly"]["median_mxn_kg"] == "24.29"
    assert campeche["delivery"]["mode"] == merida["delivery"]["mode"] == "snapshot"
    recent = client.get("/v1/market-references/merida-recent").json()
    assert recent["series_id"] == "merida-recent" and recent["rows"][0]["series_id"] == "merida-weekly"
    assert recent["delivery"]["mode"] == "snapshot" and recent["delivery"]["fallback_reason"]
    assert recent["period"] == {"start": "2026-09-21", "end": "2026-09-25"}
    assert recent["rows"][0]["retrieved_at"] == merida["rows"][0]["retrieved_at"]


def test_market_reference_reuses_one_provider_query_for_multiple_months(monkeypatch):
    calls = []

    def published(series_id):
        calls.append(series_id)
        return [row.model_dump() for row in market.load_series(series_id)]

    monkeypatch.setattr(market, "fetch_rows", published)
    monkeypatch.setattr(market, "CACHES", {series: ReferenceCache() for series in market.CACHES})
    client = TestClient(app)
    url = "/v1/market-references/campeche-monthly"
    first = client.get(url + "?month=9").json()
    second = client.get(url + "?month=10").json()
    assert first["delivery"]["mode"] == "live" and second["delivery"]["mode"] == "cache"
    assert second["selected_month"] == 10 and second["delivery"]["attempted_at"] == first["delivery"]["attempted_at"]
    assert calls == ["campeche-monthly"]


def test_usda_unavailable_uses_original_snapshot(monkeypatch):
    def unavailable():
        raise usda_reference.UsdaUnavailable("USDA temporalmente inaccesible")

    monkeypatch.setattr(usda_reference, "fetch_usda", unavailable)
    monkeypatch.setattr(usda_reference, "CACHE", ReferenceCache())
    client = TestClient(app)
    url = "/v1/usda-references/mexico-corn-production"
    response = client.get(url)
    response.raise_for_status()
    report = response.json()
    assert report["delivery"]["mode"] == "snapshot" and report["delivery"]["fallback_reason"]
    assert report["data"] == usda_reference.load_usda_snapshot().model_dump(mode="json")
    assert report["data"]["geography"] == "México · nacional"

    monkeypatch.setattr(usda_reference, "load_usda_snapshot", unavailable)
    monkeypatch.setattr(usda_reference, "CACHE", ReferenceCache())
    missing = client.get(url)
    assert missing.status_code == 503 and missing.json()["code"] == "usda_data_unavailable"


def test_p1_scenario_uses_simulated_probe_and_p0_margins():
    result = TestClient(app).get("/demo/don-tino/p1")
    result.raise_for_status()
    example = result.json()
    assert example["probe"]["evidence_tier"] == "simulated_assumption"
    assert example["probe"]["n_observaciones"] == 1
    assert example["probe"]["unit"] == "m³/m³"
    spot, cooperative = example["spot"], example["cooperative"]
    assert spot["cupo_centro_kg"] == cooperative["cupo_centro_kg"] == "9000"
    assert [Decimal(spot["margen_min_mxn"]), Decimal(spot["margen_max_mxn"])] == [-20_000, 40_000]
    assert [Decimal(cooperative["margen_min_mxn"]), Decimal(cooperative["margen_max_mxn"])] == [0, 20_000]


def test_explanation_preserves_exclusion_and_distinguishes_confirmation(cells, monkeypatch):
    monkeypatch.delenv("LUUMIA_LOCAL_LLM_URL", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    question = ExplanationRequest(context_version=1, candidate_id="rotation-saladette", question_es="¿Por qué quedó fuera?")
    request = demo_request()
    context = prepare_evaluation(seed(), request, cells)
    projection = project(context, question)
    assert not {"observations", "features", "weekly_cells", "geometry"}.intersection(projection.model_dump())
    response = explain(projection, question.question_es)
    assert response.mode == "deterministic"
    assert response.primary_check.outcome == "fail"
    assert response.primary_check.evidence_tier == "simulated_assumption"
    assert response.text_es.startswith(response.primary_check.explanation)
    assert "Margen bajo supuestos comerciales" in response.text_es
    assert [item.candidate.id for item in context.evaluation.recommendations] == ["rotation-example-a", "rotation-example-b"]

    altered = deepcopy(request.model_dump(mode="json"))
    rule = next(item for item in altered["constraints"] if item["kind"] == "market_available")
    rule["buyer_refusals"] = []
    updated = prepare_evaluation(seed(), EvaluationRequest.model_validate(altered), cells)
    assert project(updated, question).exclusion.primary_check.outcome == "needs_confirmation"


def test_rejects_evidence_from_different_coordinates(cells):
    body = [row.model_dump(mode="json") for row in cells]
    source = body[0]["observations"][0]["source"]
    source["url"] = source["url"].replace("longitude=-89.841500", "longitude=-90.000000")
    tampered = [WeeklyCell.model_validate(row) for row in body]
    with pytest.raises(base.BaseError, match="ubicación"):
        prepare_evaluation(seed(), demo_request(), tampered)
