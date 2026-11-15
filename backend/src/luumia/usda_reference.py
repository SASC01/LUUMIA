"""Ruta de contexto nacional USDA con respaldo precargado."""

from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from .contracts import ApiError, Contract
from .reference_cache import ReferenceCache, ReferenceDelivery
from .usda_live import UsdaData, UsdaUnavailable, fetch_usda, load_usda_snapshot


class UsdaReferenceResponse(Contract):
    data: UsdaData
    delivery: ReferenceDelivery


router = APIRouter(tags=["Referencias externas"])
CACHE = ReferenceCache[UsdaData]()


@router.get("/v1/usda-references/mexico-corn-production", response_model=UsdaReferenceResponse,
            responses={503: {"model": ApiError}})
def usda_reference(
    refresh: Annotated[bool, Query(description="Volver a consultar USDA FAS.")] = False,
) -> UsdaReferenceResponse | JSONResponse:
    """Consulta las cinco campañas más recientes en la publicación PSD de maíz nacional."""
    try:
        outcome = CACHE.get(fetch_usda, load_usda_snapshot,
                            "USDA FAS no devolvió un extracto válido en esta consulta. Se muestra el respaldo local.",
                            refresh=refresh)
    except UsdaUnavailable:
        error = ApiError(code="usda_data_unavailable", message="La consulta de USDA FAS y su respaldo no están disponibles.",
                         module="USDA")
        return JSONResponse(status_code=503, content=error.model_dump())
    return UsdaReferenceResponse(data=outcome.data, delivery=outcome.delivery)
