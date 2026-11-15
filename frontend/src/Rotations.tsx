import type { ConstraintCheck, Evaluation, Explanation, ParcelContext } from "./api";
import { EvidenceSummary, SourceLine } from "./Evidence";
import { confidenceLabels, crops, date, dimensions, evidenceLabels, number } from "./format";

function Check({ check }: { check: ConstraintCheck }) {
  const status = check.outcome === "fail" ? "Incumplimiento" : check.outcome === "pass" ? "Cumple" : "Por confirmar";
  return <div className="rotation-check">
    <strong>{status}</strong>
    <p>{check.explanation}</p>
    <small>
      {check.evidence_tier && evidenceLabels[check.evidence_tier]}
      {check.source && <> · <SourceLine source={check.source} /></>}
      {typeof check.documented_at === "string" && <> · Registrada {date(check.documented_at)}</>}
    </small>
  </div>;
}

export function Rotations({
  context, evaluation, explanation, busy, preview, onExplain, sectionId = "rotaciones",
}: {
  context: ParcelContext;
  evaluation?: Evaluation | null;
  explanation?: { candidate: string; response: Explanation };
  busy: boolean;
  preview: boolean;
  onExplain?: (candidate: string) => void;
  sectionId?: string;
}) {
  const demo = context.producer.persona_kind === "composite_demo";
  return <section className="panel" id={sectionId}>
    <h2 tabIndex={-1}>Rotaciones</h2>
    {demo ? <details className="disclosure" open>
      <summary>Historial de cultivos</summary>
      <ol className="timeline" aria-label="Secuencia de cultivos">
        {context.history.map((item) => <li key={item.id}>
          <span>Ciclo {item.sequence}</span><strong>{item.crop_ids.map((crop) => crops[crop] ?? crop).join(" + ")}</strong>
        </li>)}
      </ol>
      {context.history.some((item) => !item.period) && <p className="small muted">Hay ciclos con fecha sin registrar.</p>}
      <p className="small muted">La secuencia procede del historial de la ficha. La escena HLS aporta información de vigor para su fecha.</p>
      <EvidenceSummary block={context.evidence_blocks?.secuencia_cultivos} />
    </details> : <p className="muted">
      El modelo compara el cambio de familia respecto al último ciclo registrado. Los criterios sin datos tienen el mismo puntaje para todas las opciones.
    </p>}
    {evaluation ? <>
      <h3>Opciones elegibles</h3>
      {!evaluation.recommendations.length && <p>La evaluación actual no contiene rotaciones elegibles.</p>}
      {evaluation.recommendations.map((item) => <details className="disclosure rotation" key={item.candidate.id}>
        <summary><span>{item.candidate.label}</span><b>{number(item.total_score)} / 100</b></summary>
        <p className="small muted">Confianza {confidenceLabels[item.confidence.level]}</p>
        <h4>Restricciones</h4>
        {item.constraint_checks.length ? item.constraint_checks.map((check) => <Check key={check.constraint_id} check={check} />)
          : <p>La solicitud no incluye restricciones duras.</p>}
        <h4>Dimensiones</h4>
        <ul className="dimensions">
          {item.dimensions.map((dimension) => <li key={dimension.dimension}>
            <strong>{dimensions[dimension.dimension] ?? dimension.dimension}</strong>
            <b>{number(dimension.score)}/100</b>
            <span>Peso {number(dimension.weight)} · Aporte {number(dimension.contribution)} al total</span>
            {dimension.reasons.map((reason, index) => typeof reason.text === "string" && <p key={index}>{reason.text}</p>)}
          </li>)}
        </ul>
      </details>)}
      {!!evaluation.excluded.length && <div className="exclusions">
        <h3>Opciones excluidas</h3>
        {preview && <p className="small muted">Guarda el escenario para solicitar la explicación de la ficha vigente.</p>}
        {evaluation.excluded.map((item) => {
          const title = evaluation.request_snapshot.candidates.find((candidate) => candidate.id === item.candidate_id)?.label;
          const primary = item.checks.find((check) => check.constraint_id === item.primary_constraint_id)
            ?? item.checks.find((check) => check.outcome !== "pass");
          return <article className="exclusion" key={item.candidate_id}>
            <h4>{title ?? item.candidate_id}</h4>
            {primary && <Check check={primary} />}
            {onExplain && <button className="button button-secondary" disabled={busy || preview} onClick={() => onExplain(item.candidate_id)}>
              Explicar exclusión
            </button>}
            {explanation?.candidate === item.candidate_id && <div role="status" className="explanation">
              <p>{explanation.response.text_es}</p>
              <small>{explanation.response.mode === "llm" ? "Explicación asistida" : "Explicación generada por las reglas"} · Ficha v{explanation.response.context_version}</small>
            </div>}
          </article>;
        })}
      </div>}
    </> : <p>{context.evaluation_state === "pendiente_de_recalculo"
      ? "Recalcula la ficha para consultar las rotaciones vigentes." : "Prepara la demostración para evaluar las rotaciones."}</p>}
  </section>;
}

