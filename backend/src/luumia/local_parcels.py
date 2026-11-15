"""Alta y consulta de parcelas propias en la instancia local."""

from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter
from pydantic import StringConstraints

from . import base
from .contracts import ApiError, Contract, Identifier, ParcelContext
from .evidence import build_evidence
from .sowing_plan import PlanArea
from .storage import Repository

Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class LocalParcelCreate(Contract):
    name: Name
    declared_area_ha: PlanArea
    municipality: Name | None = None
    state: Name | None = None
    production_system: Literal["rainfed", "irrigated"] = "rainfed"


class LocalParcelSummary(Contract):
    parcel_id: Identifier
    name: str
    declared_area_ha: Decimal
    municipality: str
    state: str


def create_local_context(payload: LocalParcelCreate) -> ParcelContext:
    suffix = uuid4().hex
    context = ParcelContext.model_validate({
        "id": f"context-local-{suffix}",
        "context_version": 1,
        "cycle_id": f"cycle-local-{suffix}",
        "updated_at": datetime.now(UTC),
        "data_kind": "observed",
        "producer": {"id": f"producer-local-{suffix}", "display_name": payload.name, "persona_kind": "real"},
        "parcel": {
            "id": f"parcel-local-{suffix}", "name": payload.name,
            "municipality": payload.municipality or "Sin registrar", "state": payload.state or "Sin registrar",
            "country": "MX", "timezone": "America/Mexico_City",
            "declared_area_ha": payload.declared_area_ha, "geometry": {}, "geometry_kind": "unavailable",
            "area_note": "Superficie declarada en la instancia local.",
            "production_system": payload.production_system,
        },
        "history": [], "priorities": dict(base.PRIORITIES), "constraints": [], "soil": [], "observations": [],
        "features": [], "field_observations": [], "evaluation": None, "decisions": [], "pending_questions": [],
        "warnings": [],
    })
    return context.model_copy(update={"evidence_blocks": build_evidence(context)})


router = APIRouter(prefix="/v1/parcels", tags=["Parcelas propias"])


@router.get("", response_model=list[LocalParcelSummary], responses={503: {"model": ApiError}})
def list_local_parcels() -> list[LocalParcelSummary]:
    summaries = [
        LocalParcelSummary(parcel_id=context.parcel.id, name=context.producer.display_name,
                           declared_area_ha=Decimal(str(context.parcel.declared_area_ha)),
                           municipality=context.parcel.municipality, state=context.parcel.state)
        for context in Repository().list_local()
    ]
    return sorted(summaries, key=lambda item: (item.name.casefold(), item.parcel_id))


@router.post("", response_model=ParcelContext, status_code=201,
             responses={status: {"model": ApiError} for status in (409, 422, 503)})
def create_local_parcel(payload: LocalParcelCreate) -> ParcelContext:
    return Repository().create(create_local_context(payload))
