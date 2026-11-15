"""Receptor OpenRosa del formulario de pluviómetro de LuumIA."""

from datetime import UTC, datetime
from hashlib import md5, sha256
from hmac import compare_digest
from os import getenv
from pathlib import Path
from typing import Annotated, Literal
from uuid import UUID
from xml.etree.ElementTree import Element, SubElement, tostring

from defusedxml import ElementTree
from defusedxml.common import DefusedXmlException
from fastapi import APIRouter, HTTPException, Query, Request, Response, Security
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import ValidationError
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile

from .base import BaseError, PARCEL_ID
from .contracts import Contract, FieldObservationRequest, KoboReceipt
from .field import save_observation
from .kobo_local_auth import REALM, challenge, is_loopback, request_digest
from .storage import Conflict, NotFound, Repository, StorageError

FORM_ID = "don-tino-rain"
FORM_VERSION = "2026111401"
FORM_PATH = Path(__file__).resolve().parents[3] / "integrations/kobo/don-tino-rain.xml"
LIMIT = 64 * 1024
NS_LIST = "http://openrosa.org/xforms/xformsList"
NS_RESPONSE = "http://openrosa.org/http/response"
HEADERS = {"X-OpenRosa-Version": "1.0", "X-OpenRosa-Accept-Content-Length": str(LIMIT),
           "Cache-Control": "no-store"}
XML = "text/xml; charset=utf-8"
security = HTTPBasic(auto_error=False)
router = APIRouter(prefix="/integrations/kobo", tags=["KoboCollect · OpenRosa"])


class KoboStatus(Contract):
    enabled: bool
    form_id: Literal["don-tino-rain"] = FORM_ID
    form_version: str = FORM_VERSION


def configured_password() -> str:
    return getenv("LUUMIA_KOBO_PASSWORD", "").strip()


def authenticate(request: Request, credentials: Annotated[HTTPBasicCredentials | None, Security(security)]) -> None:
    password = configured_password()
    if not password:
        raise HTTPException(503, "Configura la credencial de KoboCollect en el servidor.", headers=HEADERS)
    local = is_loopback(request)
    if request.url.scheme != "https" and not local:
        raise HTTPException(403, "KoboCollect requiere HTTPS fuera del entorno local.", headers=HEADERS)
    username = getenv("LUUMIA_KOBO_USER", "don-tino")
    valid_user = credentials and compare_digest(credentials.username.encode(), username.encode())
    valid_password = credentials and compare_digest(credentials.password.encode(), password.encode())
    if not (valid_user and valid_password) and not (local and request_digest(request, username, password)):
        raise HTTPException(401, "Credencial de KoboCollect incorrecta.",
                            headers={**HEADERS, "WWW-Authenticate": challenge() if local else f'Basic realm="{REALM}"'})


def xml_response(root: Element, status_code: int = 200) -> Response:
    return Response(tostring(root, encoding="utf-8", xml_declaration=True), status_code=status_code,
                    headers=HEADERS, media_type=XML)


def message(status: int, text: str) -> Response:
    root = Element("OpenRosaResponse", {"xmlns": NS_RESPONSE})
    SubElement(root, "message", {"nature": "submit_success" if status == 201 else "error"}).text = text
    return xml_response(root, status)


@router.get("/status", response_model=KoboStatus)
def integration_status():
    return KoboStatus(enabled=bool(configured_password()) and FORM_PATH.is_file())


@router.get("/formList", name="kobo_form_list", response_class=Response, dependencies=[Security(authenticate)])
def list_forms(request: Request, form_id: Annotated[str | None, Query(alias="formID")] = None):
    root = Element("xforms", {"xmlns": NS_LIST})
    if form_id is None or form_id == FORM_ID:
        try:
            xml = FORM_PATH.read_bytes()
        except OSError:
            return message(503, "El formulario de LuumIA no está disponible.")
        form = SubElement(root, "xform")
        SubElement(form, "formID").text = FORM_ID
        SubElement(form, "name").text = "LuumIA · Pluviómetro de Don Tino"
        SubElement(form, "version").text = FORM_VERSION
        SubElement(form, "hash").text = f"md5:{md5(xml, usedforsecurity=False).hexdigest()}"
        SubElement(form, "downloadUrl").text = str(request.url_for("kobo_form_xml"))
    return xml_response(root)


@router.get("/forms/don-tino-rain", name="kobo_form_xml", response_class=Response, dependencies=[Security(authenticate)])
def download_form():
    try:
        return Response(FORM_PATH.read_bytes(), headers=HEADERS, media_type=XML)
    except OSError:
        return message(503, "El formulario de LuumIA no está disponible.")


@router.head("/submission", name="kobo_submission_check", status_code=204, dependencies=[Security(authenticate)])
def check_submission(request: Request):
    return Response(status_code=204, headers={**HEADERS, "Location": str(request.url_for("kobo_submission"))})


class LimitedUpload(Exception):
    pass


async def read_xml(request: Request) -> bytes:
    if request.headers.get("Content-Type", "").partition(";")[0].strip().lower() != "multipart/form-data":
        raise BaseError("OpenRosa requiere una parte multipart llamada xml_submission_file.")
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > LIMIT:
            raise LimitedUpload
        body.extend(chunk)

    async def receive():
        return {"type": "http.request", "body": bytes(body), "more_body": False}

    # Reutiliza el analizador multipart de Starlette después de limitar el cuerpo completo.
    bounded_request = Request(request.scope, receive)
    async with bounded_request.form(max_files=1, max_fields=0, max_part_size=LIMIT) as form:
        file = form.get("xml_submission_file")
        if not isinstance(file, UploadFile):
            raise BaseError("Falta el archivo XML de la observación.")
        return await file.read()


def translate(xml: bytes) -> tuple[FieldObservationRequest, KoboReceipt]:
    root = ElementTree.fromstring(xml, forbid_dtd=True)
    if root.tag != "data" or (root.get("id"), root.get("version")) != (FORM_ID, FORM_VERSION):
        raise BaseError("Descarga la versión vigente del formulario de LuumIA.")

    def field(name: str) -> str:
        nodes = root.findall(name)
        if len(nodes) > 1 or (nodes and len(nodes[0])):
            raise BaseError("El formulario contiene campos repetidos o inválidos.")
        return (nodes[0].text or "").strip() if nodes else ""

    raw_id = field("meta/instanceID")
    if not raw_id.startswith("uuid:"):
        raise BaseError("Falta el identificador de instancia de OpenRosa.")
    instance_id = UUID(raw_id[5:])
    if field("parcel_id") != PARCEL_ID:
        raise BaseError("El formulario corresponde a la parcela de Don Tino.")

    data_kind = field("data_kind")
    observed_at = field("observed_at")
    case = "simulada" if data_kind == "synthetic" else "confirmada en campo"
    body = FieldObservationRequest.model_validate({
        "expected_context_version": field("expected_context_version"),
        "observation": {
            "id": f"kobo-{instance_id}", "parcel_id": PARCEL_ID,
            "variable": "precipitation", "unit": "mm", "value": float(field("rainfall_mm")),
            "observed_at": observed_at, "author_id": field("author_id"),
            "confirmed": field("confirmed") == "yes", "data_kind": data_kind,
            "note": field("note") or f"Lectura {case} recibida mediante KoboCollect.",
            "rain_gauge": {
                "method": "rain_gauge", "accumulation_start": field("accumulation_start"),
                "accumulation_end": field("accumulation_end"),
                "source": {"id": "kobo-pluviometro-simulado" if data_kind == "synthetic" else "kobo-pluviometro-campo",
                           "name": f"KoboCollect · Pluviómetro, lectura {case}",
                           "kind": "synthetic" if data_kind == "synthetic" else "local",
                           "retrieved_at": datetime.now(UTC), "product": FORM_ID, "product_version": FORM_VERSION},
            },
        },
    })
    # Excluye la procedencia generada por el servidor, incluida la hora de recepción.
    canonical = body.model_dump_json(exclude={"observation": {"rain_gauge": {"source"}}})
    receipt = KoboReceipt(instance_id=instance_id, form_id=FORM_ID, form_version=FORM_VERSION,
                          payload_sha256=sha256(canonical.encode()).hexdigest(),
                          context_version=body.expected_context_version + 1)
    return body, receipt


def import_observation(repository: Repository, body: FieldObservationRequest, receipt: KoboReceipt) -> int:
    def previous_version() -> int | None:
        context = repository.get(body.observation.parcel_id)
        entry = next((item for item in context.field_observations if item.kobo and item.kobo.instance_id == receipt.instance_id), None)
        if entry and entry.kobo:
            if not compare_digest(entry.kobo.payload_sha256, receipt.payload_sha256):
                raise Conflict("Ya existe un envío de KoboCollect con ese identificador y contenido diferente.")
            return entry.kobo.context_version
        return None

    previous = previous_version()
    if previous is not None:
        return previous
    try:
        return save_observation(repository, body, kobo=receipt).context_version
    except Conflict:
        # Una respuesta a una entrega simultánea puede llegar después de su guardado original.
        previous = previous_version()
        if previous is not None:
            return previous
        raise


@router.post("/submission", name="kobo_submission", status_code=201, response_class=Response,
             dependencies=[Security(authenticate)], responses={status: {"description": explanation} for status, explanation in (
                 (400, "Multipart inválido"), (401, "Credenciales inválidas"), (404, "Parcela inexistente"),
                 (409, "Versión desactualizada o envío modificado"), (413, "Envío demasiado grande"),
                 (422, "Formulario o lectura inválidos"), (503, "Almacén no disponible"),
             )})
async def submit(request: Request):
    try:
        body, receipt = translate(await read_xml(request))
        version = await run_in_threadpool(import_observation, Repository(), body, receipt)
    except LimitedUpload:
        return message(413, "El formulario supera el límite de 64 KiB.")
    except HTTPException as error:
        return message(error.status_code, "No se pudo leer el cuerpo multipart de OpenRosa.")
    except (ElementTree.ParseError, DefusedXmlException):
        return message(422, "El XML del formulario es inválido.")
    except ValidationError as error:
        field = ".".join(str(part) for part in error.errors()[0]["loc"])
        return message(422, f"Revisa el valor de {field or 'la observación'} en KoboCollect.")
    except BaseError as error:
        return message(422, str(error))
    except Conflict as error:
        return message(409, str(error))
    except ValueError:
        return message(422, "Revisa el identificador o la lectura de lluvia del formulario.")
    except NotFound as error:
        return message(404, str(error))
    except StorageError:
        return message(503, "No se pudo guardar la observación. Reintenta desde KoboCollect.")
    return message(201, f"Observación recibida. Ficha v{version} de Don Tino.")
