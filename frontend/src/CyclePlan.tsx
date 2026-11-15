import { useEffect, useState, type FormEvent } from "react";
import { ApiFailure, getCyclePlan, type CyclePlanRequest, type CyclePlanResult, type ParcelContext, type PriceForecast } from "./api";
import { date, number, pesos } from "./format";
import { PriceTrend } from "./PriceTrend";
import "./CyclePlan.css";

type CycleRow = CyclePlanResult["rows"][number];
type Assumption = NonNullable<CyclePlanRequest["assumptions"]>[number];
type NumericAssumption = "local_price_mxn_kg" | "yield_t_ha" | "cost_mxn" | "capacity_kg" | "loss_fraction";
type Draft = Record<NumericAssumption, string> & { soil_cover: boolean };

const monthFormat = new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: "UTC" });
const monthlyPrice = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
const monthLabel = (month: string) => monthFormat.format(new Date(`${month.slice(0, 7)}-01T00:00:00Z`));
const price = (value: string | number) => monthlyPrice.format(Number(value));

const inputs = [
  { name: "local_price_mxn_kg", label: "Precio base (MXN/kg)", step: "any" },
  { name: "yield_t_ha", label: "Rendimiento (t/ha)", step: "any" },
  { name: "loss_fraction", label: "Merma (%)", step: "0.0001", max: 100 },
  { name: "capacity_kg", label: "Cupo de venta (kg)", step: "1" },
  { name: "cost_mxn", label: "Costo total (MXN)", step: "any" },
] satisfies { name: NumericAssumption; label: string; step: string; max?: number }[];

const priceBases: Record<string, string> = {
  local_forecast: "Pronóstico en MXN basado en precios al productor en México.",
  mexican_observation: "Escenario de sensibilidad. Usa el último precio mensual mexicano observado como precio fijo para la venta.",
  international_index: "Precio base local supuesto, ajustado con la variación proyectada de la referencia internacional.",
  local_assumption: "Precio base local supuesto, mantenido constante por falta de una referencia aplicable.",
};

function marketLabel(series: PriceForecast["series"]) {
  if (series.geography_code !== "MEX") return "Internacional";
  if (series.geography_level === "municipality" && series.state_code === "04") return "Campeche · Municipal";
  if (series.geography_level === "state" && series.state_code === "04") return "Campeche · Estatal";
  if (series.geography_level === "national") return "México · Nacional";
  return "México · Regional";
}

function initialDrafts(rows: CycleRow[]) {
  return Object.fromEntries(rows.map((row) => {
    const assumption = row.assumption;
    const percent = assumption.loss_fraction == null ? "" : String(Number((100 * Number(assumption.loss_fraction)).toFixed(6)));
    return [row.crop_id, {
      local_price_mxn_kg: String(assumption.local_price_mxn_kg ?? ""),
      yield_t_ha: String(assumption.yield_t_ha ?? ""),
      cost_mxn: String(assumption.cost_mxn ?? ""),
      capacity_kg: String(assumption.capacity_kg ?? ""),
      loss_fraction: percent,
      soil_cover: assumption.soil_cover ?? true,
    } satisfies Draft];
  }));
}

function toAssumption(crop_id: string, draft: Draft, baseline: Draft): Assumption {
  const changed = (field: NumericAssumption) => draft[field] === baseline[field] ? undefined : draft[field] || null;
  const capacity = changed("capacity_kg");
  const lossPercent = changed("loss_fraction");
  return {
    crop_id,
    local_price_mxn_kg: changed("local_price_mxn_kg"),
    yield_t_ha: changed("yield_t_ha"),
    cost_mxn: changed("cost_mxn"),
    capacity_kg: capacity == null ? capacity : Number(capacity),
    loss_fraction: lossPercent == null ? lossPercent : (Number(lossPercent) / 100).toFixed(6),
    soil_cover: draft.soil_cover !== baseline.soil_cover ? draft.soil_cover : undefined,
  };
}

const yieldBases: Record<string, string> = {
  municipal_median: "Rendimiento supuesto a partir de la mediana municipal.",
  demo_assumption: "Rendimiento supuesto de la demo.",
  user_assumption: "Rendimiento supuesto ingresado en el comparador.",
};

function CropResult({ row, recommended, onShowSeries }: {
  row: CycleRow;
  recommended: boolean;
  onShowSeries?: () => void;
}) {
  const economics = row.economics;
  return <li className={`cycle-row${recommended ? " cycle-row-recommended" : ""}`}>
    <h4>{row.label}</h4>
    <p className="small muted">{row.natural_rank == null ? "Sin puesto agronómico" : `Puesto agronómico ${row.natural_rank}`}
      {row.natural_score != null && ` · ${number(row.natural_score)}/2`}
    </p>
    {row.viable && <p className="small">{row.soil_pass ? "Cumple la condición de cuidado del suelo" : "Requiere mejorar la rotación o la cobertura"}</p>}
    {!row.viable && <p className="small">Fuera de la recomendación por restricciones de la ficha.</p>}
    {row.eligibility_reason && <p className="small muted">{row.eligibility_reason}</p>}
    {economics ? <>
      <dl className="facts">
        <dt>Precio estimado</dt><dd>{price(economics.price_mxn_kg)} MXN/kg</dd>
        <dt>Cosecha estimada</dt><dd>{number(economics.harvest_kg)} kg</dd>
        <dt>Volumen vendido</dt><dd>{number(economics.sold_kg)} kg</dd>
        <dt>Ingreso</dt><dd>{pesos(economics.revenue_mxn)}</dd>
        <dt>Costo total</dt><dd>{pesos(economics.cost_mxn)}</dd>
      </dl>
      <p className="small muted">{row.viable ? "Ganancia estimada" : "Ganancia solo hipotética"} · MXN</p>
      <strong className={`cycle-margin${Number(economics.margin_mxn) < 0 ? " negative" : ""}`}>{pesos(economics.margin_mxn)}</strong>
      {economics.margin_low_mxn != null && economics.margin_high_mxn != null && economics.price_basis !== "local_assumption" &&
        <p className="small muted">Rango de ganancia {pesos(economics.margin_low_mxn)} a {pesos(economics.margin_high_mxn)}</p>}
      <p className="small muted">{priceBases[economics.price_basis] ?? economics.price_basis}</p>
      {economics.reference_geography && <p className="small muted">
        {economics.reference_geography} · {economics.reference_product}
        {economics.reference_observed_month && ` · Último dato ${monthLabel(economics.reference_observed_month)}`}
      </p>}
      {onShowSeries && <a className="cycle-series-link small" href="#precios-productor" onClick={onShowSeries}>Ver serie utilizada</a>}
      {yieldBases[row.yield_basis] && <p className="small muted">{yieldBases[row.yield_basis]}</p>}
      {row.yield_reference_url && <a className="cycle-series-link small" href={row.yield_reference_url} target="_blank" rel="noreferrer">Consultar rendimiento municipal</a>}
    </> : <p className="small muted">{row.missing_reason ?? "Ganancia pendiente de datos de venta."}</p>}
    {!row.candidate_ids.length && <p className="small muted">Opción para este ciclo. La secuencia de rotación posterior queda por definir.</p>}
    {!!(row.soil_signals.length || row.soil_practice) && <details className="disclosure">
      <summary>Señales de suelo</summary>
      {row.soil_practice && <p className="small">{row.soil_practice}</p>}
      {!!row.soil_signals.length && <ul>{row.soil_signals.map((signal) => <li key={signal}>{signal}</li>)}</ul>}
    </details>}
  </li>;
}

function PriceSeries({ forecast }: { forecast: PriceForecast }) {
  const { series, points = [], annual, validation } = forecast;
  const [showHistory, setShowHistory] = useState(false);
  const rows = series.rows;
  const latest = rows.at(-1);
  const recent = rows.slice(-24);
  const lookback = latest ? new Date(`${latest.month.slice(0, 10)}T00:00:00Z`) : new Date(0);
  lookback.setUTCMonth(lookback.getUTCMonth() - 11);
  const boundary = lookback.toISOString().slice(0, 10);
  const annualHistory = rows.filter((row) => row.month >= boundary);
  const maximum = annualHistory.reduce<typeof latest>((high, row) =>
    !high || Number(row.price) > Number(high.price) ? row : high, undefined);
  const unit = series.unit.includes(series.currency) ? series.unit : `${series.currency}/${series.unit}`;
  const pointInMonth = series.observation_kind === "point_in_month";
  const scopes = [marketLabel(series), series.geography, series.product, unit, series.source_name, `Corte ${date(forecast.as_of)}`];
  return <>
    <p className="small muted">{scopes.join(" · ")}</p>
    <dl className="cycle-picks cycle-price-summary">
      {latest && <div className="cycle-pick"><dt>{pointInMonth ? "Última cotización puntual" : "Último precio mensual"}</dt>
        <dd>{price(latest.price)}<span className="small">{monthLabel(latest.month)}</span></dd></div>}
      {maximum && !pointInMonth && <div className="cycle-pick"><dt>Máximo en los 12 meses hasta el último dato</dt>
        <dd>{price(maximum.price)}<span className="small">{monthLabel(maximum.month)}{annualHistory.length < 12 && ` · ${annualHistory.length}/12 meses con dato`}</span></dd></div>}
      {annual && <div className="cycle-pick"><dt>Promedio de los próximos 12 meses</dt>
        <dd>{price(annual.central)}<span className="small">{monthLabel(annual.period_start)} a {monthLabel(annual.period_end)}</span></dd></div>}
    </dl>
    {latest?.source_note && <p className="small muted">{latest.source_note}</p>}
    <PriceTrend unit={unit}
      history={recent.map((row) => ({ month: row.month, value: Number(row.price) }))}
      projection={points.map((row) => ({ month: row.month, low: Number(row.low), central: Number(row.central), high: Number(row.high) }))} />
    {forecast.missing_reason && <p className="notice notice-warn">{forecast.missing_reason}</p>}
    {annual && <p className="small muted">Rango del promedio anual de {price(annual.low)} a {price(annual.high)} {unit}.</p>}
    {validation && <details className="disclosure">
      <summary>Método y error histórico</summary>
      <p className="small">{validation.method === "seasonal_naive"
        ? "La proyección parte del precio de cada mes en el último patrón anual disponible."
        : "La proyección parte del último precio publicado."}
        {` Error absoluto medio de ${price(validation.mae)} ${unit} en ${number(validation.observations)} pronósticos históricos.`}
      </p>
    </details>}
    {!!points.length && <details className="disclosure">
      <summary>Ver los 12 precios proyectados</summary>
      <table className="cycle-prices">
        <caption className="sr-only">Pronóstico mensual en {unit}</caption>
        <thead><tr><th scope="col">Mes</th><th scope="col">Bajo</th><th scope="col">Central</th><th scope="col">Alto</th></tr></thead>
        <tbody>{points.map((row) => <tr key={row.month}><th scope="row">{monthLabel(row.month)}</th>
          <td>{price(row.low)}</td><td>{price(row.central)}</td><td>{price(row.high)}</td></tr>)}</tbody>
      </table>
    </details>}
    {!!rows.length && <details className="disclosure" onToggle={(event) => setShowHistory(event.currentTarget.open)}>
      <summary>{pointInMonth ? "Ver cotizaciones puntuales" : "Ver historial mensual"} ({rows.length} registros)</summary>
      {showHistory && <table className="cycle-prices">
        <caption className="sr-only">{pointInMonth ? "Cotizaciones puntuales" : "Precios mensuales observados"} en {unit}</caption>
        <thead><tr><th scope="col">Mes</th><th scope="col">Precio</th></tr></thead>
        <tbody>{[...rows].reverse().map((row) => <tr key={row.month}><th scope="row">{monthLabel(row.month)}</th>
          <td>{price(row.price)}{row.source_url && <> · <a href={row.source_url} target="_blank" rel="noreferrer" aria-label={`Fuente de ${monthLabel(row.month)}`}>Fuente</a></>}</td></tr>)}</tbody>
      </table>}
    </details>}
    <div className="cycle-source-links small">
      <a href={series.source_url} target="_blank" rel="noreferrer">Consultar la fuente de {series.source_name}</a>
      {series.download_url && <a href={series.download_url} target="_blank" rel="noreferrer">Descargar datos de origen</a>}
    </div>
  </>;
}

export function CyclePlan({ context, onRefreshContext }: { context: ParcelContext; onRefreshContext: () => void }) {
  const { context_version, evaluation_state, parcel } = context;
  const ready = Boolean(context.evaluation) && evaluation_state !== "pendiente_de_recalculo";
  const [request, setRequest] = useState<CyclePlanRequest>({ context_version, price_mode: "forecast" });
  const [result, setResult] = useState<CyclePlanResult>();
  const [saleMonth, setSaleMonth] = useState("");
  const [priceMode, setPriceMode] = useState<NonNullable<CyclePlanRequest["price_mode"]>>("forecast");
  const [selectedSeries, setSelectedSeries] = useState("");
  const [defaults, setDefaults] = useState<Record<string, Draft>>();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState<{ message: string; conflict: boolean }>();
  const [loading, setLoading] = useState(ready);

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    getCyclePlan(parcel.id, request, controller.signal).then((next) => {
      if (controller.signal.aborted) return;
      const nextDrafts = initialDrafts(next.rows);
      setResult(next);
      setSaleMonth(next.sale_month);
      setPriceMode(next.price_mode);
      setDefaults((existing) => existing ?? nextDrafts);
      setDrafts(nextDrafts);
    }).catch((error: Error) => {
      if (!controller.signal.aborted) setError({ message: error.message, conflict: error instanceof ApiFailure && error.status === 409 });
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [parcel.id, ready, request]);

  function calculate(event: FormEvent) {
    event.preventDefault();
    const assumptions = Object.entries(drafts).map(([cropId, draft]) => toAssumption(cropId, draft, defaults?.[cropId] ?? draft));
    setRequest({ context_version, sale_month: saleMonth, price_mode: priceMode, assumptions: assumptions.filter(({ crop_id: _id, ...values }) =>
      Object.values(values).some((value) => value !== undefined)) });
  }

  const recommendedSeries = result?.rows.find((row) => row.crop_id === result.recommended_crop_id)?.economics?.reference_series_id;
  const forecast = result?.forecasts.find((item) => item.series.series_id === selectedSeries)
    ?? result?.forecasts.find((item) => item.series.series_id === recommendedSeries)
    ?? result?.forecasts.find((item) => item.series.geography_code === "MEX" && item.status === "available")
    ?? result?.forecasts.filter((item) => item.series.geography_code === "MEX" && item.series.observation_kind === "monthly")
      .sort((left,right) => (right.latest_observed_month ?? "").localeCompare(left.latest_observed_month ?? ""))[0]
    ?? result?.forecasts.find((item) => item.status === "available") ?? result?.forecasts[0];
  const cropName = (id: string | null | undefined) => result?.rows.find((row) => row.crop_id === id)?.label ?? "Por determinar";

  return <section className="panel cycle-plan" id="siguiente-ciclo" aria-labelledby="cycle-title">
    <h2 id="cycle-title">Siguiente ciclo</h2>
    {!ready && <p>{evaluation_state === "pendiente_de_recalculo"
      ? "Recalcula la ficha para consultar el comparador con la evidencia vigente."
      : "Prepara la demostración para proyectar el siguiente ciclo."}</p>}
    {loading && <p role="status">Calculando el plan del siguiente ciclo…</p>}
    {error && <div className="notice notice-warn" role="alert">
      <p>{error.message}</p>
      {error.conflict ? <div className="button-group"><button className="button button-secondary" type="button"
        onClick={onRefreshContext}>Cargar la ficha vigente</button></div> : !result && <div className="button-group"><button className="button button-secondary" type="button"
        onClick={() => setRequest({ ...request })}>Volver a consultar</button></div>}
    </div>}
    {result && !error?.conflict && <>
      <p>Primavera–verano · {number(result.area_ha)} ha evaluadas · Venta en {monthLabel(result.sale_month)} · Ficha v{result.context_version}</p>
      {result.price_mode === "mexican_observation" && <p className="notice notice-warn">
        Sensibilidad con los últimos precios mensuales mexicanos disponibles para los cultivos con datos comparables. Su fecha y producto se indican en cada resultado.
      </p>}
      <dl className="cycle-picks">
        <div className="cycle-pick"><dt>Mejor rotación agronómica</dt><dd>{cropName(result.natural_best_crop_id)}</dd></div>
        <div className="cycle-pick"><dt>Mayor ganancia estimada</dt><dd>{cropName(result.margin_best_crop_id)}</dd></div>
        <div className="cycle-pick cycle-recommendation"><dt>Recomendación conjunta</dt><dd>{cropName(result.recommended_crop_id)}</dd></div>
      </dl>
      <p className="notice">{result.recommendation_reason}</p>
      <div className="cycle-subsection">
        <h3>Ganancia estimada por cultivo</h3>
        <form onSubmit={calculate}>
          <fieldset className="cycle-controls" disabled={loading}>
            <div className="form-grid"><label>Mes de venta
              <select value={saleMonth} onChange={(event) => setSaleMonth(event.target.value)} aria-describedby="cycle-sale-description">
                {result.available_sale_months.map((month) => <option value={month} key={month}>{monthLabel(month)}</option>)}
              </select>
            </label><label>Escenario de precios
              <select value={priceMode} onChange={(event) => setPriceMode(event.target.value as typeof priceMode)}>
                <option value="forecast">Pronóstico vigente y supuestos</option>
                <option value="mexican_observation">Sensibilidad con precios mexicanos observados</option>
              </select>
            </label></div>
            <button className="button" type="submit">Actualizar comparación</button>
            <p className="small muted cycle-sale-description" id="cycle-sale-description">Mes supuesto dentro de la ventana general de cosecha de primavera–verano. El calendario por cultivo queda por confirmar.</p>
            <details className="disclosure cycle-assumptions">
              <summary>Ajustar supuestos por cultivo</summary>
              <p className="small muted">Supuestos para simular la venta. El costo cubre toda la superficie y el cupo limita los kilos vendidos.</p>
              {result.rows.map((row) => {
                const draft = drafts[row.crop_id];
                if (!draft) return null;
                const update = (key: keyof Draft, value: string | boolean) =>
                  setDrafts((items) => ({ ...items, [row.crop_id]: { ...items[row.crop_id], [key]: value } }));
                return <fieldset className="cycle-assumption" key={row.crop_id}>
                  <legend>{row.label}</legend>
                  <div className="form-grid">
                    {inputs.map((field) => <label key={field.name}>{field.label}
                      <input type="number" min="0" max={field.max} step={field.step} value={draft[field.name]}
                        onChange={(event) => update(field.name, event.target.value)} />
                    </label>)}
                  </div>
                  <label className="cycle-checkbox"><input type="checkbox" checked={draft.soil_cover}
                    onChange={(event) => update("soil_cover", event.target.checked)} /> Conservar cobertura del suelo</label>
                </fieldset>;
              })}
            </details>
          </fieldset>
        </form>
        <ol className="cycle-rows" aria-label="Cultivos comparados">
          {result.rows.map((row) => {
            const seriesId = row.economics?.reference_series_id;
            const hasSeries = seriesId && result.forecasts.some(({ series }) => series.series_id === seriesId);
            return <CropResult key={row.crop_id} row={row} recommended={row.crop_id === result.recommended_crop_id}
              onShowSeries={hasSeries ? () => setSelectedSeries(seriesId) : undefined} />;
          })}
        </ol>
        <p className="small muted cycle-method">{result.method_note}</p>
        <div className="cycle-source-links small">
          <a href={result.calendar_source_url} target="_blank" rel="noreferrer">Consultar el calendario agrícola</a>
          <a href={result.soil_source_url} target="_blank" rel="noreferrer">Consultar las prácticas de salud del suelo</a>
        </div>
      </div>
      <div className="cycle-subsection" id="precios-productor" aria-labelledby="producer-prices-title">
        <h3 id="producer-prices-title">Precios mensuales al productor</h3>
        {forecast ? <>
          <div className="form-grid cycle-source-select"><label>Serie de precios
            <select value={forecast.series.series_id} onChange={(event) => setSelectedSeries(event.target.value)}>
              {["México", "Referencias internacionales"].map((scope, index) => <optgroup key={scope} label={scope}>
                {result.forecasts.filter(({ series }) => (series.geography_code === "MEX") === (index === 0))
                  .map(({ series }) => <option key={series.series_id} value={series.series_id}>
                    {series.product} · {series.geography} · {series.source_name}</option>)}
              </optgroup>)}
            </select>
          </label></div>
          <PriceSeries key={forecast.series.series_id} forecast={forecast} />
        </> : <p>No hay series mensuales disponibles para los cultivos de esta ficha.</p>}
      </div>
    </>}
  </section>;
}
