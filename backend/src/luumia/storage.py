"""Repositorio de fichas inmutables en PostgreSQL."""

from __future__ import annotations

from os import getenv
from typing import TYPE_CHECKING

import psycopg
from psycopg.types.json import Jsonb
from pydantic import ValidationError

from .contracts import ParcelContext

if TYPE_CHECKING:
    from .demo_fixture import DonTinoFixture


class NotFound(LookupError):
    pass


class Conflict(ValueError):
    pass


class StorageError(RuntimeError):
    pass


class Repository:
    def __init__(self, database_url: str | None = None):
        self.database_url = database_url or getenv("DATABASE_URL")

    def connect(self):
        if not self.database_url:
            raise StorageError("Configure DATABASE_URL para acceder a las fichas guardadas.")
        return psycopg.connect(self.database_url, connect_timeout=5)

    def initialize(self, seed: ParcelContext | DonTinoFixture) -> bool:
        try:
            with self.connect() as db:
                db.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", ("luumia-initialize",))
                db.execute("""
                    CREATE TABLE IF NOT EXISTS milpia_context_versions (
                        parcel_id text NOT NULL,
                        context_version bigint NOT NULL CHECK (context_version > 0),
                        snapshot jsonb NOT NULL,
                        PRIMARY KEY (parcel_id, context_version)
                    )
                """)
                db.execute("""
                    CREATE TABLE IF NOT EXISTS luumia_sowing_drafts (
                        parcel_id text NOT NULL,
                        plan_version bigint NOT NULL CHECK (plan_version > 0),
                        context_version bigint NOT NULL,
                        saved_at timestamptz NOT NULL DEFAULT now(),
                        snapshot jsonb NOT NULL,
                        PRIMARY KEY (parcel_id, plan_version),
                        FOREIGN KEY (parcel_id, context_version)
                            REFERENCES milpia_context_versions (parcel_id, context_version)
                    )
                """)
                db.execute("""
                    CREATE TABLE IF NOT EXISTS luumia_sowing_shares (
                        parcel_id text NOT NULL,
                        plan_version bigint NOT NULL,
                        shared_at timestamptz NOT NULL DEFAULT now(),
                        PRIMARY KEY (parcel_id, plan_version),
                        FOREIGN KEY (parcel_id, plan_version)
                            REFERENCES luumia_sowing_drafts (parcel_id, plan_version)
                    )
                """)
                db.execute("""
                    CREATE TABLE IF NOT EXISTS luumia_zone_sales (
                        parcel_id text NOT NULL,
                        sale_id uuid NOT NULL,
                        plan_version bigint NOT NULL,
                        zone_id text NOT NULL,
                        sold_on date NOT NULL,
                        sold_kg numeric(12, 3) NOT NULL CHECK (sold_kg > 0),
                        price_mxn_kg numeric(16, 6) NOT NULL CHECK (price_mxn_kg >= 0),
                        cost_mxn numeric(16, 2) NOT NULL CHECK (cost_mxn >= 0),
                        revenue_mxn numeric(24, 2) NOT NULL CHECK (revenue_mxn >= 0),
                        reference varchar(180),
                        recorded_at timestamptz NOT NULL DEFAULT now(),
                        PRIMARY KEY (parcel_id, sale_id),
                        FOREIGN KEY (parcel_id, plan_version)
                            REFERENCES luumia_sowing_shares (parcel_id, plan_version)
                    )
                """)
                db.execute("""
                    CREATE INDEX IF NOT EXISTS luumia_zone_sales_by_plan
                    ON luumia_zone_sales (parcel_id, plan_version, sold_on DESC, recorded_at DESC, sale_id)
                """)
                db.execute("""
                    CREATE TABLE IF NOT EXISTS luumia_zone_sale_changes (
                        parcel_id text NOT NULL,
                        sale_id uuid NOT NULL,
                        revision bigint NOT NULL CHECK (revision > 1),
                        change_id uuid NOT NULL,
                        action text NOT NULL CHECK (action IN ('corrected', 'voided')),
                        previous jsonb NOT NULL,
                        replacement jsonb,
                        reason varchar(240),
                        recorded_at timestamptz NOT NULL,
                        CHECK ((action = 'corrected') = (replacement IS NOT NULL)),
                        PRIMARY KEY (parcel_id, sale_id, revision),
                        UNIQUE (parcel_id, sale_id, change_id),
                        FOREIGN KEY (parcel_id, sale_id) REFERENCES luumia_zone_sales (parcel_id, sale_id)
                    )
                """)
                if not isinstance(seed, ParcelContext):
                    return self._insert_demo_fixture(db, seed)
                row = db.execute("""
                    INSERT INTO milpia_context_versions (parcel_id, context_version, snapshot)
                    VALUES (%s, %s, %s) ON CONFLICT DO NOTHING RETURNING context_version
                """, (seed.parcel.id, seed.context_version, Jsonb(seed.model_dump(mode="json")))).fetchone()
                return row is not None
        except psycopg.Error as exc:
            raise StorageError("No fue posible inicializar la base de fichas.") from exc

    @staticmethod
    def _insert_demo_fixture(db: psycopg.Connection, fixture: DonTinoFixture) -> bool:
        parcel_id = fixture.contexts[0].parcel.id
        existing = db.execute("SELECT 1 FROM milpia_context_versions WHERE parcel_id = %s LIMIT 1",
                              (parcel_id,)).fetchone()
        if existing:
            return False
        with db.cursor() as cursor:
            cursor.executemany("""
                INSERT INTO milpia_context_versions (parcel_id, context_version, snapshot)
                VALUES (%s, %s, %s)
            """, [(parcel_id, context.context_version, Jsonb(context.model_dump(mode="json")))
                  for context in fixture.contexts])
            cursor.executemany("""
                INSERT INTO luumia_sowing_drafts (parcel_id, plan_version, context_version, saved_at, snapshot)
                VALUES (%s, %s, %s, %s, %s)
            """, [(parcel_id, snapshot.plan_version, snapshot.plan.context_version, snapshot.saved_at,
                   Jsonb(snapshot.plan.model_dump(mode="json"))) for snapshot in fixture.plans])
            cursor.executemany("""
                INSERT INTO luumia_sowing_shares (parcel_id, plan_version, shared_at)
                VALUES (%s, %s, %s)
            """, [(parcel_id, snapshot.plan_version, snapshot.shared_at) for snapshot in fixture.plans
                  if snapshot.shared_at is not None])
        return True

    def get(self, parcel_id: str, version: int | None = None) -> ParcelContext:
        try:
            with self.connect() as db:
                if version is None:
                    row = db.execute("""
                        SELECT snapshot FROM milpia_context_versions WHERE parcel_id = %s
                        ORDER BY context_version DESC FETCH FIRST 1 ROW ONLY
                    """, (parcel_id,)).fetchone()
                else:
                    row = db.execute("""
                        SELECT snapshot FROM milpia_context_versions WHERE parcel_id = %s AND context_version = %s
                    """, (parcel_id, version)).fetchone()
        except (psycopg.Error, ValueError) as exc:
            raise StorageError("No fue posible leer la base de fichas. Compruebe su inicialización.") from exc

        if row is None:
            raise NotFound("No existe la ficha o la versión solicitada.")
        try:
            return ParcelContext.model_validate(row[0])
        except ValidationError as exc:
            raise StorageError("La ficha almacenada no cumple el contrato de lectura.") from exc

    def list_local(self) -> list[ParcelContext]:
        try:
            with self.connect() as db:
                rows = db.execute("""
                    SELECT snapshot FROM (
                        SELECT DISTINCT ON (parcel_id) snapshot
                        FROM milpia_context_versions
                        WHERE parcel_id LIKE 'parcel-local-%'
                        ORDER BY parcel_id, context_version DESC
                    ) latest
                    WHERE snapshot->'producer'->>'persona_kind' = 'real'
                """).fetchall()
            return [ParcelContext.model_validate(row[0]) for row in rows]
        except (psycopg.Error, ValueError) as exc:
            raise StorageError("No fue posible consultar tus parcelas.") from exc

    def create(self, context: ParcelContext) -> ParcelContext:
        if context.context_version != 1:
            raise ValueError("La primera ficha debe tener la versión uno.")
        try:
            with self.connect() as db:
                row = db.execute("""
                    INSERT INTO milpia_context_versions (parcel_id, context_version, snapshot)
                    VALUES (%s, %s, %s)
                    ON CONFLICT DO NOTHING RETURNING context_version
                """, (context.parcel.id, context.context_version, Jsonb(context.model_dump(mode="json")))).fetchone()
        except (psycopg.Error, ValueError) as exc:
            raise StorageError("No fue posible registrar la parcela en PostgreSQL.") from exc
        if row is None:
            raise Conflict("Ya existe la parcela. Revisa tus parcelas y vuelve a intentar.")
        return context

    def save(self, context: ParcelContext, expected: int) -> ParcelContext:
        if context.context_version != expected + 1:
            raise ValueError("El número de versión debe avanzar exactamente una unidad.")
        parcel_id = context.parcel.id
        try:
            with self.connect() as db:
                row = db.execute("""
                    INSERT INTO milpia_context_versions (parcel_id, context_version, snapshot)
                    SELECT %s, %s, %s WHERE %s = (
                        SELECT max(context_version) FROM milpia_context_versions WHERE parcel_id = %s
                    ) ON CONFLICT DO NOTHING RETURNING context_version
                """, (parcel_id, context.context_version, Jsonb(context.model_dump(mode="json")),
                      expected, parcel_id)).fetchone()
        except (psycopg.Error, ValueError) as exc:
            raise StorageError("No fue posible guardar la ficha en PostgreSQL.") from exc
        if row is None:
            raise Conflict("La ficha cambió durante el guardado. Consulte la versión vigente.")
        return context
