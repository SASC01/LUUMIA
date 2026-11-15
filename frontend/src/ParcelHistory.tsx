import { historicalUrl, type Observation, type ParcelContext } from "./api";
import { crops, date, number, period, todayInCampeche } from "./format";
import "./ParcelHistory.css";

const variableLabels: Record<string, string> = {
  precipitation: "Lluvia",
  air_temperature_mean: "Temperatura media del aire",
  volumetric_water_content: "Humedad del suelo",
  surface_temperature: "Temperatura de la superficie",
  evapotranspiration: "Pérdida de agua",
  soil_moisture_anomaly: "Humedad respecto a lo habitual",
  ndvi: "Estado de la vegetación",
};

const units: Record<string, string> = { degC: "°C", "mm/day": "mm por día" };
const measurement = (value: number, unit: string) => [number(value), units[unit] ?? unit].filter(Boolean).join(" ");
const scopeLabel = (scope: Observation["spatial_support"]) => scope === "regional" ? "Región"
  : scope === "field" ? "Campo" : scope === "pixel" ? "Punto de la imagen" : "Parcela";
const changeDate = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City",
});

type CropCycle = ParcelContext["history"][number];
type CycleChange = NonNullable<ParcelContext["crop_cycle_history"]>[number];

function cropName(cycle: CropCycle) {
  return cycle.crop_ids.map((crop) => crops[crop] ?? crop).join(" + ");
}

function cycleDates(cycle: CropCycle) {
  return cycle.period ? period(cycle.period) : "Fecha sin registrar";
}

function CropChangeHistory({ changes, parcelId }: { changes: CycleChange[]; parcelId: string }) {
  return <details className="disclosure crop-change-history">
    <summary>Historial de cambios de cultivo ({changes.length})</summary>
    <ol>{[...changes].reverse().map((change) => <li key={change.change_id}>
      <div className="crop-change-meta">
        <strong>{change.action === "corrected" ? "Ciclo corregido" : "Ciclo anulado"}</strong>
        <span className="muted"><time dateTime={change.recorded_at}>{changeDate.format(new Date(change.recorded_at))}</time>
          {" · "}Ficha v{change.context_version}</span>
      </div>
      <dl>
        <div><dt>Antes</dt><dd>{cropName(change.previous)} · {cycleDates(change.previous)}</dd></div>
        {change.replacement && <div><dt>Después</dt><dd>{cropName(change.replacement)} · {cycleDates(change.replacement)}</dd></div>}
      </dl>
      {change.reason && <p className="crop-change-reason"><strong>Motivo</strong> {change.reason}</p>}
      <a className="crop-change-version" href={historicalUrl(parcelId, change.context_version - 1)} target="_blank" rel="noreferrer">
        Abrir ficha anterior v{change.context_version - 1} (JSON)
      </a>
    </li>)}</ol>
  </details>;
}

function orderedObservations(context: ParcelContext) {
  const observations = new Map([
    ...(context.weekly_cells ?? []).flatMap((week) => week.observations), ...context.observations,
  ].map((observation) => [observation.id, observation]));
  return [...observations.values()]
    .filter((observation) => observation.status === "available")
    .sort((left, right) => right.period.end.localeCompare(left.period.end)
      || right.period.start.localeCompare(left.period.start)
      || left.variable.localeCompare(right.variable));
}

function fieldPeriod(observation: ParcelContext["field_observations"][number]) {
  const gauge = observation.rain_gauge;
  if (!gauge) return <time dateTime={observation.observed_at}>{date(observation.observed_at)}</time>;
  const end = new Date(`${gauge.accumulation_end.slice(0, 10)}T00:00:00Z`);
  if (gauge.accumulation_end.slice(11, 19) === "00:00:00") end.setUTCDate(end.getUTCDate() - 1);
  const firstDay = gauge.accumulation_start.slice(0, 10);
  const lastDay = end.toISOString().slice(0, 10);
  return firstDay === lastDay ? date(firstDay) : `${date(firstDay)} al ${date(lastDay)}`;
}

export function ParcelHistory({ context, fieldHref }: { context: ParcelContext; fieldHref: string }) {
  const observations = orderedObservations(context);
  const periods = new Set(observations.map((item) => `${item.period.start}/${item.period.end}`));
  const readings = [...context.field_observations].sort((left, right) =>
    Date.parse(right.observed_at) - Date.parse(left.observed_at) || Date.parse(right.recorded_at) - Date.parse(left.recorded_at));
  const replaced = new Set(readings.map((record) => record.supersedes_id));
  const changes = [...(context.registered_area_history ?? [])].reverse();
  const cropCycles = [...context.history].sort((left, right) => right.sequence - left.sequence);
  const cropChanges = context.crop_cycle_history ?? [];
  const previousEvaluation = context.prior_commercial?.context_version ?? context.last_evaluation_version;
  const demo = context.producer.persona_kind === "composite_demo";
  const today = todayInCampeche();
  const cropList = cropCycles.length ? <ul className="parcel-history-list">
    {cropCycles.map((cycle) => <li key={cycle.id}>
      <div>
        <strong>{cropName(cycle)}</strong>
        <span>{cycleDates(cycle)}
          {cycle.data_kind === "synthetic" && " · Simulado"}</span>
      </div>
      <div className="parcel-history-value">Ciclo {cycle.sequence}
        {cycle.data_kind === "observed" && cycle.period && cycle.period.start <= today && today <= cycle.period.end && " · En curso"}
      </div>
    </li>)}
  </ul> : <p className="muted">Aún no hay ciclos de cultivo registrados.</p>;

  return <section className="parcel-history" aria-label="Registros de la parcela">
    {!demo && <section aria-labelledby="parcel-history-crops">
      <div className="parcel-history-title">
        <h2 id="parcel-history-crops">Ciclos de cultivo</h2>
        <a href="#registro-cultivos">{cropCycles.length ? "Gestionar ciclos" : "Registrar un ciclo"}</a>
      </div>
      {cropList}
      {cropChanges.length > 0 && <CropChangeHistory changes={cropChanges} parcelId={context.parcel.id} />}
    </section>}
    <section aria-labelledby="parcel-history-weather">
      <h2 id="parcel-history-weather">Lecturas ambientales</h2>
      {observations.length > 0 ? <>
        {periods.size === 1 && <p className="muted">Hay un solo período registrado. Se necesitan varios períodos comparables para ver una tendencia.</p>}
        <ul className="parcel-history-list">
          {observations.map((item) => <li key={item.id}>
            <div>
              <strong>{variableLabels[item.variable] ?? "Otra lectura ambiental"}</strong>
              <span>{period(item.period)} · {scopeLabel(item.spatial_support)}</span>
            </div>
            <div className="parcel-history-value">
              {item.value !== null && <strong>{measurement(item.value, item.unit)}</strong>}
              <span>{item.source.name}{item.data_kind === "synthetic" && " · Simulada"}</span>
            </div>
          </li>)}
        </ul>
      </> : <p className="muted">Aún no hay lecturas ambientales en la ficha.</p>}
    </section>

    <section aria-labelledby="parcel-history-field">
      <div className="parcel-history-title">
        <h2 id="parcel-history-field">Observaciones de campo</h2>
        <a href={fieldHref}>Ir a observaciones</a>
      </div>
      {readings.length ? <ul className="parcel-history-list">
        {readings.map((item) => <li key={item.id}>
          <div>
            <strong>{variableLabels[item.variable] ?? "Observación de campo"}</strong>
            <span>{fieldPeriod(item)}
              {item.data_kind === "synthetic" && " · Simulada"}
              {replaced.has(item.id) && " · Sustituida"}
              {!item.confirmed && " · Por confirmar"}
            </span>
          </div>
          <div className="parcel-history-value">
            <strong>{typeof item.value === "number" ? measurement(item.value, item.unit)
              : typeof item.value === "boolean" ? item.value ? "Sí" : "No" : item.value}</strong>
            <span>{item.kobo ? `KoboCollect · ficha v${item.kobo.context_version}`
              : item.rain_gauge?.source.name}</span>
          </div>
        </li>)}
      </ul> : <p className="muted">Aún no hay observaciones de campo registradas.</p>}
    </section>

    {demo && <details className="disclosure">
      <summary>Cultivos anteriores</summary>
      {cropList}
    </details>}

    <details className="disclosure">
      <summary>Superficie y versiones de la ficha</summary>
      {changes.length ? <ul className="parcel-history-list">
        {changes.map((change) => <li key={change.context_version}>
          <div>
            <strong>{number(change.previous_area_ha)} ha a {number(change.declared_area_ha)} ha</strong>
            <span><time dateTime={change.recorded_at}>{date(change.recorded_at)}</time> · Ficha v{change.context_version}</span>
          </div>
          <a href={historicalUrl(context.parcel.id, change.context_version - 1)} target="_blank" rel="noreferrer">
            Ver ficha anterior v{change.context_version - 1} (JSON)
          </a>
        </li>)}
      </ul> : <p className="muted">Aún no hay cambios de superficie registrados.</p>}
      {previousEvaluation && <p className="parcel-history-previous">
        <a href={historicalUrl(context.parcel.id, previousEvaluation)} target="_blank" rel="noreferrer">
          Ver ficha con la evaluación anterior v{previousEvaluation} (JSON)
        </a>
      </p>}
    </details>
  </section>;
}
