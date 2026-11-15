import { useEffect, useState } from "react";
import { getMarketReference, type MarketReference, type MarketSummary } from "./api";
import { date, period, pesos } from "./format";
import { ReferenceStatus } from "./ReferenceStatus";

const months = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat("es-MX", { month: "long", timeZone: "UTC" }).format(Date.UTC(2026, month, 1)),
);

function Summary({ summary, heading }: { summary: MarketSummary; heading: string }) {
  return <div className="market-summary">
    <h3>{heading}</h3>
    {summary.median_mxn_kg !== null && summary.minimum_mxn_kg !== null && summary.maximum_mxn_kg !== null
      ? <div className="facts">
        <span>Mediana</span><b>{pesos(summary.median_mxn_kg)}/kg</b>
        <span>Rango</span><b>{pesos(summary.minimum_mxn_kg)} a {pesos(summary.maximum_mxn_kg)}/kg</b>
        <span>Cotizaciones</span><b>{summary.n}</b>
      </div>
      : <p className="small muted">{summary.missing_reason ?? "Sin dato."}</p>}
  </div>;
}

export function Market() {
  const [series, setSeries] = useState("campeche-monthly");
  const [month, setMonth] = useState(9);
  const [request, setRequest] = useState({ refresh: false });
  const [state, setState] = useState<{ report?: MarketReference; error?: string; pending?: boolean }>({});

  useEffect(() => {
    const controller = new AbortController();
    setState({ pending: true });
    getMarketReference(series, month, controller.signal, request.refresh).then((report) => {
      if (!controller.signal.aborted) setState({ report });
    }).catch((error: Error) => {
      if (!controller.signal.aborted) setState({ error: error.message });
    });
    return () => controller.abort();
  }, [series, month, request]);

  const report = state.report?.series_id === series && state.report.selected_month === month ? state.report : undefined;
  const shown = report?.rows.filter((item) => report.granularity === "daily" || Number(item.period_start.slice(5, 7)) === month);

  return <section className="panel" id="mayoreo">
    <h2>Precio mayorista de Saladette</h2>
    <p>Referencia de SNIIM. El cálculo de margen usa el precio al productor que ingreses.</p>
    <div className="form-grid">
      <div className="reference-field"><label htmlFor="sniim-market">Mercado</label>
        <select id="sniim-market" value={series} onChange={(event) => { setSeries(event.target.value); setRequest({ refresh: false }); }}>
          <option value="campeche-monthly">Pedro Sáinz de Baranda, Campeche</option>
          <option value="merida-recent">Mérida · Semana reciente</option>
          <option value="merida-weekly">Mérida · Septiembre de 2026</option>
        </select>
      </div>
      {series === "campeche-monthly" && <div className="reference-field"><label htmlFor="sniim-month">Mes de referencia</label>
        <select id="sniim-month" value={month} onChange={(event) => { setMonth(Number(event.target.value)); setRequest({ refresh: false }); }}>
          {months.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
        </select>
      </div>}
    </div>
    <button type="button" className="button button-secondary" disabled={state.pending}
      onClick={() => setRequest({ refresh: true })}>Consultar SNIIM de nuevo</button>
    {!report && !state.error && <p role="status">Cargando cotizaciones de SNIIM…</p>}
    {state.error && <div className="notice notice-warn" role="alert">
      <p>{state.error}</p>
    </div>}
    {report && <>
      <ReferenceStatus delivery={report.delivery} />
      <p className="small muted">{report.market} · {report.quality} · {period(report.period)}</p>
      {report.granularity === "daily" && <Summary heading="Cotizaciones de la semana" summary={report.weekly} />}
      {series === "merida-recent" && report.delivery.mode !== "snapshot" && report.weekly.n < 5 &&
        <p className="small muted">Semana con cobertura parcial de cotizaciones comparables ({report.weekly.n} de 5 días hábiles).</p>}
      {report.granularity === "monthly"
        ? <Summary heading="Referencia estacional" summary={report.seasonal} />
        : <p className="small muted">{report.seasonal.missing_reason}</p>}
      <details className="disclosure">
        <summary>Ver cotizaciones y fuentes</summary>
        <ul className="quote-list">
          {shown?.map((row) => <li key={row.id}>
            <a href={row.url_fuente} target="_blank" rel="noreferrer">{date(row.period_start)}</a>
            <span>{pesos(row.mxn_kg)}/kg</span>
            <small>{[row.presentation, row.origin].filter(Boolean).join(" · ") || row.missing_reason}
              {" · "}{row.price_kind === "daily_frequent" ? "Precio frecuente diario" : "Promedio mensual"}
              {" · "}Consulta del {date(row.retrieved_at)}
            </small>
          </li>)}
        </ul>
      </details>
    </>}
  </section>;
}

