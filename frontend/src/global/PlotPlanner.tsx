import { useId, useState } from "react";
import {
  appendZone, assignedArea, conditionsFor, cropColor, evaluatePlan, MAX_DEMO_AREA_HA,
  MAX_DEMO_ZONES, parseDemoArea, recommendCrop, scalePlan, setZoneArea, setZoneCrop, zoneLimit,
  type DemoPlan, type PlannerSite,
} from "./planner";
import "./PlotPlanner.css";

const quantity = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });
const money = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0, style: "currency", currency: "USD", currencyDisplay: "code" });
const formatArea = (area: number) => `${quantity.format(area)} ha`;
const formatTonnes = (tonnes: number) => `${quantity.format(tonnes)} t`;

function HectareInput({ value, max, label, inputId, allowZero, onChange }: {
  value: number;
  max: number;
  label: string;
  inputId?: string;
  allowZero?: boolean;
  onChange: (next: number) => void;
}) {
  const [edit, setEdit] = useState<{ text: string; syncedValue: number }>();
  const id = useId();
  const draft = edit?.syncedValue === value ? edit.text : undefined;
  const invalid = draft !== undefined && parseDemoArea(draft, max, allowZero) === null;
  return <div className="world-hectare-field">
    <span className="world-hectare-input">
      <input id={inputId} type="text" inputMode="decimal" aria-label={label} aria-invalid={invalid || undefined}
        aria-describedby={invalid ? id : undefined} value={draft ?? String(value)} onChange={(event) => {
          const text = event.currentTarget.value;
          const area = parseDemoArea(text, max, allowZero);
          setEdit({ text, syncedValue: area ?? value });
          if (area !== null) onChange(area);
        }} onBlur={() => { if (!invalid) setEdit(undefined); }}
        onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />
      <span aria-hidden="true">ha</span>
    </span>
    {invalid && <span className="world-plot-error" role="status" id={id}>
      Usa de {allowZero ? "0" : "0.001"} a {formatArea(max)}, con hasta tres decimales.
    </span>}
  </div>;
}

export function PlotPlanner({ site, plan, onPlanChange }: {
  site: PlannerSite;
  plan: DemoPlan;
  onPlanChange: (plan: DemoPlan) => void;
}) {
  const assigned = assignedArea(plan);
  const free = Math.round((plan.areaHa - assigned) * 1000) / 1000;
  const totals = evaluatePlan(site, plan);
  const recommendation = recommendCrop(site, plan.areaHa);
  const conditions = conditionsFor(site);
  const areaInput = useId();

  return <section className="world-planner" aria-labelledby="world-planting-title">
    <div className="world-planner-top">
      <h2 id="world-planting-title">Reparte la parcela</h2>
      <div className="world-plan-area">
        <label htmlFor={areaInput}>Superficie total</label>
        <HectareInput inputId={areaInput} label="Superficie (ha)" value={plan.areaHa} max={MAX_DEMO_AREA_HA}
          onChange={(area) => onPlanChange(scalePlan(plan, area))} />
      </div>
    </div>

    <ol className="world-zone-list" aria-label="Zonas de cultivo">
      {plan.zones.map((zone, index) => {
        const letter = String.fromCharCode(65 + index);
        return <li key={zone.id} className="world-zone">
          <span className="world-zone-color" style={{ backgroundColor: cropColor(zone.crop) }} aria-hidden="true">{letter}</span>
          <select value={zone.crop} aria-label={`Cultivo de la zona ${letter}`} onChange={(event) =>
            onPlanChange(setZoneCrop(plan, index, event.currentTarget.value))}>
            {site.crops.map((crop) => <option key={crop}>{crop}</option>)}
          </select>
          <HectareInput value={zone.areaHa} label={`Hectáreas de la zona ${letter}`} allowZero max={zoneLimit(plan, index)}
            onChange={(area) => onPlanChange(setZoneArea(plan, index, area))} />
          <button type="button" className="world-remove-zone" aria-label={`Quitar zona ${letter}`}
            title={`Quitar zona ${letter}`} disabled={plan.zones.length <= 1}
            onClick={() => onPlanChange({ ...plan, zones: plan.zones.filter(({ id }) => id !== zone.id) })}>×</button>
        </li>;
      })}
    </ol>
    <div className="world-zone-actions">
      <button type="button" disabled={plan.zones.length >= MAX_DEMO_ZONES} onClick={() => onPlanChange(appendZone(site, plan))}>
        <span aria-hidden="true">+</span> Añadir zona
      </button>
      <small role="status">{free > 0 ? `${formatArea(free)} por asignar` : `${formatArea(assigned)} asignadas`}</small>
    </div>

    <section className="world-estimate" aria-labelledby="world-estimate-title">
      <h3 id="world-estimate-title">Ganancia estimada</h3>
      <strong className={totals.marginUsd < 0 ? "world-margin world-margin-loss" : "world-margin"}>{money.format(totals.marginUsd)}</strong>
      <dl className="world-totals">
        <div><dt>Ingresos</dt><dd>{money.format(totals.revenueUsd)}</dd></div>
        <div><dt>Costos</dt><dd>{money.format(totals.costUsd)}</dd></div>
      </dl>
    </section>

    {recommendation && <section className="world-recommendation" aria-label="Comparación de opciones">
      <p className="world-recommendation-label">{recommendation.marginUsd >= 0 ? "Mejor margen simulado" : "Menor pérdida simulada"}</p>
      <div className="world-recommendation-title">
        <strong>{recommendation.crop}</strong><span>{money.format(recommendation.marginUsd)}</span>
      </div>
      <p>Con {formatArea(plan.areaHa)} de ese cultivo, el cálculo considera {recommendation.reasons.join(", ")}.</p>
    </section>}

    <details className="world-planner-details">
      <summary>Ver cálculos y supuestos</summary>
      <p>Valores simulados para un ciclo. El rendimiento se ajusta según suelo, humedad, agua y rotación. La merma y el cupo limitan la venta.</p>
      <dl className="world-assumptions">
        <div><dt>Suelo</dt><dd>{conditions.soil}</dd></div>
        <div><dt>Humedad del suelo</dt><dd>{conditions.moisturePct}%</dd></div>
        <div><dt>Agua disponible</dt><dd>{conditions.waterMm} mm</dd></div>
        <div><dt>Cultivo anterior</dt><dd>{conditions.previousCrop}</dd></div>
        <div><dt>Cosecha estimada</dt><dd>{formatTonnes(totals.harvestT)}</dd></div>
        <div><dt>Venta estimada</dt><dd>{formatTonnes(totals.soldT)}</dd></div>
      </dl>
      {totals.rows.map((row) => <p key={row.crop}>
        <strong>{row.crop}</strong> · {quantity.format(row.baseYield)} t/ha de partida,
        {" "}{Math.round(row.yieldFactor * 100)}% tras ajustar al escenario,
        {" "}{money.format(row.profile.priceUsd)}/t, {money.format(row.costPerHa)}/ha,
        {" "}{Math.round(row.profile.loss * 100)}% de merma y cupo de {formatTonnes(row.capacityT)}.
      </p>)}
      {recommendation && <dl className="world-assumptions" aria-label="Comparación por cultivo sobre toda la parcela">
        {recommendation.ranked.map((row) => <div key={row.crop}><dt>{row.crop} en toda la parcela</dt><dd>{money.format(row.marginUsd)}</dd></div>)}
      </dl>}
    </details>
  </section>;
}
