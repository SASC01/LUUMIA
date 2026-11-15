import type { BlockEvidence, FieldSource, ParcelContext } from "./api";
import { confidenceLabels, date, evidenceLabels, number, period } from "./format";

export function SourceLine({ source }: { source: FieldSource }) {
  return <span>
    {source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> : source.name}
    {" · "}<time dateTime={source.retrieved_at}>{date(source.retrieved_at)}</time>
  </span>;
}

export function EvidenceTag({ block }: { block?: BlockEvidence | null }) {
  if (!block) return null;
  const heading = block.evidence_tier ? evidenceLabels[block.evidence_tier] : "Sin dato";
  return <span className={`tag tag-${block.evidence_tier ?? "missing"}`}>{heading}</span>;
}

export function EvidenceSummary({ block }: { block?: BlockEvidence | null }) {
  if (!block) return null;
  return <details className="evidence-detail">
    <summary><EvidenceTag block={block} /> {number(block.n_observaciones)} {block.count_unit}</summary>
    <p>Confianza {confidenceLabels[block.confidence.level]}.
      {block.n_simulated ? ` Registros simulados: ${block.n_simulated}.` : ""}
    </p>
    {block.missing_reason && <p>{block.missing_reason}</p>}
    {block.confidence.reasons.map((item) => <p key={item}>{item}</p>)}
    {block.sources?.length ? <ul>{block.sources.map((source) =>
      <li key={`${source.id}-${source.url ?? ""}`}><SourceLine source={source} /></li>,
    )}</ul> : null}
  </details>;
}

export function RegionalClimate({ context }: { context: ParcelContext }) {
  const rainfall = context.features.find((row) => row.name === "weekly_precipitation_total");
  const air = context.features.find((row) => row.name === "weekly_air_temperature_mean");
  const backup = context.weekly_cells?.some((cell) => cell.warnings.some((warning) => warning.includes("respaldo")));
  return <div className="weather-panel">
    <div className="weather-heading"><h2>Clima regional</h2><span>NASA POWER</span></div>
    {rainfall || air ? <>
      <p>{period((rainfall ?? air)!.period)} · Hora solar local</p>
      <div className="weather-grid">
        <div><span>Lluvia acumulada</span><strong>{rainfall?.value == null ? "Sin dato" : `${number(rainfall.value)} mm`}</strong></div>
        <div><span>Temperatura media</span><strong>{air?.value == null ? "Sin dato" : `${number(air.value)} °C`}</strong></div>
      </div>
      {rainfall?.missing_reason && <p>{rainfall.missing_reason}</p>}
      {air?.missing_reason && <p>{air.missing_reason}</p>}
      {backup && <p className="small">Semana recuperada del respaldo de LuumIA. Consulta la fecha original en la fuente.</p>}
    </> : <p>Prepara la demostración para consultar la semana de referencia.</p>}
    <EvidenceSummary block={context.evidence_blocks?.agronomico} />
  </div>;
}

