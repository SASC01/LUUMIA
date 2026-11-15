"""Contratos públicos de LuumIA y lectura de instantáneas históricas."""

from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints, model_validator

Version = Literal["0.1.0", "0.2.0"]
Identifier = Annotated[str, Field(pattern=r"^[a-z][a-z0-9_-]{1,79}$")]
Text = Annotated[str, Field(min_length=1)]
Kg = Annotated[int, Field(strict=True, ge=0, le=1_000_000_000)]
Nonnegative = Annotated[Decimal, Field(ge=0, max_digits=16, decimal_places=6)]
DataKind = Literal["observed", "derived", "synthetic"]
Tier = Literal["observed", "derived", "simulated_assumption"]
ConstraintOutcome = Literal["pass", "fail", "needs_confirmation"]
AgriculturalCycle = Literal["spring_summer", "fall_winter"]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class LegacyObject(Contract):
    model_config = ConfigDict(extra="allow", allow_inf_nan=False)


class Period(Contract):
    start: date
    end: date

    @model_validator(mode="after")
    def check_dates(self):
        if self.end < self.start:
            raise ValueError("La fecha final precede a la inicial.")
        return self


class Source(LegacyObject):
    id: Identifier
    name: Text
    kind: Text
    retrieved_at: AwareDatetime
    url: Annotated[str, Field(pattern=r"^https://")] | None = None


class Confidence(LegacyObject):
    level: Literal["high", "medium", "low", "unknown"]
    reasons: list[Text]


class EvidenceRef(Contract):
    kind: Literal["observation", "feature", "field_observation", "knowledge", "rule"]
    id: Identifier


class PriceVolumeAssumption(Contract):
    """Precio marginal para los kilos vendidos que exceden el umbral."""

    umbral_kg: Annotated[int, Field(strict=True, ge=1, le=1_000_000_000)]
    precio_excedente_mxn_kg: Nonnegative
    evidence_tier: Literal["simulated_assumption"] = "simulated_assumption"


class YieldAssumption(Contract):
    kind: Literal["manual", "municipal_median"]
    reference_id: Identifier | None = None

    @model_validator(mode="after")
    def check_reference(self):
        if (self.kind == "municipal_median") != (self.reference_id is not None):
            raise ValueError("La mediana municipal requiere una referencia identificada.")
        return self


class AppliedYield(Contract):
    method_version: Literal["crop-yield-area-1"] = "crop-yield-area-1"
    evidence_tier: Literal["simulated_assumption"] = "simulated_assumption"
    crop_id: Identifier
    cycle_offset: Annotated[int, Field(ge=1, le=6)]
    agricultural_cycle: AgriculturalCycle | None
    area_ha: Nonnegative
    yield_t_ha: Nonnegative
    assumption: YieldAssumption
    reference_source_url: str | None = None
    reference_n: Annotated[int, Field(ge=1)] | None = None
    reference_period_start: int | None = None
    reference_period_end: int | None = None


class CommercialScenario(Contract):
    id: Identifier
    candidate_id: Identifier
    crop_id: Identifier
    cycle_offset: Annotated[int, Field(ge=1, le=6)]
    sales_period: Period
    sales_structure: Literal["spot", "cooperative", "buyer_contract"]
    cupo_range: tuple[Kg, Kg]
    cupo_confirmacion: Identifier | None = None
    superficie_ha: Annotated[Decimal, Field(gt=0, max_digits=16, decimal_places=6)]
    precio_productor_mxn_kg: Nonnegative
    precio_volumen: PriceVolumeAssumption | None = None
    rendimiento_esperado_t_ha: Nonnegative
    agricultural_cycle: AgriculturalCycle | None = None
    yield_assumption: YieldAssumption | None = None
    merma_fraccion: Annotated[Decimal, Field(ge=0, le=1, decimal_places=6)]
    costos_produccion_mxn: Nonnegative
    costos_empaque_mxn: Nonnegative
    costos_transporte_mxn: Nonnegative
    costos_venta_mxn: Nonnegative
    supuestos: list[Text] = Field(default_factory=list)
    fuentes_insumos: dict[str, Source] = Field(default_factory=dict)

    @model_validator(mode="after")
    def check_capacity(self):
        if self.cupo_range[1] < self.cupo_range[0]:
            raise ValueError("El cupo alto debe ser mayor o igual al cupo bajo.")
        if self.yield_assumption and self.yield_assumption.kind == "municipal_median" and self.agricultural_cycle is None:
            raise ValueError("Selecciona el ciclo agrícola de la mediana municipal.")
        return self


class CommercialEndpoint(Contract):
    cupo_kg: Kg
    kg_disponibles: Decimal
    kg_vendidos: Decimal
    kg_sin_salida: Decimal
    margen_mxn: Decimal
    ingreso_mxn: Decimal | None = None
    precio_efectivo_mxn_kg: Decimal | None = None
    precio_equilibrio_mxn_kg: Decimal | None
    precio_equilibrio_status: Literal["available", "missing"]
    precio_equilibrio_missing_reason: Text | None = None


class CommercialResult(Contract):
    scenario_id: Identifier
    method_version: Text
    evidence_tier: Tier
    label_es: Text
    precio_base_mxn_kg: Nonnegative | None = None
    precio_volumen: PriceVolumeAssumption | None = None
    applied_yield: AppliedYield | None = None
    cupo_centro_kg: Decimal
    cupo_amplitud_kg: Kg
    kg_cosechados: Decimal
    costos_totales_mxn: Decimal
    bajo: CommercialEndpoint
    alto: CommercialEndpoint
    margen_min_mxn: Decimal
    margen_max_mxn: Decimal


class Parcel(LegacyObject):
    id: Identifier
    municipality: Text
    state: Text
    declared_area_ha: Annotated[float, Field(gt=0)]
    geometry: dict
    geometry_kind: Literal["provided", "synthetic", "unavailable"]
    production_system: Literal["rainfed", "irrigated"]


class Producer(LegacyObject):
    id: Identifier
    display_name: Text
    persona_kind: Literal["composite_demo", "real"]


class CropCycle(LegacyObject):
    id: Identifier
    sequence: Annotated[int, Field(ge=1)]
    period: Period | None
    crop_ids: list[Identifier] = Field(min_length=1)
    data_kind: Literal["observed", "synthetic"]


CropCycleChangeReason = Annotated[str, StringConstraints(strip_whitespace=True, max_length=240)]


class CropCycleChange(Contract):
    change_id: UUID
    action: Literal["corrected", "voided"]
    recorded_at: AwareDatetime
    context_version: Annotated[int, Field(ge=2)]
    previous: CropCycle
    replacement: CropCycle | None = None
    reason: CropCycleChangeReason | None = None

    @model_validator(mode="after")
    def check_replacement(self):
        if (self.action == "corrected") != (self.replacement is not None):
            raise ValueError("Solo una corrección incluye el ciclo resultante.")
        if self.replacement and self.replacement.id != self.previous.id:
            raise ValueError("La corrección debe conservar el identificador del ciclo.")
        return self


class Priorities(Contract):
    nitrogen: Annotated[float, Field(ge=0, le=100)]
    erosion_cover: Annotated[float, Field(ge=0, le=100)]
    organic_matter: Annotated[float, Field(ge=0, le=100)]
    pest_break: Annotated[float, Field(ge=0, le=100)]
    water_fit: Annotated[float, Field(ge=0, le=100)]
    forage: Annotated[float, Field(ge=0, le=100)]
    market: Annotated[float, Field(ge=0, le=100)]

    @model_validator(mode="after")
    def check_total(self):
        if sum(self.model_dump().values()) == 0:
            raise ValueError("Se necesita al menos una prioridad positiva.")
        return self


class BuyerRefusal(Contract):
    crop_id: Identifier
    cycle_offset: Annotated[int, Field(ge=1, le=6)]
    sales_period: Period
    documented_at: AwareDatetime
    source: Source
    data_kind: Literal["observed", "synthetic"]

    @model_validator(mode="after")
    def check_provenance(self):
        if (self.source.kind == "synthetic") != (self.data_kind == "synthetic"):
            raise ValueError("El origen del rechazo debe indicar si es simulado.")
        return self


class ConfirmedCapacity(Contract):
    id: Identifier
    crop_id: Identifier
    cycle_offset: Annotated[int, Field(ge=1, le=6)]
    sales_period: Period
    sales_structure: Literal["spot", "cooperative", "buyer_contract"]
    cupo_range: tuple[Kg, Kg]
    confirmed_at: AwareDatetime
    source: Source

    @model_validator(mode="after")
    def check_confirmation(self):
        if self.cupo_range[0] > self.cupo_range[1] or self.source.kind == "synthetic":
            raise ValueError("La confirmación requiere cupo ordenado y fuente documentada del comprador.")
        return self


CapacityChangeReason = Annotated[str, StringConstraints(strip_whitespace=True, max_length=240)]


class CooperativeCapacityHistoryEntry(Contract):
    action: Literal["corrected", "cancelled"]
    previous: ConfirmedCapacity
    replacement: ConfirmedCapacity | None
    recorded_at: AwareDatetime
    context_version: Annotated[int, Field(ge=1)]
    reason: CapacityChangeReason | None = None

    @model_validator(mode="after")
    def check_replacement(self):
        if (self.action == "corrected") != (self.replacement is not None):
            raise ValueError("Una corrección conserva su cupo anterior y el cupo de reemplazo.")
        return self


class Constraint(Contract):
    id: Identifier
    confirmed: bool
    note: Text


class WaterConstraint(Constraint):
    kind: Literal["water_budget"]
    available_mm: Annotated[float, Field(ge=0)]
    period: Period


class EquipmentConstraint(Constraint):
    kind: Literal["equipment_available"]
    equipment_ids: list[Identifier]


class MarketConstraint(Constraint):
    kind: Literal["market_available"]
    crop_ids: list[Identifier]
    buyer_refusals: list[BuyerRefusal] = Field(default_factory=list)


class TransitionConstraint(Constraint):
    kind: Literal["crop_transition"]
    crop_id: Identifier
    required_previous_crop_id: Identifier


HardConstraint = Annotated[
    WaterConstraint | EquipmentConstraint | MarketConstraint | TransitionConstraint,
    Field(discriminator="kind"),
]


class RotationStep(Contract):
    cycle_offset: Annotated[int, Field(ge=1, le=6)]
    crop_ids: list[Identifier] = Field(min_length=1)
    arrangement: Literal["single_crop", "intercrop"]

    @model_validator(mode="after")
    def check_arrangement(self):
        if len(set(self.crop_ids)) != len(self.crop_ids) or (
            (self.arrangement == "single_crop") != (len(self.crop_ids) == 1)
        ):
            raise ValueError("El número de cultivos debe corresponder al tipo de arreglo.")
        return self


class Candidate(Contract):
    id: Identifier
    label: Text
    steps: list[RotationStep] = Field(min_length=1)


class EvaluationRequest(Contract):
    contract_version: Version = "0.2.0"
    parcel_id: Identifier
    context_version: Annotated[int, Field(ge=1)]
    horizon_cycles: Annotated[int, Field(ge=1, le=6)]
    priorities: Priorities
    candidates: list[Candidate] = Field(min_length=1)
    constraints: list[HardConstraint]
    scenario: dict | None = None
    commercial_scenarios: list[CommercialScenario] = Field(default_factory=list)

    @model_validator(mode="after")
    def check_request_links(self):
        candidates = {candidate.id: candidate for candidate in self.candidates}
        if len(candidates) != len(self.candidates):
            raise ValueError("Hay candidatos repetidos.")
        if len({c.id for c in self.constraints}) != len(self.constraints):
            raise ValueError("Hay restricciones repetidas.")
        if len({s.id for s in self.commercial_scenarios}) != len(self.commercial_scenarios):
            raise ValueError("Hay escenarios comerciales repetidos.")
        for candidate in self.candidates:
            if [step.cycle_offset for step in candidate.steps] != list(range(1, self.horizon_cycles + 1)):
                raise ValueError("Todos los candidatos deben tener ciclos consecutivos y el mismo horizonte.")
        for scenario in self.commercial_scenarios:
            candidate = candidates.get(scenario.candidate_id)
            if not candidate or scenario.cycle_offset > self.horizon_cycles or (
                scenario.crop_id not in candidate.steps[scenario.cycle_offset - 1].crop_ids
            ):
                raise ValueError("El escenario comercial debe indicar un cultivo del ciclo y candidato elegidos.")
        return self


class Observation(LegacyObject):
    id: Identifier
    parcel_id: Identifier
    variable: Text
    value: float | None
    unit: Text
    status: Literal["available", "missing"]
    missing_reason: Text | None
    period: Period
    source: Source
    data_kind: DataKind
    spatial_support: Literal["regional", "parcel_aggregate", "pixel", "field"]
    aggregation: Text
    confidence: Confidence

    @model_validator(mode="after")
    def check_presence(self):
        if self.status == "available" and (self.value is None or self.missing_reason):
            raise ValueError("Un dato disponible requiere valor y debe carecer de motivo de ausencia.")
        if self.status == "missing" and (self.value is not None or not self.missing_reason):
            raise ValueError("Un dato ausente requiere motivo y valor nulo.")
        return self


class Feature(LegacyObject):
    id: Identifier
    parcel_id: Identifier
    name: Text
    value: float | None
    unit: Text
    status: Literal["available", "missing"]
    missing_reason: Text | None
    period: Period
    evidence: list[EvidenceRef]
    confidence: Confidence
    data_kind: DataKind


class WeeklyCell(Contract):
    parcel_id: Identifier
    week: Period
    observations: list[Observation]
    coverage_fraction: Annotated[float, Field(ge=0, le=1)]
    warnings: list[Text]


class CollectionRequest(Contract):
    contract_version: Version = "0.1.0"
    parcel_id: Identifier
    geometry: dict
    period: Period
    variables: list[Text] = Field(min_length=1)


class CollectionResult(Contract):
    contract_version: Version = "0.1.0"
    request: CollectionRequest
    observations: list[Observation]
    warnings: list[Text]


class EvaluationInput(Contract):
    request: EvaluationRequest
    weekly_cells: list[WeeklyCell]


class ContextSaveRequest(EvaluationInput):
    expected_context_version: Annotated[int, Field(ge=1)]

    @model_validator(mode="after")
    def check_expected(self):
        if self.expected_context_version != self.request.context_version:
            raise ValueError("La versión esperada debe coincidir con la solicitud.")
        return self


class ConstraintCheck(LegacyObject):
    constraint_id: Identifier
    outcome: ConstraintOutcome
    explanation: Text
    evidence_tier: Tier | None = None
    evidence: list[EvidenceRef] = Field(default_factory=list)
    source: Source | None = None
    documented_at: AwareDatetime | None = None


class DimensionScore(LegacyObject):
    dimension: Text
    score: Annotated[float, Field(ge=0, le=100)]
    weight: Annotated[float, Field(ge=0, le=100)]
    contribution: float
    reasons: list[dict]


class RankedRotation(LegacyObject):
    candidate: Candidate
    rank: Annotated[int, Field(ge=1)]
    total_score: float
    dimensions: list[DimensionScore] = Field(min_length=7, max_length=7)
    constraint_checks: list[ConstraintCheck]
    confidence: Confidence


class ExcludedRotation(LegacyObject):
    candidate_id: Identifier
    checks: list[ConstraintCheck] = Field(min_length=1)
    primary_constraint_id: Identifier | None = None


class EvaluationResponse(LegacyObject):
    contract_version: Version = "0.2.0"
    id: Identifier
    parcel_id: Identifier
    context_version: Annotated[int, Field(ge=1)]
    created_at: AwareDatetime
    engine_version: Text
    rules_version: Text
    catalog_version: Text
    data_kind: DataKind
    horizon_cycles: Annotated[int, Field(ge=1, le=6)]
    request_snapshot: EvaluationRequest
    status: Literal["computed", "no_viable_options", "needs_confirmation", "illustrative"]
    recommendations: list[RankedRotation]
    excluded: list[ExcludedRotation]
    warnings: list[Text]
    commercial_results: list[CommercialResult] = Field(default_factory=list)

    @model_validator(mode="after")
    def check_links(self):
        snapshot = self.request_snapshot
        if (self.parcel_id, self.context_version, self.horizon_cycles) != (
            snapshot.parcel_id, snapshot.context_version, snapshot.horizon_cycles
        ):
            raise ValueError("La evaluación y su solicitud deben compartir parcela, versión y horizonte.")
        if self.recommendations != sorted(self.recommendations, key=lambda row: (-row.total_score, row.candidate.id)):
            raise ValueError("El ranking debe ordenarse por puntaje y luego por ID de candidato.")
        if any(check.outcome != "pass" for row in self.recommendations for check in row.constraint_checks):
            raise ValueError("Solo se pueden ordenar candidatos que pasan las restricciones.")
        if {r.scenario_id for r in self.commercial_results} != {s.id for s in snapshot.commercial_scenarios}:
            raise ValueError("Los resultados comerciales deben corresponder a la solicitud.")
        return self


class RainGaugeMeasurement(Contract):
    method: Literal["rain_gauge"]
    accumulation_start: AwareDatetime
    accumulation_end: AwareDatetime
    source: Source

    @model_validator(mode="after")
    def check_window(self):
        if self.accumulation_end <= self.accumulation_start:
            raise ValueError("La ventana de acumulación debe tener duración positiva.")
        return self


class KoboReceipt(Contract):
    instance_id: UUID
    form_id: Literal["don-tino-rain"]
    form_version: Annotated[str, Field(pattern=r"^[0-9]{1,16}$")]
    payload_sha256: Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
    context_version: Annotated[int, Field(ge=2)]


class FieldObservation(LegacyObject):
    id: Identifier
    parcel_id: Identifier
    variable: Text
    value: bool | float | str
    unit: Text
    observed_at: AwareDatetime
    recorded_at: AwareDatetime
    author_id: Identifier
    confirmed: bool
    data_kind: Literal["observed", "synthetic"]
    supersedes_id: Identifier | None = None
    note: Text
    rain_gauge: RainGaugeMeasurement | None = None
    kobo: KoboReceipt | None = None


class RainGaugeInput(Contract):
    id: Identifier
    parcel_id: Identifier
    variable: Literal["precipitation"]
    value: Annotated[float, Field(strict=True, ge=0)]
    unit: Literal["mm"]
    observed_at: AwareDatetime
    author_id: Identifier
    confirmed: bool
    data_kind: Literal["observed", "synthetic"]
    supersedes_id: Identifier | None = None
    note: Text
    rain_gauge: RainGaugeMeasurement

    @model_validator(mode="after")
    def check_source(self):
        if self.observed_at < self.rain_gauge.accumulation_end:
            raise ValueError("La lectura debe fecharse al cierre de la ventana o después.")
        if (self.data_kind == "synthetic") != (self.rain_gauge.source.kind == "synthetic"):
            raise ValueError("La fuente debe indicar si la lectura es sintética.")
        if self.data_kind == "observed" and not self.confirmed:
            raise ValueError("Confirme la lectura antes de registrarla como observada.")
        return self


class FieldObservationRequest(Contract):
    contract_version: Version = "0.2.0"
    expected_context_version: Annotated[int, Field(ge=1)]
    observation: RainGaugeInput


class PriorCommercialRef(Contract):
    context_version: Annotated[int, Field(ge=1)]
    evaluation_id: Identifier
    scenario_ids: list[Identifier] = Field(min_length=1)


class RainComparison(Contract):
    status: Literal["available", "missing"]
    missing_reason: Text | None = None
    local: FieldObservation | None
    power: Observation | None


class BlockEvidence(Contract):
    evidence_tier: Tier | None
    status: Literal["available", "missing"]
    missing_reason: Text | None = None
    n_observaciones: Annotated[int, Field(ge=0)]
    count_unit: Text
    n_simulated: Annotated[int, Field(ge=0)] = 0
    confidence: Confidence
    sources: list[Source] = Field(default_factory=list)

    @model_validator(mode="after")
    def check_counts(self):
        if self.n_simulated > self.n_observaciones:
            raise ValueError("El conteo simulado supera el total de registros.")
        if self.status == "available" and (self.evidence_tier is None or self.missing_reason):
            raise ValueError("Un bloque disponible requiere nivel de evidencia.")
        if self.status == "missing" and (self.evidence_tier is not None or not self.missing_reason or self.n_observaciones):
            raise ValueError("Un bloque ausente requiere motivo y cero registros.")
        return self


class ParcelEvidence(Contract):
    agronomico: BlockEvidence
    comercial: BlockEvidence
    observacion_local: BlockEvidence
    secuencia_cultivos: BlockEvidence


class RegisteredAreaChange(Contract):
    context_version: Annotated[int, Field(ge=1)]
    previous_area_ha: Annotated[Decimal, Field(gt=0)]
    declared_area_ha: Annotated[Decimal, Field(gt=0)]
    recorded_at: AwareDatetime


class ParcelContext(LegacyObject):
    contract_version: Version = "0.2.0"
    id: Identifier
    context_version: Annotated[int, Field(ge=1)]
    cycle_id: Identifier
    updated_at: AwareDatetime
    data_kind: DataKind
    producer: Producer
    parcel: Parcel
    history: list[CropCycle]
    priorities: Priorities
    constraints: list[HardConstraint]
    soil: list[dict]
    observations: list[Observation]
    features: list[Feature]
    field_observations: list[FieldObservation]
    decisions: list[dict]
    evaluation: EvaluationResponse | None
    pending_questions: list[Text]
    warnings: list[Text]
    evidence_blocks: ParcelEvidence | None = None
    confirmed_purchase_capacities: list[ConfirmedCapacity] = Field(default_factory=list)
    cooperative_capacity_history: list[CooperativeCapacityHistoryEntry] = Field(default_factory=list)
    registered_area_history: list[RegisteredAreaChange] = Field(default_factory=list)
    crop_cycle_history: list[CropCycleChange] = Field(default_factory=list)
    weekly_cells: list[WeeklyCell] = Field(default_factory=list)
    evaluation_state: Literal["vigente", "pendiente_de_recalculo"] | None = None
    recalculation_reason: Text | None = None
    prior_commercial: PriorCommercialRef | None = None
    last_evaluation_version: Annotated[int, Field(ge=1)] | None = None
    rain_comparison: RainComparison | None = None

    @model_validator(mode="after")
    def check_version(self):
        if self.evaluation and (self.evaluation.parcel_id, self.evaluation.context_version) != (
            self.parcel.id, self.context_version
        ):
            raise ValueError("La evaluación adjunta debe corresponder a esta ficha.")
        entities = [*self.observations, *self.features, *self.field_observations]
        if any(item.parcel_id != self.parcel.id for item in entities):
            raise ValueError("La ficha contiene evidencia de otra parcela.")
        if len({item.id for item in entities}) != len(entities):
            raise ValueError("Hay identificadores de evidencia duplicados.")
        if self.evaluation_state == "pendiente_de_recalculo" and (self.evaluation or not self.recalculation_reason):
            raise ValueError("Una ficha pendiente requiere motivo y evaluación nula.")
        if self.evaluation_state == "vigente" and (
            not self.evaluation or self.recalculation_reason or self.prior_commercial or self.last_evaluation_version
        ):
            raise ValueError("Una ficha vigente requiere evaluación propia y carece de referencias obsoletas.")
        if self.prior_commercial and (
            self.evaluation_state != "pendiente_de_recalculo"
            or self.prior_commercial.context_version >= self.context_version
        ):
            raise ValueError("El margen anterior debe pertenecer a una versión histórica.")
        if self.last_evaluation_version and self.last_evaluation_version >= self.context_version:
            raise ValueError("La referencia de insumos debe pertenecer a una versión histórica.")
        return self


class ApiError(Contract):
    contract_version: Version = "0.2.0"
    code: Text
    message: Text
    module: Text


class AssistantCommercialSummary(Contract):
    status: Literal["available", "stale", "missing"]
    scenario_id: Identifier | None = None
    result: CommercialResult | None = None
    assumptions: list[Text] = Field(default_factory=list)
    reason: Text | None = None


class AssistantExclusion(Contract):
    candidate_id: Identifier
    candidate_label: Text
    primary_check: ConstraintCheck


class AssistantContext(Contract):
    contract_version: Version = "0.2.0"
    parcel_id: Identifier
    context_version: Annotated[int, Field(ge=1)]
    evaluation_id: Identifier | None = None
    evaluation_state: Literal["vigente", "pendiente_de_recalculo"] | None = None
    data_kind: DataKind
    exclusion: AssistantExclusion | None = None
    evidence_blocks: dict[str, Tier | None] = Field(default_factory=dict)
    commercial_summary: AssistantCommercialSummary
    summary_es: Text
    allowed_tools: list[Literal["read_context_detail"]] = Field(default_factory=list, max_length=0)


class ExplanationRequest(Contract):
    context_version: Annotated[int, Field(ge=1)]
    candidate_id: Identifier
    scenario_id: Identifier | None = None
    question_es: Annotated[str, Field(min_length=1, max_length=300)]


class ExplanationResponse(Contract):
    context_version: Annotated[int, Field(ge=1)]
    mode: Literal["llm", "deterministic"]
    text_es: Text
    primary_check: ConstraintCheck | None = None
