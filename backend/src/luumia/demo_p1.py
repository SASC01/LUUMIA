"""Datos de demostración de P1, independientes de la ficha vigente."""

from datetime import date
from decimal import Decimal
from typing import Annotated, Literal

from pydantic import Field

from .commercial import calculate
from .contracts import CommercialResult, Contract, Period
from .service import demo_request, seed


class SimulatedProbe(Contract):
    evidence_tier: Literal["simulated_assumption"] = "simulated_assumption"
    n_observaciones: Literal[1] = 1
    sensor_reference: str
    variable: Literal["volumetric_water_content"] = "volumetric_water_content"
    value: Annotated[Decimal, Field(ge=0, le=1)]
    unit: Literal["m³/m³"] = "m³/m³"
    depth_cm: Annotated[int, Field(gt=0)]
    simulated_date: date
    calibration: str
    manufacturer_url: str


class DemoP1(Contract):
    probe: SimulatedProbe
    window: Period
    spot: CommercialResult
    cooperative: CommercialResult


def build_demo_p1() -> DemoP1:
    context = seed()
    baseline = next(s for s in demo_request().commercial_scenarios if s.id == "scenario-maiz")
    cooperative = baseline.model_copy(update={
        "id": "scenario-maiz-cooperative",
        "sales_structure": "cooperative",
        "cupo_range": (8000, 10000),
    })
    return DemoP1(
        probe=SimulatedProbe(
            sensor_reference="Sonda tipo TEROS 12",
            value=Decimal("0.24"), depth_cm=20, simulated_date=date(2026, 11, 1),
            calibration="Curva genérica para suelo mineral, asumida para la demostración.",
            manufacturer_url="https://metergroup.com/es/products/teros-12/",
        ),
        window=baseline.sales_period,
        spot=calculate(baseline, context.parcel.declared_area_ha),
        cooperative=calculate(cooperative, context.parcel.declared_area_ha),
    )
