import { useEffect, useId, useState } from "react";
import type { components } from "../../contracts/generated/luumia";
import { crops, number } from "./format";
import "./YieldScenario.css";

type Reference = components["schemas"]["YieldReferenceResponse"];
export type AgriculturalCycle = Reference["cycle"];
export type YieldAssumption = components["schemas"]["YieldAssumption"];

const cycles = [
  ["spring_summer", "Primavera–verano"],
  ["fall_winter", "Otoño–invierno"],
] as const;

const yieldFormat = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 6 });
const formatYield = (value: string | number) => yieldFormat.format(Number(value));

type Props = {
  cropId: string;
  cycle: AgriculturalCycle | null;
  value: string | number;
  source: YieldAssumption | null;
  onCycleChange: (cycle: AgriculturalCycle | null) => void;
  onValueChange: (value: string) => void;
  onUseReference: (referenceId: string, value: string) => void;
};

type State = { key: string; loading: boolean; data?: Reference; error?: string };

export function YieldScenario({ cropId, cycle, value, source, onCycleChange, onValueChange, onUseReference }: Props) {
  const uid = useId();
  const [state, setState] = useState<State>();
  const [refreshCount, setRefreshCount] = useState(0);
  const key = `${cropId}|${cycle ?? ""}`;
  const current = state?.key === key ? state : undefined;

  useEffect(() => {
    if (!cycle) return;
    const controller = new AbortController();
    setState({ key, loading: true });
    fetch(`/api/v1/yield-references/${encodeURIComponent(cropId)}?cycle=${cycle}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo consultar la referencia municipal.");
        return await response.json() as Reference;
      })
      .then((data) => { if (!controller.signal.aborted) setState({ key, loading: false, data }); })
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, loading: false, error: "No se pudo consultar la referencia municipal. Puedes ingresar un supuesto propio." });
      });
    return () => controller.abort();
  }, [cropId, cycle, key, refreshCount]);

  const report = current?.data;
  const reference = report?.reference;
  const referenceId = reference?.reference_id;
  const fromMunicipality = source?.kind === "municipal_median";
  const applied = fromMunicipality && source.reference_id === referenceId;
  const best = reference?.max_record;

  return <section className="yield-scenario" aria-labelledby={`${uid}-title`}>
    <h3 id={`${uid}-title`}>Rendimiento de {crops[cropId]?.toLocaleLowerCase("es-MX") ?? cropId}</h3>
    <div className="form-grid">
      <div className="reference-field">
        <label htmlFor={`${uid}-cycle`}>Ciclo agrícola</label>
        <select id={`${uid}-cycle`} value={cycle ?? ""}
          onChange={(event) => onCycleChange(cycles.find(([id]) => id === event.target.value)?.[0] ?? null)}>
          <option value="">Sin especificar</option>
          {cycles.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>
      <div className="reference-field">
        <label htmlFor={`${uid}-yield`}>Rendimiento supuesto (t/ha)</label>
        <input id={`${uid}-yield`} min="0" step="0.000001" type="number" required
          value={value} onChange={(event) => onValueChange(event.target.value)} />
      </div>
    </div>
    <p className="small muted"><span className="tag tag-simulated_assumption">Supuesto productivo</span>{" "}
      {fromMunicipality ? "Valor tomado de la mediana municipal para simular la cosecha de esta parcela."
        : "Valor editable para estimar la cosecha de Don Tino."}</p>
    {!cycle && <p className="small muted">Selecciona el ciclo agrícola para buscar registros comparables de temporal.</p>}
    {cycle && (!current || current.loading) && <p className="small muted" role="status">Cargando referencia municipal…</p>}
    {current?.error && <div className="notice notice-warn">
      <p role="status">{current.error}</p>
      <div className="button-group"><button type="button" className="button button-secondary"
        onClick={() => setRefreshCount(refreshCount + 1)}>Volver a consultar</button></div>
    </div>}
    {report?.status === "missing" && <p className="small muted" role="status">
      {report.missing_reason || "No hay registros municipales comparables para este cultivo y ciclo. Ingresa un supuesto propio."}{" "}
      <a href={report.source_url} target="_blank" rel="noreferrer">Consultar cierres agrícolas</a>
    </p>}
    {report?.status === "available" && reference && best && <div className="yield-reference">
      <p><span className="tag tag-observed">Datos históricos reales</span></p>
      <p className="small muted">{report.municipality}, {report.state} · {reference.crop_label} de temporal</p>
      <p className="small muted">Estadísticos de los cierres agrícolas municipales consultados entre {reference.period_start_year} y {reference.period_end_year}.</p>
      <dl className="yield-statistics">
        <div><dt>Mediana</dt><dd>{formatYield(reference.median_t_ha)} t/ha</dd></div>
        <div><dt>Rango histórico</dt><dd>{formatYield(reference.min_t_ha)} a {formatYield(reference.max_t_ha)} t/ha</dd></div>
        <div><dt>Registros</dt><dd>{number(reference.n)}</dd></div>
        <div><dt>Máximo histórico</dt><dd>{formatYield(best.yield_t_ha)} t/ha ({best.year})</dd></div>
      </dl>
      <div className="button-group"><button type="button" className="button button-secondary" disabled={applied}
        onClick={() => onUseReference(reference.reference_id, String(reference.median_t_ha))}>
        {applied ? "Mediana aplicada como supuesto" : "Usar mediana como supuesto"}
      </button></div>
      <details className="disclosure">
        <summary>Registros y fuentes</summary>
        <p className="small muted">El máximo de {best.year} corresponde a {number(best.harvested_area_ha)} ha cosechadas y {number(best.production_t)} t producidas en el municipio.</p>
        <ul className="quote-list">{reference.rows.map((row) => <li key={row.year}>
          <a href={row.source_url} target="_blank" rel="noreferrer">Cierre agrícola {row.year}</a>
          <span>{formatYield(row.yield_t_ha)} t/ha</span>
        </li>)}</ul>
      </details>
    </div>}
  </section>;
}
