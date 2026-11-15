from decimal import Decimal

from luumia import base
from luumia.demo_fixture import load_demo_fixture


def test_packaged_demo_keeps_published_calculations_and_field_history():
    fixture = load_demo_fixture()
    contexts = {context.context_version: context for context in fixture.contexts}
    plans = {plan.plan_version: plan for plan in fixture.plans}

    assert sorted(contexts) == list(range(1, 12))
    assert all(context.parcel.id == base.PARCEL_ID and context.data_kind == "synthetic" for context in contexts.values())
    latest = contexts[11]
    assert latest.evaluation_state == "vigente"
    assert latest.evaluation and latest.evaluation.context_version == 11
    assert latest.rain_comparison and latest.rain_comparison.local
    reading = latest.rain_comparison.local
    assert reading.value == 13.75 and reading.data_kind == "synthetic"
    assert reading.kobo and reading.kobo.context_version == 10
    assert contexts[10].field_observations[-1].kobo == reading.kobo
    previous_version = contexts[10].last_evaluation_version
    assert previous_version and contexts[previous_version].evaluation

    assert sorted(plans) == list(range(1, 6))
    assert plans[5].shared_at and plans[5].plan.context_version == 11
    assert plans[5].plan.estimated_harvest_kg == Decimal("52200")
    economics = plans[5].plan.economics
    assert economics and economics.estimated_margin_mxn == Decimal("170477.25")
