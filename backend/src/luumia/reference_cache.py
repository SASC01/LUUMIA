"""Memoria volátil para consultas externas de referencia."""

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from threading import Lock
from time import monotonic
from typing import Literal

from pydantic import AwareDatetime, model_validator

from .contracts import Contract, Text


class ReferenceDelivery(Contract):
    mode: Literal["live", "cache", "snapshot"]
    attempted_at: AwareDatetime
    fallback_reason: Text | None = None

    @model_validator(mode="after")
    def check_reason(self):
        if (self.mode == "snapshot") != (self.fallback_reason is not None):
            raise ValueError("El respaldo requiere un motivo de uso.")
        return self


@dataclass(frozen=True)
class ReferenceResult[T]:
    data: T
    delivery: ReferenceDelivery


class ReferenceCache[T]:
    def __init__(self, live_ttl: float = 600, retry_delay: float = 30) -> None:
        self._live_ttl = live_ttl
        self._retry_delay = retry_delay
        self._lock = Lock()
        self._expires_at = 0.0
        self._refreshed_at = 0.0
        self._cached: ReferenceResult[T] | None = None

    def get(
        self, fetch: Callable[[], T], load_snapshot: Callable[[], T], fallback_reason: str, *,
        refresh: bool = False,
    ) -> ReferenceResult[T]:
        with self._lock:
            current = self._cached
            now = monotonic()
            # Una pulsación repetida puede reutilizar el resultado recién obtenido por otra solicitud.
            if current is not None and now < self._expires_at and (not refresh or now - self._refreshed_at < 5):
                delivery = current.delivery
                if delivery.mode == "live":
                    delivery = delivery.model_copy(update={"mode": "cache"})
                return ReferenceResult(current.data, delivery)

            attempted_at = datetime.now(UTC)
            try:
                data = fetch()
                ttl = self._live_ttl
                delivery = ReferenceDelivery(mode="live", attempted_at=attempted_at)
            except (OSError, ValueError):
                data = load_snapshot()
                ttl = self._retry_delay
                delivery = ReferenceDelivery(mode="snapshot", attempted_at=attempted_at, fallback_reason=fallback_reason)

            self._refreshed_at = monotonic()
            self._expires_at = self._refreshed_at + ttl
            self._cached = ReferenceResult(data, delivery)
            return self._cached
