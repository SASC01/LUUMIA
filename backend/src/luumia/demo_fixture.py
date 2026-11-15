"""Lectura de las fichas y los planes de siembra de Don Tino."""

from pathlib import Path

from pydantic import ValidationError, model_validator

from .base import PARCEL_ID, PRODUCER_ID
from .contracts import Contract, ParcelContext
from .sowing_plan import SowingPlanSnapshot
from .storage import StorageError

DEMO_FIXTURE_PATH = Path(__file__).resolve().parents[3] / "data/demo/don-tino.json"


class DonTinoFixture(Contract):
    contexts: list[ParcelContext]
    plans: list[SowingPlanSnapshot]

    @model_validator(mode="after")
    def check_demo_history(self):
        versions = [context.context_version for context in self.contexts]
        if versions != list(range(1, 12)):
            raise ValueError("La carga debe incluir las fichas de Don Tino de v1 a v11, en orden.")
        if any(
            context.parcel.id != PARCEL_ID
            or context.producer.id != PRODUCER_ID
            or context.producer.persona_kind != "composite_demo"
            or context.data_kind != "synthetic"
            or context.parcel.geometry_kind != "synthetic"
            or any(cycle.data_kind != "synthetic" for cycle in context.history)
            or any(observation.data_kind != "synthetic" for observation in context.field_observations)
            for context in self.contexts
        ):
            raise ValueError("La carga solo admite fichas del caso sintético de Don Tino.")
        current = self.contexts[-1]
        if current.evaluation_state != "vigente" or not any(
            observation.kobo and observation.kobo.context_version == 10
            for observation in current.field_observations
        ):
            raise ValueError("La ficha v11 debe incluir la evaluación vigente y el acuse de KoboCollect de v10.")
        plan_versions = [snapshot.plan_version for snapshot in self.plans]
        if (not plan_versions or plan_versions != sorted(set(plan_versions))
                or plan_versions[0] < 1 or plan_versions[-1] != 5):
            raise ValueError("La carga debe incluir planes en orden ascendente hasta v5.")
        if any(snapshot.plan.context_version not in versions for snapshot in self.plans):
            raise ValueError("Cada plan debe usar una ficha incluida en la carga.")
        last_plan = self.plans[-1]
        if last_plan.shared_at is None or last_plan.plan.context_version != current.context_version:
            raise ValueError("El plan v5 debe estar publicado y usar la ficha v11.")
        return self


def load_demo_fixture(path: Path = DEMO_FIXTURE_PATH) -> DonTinoFixture:
    try:
        return DonTinoFixture.model_validate_json(path.read_bytes())
    except OSError:
        raise StorageError(f"No se pudo abrir la carga de demostración en {path}.") from None
    except ValidationError:
        raise StorageError(f"La carga de demostración en {path} contiene fichas o planes incompatibles.") from None
