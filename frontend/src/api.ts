import type { components, paths } from "../../contracts/generated/luumia";

type Schema = components["schemas"];
export type FieldSource = Schema["Source"];
export type Confidence = Schema["Confidence"];
export type ConstraintCheck = Schema["ConstraintCheck"];
export type Evaluation = Schema["EvaluationResponse"];
export type EvaluationRequest = Schema["EvaluationRequest-Input"];
export type CommercialScenario = Schema["CommercialScenario-Input"];
export type CommercialResult = Schema["CommercialResult"];
export type MarketReference = Schema["MarketReferenceResponse"];
export type MarketSummary = Schema["MarketSummary"];
export type ReferenceDelivery = Schema["ReferenceDelivery"];
export type UsdaReference = Schema["UsdaReferenceResponse"];
export type Period = Schema["Period"];
export type Observation = Schema["Observation"];

export type FieldCapture = Schema["RainGaugeInput"];
export type BlockEvidence = Schema["BlockEvidence"];
export type ParcelContext = Schema["ParcelContext"];
export type Explanation = Schema["ExplanationResponse"];
export type Cells = Schema["WeeklyCell"][];
export type DemoP1 = Schema["DemoP1"];
export type WeatherLinkCurrent = Schema["WeatherLinkResponse"];

export class ApiFailure extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, options?: RequestInit): Promise<T> {
  let response;
  try {
    response = await fetch(`/api${path}`, options);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiFailure(0, "No se pudo conectar con LuumIA. Revisa la conexión e intenta de nuevo.");
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiFailure(response.status, body?.message ?? `La operación devolvió un error (HTTP ${response.status}).`);
  }
  return body as T;
}

function post<T>(path: string, body: unknown, signal?: AbortSignal) {
  return call<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}

const contextPath = (parcel = "parcel-don-tino") => `/v1/contexts/${encodeURIComponent(parcel)}`;
export const getContext = (parcel?: string, signal?: AbortSignal) =>
  call<ParcelContext>(contextPath(parcel), { signal });
export type LocalParcelSummary = Schema["LocalParcelSummary"];
export type LocalParcelCreate = paths["/v1/parcels"]["post"]["requestBody"]["content"]["application/json"];
export const listLocalParcels = (signal?: AbortSignal) => call<LocalParcelSummary[]>("/v1/parcels", { signal });
export const createLocalParcel = (body: LocalParcelCreate) => post<ParcelContext>("/v1/parcels", body);
type CropCycleRegistration = paths["/v1/contexts/{parcel_id}/crop-cycles"]["post"]["requestBody"]["content"]["application/json"];
export const saveCropCycle = (parcel: string, body: CropCycleRegistration) =>
  post<ParcelContext>(`${contextPath(parcel)}/crop-cycles`, body);
type CropCycleCorrection = paths["/v1/contexts/{parcel_id}/crop-cycles/{cycle_id}"]["put"]["requestBody"]["content"]["application/json"];
type CropCycleVoid = paths["/v1/contexts/{parcel_id}/crop-cycles/{cycle_id}/void"]["post"]["requestBody"]["content"]["application/json"];
const cropCyclePath = (parcel: string, cycle: string) => `${contextPath(parcel)}/crop-cycles/${encodeURIComponent(cycle)}`;
export const correctCropCycle = (parcel: string, cycle: string, body: CropCycleCorrection) =>
  call<ParcelContext>(cropCyclePath(parcel, cycle), {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
export const voidCropCycle = (parcel: string, cycle: string, body: CropCycleVoid) =>
  post<ParcelContext>(`${cropCyclePath(parcel, cycle)}/void`, body);
export const refreshCropRotation = (parcel: string, expected_context_version: number) =>
  post<ParcelContext>(`${contextPath(parcel)}/crop-rotation`, { expected_context_version });
export const getHistorical = (parcel: string, version: number, signal?: AbortSignal) =>
  call<ParcelContext>(`${contextPath(parcel)}/versions/${version}`, { signal });
export const historicalUrl = (parcel: string, version: number) =>
  `/api${contextPath(parcel)}/versions/${version}`;
type RegisteredAreaPath = paths["/v1/contexts/{parcel_id}/registered-area"];
type ParcelAreaUpdate = RegisteredAreaPath["put"]["requestBody"]["content"]["application/json"];
export const saveRegisteredArea = (parcel: string, update: ParcelAreaUpdate) =>
  call<ParcelContext>(`${contextPath(parcel)}/registered-area`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(update),
  });
export const getDemoRequest = () => call<EvaluationRequest>("/demo/don-tino/evaluation-request");
export const getDemoP1 = (signal?: AbortSignal) => call<DemoP1>("/demo/don-tino/p1", { signal });

export async function collectWeekly(): Promise<Cells> {
  const request = await call<Schema["CollectionRequest"]>("/demo/don-tino/collection-request");
  let collection;
  try {
    collection = await post<Schema["CollectionResult"]>("/v1/collections", request);
  } catch (error) {
    if (!(error instanceof ApiFailure) || ![502, 504].includes(error.status)) throw error;
    collection = await call<Schema["CollectionResult"]>("/demo/don-tino/power-snapshot");
  }
  return post<Cells>("/v1/harmonizations", collection);
}

export const previewEvaluation = (request: EvaluationRequest, weekly_cells: Cells) =>
  post<Evaluation>("/v1/evaluations", { request, weekly_cells });
export const saveEvaluation = (request: EvaluationRequest, weekly_cells: Cells) =>
  post<ParcelContext>(`${contextPath(request.parcel_id)}/versions`, {
    request, weekly_cells, expected_context_version: request.context_version,
  });
export const saveFieldCapture = (expected_context_version: number, observation: FieldCapture) =>
  post<ParcelContext>("/v1/field-observations", { expected_context_version, observation });
export const getExplanation = (
  parcel: string, context_version: number, candidate_id: string, question_es: string, scenario_id?: string,
) => post<Explanation>(`${contextPath(parcel)}/explanations`, {
  context_version, candidate_id, question_es, scenario_id,
});
export const getMarketReference = (series: string, month: number, signal: AbortSignal, refresh: boolean) =>
  call<MarketReference>(`/v1/market-references/${encodeURIComponent(series)}?month=${month}&refresh=${refresh}`, { signal });
export const getUsdaReference = (signal: AbortSignal, refresh: boolean) =>
  call<UsdaReference>(`/v1/usda-references/mexico-corn-production?refresh=${refresh}`, { signal });
export const getWeatherLinkCurrent = (signal: AbortSignal, example: boolean) =>
  call<WeatherLinkCurrent>(`/v1/weatherlink/current?example=${example}`, { signal });

export type CyclePlanRequest = Schema["CyclePlanRequest"];
export type CyclePlanResult = Schema["CyclePlan"];
export type PriceForecast = Schema["PriceForecast"];

export const getCyclePlan = (parcel: string, request: CyclePlanRequest, signal: AbortSignal) =>
  post<CyclePlanResult>(`${contextPath(parcel)}/cycle-plan`, request, signal);

export type SowingPlanState = Schema["SowingPlanState"];
export type SowingPlanInput = paths["/v1/contexts/{parcel_id}/sowing-plan/preview"]["post"]["requestBody"]["content"]["application/json"];
export type SowingPlanResult = Schema["SowingPlanResult"];
export type SowingPlanSnapshot = Schema["SowingPlanSnapshot"];
export type SowingMetrics = Schema["SowingMetrics"];

const sowingPath = (parcel: string) => `${contextPath(parcel)}/sowing-plan`;
export const getSowingPlan = (parcel: string, signal?: AbortSignal) =>
  call<SowingPlanState>(sowingPath(parcel), { signal });
export const previewSowingPlan = (parcel: string, plan: SowingPlanInput, signal?: AbortSignal) =>
  post<SowingPlanResult>(`${sowingPath(parcel)}/preview`, plan, signal);
export const saveSowingDraft = (parcel: string, expected_plan_version: number, plan: SowingPlanInput) =>
  call<SowingPlanSnapshot>(`${sowingPath(parcel)}/draft`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expected_plan_version, plan }),
  });
export const shareSowingPlan = (parcel: string, expected_plan_version: number) =>
  post<SowingPlanSnapshot>(`${sowingPath(parcel)}/share`, { expected_plan_version });
export const getSowingMetrics = (parcel: string, signal?: AbortSignal) =>
  call<SowingMetrics>(`${contextPath(parcel)}/sowing-metrics`, { signal });

type SowingSalesPath = paths["/v1/contexts/{parcel_id}/sowing-sales"];
type SaleCorrectionPath = paths["/v1/contexts/{parcel_id}/sowing-sales/{sale_id}"];
type SaleVoidPath = paths["/v1/contexts/{parcel_id}/sowing-sales/{sale_id}/void"];
export type SowingSalesReport = Schema["SowingSalesReport"];
export type ZoneSaleRegistration = SowingSalesPath["post"]["requestBody"]["content"]["application/json"];
export type ZoneSaleCorrection = SaleCorrectionPath["put"]["requestBody"]["content"]["application/json"];
export type ZoneSaleVoid = SaleVoidPath["post"]["requestBody"]["content"]["application/json"];
const sowingSalesPath = (parcel: string) => `${contextPath(parcel)}/sowing-sales`;
const zoneSalePath = (parcel: string, sale: string) => `${sowingSalesPath(parcel)}/${encodeURIComponent(sale)}`;
export const getSowingSales = (parcel: string, planVersion: number, signal?: AbortSignal) =>
  call<SowingSalesReport>(`${sowingSalesPath(parcel)}?plan_version=${planVersion}`, { signal });
export const registerZoneSale = (parcel: string, sale: ZoneSaleRegistration) =>
  post<SowingSalesReport>(sowingSalesPath(parcel), sale);
export const correctZoneSale = (parcel: string, sale: string, body: ZoneSaleCorrection) =>
  call<SowingSalesReport>(zoneSalePath(parcel, sale), {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
export const voidZoneSale = (parcel: string, sale: string, body: ZoneSaleVoid) =>
  post<SowingSalesReport>(`${zoneSalePath(parcel, sale)}/void`, body);

type CapacityRegistrationPath = paths["/v1/contexts/{parcel_id}/cooperative-capacities"];
export type CooperativeCapacityRegistration = CapacityRegistrationPath["post"]["requestBody"]["content"]["application/json"];
export const saveCooperativeCapacity = (parcel: string, request: CooperativeCapacityRegistration) =>
  post<ParcelContext>(`${contextPath(parcel)}/cooperative-capacities`, request);

type CapacityCorrectionPath = paths["/v1/contexts/{parcel_id}/cooperative-capacities/{capacity_id}"];
type CapacityCancellationPath = paths["/v1/contexts/{parcel_id}/cooperative-capacities/{capacity_id}/cancel"];
export type CooperativeCapacityCorrection = CapacityCorrectionPath["put"]["requestBody"]["content"]["application/json"];
export type CooperativeCapacityCancellation = CapacityCancellationPath["post"]["requestBody"]["content"]["application/json"];
const capacityPath = (parcel: string, id: string) => `${contextPath(parcel)}/cooperative-capacities/${encodeURIComponent(id)}`;
export const correctCooperativeCapacity = (parcel: string, id: string, body: CooperativeCapacityCorrection) =>
  call<ParcelContext>(capacityPath(parcel, id), {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
export const cancelCooperativeCapacity = (parcel: string, id: string, body: CooperativeCapacityCancellation) =>
  post<ParcelContext>(`${capacityPath(parcel, id)}/cancel`, body);

