import type { FormEvent } from "react";
import type { CommercialResult, CommercialScenario } from "./api";
import { crops, number, period, pesos } from "./format";
import { YieldScenario } from "./YieldScenario";

type Structure = CommercialScenario["sales_structure"];
const structures: Record<Structure, string> = {
  spot: "Venta spot", cooperative: "Cooperativa", buyer_contract: "Contrato con comprador",
};
const presets: Record<Structure, [number, number]> = {
  spot: [6000, 12000], cooperative: [8000, 10000], buyer_contract: [8500, 9500],
};
const inputs = [
  ["superficie_ha", "Superficie evaluada (ha)"],
  ["merma_fraccion", "Merma como fracción (0 a 1)"],
  ["costos_produccion_mxn", "Producción (MXN)"],
  ["costos_empaque_mxn", "Empaque (MXN)"],
  ["costos_transporte_mxn", "Transporte (MXN)"],
  ["costos_venta_mxn", "Venta (MXN)"],
] as const;

function Metrics({ result, title, historical = false }: { result: CommercialResult; title?: string; historical?: boolean }) {
  return <figure className={`result ${historical ? "result-past" : ""}`} aria-label="Resultados del escenario comercial">
    <figcaption>
      <span>{historical ? "Margen anterior bajo supuestos comerciales" : result.label_es}{title && ` · ${title}`}</span>
      <strong>{pesos(result.margen_min_mxn)} a {pesos(result.margen_max_mxn)}</strong>
    </figcaption>
    <div className="range-info">
      <span>Cupo medio <b>{number(result.cupo_centro_kg)} kg</b></span>
      <span>Amplitud <b>{number(result.cupo_amplitud_kg)} kg</b></span>
    </div>
    {result.applied_yield && <p className="small muted">
      Cosecha simulada con {number(result.applied_yield.area_ha)} ha × {result.applied_yield.yield_t_ha} t/ha.
      {result.applied_yield.assumption.kind === "municipal_median" && <>
        {" "}Se usó la mediana de {result.applied_yield.reference_n} registros municipales
        {" "}({result.applied_yield.reference_period_start}–{result.applied_yield.reference_period_end}) como supuesto de la parcela.
      </>}
    </p>}
    {result.precio_volumen ? <p className="small muted">
      Precio por volumen supuesto · hasta {number(result.precio_volumen.umbral_kg)} kg a {result.precio_base_mxn_kg == null
        ? "precio base" : `${pesos(result.precio_base_mxn_kg)}/kg`} y el excedente a {pesos(result.precio_volumen.precio_excedente_mxn_kg)}/kg.
      El precio efectivo es el ingreso dividido entre los kilos vendidos.
    </p> : result.precio_base_mxn_kg != null && <p className="small muted">
      Precio fijo supuesto · {pesos(result.precio_base_mxn_kg)}/kg.
    </p>}
    <div className="endpoints">
      {([
        ["Cupo bajo", result.bajo],
        ["Cupo alto", result.alto],
      ] as const).map(([label, point]) => <section className="endpoint" key={label} aria-label={label}>
        <h4>{label} <span>{number(point.cupo_kg)} kg</span></h4>
        <dl className="facts">
          <dt>Disponibles</dt><dd>{number(point.kg_disponibles)} kg</dd>
          <dt>Vendidos</dt><dd>{number(point.kg_vendidos)} kg</dd>
          <dt>Sin salida</dt><dd>{number(point.kg_sin_salida)} kg</dd>
          {point.ingreso_mxn != null && <>
            <dt>Ingreso por venta</dt><dd>{pesos(point.ingreso_mxn)}</dd>
            <dt>Precio efectivo al productor</dt>
            <dd>{point.precio_efectivo_mxn_kg == null ? "Sin venta" : `${pesos(point.precio_efectivo_mxn_kg)}/kg`}</dd>
          </>}
          <dt>Margen</dt><dd className={Number(point.margen_mxn) < 0 ? "negative" : ""}>{pesos(point.margen_mxn)}</dd>
          <dt>{result.precio_volumen ? "Precio promedio de equilibrio" : "Precio de equilibrio"}</dt>
          <dd>{point.precio_equilibrio_mxn_kg === null ? "Sin dato" : `${pesos(point.precio_equilibrio_mxn_kg)}/kg`}</dd>
        </dl>
        {point.precio_equilibrio_missing_reason && <p className="small muted">{point.precio_equilibrio_missing_reason}</p>}
      </section>)}
    </div>
    <p className="small muted">Cosecha antes de merma {number(result.kg_cosechados)} kg · Costos totales {pesos(result.costos_totales_mxn)} MXN</p>
  </figure>;
}

type Props = {
  scenario: CommercialScenario;
  scenarios: CommercialScenario[];
  result?: CommercialResult;
  comparison?: CommercialResult;
  selectable: boolean;
  editing: boolean;
  dirty: boolean;
  excluded: boolean;
  busy: boolean;
  onChange: (draft: CommercialScenario) => void;
  onSelect: (id: string) => void;
  onCalculate: () => void;
  onCompare: () => void;
};

export function Commercial({
  scenario, scenarios, result, comparison, selectable, editing, dirty, excluded, busy,
  onChange, onSelect, onCalculate, onCompare,
}: Props) {
  const priceVolume = scenario.precio_volumen;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onCalculate();
  }
  return <>
    <form onSubmit={handleSubmit} className="scenario">
      <fieldset disabled={busy || !editing}>
        <legend className="sr-only">Insumos de venta</legend>
        <div className="form-grid">
          <label>Cultivo del escenario
            <select value={scenario.id} onChange={(event) => onSelect(event.target.value)} disabled={!selectable}>
              {scenarios.map((item) => <option key={item.id} value={item.id}>{crops[item.crop_id] ?? item.crop_id}</option>)}
            </select>
          </label>
          <label>Estructura de venta
            <select value={scenario.sales_structure} onChange={(event) => {
              const kind = event.target.value as Structure;
              onChange({ ...scenario, sales_structure: kind, cupo_range: [...presets[kind]], cupo_confirmacion: null });
            }}>
              {Object.entries(structures).map(([id, title]) => <option key={id} value={id}>{title}</option>)}
            </select>
          </label>
          <label>Cupo bajo (kg)
            <input type="number" min="0" max="1000000000" step="1" required value={Number.isNaN(scenario.cupo_range[0]) ? "" : scenario.cupo_range[0]}
              onChange={(event) => onChange({
                ...scenario, cupo_range: [event.target.valueAsNumber, scenario.cupo_range[1]], cupo_confirmacion: null,
              })} />
          </label>
          <label>Cupo alto (kg)
            <input type="number" min={Number.isFinite(scenario.cupo_range[0]) ? scenario.cupo_range[0] : 0}
              max="1000000000" step="1" required value={Number.isNaN(scenario.cupo_range[1]) ? "" : scenario.cupo_range[1]}
              onChange={(event) => onChange({
                ...scenario, cupo_range: [scenario.cupo_range[0], event.target.valueAsNumber], cupo_confirmacion: null,
              })} />
          </label>
        </div>
        <p className="small muted">Ventana de venta supuesta · {period(scenario.sales_period)}</p>
        {excluded && <p className="notice notice-warn">Rotación excluida. Puedes explorar su venta como hipótesis comercial.</p>}
        <h3>Precio al productor</h3>
        <p className="small muted" id="producer-price-help">Los precios de este escenario son editables y se usan como supuestos. SNIIM aporta cotizaciones mayoristas y USDA, producción nacional.</p>
        <div className="form-grid">
          <div className="reference-field">
            <label htmlFor="scenario-price-mode">Modelo de precio</label>
            <select id="scenario-price-mode" aria-describedby="producer-price-help" value={priceVolume ? "volume" : "fixed"}
              onChange={(event) => onChange({
                ...scenario,
                precio_volumen: event.target.value === "volume" ? {
                  umbral_kg: 6000, precio_excedente_mxn_kg: "8", evidence_tier: "simulated_assumption",
                } : null,
              })}>
              <option value="fixed">Precio fijo</option>
              <option value="volume">Precio por volumen vendido</option>
            </select>
          </div>
          <div className="reference-field">
            <label htmlFor="scenario-price-base">{priceVolume ? "Precio base al productor" : "Precio al productor"} (MXN/kg)</label>
            <input id="scenario-price-base" type="number" min="0" step="0.000001" required value={scenario.precio_productor_mxn_kg}
              onChange={(event) => onChange({ ...scenario, precio_productor_mxn_kg: event.target.value })} />
          </div>
          {priceVolume && <>
            <div className="reference-field">
              <label htmlFor="scenario-price-threshold">Kilos al precio base (kg)</label>
              <input id="scenario-price-threshold" type="number" min="1" max="1000000000" step="1" required
                value={Number.isNaN(priceVolume.umbral_kg) ? "" : priceVolume.umbral_kg}
                onChange={(event) => onChange({
                  ...scenario, precio_volumen: { ...priceVolume, umbral_kg: event.target.valueAsNumber },
                })} />
            </div>
            <div className="reference-field">
              <label htmlFor="scenario-price-extra">Precio por kilo adicional (MXN/kg)</label>
              <input id="scenario-price-extra" type="number" min="0" step="0.000001" required
                value={priceVolume.precio_excedente_mxn_kg}
                onChange={(event) => onChange({
                  ...scenario, precio_volumen: { ...priceVolume, precio_excedente_mxn_kg: event.target.value },
                })} />
            </div>
          </>}
        </div>
        {priceVolume && <p className="small muted">Los primeros kilos vendidos se pagan al precio base hasta el umbral. Solo los kilos adicionales se pagan al precio del segundo tramo.</p>}
        <YieldScenario cropId={scenario.crop_id} cycle={scenario.agricultural_cycle ?? null}
          value={scenario.rendimiento_esperado_t_ha} source={scenario.yield_assumption ?? null}
          onCycleChange={(cycle) => onChange({
            ...scenario, agricultural_cycle: cycle, yield_assumption: null,
            rendimiento_esperado_t_ha: scenario.yield_assumption?.kind === "municipal_median" ? "" : scenario.rendimiento_esperado_t_ha,
          })}
          onValueChange={(value) => onChange({
            ...scenario, rendimiento_esperado_t_ha: value, yield_assumption: { kind: "manual" },
          })}
          onUseReference={(referenceId, value) => onChange({
            ...scenario, rendimiento_esperado_t_ha: value,
            yield_assumption: { kind: "municipal_median", reference_id: referenceId },
          })} />
        <details className="disclosure">
          <summary>Supuestos del cálculo</summary>
          <p className="small muted">El historial de Don Tino registra cultivos. El rendimiento de la parcela se simula con el valor ingresado.</p>
          <div className="form-grid">
            {inputs.map(([id, label]) => <label key={id}>{label}
              <input type="number" required min={id === "superficie_ha" ? "0.000001" : "0"} max={id === "merma_fraccion" ? "1" : undefined}
                step="0.000001" value={scenario[id]} onChange={(event) => onChange({ ...scenario, [id]: event.target.value })} />
            </label>)}
          </div>
          <ul>{scenario.supuestos?.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
        </details>
        <div className="button-group">
          <button className="button" type="submit">Calcular margen</button>
          <button className="button button-secondary" type="button" onClick={(event) => {
            if (event.currentTarget.form?.reportValidity()) onCompare();
          }}>Comparar spot y cooperativa</button>
        </div>
      </fieldset>
    </form>
    {dirty && result && <p className="notice notice-warn" role="status">El resultado visible corresponde a los insumos anteriores.</p>}
    {result && <Metrics result={result} title={comparison ? structures.spot : undefined} />}
    {comparison && <>
      <Metrics result={comparison} title={structures.cooperative} />
      <p className="small">La comparación usa cupos con centro de 9.000 kg y amplitudes distintas. Mantiene iguales los supuestos de precio, los costos y el volumen disponible.</p>
    </>}
  </>;
}

export function HistoricalMargin({ result, version, scenario }: {
  result?: CommercialResult;
  version?: number;
  scenario?: CommercialScenario;
}) {
  if (!result) return null;
  return <div className="past">
    <p className="small muted">Resultado obsoleto · Ficha v{version}</p>
    <Metrics result={result} historical title={scenario ? crops[scenario.crop_id] ?? scenario.crop_id : undefined} />
  </div>;
}

