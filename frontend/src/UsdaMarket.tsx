import { useEffect, useState } from "react";
import { getUsdaReference, type UsdaReference } from "./api";
import { date, number } from "./format";
import { ReferenceStatus } from "./ReferenceStatus";

export function UsdaMarket() {
  const [request, setRequest] = useState({ refresh: false });
  const [state, setState] = useState<{ reference?: UsdaReference; error?: string }>({});

  useEffect(() => {
    const controller = new AbortController();
    setState({});
    getUsdaReference(controller.signal, request.refresh).then((reference) => {
      if (!controller.signal.aborted) setState({ reference });
    }).catch((error: Error) => {
      if (!controller.signal.aborted) setState({ error: error.message });
    });
    return () => controller.abort();
  }, [request]);

  const report = state.reference?.data;
  const pending = !report && !state.error;
  return <section className="panel" id="usda" aria-labelledby="usda-title">
    <h2 id="usda-title">Producción nacional de maíz</h2>
    <p>México · USDA FAS. Referencia nacional por campaña comercial.</p>
    <div className="button-group">
      <button type="button" className="button button-secondary" disabled={pending}
        onClick={() => setRequest({ refresh: true })}>Consultar USDA de nuevo</button>
    </div>
    {pending && <p role="status">Cargando la publicación de USDA FAS…</p>}
    {state.error && <p className="notice notice-warn" role="alert">{state.error}</p>}
    {report && state.reference && <>
      <ReferenceStatus delivery={state.reference.delivery} />
      <p className="small muted">En {report.unit}. {report.scope_note}</p>
      <table className="usda-campaigns">
        <caption className="sr-only">Producción por campaña, en {report.unit}</caption>
        <thead><tr><th scope="col">Campaña</th><th scope="col">Producción</th></tr></thead>
        <tbody>{report.rows.map((row) => <tr key={row.market_year}>
          <th scope="row">{row.market_year}/{String(row.market_year + 1).slice(-2)}</th>
          <td>{number(row.value)}</td>
        </tr>)}</tbody>
      </table>
      <details className="disclosure">
        <summary>Publicación y fuente</summary>
        <p className="small">Archivo consultado el {date(report.retrieved_at)}.
          {report.published_at && <> Fecha de modificación publicada del ZIP: {date(report.published_at)}.</>}
        </p>
        <ul><li><a href={report.source_url} target="_blank" rel="noreferrer">USDA FAS · PSD Online</a></li>
          <li><a href={report.download_url} target="_blank" rel="noreferrer">Descargar el extracto oficial de granos (ZIP)</a></li></ul>
      </details>
    </>}
  </section>;
}
