import { useEffect, useRef, useState } from "react";
import {
  getCyclePlan, getHistorical, getSowingMetrics, getSowingSales,
  type CyclePlanResult, type ParcelContext, type SowingMetrics, type SowingPlanSnapshot, type SowingSalesReport,
} from "./api";
import { SourceLine } from "./Evidence";
import { ActionFeedback } from "./ActionFeedback";
import { CooperativeCapacities } from "./CooperativeCapacities";
import { ZoneSales } from "./ZoneSales";
import { crops, date, number, period, pesoRate, pesos } from "./format";
import { downloadCsv, missingSales, salesComparisonNote, salesRows, zoneName } from "./reportCsv";
import "./Metrics.css";

type Report = "technical" | "commercial";
type PlanEconomics = NonNullable<SowingPlanSnapshot["plan"]["economics"]>;
type CropEconomics = PlanEconomics["crops"][number];

function useReportData<T>(load: (signal: AbortSignal) => Promise<T>, key: string, enabled = true) {
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${key}/${attempt}`;
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>();
  const writeVersion = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const versionAtLoad = writeVersion.current;
    load(controller.signal).then((data) => {
      if (!controller.signal.aborted && versionAtLoad === writeVersion.current) setResult({ key: requestKey, data });
    }).catch((error: Error) => {
      if (!controller.signal.aborted && versionAtLoad === writeVersion.current) setResult({ key: requestKey, error: error.message });
    });
    return () => controller.abort();
  // La clave identifica todos los parámetros de cada consulta.
  }, [requestKey, enabled]);
  return {
    ...((result?.key === requestKey && result) || {}),
    retry: () => setAttempt((current) => current + 1),
    replace: (data: T) => {
      writeVersion.current += 1;
      setResult({ key: requestKey, data });
    },
  };
}

function RequestStatus({ error, loading, onRetry }: { error?: string; loading: string; onRetry: () => void }) {
  return error
    ? <div className="notice notice-warn" role="alert"><p>{error}</p><button className="button button-secondary" type="button" onClick={onRetry}>Volver a consultar</button></div>
    : <ActionFeedback pending={loading} />;
}

function cropLabel(id: string | null | undefined) {
  return id ? crops[id] ?? id : "Por determinar";
}

const monthFormat = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });
const saleMonth = (iso: string) => monthFormat.format(new Date(`${iso.slice(0, 7)}-01T00:00:00Z`));
const yieldLabel = (basis: string) => {
  if (basis === "municipal_median") return "Mediana municipal como supuesto";
  if (basis === "reported") return "Rendimiento reportado";
  if (basis === "user_assumption") return "Rendimiento ingresado como supuesto";
  return basis === "demo_assumption" ? "Rendimiento supuesto de la demo" : "Rendimiento pendiente";
};
const measured = (value: string | number | null, unit: string) => value == null ? "Sin dato" : `${number(value)} ${unit}`;
const priceBasis: Record<string, string> = {
  international_index: "Supuesto local ajustado con una referencia internacional",
  local_forecast: "Proyección con datos mexicanos",
  mexican_observation: "Precio mexicano observado, aplicado como supuesto",
  local_assumption: "Precio local supuesto",
};
const margin = (value: string | number | null | undefined) => value == null ? "Sin estimación" : pesos(value);
const termLabels: Record<CropEconomics["sale_capacity_kg"]["basis"], string> = {
  assumption: "Supuesto",
  reported: "Dato reportado",
  cooperative_confirmation: "Cupo confirmado · Cooperativa",
};
const missingTermLabels = { yield_t_ha: "rendimiento", price_mxn_kg: "precio", loss_fraction: "merma",
  cost_per_ha: "costo por hectárea", sale_capacity_kg: "cupo de venta" };
const missingMargin = "Este plan se compartió sin estimación de ganancia. Para calcularla, guarda y comparte una nueva versión en Parcela.";

function reportFile(report: Report, snapshot: SowingPlanSnapshot, rows: (string | number)[][]) {
  downloadCsv(`luumia-${report === "technical" ? "tecnico" : "comercial"}-plan-v${snapshot.plan_version}.csv`, [
    ["Plan compartido", `v${snapshot.plan_version}`],
    ["Versión de la ficha", `v${snapshot.plan.context_version}`],
    ["Fecha del plan", snapshot.shared_at ?? snapshot.saved_at],
    ...rows,
  ]);
}

function PlanOverview({ snapshot }: { snapshot: SowingPlanSnapshot }) {
  const { plan } = snapshot;
  const assignment = Number(plan.area_ha) > 0 ? Number(plan.assigned_area_ha) * 100 / Number(plan.area_ha) : 0;
  return <section className="metrics-content" aria-labelledby="metrics-overview-title">
    <h2 id="metrics-overview-title">Reparto del plan compartido</h2>
    <ul className="metrics-zones metrics-zones-overview" aria-label="Zonas del plan">
      {plan.zones.map((zone) => <li key={zone.zone_id}>
        <div><strong>{Number(zone.area_ha) > 0 ? zone.crop_label : "Sin siembra"}</strong><span className="muted">Zona {zoneName(zone.zone_id)} · {number(zone.area_ha)} ha</span></div>
        {Number(zone.area_ha) > 0 && <div><strong>{measured(zone.estimated_harvest_kg, "kg")}</strong><span className="muted">Cosecha estimada</span></div>}
        {plan.economics && Number(zone.area_ha) > 0 && <div className="metrics-zone-margin">
          <strong>{margin(zone.economics?.margin_mxn)}</strong><span className="muted">Ganancia estimada</span>
        </div>}
      </li>)}
    </ul>
    <div className="metrics-assignment">
      <p><strong>{number(plan.assigned_area_ha)} de {number(plan.area_ha)} ha asignadas</strong> · {number(plan.unassigned_area_ha)} ha disponibles</p>
      <div className="metrics-track" aria-hidden="true"><span style={{ inlineSize: `${assignment}%` }} /></div>
    </div>
    <p className="small muted">Cosecha estimada = superficie de cada zona × rendimiento aplicado. El reparto es un croquis de planeación.</p>
    {!plan.economics && <p className="notice">{missingMargin}</p>}
  </section>;
}

function TechnicalReport({ snapshot, parcel }: { snapshot: SowingPlanSnapshot; parcel: ParcelContext }) {
  const regionalRain = parcel.rain_comparison?.power;
  const fieldRain = parcel.rain_comparison?.local;
  const fieldRainValue = fieldRain && typeof fieldRain.value !== "boolean" ? fieldRain.value : null;
  const recommendations = parcel.evaluation?.recommendations ?? [];
  const plantedZones = snapshot.plan.zones.filter((zone) => Number(zone.area_ha) > 0);
  return <section className="metrics-content" aria-labelledby="metrics-technical-title">
    <h2 id="metrics-technical-title">Reporte técnico</h2>
    <dl className="metrics-facts">
      <div><dt>Lluvia semanal regional</dt><dd>{regionalRain?.value == null ? "Sin dato" : `${number(regionalRain.value)} mm`}
        {regionalRain && <small>{period(regionalRain.period)} · <SourceLine source={regionalRain.source} /></small>}</dd></div>
      <div><dt>Registro de campo</dt><dd>{measured(fieldRainValue, "mm")}
        {fieldRain && <small>{fieldRain.data_kind === "synthetic" ? "Lectura simulada" : "Lectura de campo"} · {date(fieldRain.observed_at)}</small>}</dd></div>
      <div><dt>Suelo por zona</dt><dd>{parcel.soil.length ? "Consultar los registros de suelo de la ficha" : "Muestreo pendiente"}</dd></div>
      <div><dt>Plagas por zona</dt><dd>Observación en campo pendiente</dd></div>
    </dl>
    {recommendations.length > 0 && <div className="metrics-report-block">
      <h3>Alternativas de rotación de la ficha</h3>
      <ol className="metrics-rotations">{recommendations.map((entry) => <li key={entry.candidate.id}>{entry.candidate.label}</li>)}</ol>
    </div>}
    <h3>Rendimiento aplicado por zona</h3>
    <ul className="metrics-zones" aria-label="Rendimiento por zona">{plantedZones.map((zone) => <li key={zone.zone_id}>
      <div><strong>Zona {zoneName(zone.zone_id)} · {zone.crop_label}</strong><span className="muted">{yieldLabel(zone.yield_basis)}
        {zone.yield_input?.source && ` · ${zone.yield_input.source}`}</span></div>
      <div><strong>{measured(zone.yield_t_ha, "t/ha")}</strong>{zone.yield_reference_url && <a href={zone.yield_reference_url} target="_blank" rel="noreferrer">Fuente municipal</a>}</div>
    </li>)}</ul>
    <button className="button button-secondary" type="button" onClick={() => reportFile("technical", snapshot, [
      ["Lluvia semanal regional (mm)", regionalRain?.value ?? "Sin dato", regionalRain ? period(regionalRain.period) : "", regionalRain?.source.url ?? ""],
      ["Registro de campo (mm)", fieldRainValue ?? "Sin dato", fieldRain ? (fieldRain.data_kind === "synthetic" ? "Lectura simulada" : "Lectura de campo") : "", fieldRain?.observed_at ?? ""],
      ["Zona", "Cultivo", "Área (ha)", "Rendimiento (t/ha)", "Cosecha estimada (kg)", "Evidencia de rendimiento", "Fuente"],
      ...plantedZones.map((zone) => [zoneName(zone.zone_id), zone.crop_label, zone.area_ha, zone.yield_t_ha ?? "", zone.estimated_harvest_kg ?? "", yieldLabel(zone.yield_basis), zone.yield_reference_url ?? zone.yield_input?.source ?? ""]),
      ...recommendations.map((entry) => ["Alternativa de rotación de la ficha", entry.candidate.label]),
    ])}>Descargar reporte técnico (CSV)</button>
  </section>;
}

function CropSaleCapacity({ crop }: { crop: CropEconomics }) {
  const { sale_capacity_kg: capacity, capacity_confirmation: confirmation } = crop;
  return <div>
    <dt>Cupo de venta del cultivo</dt>
    <dd>{number(capacity.value)} kg{confirmation && " aplicados"}</dd>
    <dd className="muted">{termLabels[capacity.basis]}{!confirmation && capacity.source && ` · ${capacity.source}`}</dd>
    {confirmation && <>
      {confirmation.cupo_range[0] !== confirmation.cupo_range[1] && <dd className="muted">
        Rango documentado de {number(confirmation.cupo_range[0])} a {number(confirmation.cupo_range[1])} kg
      </dd>}
      <dd className="muted">Entrega del {period(confirmation.sales_period)}</dd>
      <dd className="muted">Confirmado el <time dateTime={confirmation.confirmed_at}>{date(confirmation.confirmed_at)}</time></dd>
      <dd className="muted">Fuente {confirmation.source.url
        ? <a href={confirmation.source.url} target="_blank" rel="noreferrer">{confirmation.source.name}</a>
        : confirmation.source.name}</dd>
    </>}
  </div>;
}

function ZoneEconomics({ plan }: { plan: SowingPlanSnapshot["plan"] }) {
  const { economics } = plan;
  if (!economics) return <p className="notice">{missingMargin}</p>;
  return <>
    <p className="muted">Venta prevista en {saleMonth(economics.sale_month)} · Importes en pesos mexicanos</p>
    {economics.missing_inputs?.map((crop) => <p key={crop.crop_id} className="notice">Falta {crop.fields.map((field) => missingTermLabels[field]).join(", ")} para calcular el margen de {cropLabel(crop.crop_id).toLowerCase()}.</p>)}
    <h3 id="metrics-zonal-economics">Ganancia estimada por zona</h3>
    <ul className="metrics-commercial-zones" aria-labelledby="metrics-zonal-economics">
      {plan.zones.filter((zone) => Number(zone.area_ha) > 0).map((zone) => {
        const value = zone.economics;
        return <li key={zone.zone_id}>
          <div className="metrics-zone-heading">
            <h4>Zona {zoneName(zone.zone_id)} · {zone.crop_label}</h4>
            <strong>{margin(value?.margin_mxn)}</strong>
          </div>
          {value && <dl className="metrics-zone-breakdown">
            <div><dt>Cosecha vendible</dt><dd>{number(value.marketable_kg)} kg</dd></div>
            <div><dt>Venta estimada</dt><dd>{number(value.sold_kg)} kg</dd></div>
            <div><dt>Ingreso estimado</dt><dd>{pesos(value.revenue_mxn)}</dd></div>
            <div><dt>Costo de la zona</dt><dd>{pesos(value.cost_mxn)}</dd></div>
          </dl>}
        </li>;
      })}
    </ul>
    <p className="small muted">La cosecha vendible descuenta la merma. Si un cultivo ocupa varias zonas, comparten su cupo de venta. La ganancia estimada resta el costo de toda la zona al ingreso previsto.</p>
    {economics.crops.length > 0 && <><h3>Costos, cupos y precios por cultivo</h3>
    <ul className="metrics-commercial-zones" aria-label="Datos y supuestos por cultivo">
      {economics.crops.map((crop) => <li key={crop.crop_id}>
        <h4>{cropLabel(crop.crop_id)}</h4>
        <dl className="metrics-zone-breakdown metrics-crop-terms">
          <div><dt>Costo por hectárea</dt><dd>{pesoRate(crop.cost_per_ha.value)}/ha</dd>
            <dd className="muted">{termLabels[crop.cost_per_ha.basis]}{crop.cost_per_ha.source && ` · ${crop.cost_per_ha.source}`}</dd></div>
          <CropSaleCapacity crop={crop} />
          <div><dt>Precio para la estimación</dt><dd>{pesoRate(crop.price_mxn_kg)}/kg</dd>
            <dd className="muted">{crop.price_input ? termLabels[crop.price_input.basis] : priceBasis[crop.price_basis]}
              {crop.price_input?.source && ` · ${crop.price_input.source}`}{crop.reference_geography && ` · ${crop.reference_geography}`}
              {crop.reference_product && ` · ${crop.reference_product}`}{crop.reference_observed_month && ` · ${saleMonth(crop.reference_observed_month)}`}</dd>
            {crop.reference_observed_url && <dd><a href={crop.reference_observed_url} target="_blank" rel="noreferrer">Ver fuente de precio</a></dd>}</div>
          <div><dt>Merma aplicada</dt><dd>{number(Number(crop.loss_fraction) * 100)} %</dd><dd className="muted">
            {crop.loss_input ? termLabels[crop.loss_input.basis] : "Supuesto de la demo"}{crop.loss_input?.source && ` · ${crop.loss_input.source}`}</dd></div>
        </dl>
      </li>)}
    </ul></>}
    <p className="small muted">«Dato reportado» identifica una cifra declarada en Parcela con su referencia.
      {economics.crops.some((crop) => crop.capacity_confirmation) && " El cálculo usa el límite inferior del cupo confirmado."}</p>
  </>;
}

function CommercialReport({ snapshot, parcel, parcelId, historicalError, retryHistory, current, sales, salesError, retrySales, showReferences }: {
  snapshot: SowingPlanSnapshot;
  parcel?: ParcelContext;
  parcelId: string;
  historicalError?: string;
  retryHistory: () => void;
  current: boolean;
  sales?: SowingSalesReport;
  salesError?: string;
  retrySales: () => void;
  showReferences: boolean;
}) {
  const version = snapshot.plan.context_version;
  const canCompare = showReferences && current && parcel?.evaluation_state === "vigente" && Boolean(parcel.evaluation);
  const request = useReportData((signal) => getCyclePlan(parcelId, { context_version: version, price_mode: "forecast" }, signal),
    `cycle/${parcelId}/${version}`, canCompare);
  const reference = request.data;
  const waitingForReferences = (showReferences && !parcel && !historicalError) || (canCompare && !reference && !request.error);
  const results = parcel?.evaluation?.commercial_results ?? [];
  const validCandidates = new Set(parcel?.evaluation?.recommendations.map((entry) => entry.candidate.id));
  const savedScenarios = parcel?.evaluation?.request_snapshot.commercial_scenarios?.filter((scenario) => validCandidates.has(scenario.candidate_id)) ?? [];
  const savedMargins = savedScenarios.flatMap((scenario) => {
    const margin = results.find((entry) => entry.scenario_id === scenario.id);
    return margin ? [{ scenario, margin }] : [];
  });
  return <section className="metrics-content" aria-labelledby="metrics-commercial-title">
    <h2 id="metrics-commercial-title">Reporte comercial</h2>
    <dl className="metrics-facts">
      <div><dt>Ganancia estimada del plan</dt><dd>{margin(snapshot.plan.economics?.estimated_margin_mxn)}</dd></div>
      {sales && <>
        <div><dt>Ganancia registrada</dt><dd>{sales.totals.actual_margin_mxn == null ? missingSales(sales) : pesos(sales.totals.actual_margin_mxn)}</dd></div>
        {sales.totals.margin_difference_mxn != null && <div><dt>Diferencia frente a la estimación</dt><dd>{pesos(sales.totals.margin_difference_mxn)}</dd></div>}
      </>}
    </dl>
    {sales ? ((sales.totals.sale_count > 0 || Boolean(sales.history?.length)) && <p className="small muted">{salesComparisonNote}</p>)
      : <RequestStatus error={salesError} loading="Cargando ventas registradas…" onRetry={retrySales} />}
    <ZoneEconomics plan={snapshot.plan} />
    <button className="button button-secondary" type="button" disabled={waitingForReferences || !sales}
      onClick={() => sales && reportFile("commercial", snapshot, commercialRows(snapshot.plan, sales, reference, savedMargins.map(({ scenario, margin }) => [
        cropLabel(scenario.crop_id), scenario.superficie_ha, period(scenario.sales_period), scenario.precio_productor_mxn_kg,
        margin.margen_min_mxn, margin.margen_max_mxn, margin.label_es,
      ])))}>Descargar reporte comercial (CSV)</button>
    {showReferences && <><h3>Referencias de la parcela completa</h3>
    {!parcel && <RequestStatus error={historicalError} loading="Cargando las referencias de la ficha…" onRetry={retryHistory} />}
    {parcel && !canCompare && <p className="muted">Consulta los escenarios guardados de esta ficha. Las proyecciones requieren una ficha vigente.</p>}
    {canCompare && !reference && <RequestStatus error={request.error} loading="Cargando referencias comerciales…" onRetry={request.retry} />}
    {reference && <>
      <p className="muted">Superficie de referencia: {number(reference.area_ha)} ha · Venta en {saleMonth(reference.sale_month)}</p>
      <dl className="metrics-facts">
        <div><dt>Mejor rotación agronómica</dt><dd>{cropLabel(reference.natural_best_crop_id)}</dd></div>
        <div><dt>Mayor ganancia estimada</dt><dd>{cropLabel(reference.margin_best_crop_id)}</dd></div>
        <div><dt>Recomendación conjunta</dt><dd>{cropLabel(reference.recommended_crop_id)}</dd></div>
      </dl>
      <p>{reference.recommendation_reason}</p>
      <ul className="metrics-zones" aria-label="Precios y márgenes de referencia">
        {reference.rows.filter((entry) => entry.viable && entry.economics).map((entry) => {
          const value = entry.economics!;
          return <li key={entry.crop_id}>
            <div><strong>{entry.label} · {pesos(value.price_mxn_kg)}/kg</strong>
              <span className="muted">{priceBasis[value.price_basis]}{value.reference_geography && ` · ${value.reference_geography}`}
                {value.reference_observed_month && ` · ${saleMonth(value.reference_observed_month)}`}</span>
              {value.price_low_mxn_kg != null && value.price_high_mxn_kg != null && <span className="muted">Rango de precio: {pesos(value.price_low_mxn_kg)} a {pesos(value.price_high_mxn_kg)}/kg</span>}
              {value.reference_observed_url && <a href={value.reference_observed_url} target="_blank" rel="noreferrer">Ver fuente de precio</a>}</div>
            <div><strong>{pesos(value.margin_mxn)}</strong><span className="muted">Margen estimado</span>
              {value.margin_low_mxn != null && value.margin_high_mxn != null && <span className="muted">{pesos(value.margin_low_mxn)} a {pesos(value.margin_high_mxn)}</span>}</div>
          </li>;
        })}
      </ul>
    </>}
    {savedMargins.length > 0 && <details className="disclosure">
      <summary>Escenarios guardados de la ficha</summary>
      <ul className="metrics-zones" aria-label="Escenarios comerciales guardados">{savedMargins.map(({ scenario, margin }) => <li key={scenario.id}>
        <div><strong>{cropLabel(scenario.crop_id)} · {number(scenario.superficie_ha)} ha</strong><span className="muted">{period(scenario.sales_period)} · {margin.label_es}</span></div>
        <strong>{pesos(margin.margen_min_mxn)} a {pesos(margin.margen_max_mxn)}</strong>
      </li>)}</ul>
    </details>}</>}
  </section>;
}

function commercialRows(plan: SowingPlanSnapshot["plan"], sales: SowingSalesReport, reference: CyclePlanResult | undefined, savedMargins: (string | number)[][]) {
  const { economics } = plan;
  return [
    ...salesRows(sales),
    ...(economics ? [
      ["Mes de venta previsto", economics.sale_month],
      ["Zona", "Cultivo", "Área (ha)", "Cosecha estimada (kg)", "Cosecha vendible (kg)", "Venta estimada (kg)", "Ingreso estimado (MXN)", "Costo de la zona (MXN)", "Ganancia estimada (MXN)"],
      ...plan.zones.filter((zone) => Number(zone.area_ha) > 0).map((zone) => [
        zoneName(zone.zone_id), zone.crop_label, zone.area_ha, zone.estimated_harvest_kg ?? "", zone.economics?.marketable_kg ?? "",
        zone.economics?.sold_kg ?? "", zone.economics?.revenue_mxn ?? "", zone.economics?.cost_mxn ?? "", zone.economics?.margin_mxn ?? "",
      ]),
      ["Cultivo", "Costo (MXN/ha)", "Evidencia del costo", "Referencia del costo", "Cupo aplicado del cultivo (kg)", "Evidencia del cupo", "Referencia del cupo",
        "Merma (fracción)", "Evidencia de la merma", "Precio (MXN/kg)", "Base del precio", "Geografía de la referencia", "Producto de la referencia", "Fecha de referencia", "URL de referencia",
        "Folio de confirmación del cupo", "Mínimo confirmado (kg)", "Máximo confirmado (kg)", "Inicio de ventana de entrega", "Fin de ventana de entrega", "Fecha de confirmación del cupo", "URL de fuente del cupo", "Referencia del precio declarado", "Referencia de merma"],
      ...economics.crops.map((crop) => {
        const confirmation = crop.capacity_confirmation;
        return [
          cropLabel(crop.crop_id), crop.cost_per_ha.value, termLabels[crop.cost_per_ha.basis], crop.cost_per_ha.source ?? "",
          crop.sale_capacity_kg.value, termLabels[crop.sale_capacity_kg.basis], confirmation?.source.name ?? crop.sale_capacity_kg.source ?? "", crop.loss_fraction, crop.loss_input ? termLabels[crop.loss_input.basis] : "Supuesto de la demo",
          crop.price_mxn_kg, crop.price_input ? termLabels[crop.price_input.basis] : priceBasis[crop.price_basis], crop.reference_geography ?? "", crop.reference_product ?? "", crop.reference_observed_month ?? "", crop.reference_observed_url ?? "",
          confirmation?.id ?? "", confirmation?.cupo_range[0] ?? "", confirmation?.cupo_range[1] ?? "", confirmation?.sales_period.start ?? "", confirmation?.sales_period.end ?? "",
          confirmation?.confirmed_at ?? "", confirmation?.source.url ?? "", crop.price_input?.source ?? "", crop.loss_input?.source ?? "",
        ];
      }),
    ] : []),
    ...(reference ? [
      ["Escenario de parcela completa", `${reference.area_ha} ha`, reference.sale_month, `Corte: ${reference.as_of}`],
      ["Cultivo", "Precio estimado (MXN/kg)", "Precio bajo (MXN/kg)", "Precio alto (MXN/kg)", "Margen estimado (MXN)", "Margen bajo (MXN)", "Margen alto (MXN)", "Base del precio", "Geografía de la referencia", "Fecha", "URL"],
      ...reference.rows.flatMap((entry) => {
        const value = entry.economics;
        return entry.viable && value ? [[entry.label, value.price_mxn_kg, value.price_low_mxn_kg ?? "", value.price_high_mxn_kg ?? "", value.margin_mxn, value.margin_low_mxn ?? "", value.margin_high_mxn ?? "",
          priceBasis[value.price_basis], value.reference_geography ?? "", value.reference_observed_month ?? "", value.reference_observed_url ?? ""]] : [];
      }),
    ] : []),
    ...(savedMargins.length ? [["Escenarios guardados de la ficha"], ["Cultivo", "Área (ha)", "Ventana de venta", "Precio base (MXN/kg)", "Margen bajo (MXN)", "Margen alto (MXN)", "Evidencia"], ...savedMargins] : []),
  ];
}

function SharedPlan({ snapshot, metrics, currentVersion, showReferences }: { snapshot: SowingPlanSnapshot; metrics: SowingMetrics; currentVersion: number; showReferences: boolean }) {
  const [view, setView] = useState<"overview" | "sales" | Report>("overview");
  const [salesPlanVersion, setSalesPlanVersion] = useState(snapshot.plan_version);
  const restorePlanFocus = useRef(false);
  const { plan } = snapshot;
  const historical = useReportData((signal) => getHistorical(metrics.parcel_id, plan.context_version, signal),
    `history/${metrics.parcel_id}/${plan.context_version}`, view === "technical" || (view === "commercial" && showReferences));
  const currentSales = useReportData((signal) => getSowingSales(metrics.parcel_id, snapshot.plan_version, signal),
    `sales/${metrics.parcel_id}/${snapshot.plan_version}`, view === "sales" || view === "commercial");
  const historicalSales = useReportData((signal) => getSowingSales(metrics.parcel_id, salesPlanVersion, signal),
    `sales/${metrics.parcel_id}/${salesPlanVersion}`, view === "sales" && salesPlanVersion !== snapshot.plan_version);
  const selectedSales = salesPlanVersion === snapshot.plan_version ? currentSales : historicalSales;
  useEffect(() => {
    if (view !== "sales") restorePlanFocus.current = false;
    if (restorePlanFocus.current && selectedSales.data) {
      document.getElementById("zone-sales-plan-select")?.focus();
      restorePlanFocus.current = false;
    }
  }, [view, selectedSales.data]);
  const sharedAt = snapshot.shared_at ?? snapshot.saved_at;
  const location = [metrics.municipality, metrics.state].filter((part) => part !== "Sin registrar").join(", ");
  return <>
    <div className="metrics-header">
      <div><h2>Plan de siembra compartido</h2><p>{location && `${location} · `}Primavera–verano {plan.campaign_year}</p></div>
      <p className="metrics-version">Plan v{snapshot.plan_version}<br /><span>Ficha v{plan.context_version} · <time dateTime={sharedAt}>{date(sharedAt)}</time></span></p>
    </div>
    <dl className="metrics-totals">
      <div className="metrics-totals-money"><dt>Ganancia estimada</dt><dd>{margin(plan.economics?.estimated_margin_mxn)}</dd></div>
      <div><dt>Superficie del plan</dt><dd>{number(plan.area_ha)} ha</dd></div>
      <div><dt>Zonas sembradas en el plan</dt><dd>{plan.zones.filter((zone) => Number(zone.area_ha) > 0).length}</dd></div>
      <div><dt>Cosecha total estimada</dt><dd>{measured(plan.estimated_harvest_kg, "kg")}</dd></div>
    </dl>
    {plan.context_version !== currentVersion && <p className="notice notice-warn">Este plan usa la ficha v{plan.context_version}. La ficha actual es v{currentVersion}.</p>}
    <div className="metrics-reports" role="group" aria-label="Vistas del plan compartido">
      <button type="button" aria-pressed={view === "overview"} onClick={() => setView("overview")}>Plan compartido</button>
      <button type="button" aria-pressed={view === "sales"} onClick={() => setView("sales")}>Ventas por zona</button>
      <button type="button" aria-pressed={view === "technical"} onClick={() => setView("technical")}>Reporte técnico</button>
      <button type="button" aria-pressed={view === "commercial"} onClick={() => setView("commercial")}>Reporte comercial</button>
    </div>
    {view === "overview" && <PlanOverview snapshot={snapshot} />}
    {view === "sales" && (selectedSales.data ? <ZoneSales key={salesPlanVersion} parcelId={metrics.parcel_id} report={selectedSales.data}
      onSelectPlan={(version) => {
        restorePlanFocus.current = true;
        setSalesPlanVersion(version);
      }} onRegistered={selectedSales.replace} />
      : <RequestStatus error={selectedSales.error} loading="Cargando ventas por zona…" onRetry={selectedSales.retry} />)}
    {view === "technical" && (historical.data ? <TechnicalReport snapshot={snapshot} parcel={historical.data} />
      : <RequestStatus error={historical.error} loading="Cargando la versión de la ficha…" onRetry={historical.retry} />)}
    {view === "commercial" && <CommercialReport snapshot={snapshot} parcel={historical.data} parcelId={metrics.parcel_id}
      historicalError={historical.error} retryHistory={historical.retry} current={plan.context_version === currentVersion}
      sales={currentSales.data} salesError={currentSales.error} retrySales={currentSales.retry} showReferences={showReferences} />}
  </>;
}

export function Metrics({ context, refreshKey, onContextSaved, parcelLink = "#parcela" }: {
  context: ParcelContext;
  refreshKey: number;
  onContextSaved: (context: ParcelContext) => void;
  parcelLink?: string;
}) {
  const id = context.parcel.id;
  const demo = context.producer.persona_kind === "composite_demo";
  const report = useReportData((signal) => getSowingMetrics(id, signal), `metrics/${id}/${context.context_version}/${refreshKey}`);
  const capacities = <CooperativeCapacities context={context} onContextSaved={onContextSaved} />;
  return <section className="metrics" aria-labelledby="metrics-title">
    <header className="metrics-intro"><h1 id="metrics-title" tabIndex={-1}>Seguimiento de {context.producer.display_name}</h1></header>
    {demo && capacities}
    {!report.data ? <RequestStatus error={report.error} loading="Cargando el plan compartido…" onRetry={report.retry} />
      : report.data.shared_plan ? <SharedPlan key={report.data.shared_plan.plan_version} snapshot={report.data.shared_plan} metrics={report.data} currentVersion={report.data.current_context_version}
        showReferences={demo} />
      : <div className="metrics-empty">
        <p>Aún no hay un plan compartido. Puedes compartirlo al revisar el resumen del simulador en <a href={parcelLink}>Parcela</a>.</p></div>}
    {!demo && <details className="parcel-detail own-cooperative">
      <summary>Cupos de venta de la cooperativa</summary>
      {capacities}
    </details>}
  </section>;
}
