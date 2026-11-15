import { historicalUrl, type ParcelContext } from "./api";
import { EvidenceSummary, SourceLine } from "./Evidence";
import { period } from "./format";
import "./ParcelAnalysis.css";

const variableLabels: Record<string, string> = {
  weekly_air_temperature_mean: "Temperatura media del aire en la semana",
  weekly_precipitation_total: "Lluvia acumulada en la semana",
  weekly_precipitation_daily_mean: "Lluvia media por día en la semana",
  air_temperature_mean: "Temperatura media del aire",
  precipitation: "Lluvia acumulada",
};

export function ParcelAdvancedData({ context }: { context: ParcelContext }) {
  const { evaluation, features, observations } = context;
  const demo = context.producer.persona_kind === "composite_demo";
  return <section className="panel parcel-advanced" aria-labelledby="parcel-data-title">
    <h2 id="parcel-data-title">Datos y fuentes de la ficha</h2>
    {features.length > 0 && <details className="disclosure">
      <summary>Variables calculadas</summary>
      <dl className="parcel-raw-values">{features.map((feature) =>
        <div key={feature.id}>
          <dt>{variableLabels[feature.name] ?? feature.name}</dt>
          <dd>
            <strong>{feature.value != null ? `${String(feature.value)} ${feature.unit}` : "Sin dato"}</strong>
            <p className="small muted">{period(feature.period)}</p>
            <p className="small"><code>{feature.name}</code>
              {typeof feature.method === "string" && <> · Método <code>{feature.method}</code></>}
              {typeof feature.method_version === "string" && ` v${feature.method_version}`}
            </p>
            {feature.missing_reason && <p>{feature.missing_reason}</p>}
            {feature.confidence.reasons.map((reason) => <p key={reason} className="small muted">{reason}</p>)}
          </dd>
        </div>)}</dl>
    </details>}
    {observations.length > 0 && <details className="disclosure">
      <summary>Observaciones y procedencia</summary>
      <dl className="parcel-raw-values">{observations.map((observation) => <div key={observation.id}>
        <dt>{variableLabels[observation.variable] ?? observation.variable}</dt>
        <dd>
          <strong>{observation.value != null ? `${String(observation.value)} ${observation.unit}` : "Sin dato"}</strong>
          <p className="small muted">{period(observation.period)} · <SourceLine source={observation.source} /></p>
          {observation.missing_reason && <p>{observation.missing_reason}</p>}
        </dd>
      </div>)}</dl>
    </details>}
    {evaluation && <details className="disclosure">
      <summary>Evaluación de rotaciones</summary>
      <p>Motor v{evaluation.engine_version} · Reglas v{evaluation.rules_version} · Catálogo v{evaluation.catalog_version}</p>
      {evaluation.warnings.length > 0 && <ul>{evaluation.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
      {demo && <p><a href="#rotaciones">Consultar puntuaciones, restricciones y alternativas</a></p>}
    </details>}
    {context.warnings?.length ? <details className="disclosure">
      <summary>Notas de la ficha</summary>
      <ul>{context.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
    </details> : null}
    {features.length === 0 && observations.length === 0 && !evaluation &&
      <p className="muted">Las variables calculadas y las fuentes aparecen aquí cuando la ficha las tiene disponibles.</p>}
    {demo && <EvidenceSummary block={context.evidence_blocks?.agronomico} />}
    <p className="parcel-raw-download">
      <a href={historicalUrl(context.parcel.id, context.context_version)} target="_blank" rel="noreferrer">
        Abrir ficha v{context.context_version} (JSON)
      </a>
    </p>
  </section>;
}
