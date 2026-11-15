import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type PointerEvent } from "react";
import {
  ApiFailure, getSowingPlan, previewSowingPlan, saveSowingDraft, shareSowingPlan,
  type ParcelContext, type SowingPlanInput, type SowingPlanResult, type SowingPlanState,
} from "./api";
import { SourceLine } from "./Evidence";
import { ActionFeedback } from "./ActionFeedback";
import { number, period, pesoRate, pesos } from "./format";
import { areaText, areaUnits } from "./parcelArea";
import "./PlantingPlanner.css";

type CropId = SowingPlanInput["zones"][number]["crop_id"];
type FieldZone = { zone_id: string; crop_id: CropId; area_ha: string };
type CropEconomics = NonNullable<SowingPlanInput["crop_economics"]>[number];
type EconomicField = "cost_per_ha" | "sale_capacity_kg" | "yield_t_ha" | "price_mxn_kg" | "loss_fraction";
type EconomicValue = NonNullable<CropEconomics[EconomicField]>;
type Editor = { area: string; zones: FieldZone[]; economics: CropEconomics[] };
type Step = 0 | 1 | 2;
type CropOption = SowingPlanState["crop_options"][number];

const STEPS = ["Superficie", "Reparto", "Resumen"];
const MAX_ZONES = 6;
const ECONOMIC_FIELDS = {
  yield_t_ha: { label: "Rendimiento (t/ha)", name: "Rendimiento", decimals: 6 },
  price_mxn_kg: { label: "Precio al productor (MXN/kg)", name: "Precio", decimals: 6 },
  loss_fraction: { label: "Merma (%)", name: "Merma", decimals: 4 },
  cost_per_ha: { label: "Costo por hectárea (MXN/ha)", name: "Costo", decimals: 6 },
  sale_capacity_kg: { label: "Cupo total de venta (kg)", name: "Cupo", decimals: 3 },
} as const;
const economicFields = Object.keys(ECONOMIC_FIELDS) as EconomicField[];
const demoFields: EconomicField[] = ["cost_per_ha", "sale_capacity_kg"];

function zoneName(id: string) {
  return id.replace(/^zone-/, "").toUpperCase();
}

const hectares = (units: number) => `${number(units / 1000)} ha`;

function resizePlan(editor: Editor, area: number): Editor {
  const sizes = editor.zones.map((zone) => areaUnits(zone.area_ha));
  const assigned = sizes.reduce<number>((sum, size) => sum + (size ?? 0), 0);
  if (assigned <= area || area === areaUnits(editor.area)) return { ...editor, area: areaText(area) };

  const total = BigInt(assigned);
  const parts = sizes.map((size, index) => {
    const scaled = BigInt(size ?? 0) * BigInt(area);
    return { index, units: Number(scaled / total), remainder: scaled % total };
  });
  // Reparte las milésimas que sobran después de redondear para que las zonas sumen el área exacta.
  const leftover = area - parts.reduce((sum, part) => sum + part.units, 0);
  const byRemainder = [...parts].sort((left, right) => left.remainder === right.remainder
    ? left.index - right.index : left.remainder > right.remainder ? -1 : 1);
  for (const part of byRemainder.slice(0, leftover)) part.units += 1;
  return { ...editor, area: areaText(area), zones: editor.zones.map((zone, index) => sizes[index] == null
    ? zone : { ...zone, area_ha: areaText(parts[index].units) }) };
}

function fromState(state: SowingPlanState): Editor {
  const plan = state.draft?.plan ?? state.default_input;
  return { area: String(Number(plan.area_ha)), zones: plan.zones.map(({ zone_id, crop_id, area_ha }) => ({
    zone_id, crop_id, area_ha: String(Number(area_ha)),
  })), economics: (plan.crop_economics ?? []).map((row) => row.loss_fraction ? {
    ...row, loss_fraction: { ...row.loss_fraction, value: Number((Number(row.loss_fraction.value) * 100).toFixed(4)) },
  } : row) };
}

function activeCrops(editor: Editor) {
  return new Set(editor.zones.filter((zone) => (areaUnits(zone.area_ha) ?? 0) > 0).map((zone) => zone.crop_id));
}

function activeEconomics(editor: Editor) {
  const active = activeCrops(editor);
  return editor.economics.filter((entry) => active.has(entry.crop_id));
}

function requestedEconomics(editor: Editor) {
  return activeEconomics(editor).flatMap((row) => {
    const result: CropEconomics = { crop_id: row.crop_id };
    for (const field of economicFields) {
      const term = row[field];
      if (!term || String(term.value).trim() === "") continue;
      const decimal = String(term.value).trim().replace(",", ".");
      result[field] = { ...term, value: field === "loss_fraction" ? (Number(decimal) / 100).toFixed(6) : decimal };
    }
    return economicFields.some((field) => result[field]) ? [result] : [];
  });
}

function normalizedDecimal(value: string | number) {
  const [integer, fraction = ""] = String(value).split(".");
  return `${integer.replace(/^0+(?=\d)/, "") || "0"}.${fraction.replace(/0+$/, "")}`;
}

function sameEconomicValue(left: EconomicValue | null | undefined, right: EconomicValue | null | undefined) {
  if (!left || !right) return !left && !right;
  return normalizedDecimal(left.value) === normalizedDecimal(right.value) && left.basis === right.basis
    && (left.source?.trim() ?? "") === (right.source?.trim() ?? "");
}

function samePlan(editor: Editor, plan: SowingPlanResult | undefined) {
  if (!plan?.economics || areaUnits(editor.area) !== areaUnits(plan.area_ha) || editor.zones.length !== plan.zones.length) return false;
  const inputs = requestedEconomics(editor);
  const saved = plan.crop_economics ?? [];
  return editor.zones.every((zone, index) => zone.zone_id === plan.zones[index].zone_id
      && zone.crop_id === plan.zones[index].crop_id && areaUnits(zone.area_ha) === areaUnits(plan.zones[index].area_ha))
    && inputs.length === saved.length && inputs.every((row) => {
      const match = saved.find((entry) => entry.crop_id === row.crop_id);
      return match && economicFields.every((field) => sameEconomicValue(row[field], match[field]));
    });
}

function surfaceIssue(area: number | null, available: number) {
  if (!area) return "Escribe una superficie mayor que cero, con hasta tres decimales.";
  if (area > available) return `Tu parcela tiene ${hectares(available)} registradas. Usa esa cantidad o menos.`;
  return "";
}

function issueFor(editor: Editor, available: number, step: Step) {
  const area = areaUnits(editor.area) ?? 0;
  const problem = surfaceIssue(area, available);
  if (problem) return { message: problem, field: "sowing-area" };
  if (step === 0) return null;
  let assigned = 0;
  for (const zone of editor.zones) {
    const size = areaUnits(zone.area_ha);
    if (size === null) return {
      message: `Escribe las hectáreas de la zona ${zoneName(zone.zone_id)}. Usa cero si quedará sin sembrar.`,
      field: `sowing-${zone.zone_id}-area`,
    };
    assigned += size;
  }
  const firstField = `sowing-${editor.zones[0].zone_id}-area`;
  if (!assigned) return { message: "Asigna hectáreas a por lo menos un cultivo.", field: firstField };
  if (assigned > area) return {
    message: `El reparto supera la superficie del plan por ${hectares(assigned - area)}. Reduce las hectáreas de una zona.`,
    field: firstField,
  };
  return null;
}

function economicIssue(editor: Editor) {
  for (const row of activeEconomics(editor)) {
    for (const field of economicFields) {
      const value = row[field];
      if (!value) continue;
      const { label, decimals } = ECONOMIC_FIELDS[field];
      const fieldId = `sowing-${row.crop_id}-${field}`;
      const decimal = String(value.value).trim().replace(",", ".");
      if (!decimal) continue;
      const pattern = new RegExp(`^(?:\\d+(?:\\.\\d{0,${decimals}})?|\\.\\d{1,${decimals}})$`);
      if (!pattern.test(decimal) || decimal.split(".")[0].replace(/^0+/, "").length > 10) {
        return { message: `Revisa ${label.toLowerCase()}. Usa una cantidad de cero o más, con hasta ${decimals} decimales.`, field: fieldId };
      }
      if (field === "loss_fraction" && Number(decimal) > 100) return { message: "La merma debe estar entre 0 y 100 %.", field: fieldId };
      if (value.basis === "reported" && !value.source?.trim()) {
        return { message: "Indica la referencia del dato reportado, por ejemplo, un folio de presupuesto o un pedido del comprador.", field: `${fieldId}-source` };
      }
    }
  }
  return null;
}

function CropEconomicsEditor({ workspace, editor, invalidField, demo, onChange }: {
  workspace: SowingPlanState;
  editor: Editor;
  invalidField: string;
  demo: boolean;
  onChange: (crop: CropId, changes?: Partial<CropEconomics>) => void;
}) {
  const crops = activeCrops(editor);
  if (!crops.size) return null;
  const fields = demo ? demoFields : economicFields;

  return <details className="sowing-terms disclosure">
    <summary>{demo ? "Costos y cupos de venta" : "Datos para estimar la cosecha y la ganancia"}</summary>
    <p className="sowing-copy">{demo
      ? "Se usa el cupo confirmado de la cooperativa si corresponde al mes de venta. Las zonas del mismo cultivo comparten ese cupo."
      : "Agrega el rendimiento esperado para estimar la cosecha. Para calcular la ganancia también hacen falta precio, costos, merma y cupo de venta, ya sean capturados o disponibles como referencias."}</p>
    {workspace.crop_options.filter((entry) => crops.has(entry.crop_id)).map((entry) => {
      const label = entry.label;
      const override = editor.economics.find((item) => item.crop_id === entry.crop_id);
      const defaults = workspace.default_crop_economics.find((item) => item.crop_id === entry.crop_id);
      const confirmation = workspace.cooperative_capacities?.find((item) => item.crop_id === entry.crop_id);
      const terms = fields.map((field) => {
        const savedValue = override?.[field];
        const value = savedValue ?? (field === "cost_per_ha" || field === "sale_capacity_kg" ? defaults?.[field] : undefined);
        const id = `sowing-${entry.crop_id}-${field}`;
        return { field, savedValue, value, id, editValue: (changes: Partial<EconomicValue>) => onChange(entry.crop_id, {
          [field]: { value: value?.value ?? "", basis: value?.basis ?? "assumption", source: savedValue?.source ?? null, ...changes },
        }) };
      });
      const originControls = ({ field, value, id, editValue }: typeof terms[number]) => {
        const name = ECONOMIC_FIELDS[field].name.toLowerCase();
        return <div className="sowing-term" key={field}>
          <label className="sowing-input">{`Origen · ${name}`}
            <select value={value?.basis ?? "assumption"} onChange={(event) => {
              const reported = event.currentTarget.value === "reported";
              editValue({ basis: reported ? "reported" : "assumption", source: reported ? value?.source ?? "" : null });
            }}>
              <option value="assumption">Supuesto</option><option value="reported">Dato reportado</option>
            </select>
          </label>
          {value?.basis === "reported" && <label className="sowing-input">{`Referencia · ${name}`}
            <input type="text" id={`${id}-source`} maxLength={180} value={value.source ?? ""}
              aria-invalid={invalidField === `${id}-source` || undefined} aria-describedby={invalidField === `${id}-source` ? "sowing-error" : undefined}
              onChange={(event) => editValue({ source: event.currentTarget.value })} />
          </label>}
        </div>;
      };
      const documented = terms.filter(({ value }) => value && String(value.value).trim());
      return <fieldset className="sowing-zone sowing-term-crop" key={entry.crop_id}>
        <legend>{label}</legend>
        {confirmation && <div className="sowing-capacity-note">
          <strong>Cupo confirmado por la cooperativa</strong>
          <span>Se usan {number(confirmation.cupo_range[0])} kg para estimar la venta. Rango confirmado de {number(confirmation.cupo_range[0])} a {number(confirmation.cupo_range[1])} kg.</span>
          <span>{period(confirmation.sales_period)} · <SourceLine source={confirmation.source} /></span>
        </div>}
        <div className="sowing-zone-fields">
          {terms.map((term) => {
            const { field, value, id, editValue } = term;
            return <div className="sowing-term" key={field}>
              <label className="sowing-input">{confirmation && field === "sale_capacity_kg" ? "Cupo de respaldo (kg)" : ECONOMIC_FIELDS[field].label}
                <input type="text" id={id} inputMode="decimal" value={value?.value ?? ""}
                  aria-invalid={invalidField === id || undefined} aria-describedby={invalidField === id ? "sowing-error" : undefined}
                  onChange={(event) => editValue({ value: event.currentTarget.value })} />
              </label>
              {!demo && field === "yield_t_ha" && entry.yield_reference_url && entry.yield_t_ha != null && <small>
                <a href={entry.yield_reference_url} target="_blank" rel="noreferrer">Referencia municipal · {number(entry.yield_t_ha)} t/ha</a>
              </small>}
              {demo && originControls(term)}
            </div>;
          })}
        </div>
        {!demo && documented.length > 0 && <details className="disclosure"><summary>Documentar origen de las cifras</summary>
          <div className="sowing-zone-fields">{documented.map(originControls)}</div>
        </details>}
        {demo && override && <button className="sowing-text-button" type="button" onClick={() => onChange(entry.crop_id)}>Usar supuestos de la demo para {label.toLowerCase()}</button>}
      </fieldset>;
    })}
  </details>;
}

function FieldSketch({ editor, crops, waitingForArea, onResize }: {
  editor: Editor;
  crops: CropOption[];
  waitingForArea: boolean;
  onResize?: (leftId: string, leftUnits: number, rightId: string | null, rightUnits: number) => void;
}) {
  const tracks = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; offset: number } | null>(null);
  const area = areaUnits(editor.area) ?? 0;
  const zones = editor.zones.map((zone) => ({
    id: zone.zone_id, crop: crops.find((crop) => crop.crop_id === zone.crop_id), units: areaUnits(zone.area_ha) ?? 0,
  }));
  const assigned = zones.reduce((sum, zone) => sum + zone.units, 0);
  const remainder = Math.max(0, area - assigned);
  const scale = Math.max(area, assigned);
  const canResize = Boolean(onResize && area && assigned <= area && editor.zones.every((zone) => areaUnits(zone.area_ha) !== null));
  const boundaries = zones.flatMap((left, index) => {
    const right = zones[index + 1];
    const total = left.units + (right?.units ?? remainder);
    if (total === 0) return [];
    const before = zones.slice(0, index).reduce((sum, zone) => sum + zone.units, 0);
    return [{ left, right, total, before, position: before + left.units }];
  });

  return <figure className="sowing-sketch" aria-labelledby="sowing-map-title">
    <div className="sowing-sketch-heading">
      <h3 id="sowing-map-title">Croquis de siembra</h3>
      <strong>{hectares(area)}</strong>
    </div>
    <div className={`sowing-map${canResize ? " sowing-map-editable" : ""}`}>
      <div className="sowing-map-tracks" ref={tracks} aria-hidden="true">
        {scale > 0 && zones.filter((zone) => zone.units > 0).map((zone) => (
          <div className="sowing-map-zone" data-crop={zone.crop?.crop_id} key={zone.id} style={{ flexBasis: `${100 * zone.units / scale}%` }}>
            {zone.units / scale >= 0.10 && <span>{zoneName(zone.id)}</span>}
          </div>
        ))}
      </div>
      {canResize && <div className="sowing-boundaries">
        {boundaries.map(({ left, right, total, before, position }, index) => {
          const leftName = `Zona ${zoneName(left.id)}`;
          const rightName = right ? `zona ${zoneName(right.id)}` : "superficie sin asignar";
          const shared = boundaries.some((other, otherIndex) => otherIndex !== index && other.position === position);
          const adjust = (requested: number) => {
            const size = Math.max(0, Math.min(total, requested));
            if (size !== left.units) onResize?.(left.id, size, right?.id ?? null, total - size);
          };
          function keyDown(event: KeyboardEvent<HTMLButtonElement>) {
            const step = event.shiftKey ? 1 : Math.max(1, Math.min(100, Math.round(area / 100)));
            switch (event.key) {
              case "Home": adjust(0); break;
              case "End": adjust(total); break;
              case "ArrowLeft": case "ArrowDown": adjust(left.units - step); break;
              case "ArrowRight": case "ArrowUp": adjust(left.units + step); break;
              default: return;
            }
            event.preventDefault();
          }
          function startDrag(event: PointerEvent<HTMLButtonElement>) {
            if (event.button !== 0 || !event.isPrimary) return;
            const rect = tracks.current?.getBoundingClientRect();
            if (!rect?.width) return;
            drag.current = { pointer: event.pointerId, offset: event.clientX - (rect.left + rect.width * position / area) };
            event.currentTarget.setPointerCapture(event.pointerId);
          }
          function moveDrag(event: PointerEvent<HTMLButtonElement>) {
            if (drag.current?.pointer !== event.pointerId) return;
            const rect = tracks.current?.getBoundingClientRect();
            if (!rect?.width) return;
            const current = (event.clientX - drag.current.offset - rect.left) / rect.width;
            adjust(Math.round(current * area) - before);
          }
          return <button type="button" key={left.id} className="sowing-boundary" role="slider"
            aria-label={`Límite entre ${leftName.toLowerCase()} y ${rightName}`}
            aria-valuemin={0} aria-valuemax={total / 1000} aria-valuenow={left.units / 1000}
            aria-valuetext={`${leftName}, ${hectares(left.units)}. ${rightName}, ${hectares(total - left.units)}.`}
            aria-describedby="sowing-map-instructions"
            style={{ left: `${100 * position / area}%`, top: shared ? `${(100 * (index + 1)) / (boundaries.length + 1)}%` : undefined }}
            onKeyDown={keyDown} onPointerDown={startDrag} onPointerMove={moveDrag}
            onPointerUp={moveDrag} onLostPointerCapture={() => { drag.current = null; }}>
            <span aria-hidden="true">↔</span>
          </button>;
        })}
      </div>}
    </div>
    <figcaption id="sowing-map-instructions">{waitingForArea ? "El croquis se actualizará al ingresar una superficie válida."
      : canResize ? <>Arrastra los separadores para ajustar las zonas.<span className="sowing-keyboard-help"> También puedes usar las flechas y Mayús + flechas para cambios de 0.001 ha.</span></>
        : "Es un reparto aproximado para planificar la siembra."}</figcaption>
    <ul className="sowing-map-key">
      {zones.filter((zone) => zone.units > 0).map((zone) => <li key={zone.id}>
        <span className="sowing-map-key-label"><span className="sowing-key-mark" data-crop={zone.crop?.crop_id} aria-hidden="true" />
          Zona {zoneName(zone.id)} · {zone.crop?.label ?? zone.crop?.crop_id}</span>
        <strong>{hectares(zone.units)}</strong>
      </li>)}
      {remainder > 0 && <li><span className="sowing-map-key-label"><span className="sowing-key-mark" aria-hidden="true" /> Sin asignar</span>
        <strong>{hectares(remainder)}</strong></li>}
      {assigned > area && <li className="sowing-overflow">El reparto supera el plan por {hectares(assigned - area)}. Ajusta las zonas para continuar.</li>}
    </ul>
  </figure>;
}

export function PlantingPlanner({ context, onShared, onEditRegisteredArea }: {
  context: ParcelContext;
  onShared?: () => void;
  onEditRegisteredArea?: () => void;
}) {
  const parcelId = context.parcel.id;
  const demo = context.producer.persona_kind === "composite_demo";
  const [workspace, setWorkspace] = useState<SowingPlanState>();
  const [editor, setEditor] = useState<Editor>();
  const [surfaceInput, setSurfaceInput] = useState<string>();
  const [step, setStep] = useState<Step>(0);
  const [preview, setPreview] = useState<SowingPlanResult>();
  const [message, setMessage] = useState("");
  const [versionNotice, setVersionNotice] = useState("");
  const [error, setError] = useState("");
  const [invalidField, setInvalidField] = useState("");
  const [busy, setBusy] = useState("");
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const loadedParcel = useRef<string | undefined>(undefined);
  const title = useRef<HTMLHeadingElement>(null);
  const focusStep = useRef(false);
  const active = useRef(0);

  useEffect(() => {
    const loader = new AbortController();
    const initialize = loadedParcel.current !== parcelId;
    active.current += 1;
    setLoading(true);
    setBusy("");
    setPreview(undefined);
    setError("");
    setMessage("");
    setVersionNotice("");
    if (initialize) {
      setWorkspace(undefined);
      setEditor(undefined);
      setSurfaceInput(undefined);
      setStep(0);
    }
    getSowingPlan(parcelId, loader.signal).then((state) => {
      if (loader.signal.aborted) return;
      loadedParcel.current = parcelId;
      setWorkspace(state);
      setEditor((current) => !current || initialize ? fromState(state) : current);
      if (state.draft && state.draft.plan.context_version !== state.context_version) {
        setVersionNotice(`La ficha cambió a la versión ${state.context_version}. Vuelve a calcular tu plan antes de compartirlo.`);
      }
    }).catch((failure: Error) => {
      if (!loader.signal.aborted) setError(failure.message);
    }).finally(() => {
      if (!loader.signal.aborted) setLoading(false);
    });
    return () => loader.abort();
  }, [parcelId, context.context_version, retry]);

  useEffect(() => {
    if (focusStep.current) {
      title.current?.focus();
      focusStep.current = false;
    }
  }, [step]);

  function goTo(next: Step) {
    setError("");
    setInvalidField("");
    focusStep.current = true;
    setStep(next);
  }

  function edit(next: Editor) {
    setError("");
    setInvalidField("");
    setMessage("");
    setPreview(undefined);
    setEditor(next);
  }

  async function operation(label: string, action: (operationId: number) => Promise<void>) {
    const operationId = ++active.current;
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await action(operationId);
    } catch (failure) {
      if (active.current !== operationId) return;
      if (failure instanceof ApiFailure && failure.status === 409) {
        try {
          const state = await getSowingPlan(parcelId);
          if (active.current !== operationId) return;
          setWorkspace(state);
          setPreview(undefined);
          setError("El plan o la ficha cambió. Conservamos tus cambios. Revisa el cálculo y vuelve a guardar si quieres usar este reparto.");
        } catch {
          if (active.current === operationId) setError(failure.message);
        }
      } else {
        setError(failure instanceof Error ? failure.message : "La operación quedó pendiente. Intenta de nuevo.");
      }
    } finally {
      if (active.current === operationId) setBusy("");
    }
  }

  if (!workspace || !editor) {
    return <section id="plan-siembra" className="panel sowing-planner" aria-labelledby="plan-siembra-title">
      <h2 id="plan-siembra-title">Plan de siembra</h2>
      {error ? <>
        <p className="notice notice-warn" role="alert">{error}</p>
        <button className="button" type="button" onClick={() => setRetry((value) => value + 1)}>Volver a cargar el plan</button>
      </> : <ActionFeedback pending="Cargando el plan de siembra…" />}
    </section>;
  }

  const available = areaUnits(workspace.declared_area_ha, true) ?? 0;
  const surfaceText = surfaceInput ?? editor.area;
  const nextArea = areaUnits(surfaceText);
  const sizeIssue = surfaceIssue(nextArea, available);
  const inlineAreaIssue = (surfaceText.trim() || invalidField === "sowing-area") ? sizeIssue : "";
  const sketch = step === 0 && nextArea && !sizeIssue ? resizePlan(editor, nextArea) : editor;
  const area = areaUnits(editor.area) ?? 0;
  const assigned = editor.zones.reduce((sum, zone) => sum + (areaUnits(zone.area_ha) ?? 0), 0);
  const draft = workspace.draft?.plan;
  const draftVersion = workspace.draft?.plan_version ?? 0;
  const matchingConfirmations = draft?.economics?.crops.every((crop) => crop.capacity_confirmation?.id
    === workspace.cooperative_capacities?.find((item) => item.crop_id === crop.crop_id)?.id);
  const isCurrentDraft = draft?.context_version === workspace.context_version
    && draft.economics?.sale_month === workspace.sale_month && matchingConfirmations && samePlan(editor, draft);
  const canShare = isCurrentDraft && workspace.shared_version !== draftVersion;
  const currentPreview = preview ?? (isCurrentDraft ? draft : undefined);
  const locked = loading || Boolean(busy);

  const toInput = (): SowingPlanInput => ({
    context_version: workspace.context_version, area_ha: areaText(area),
    zones: editor.zones.map(({ zone_id, crop_id, area_ha }) => ({ zone_id, crop_id, area_ha: areaText(areaUnits(area_ha) ?? 0) })),
    crop_economics: requestedEconomics(editor),
  });

  const check = (stepToCheck: Step) => {
    const candidate = stepToCheck === 0 ? { ...editor, area: surfaceText } : editor;
    const issue = issueFor(candidate, available, stepToCheck) ?? (stepToCheck > 0 ? economicIssue(editor) : null);
    if (!issue) return true;
    setError(issue.field === "sowing-area" ? "" : issue.message);
    setInvalidField(issue.field);
    const targetStep = issue.field === "sowing-area" ? 0 : 1;
    if (step !== targetStep) {
      setStep(targetStep);
    }
    requestAnimationFrame(() => {
      const field = document.getElementById(issue.field);
      for (let details = field?.closest<HTMLDetailsElement>("details"); details; details = details.parentElement?.closest<HTMLDetailsElement>("details")) {
        details.open = true;
      }
      field?.focus();
    });
    return false;
  };

  function calculate(event: FormEvent) {
    event.preventDefault();
    if (locked || !check(step)) return;
    if (step === 0) {
      setEditor(sketch);
      setSurfaceInput(undefined);
      return goTo(1);
    }
    void operation("Calculando cosecha y ganancia…", async (operationId) => {
      const result = await previewSowingPlan(parcelId, toInput());
      if (active.current !== operationId) return;
      setPreview(result);
      if (step === 1) goTo(2);
    });
  }

  function save() {
    if (locked || !check(2)) return;
    void operation("Guardando el borrador…", async (operationId) => {
      const result = await saveSowingDraft(parcelId, draftVersion, toInput());
      if (active.current !== operationId) return;
      setWorkspace((state) => state && { ...state, draft: result });
      setPreview(result.plan);
      setVersionNotice("");
      setMessage(`Borrador v${result.plan_version} guardado. Puedes compartirlo desde aquí para que se vea en Métricas.`);
    });
  }

  function share() {
    if (locked || !canShare) return;
    void operation("Compartiendo el plan…", async (operationId) => {
      const result = await shareSowingPlan(parcelId, draftVersion);
      if (active.current !== operationId) return;
      setWorkspace((state) => state && { ...state, draft: result, shared_version: result.plan_version });
      setMessage(`Plan v${result.plan_version} compartido. Ya está disponible en Métricas.`);
      onShared?.();
    });
  }

  const updateZone = (id: string, changes: Partial<FieldZone>) => {
    edit({ ...editor, zones: editor.zones.map((zone) => zone.zone_id === id ? { ...zone, ...changes } : zone) });
  };

  const updateBoundary = (leftId: string, leftUnits: number, rightId: string | null, rightUnits: number) => {
    edit({ ...sketch, zones: sketch.zones.map((zone) => {
      if (zone.zone_id === leftId) return { ...zone, area_ha: areaText(leftUnits) };
      if (zone.zone_id === rightId) return { ...zone, area_ha: areaText(rightUnits) };
      return zone;
    }) });
  };

  const updateEconomics = (crop: CropId, changes?: Partial<CropEconomics>) => {
    const other = editor.economics.filter((entry) => entry.crop_id !== crop);
    const current = editor.economics.find((entry) => entry.crop_id === crop);
    edit({ ...editor, economics: changes ? [...other, { ...current, ...changes, crop_id: crop }] : other });
  };

  const addZone = () => {
    if (editor.zones.length >= MAX_ZONES) return;
    const letter = "abcdef".split("").find((value) => editor.zones.every((zone) => zone.zone_id !== `zone-${value}`));
    if (!letter) return;
    edit({ ...editor, zones: [...editor.zones, { zone_id: `zone-${letter}`, crop_id: workspace.crop_options[0].crop_id, area_ha: "0" }] });
    requestAnimationFrame(() => document.getElementById(`sowing-zone-${letter}-crop`)?.focus());
  };

  return <section id="plan-siembra" className="panel sowing-planner" aria-labelledby="plan-siembra-title">
    <div className="sowing-lead">
      <h2 id="plan-siembra-title">Plan de siembra por zonas</h2>
      <p>Primavera–verano{currentPreview ? ` ${currentPreview.campaign_year}` : ""}</p>
    </div>
    <ol className="sowing-steps" data-step={step} aria-label="Pasos del plan de siembra">
      {STEPS.map((label, index) => <li key={label} aria-current={index === step ? "step" : undefined}>
        <span aria-hidden="true">{index + 1}</span> {label}</li>)}
    </ol>
    <div className="sowing-layout" data-step={step}>
      <form onSubmit={calculate} noValidate>
        <h3 ref={title} tabIndex={-1}>{step === 0 ? "¿Cuánta tierra vas a sembrar?" : step === 1 ? "¿Qué vas a sembrar en cada zona?" : "Este es tu plan de siembra"}</h3>
        <fieldset disabled={locked}>
          {step === 0 && <>
            <label className="sowing-input" htmlFor="sowing-area">Hectáreas para este plan
              <input type="text" id="sowing-area" inputMode="decimal" value={surfaceText}
                aria-invalid={Boolean(inlineAreaIssue) || undefined}
                aria-describedby={inlineAreaIssue ? "sowing-area-help sowing-area-warning" : "sowing-area-help"}
                onChange={(event) => {
                  setSurfaceInput(event.currentTarget.value);
                  edit(editor);
                }} />
            </label>
            <p id="sowing-area-help" className="sowing-copy">{demo
              ? `Puedes usar hasta ${hectares(available)}. Si las zonas ya no caben, se ajustan en la misma proporción.`
              : `Tu ficha tiene ${hectares(available)}. Puedes planear la siembra de toda la parcela o de una parte.`}</p>
            <p id="sowing-area-warning" className="sowing-area-warning" role="status">{inlineAreaIssue}</p>
            {nextArea != null && nextArea > available && (onEditRegisteredArea
              ? <button className="sowing-text-button" type="button" onClick={onEditRegisteredArea}>Cambiar superficie registrada</button>
              : <a className="sowing-text-button" href="#registered-area-action">Cambiar superficie registrada</a>)}
            <div className="sowing-actions"><button className="button" type="submit">Repartir la parcela</button></div>
          </>}
          {step === 1 && <>
            <p className="sowing-balance" role="status">{assigned > area
              ? `${hectares(assigned)} asignadas de ${hectares(area)}.`
              : `${hectares(area - assigned)} por asignar.`}</p>
            <div className="sowing-zones">
              {editor.zones.map((zone) => <fieldset className="sowing-zone" key={zone.zone_id}>
                <legend>Zona {zoneName(zone.zone_id)}</legend>
                <div className="sowing-zone-fields">
                  <label className="sowing-input">Cultivo
                    <select id={`sowing-${zone.zone_id}-crop`} value={zone.crop_id} onChange={(event) => {
                      const crop = workspace.crop_options.find((option) => option.crop_id === event.currentTarget.value);
                      if (crop) updateZone(zone.zone_id, { crop_id: crop.crop_id });
                    }}>
                      {workspace.crop_options.map((crop) => <option key={crop.crop_id} value={crop.crop_id}>{crop.label}</option>)}
                    </select>
                  </label>
                  <label className="sowing-input">Hectáreas
                    <input id={`sowing-${zone.zone_id}-area`} type="text" inputMode="decimal" value={zone.area_ha}
                      aria-invalid={invalidField === `sowing-${zone.zone_id}-area` || undefined}
                      aria-describedby={invalidField === `sowing-${zone.zone_id}-area` ? "sowing-error" : undefined}
                      onChange={(event) => updateZone(zone.zone_id, { area_ha: event.currentTarget.value })} />
                  </label>
                </div>
                {editor.zones.length > 1 && <button className="sowing-text-button" type="button"
                  onClick={() => {
                    edit({ ...editor, zones: editor.zones.filter((item) => item.zone_id !== zone.zone_id) });
                    requestAnimationFrame(() => title.current?.focus());
                  }}>Quitar zona {zoneName(zone.zone_id)}</button>}
              </fieldset>)}
            </div>
            {editor.zones.length < MAX_ZONES && <button className="sowing-text-button" type="button" onClick={addZone}>Agregar una zona</button>}
            <CropEconomicsEditor workspace={workspace} editor={editor} demo={demo}
              invalidField={invalidField} onChange={updateEconomics} />
            <div className="sowing-actions"><button className="button button-secondary" type="button" onClick={() => goTo(0)}>Cambiar superficie</button>
              <button className="button" type="submit">Ver mi plan</button></div>
          </>}
          {step === 2 && <>
            {currentPreview && <PlanSummary plan={currentPreview} demo={demo} />}
            {!currentPreview && <p className="notice">Vuelve a calcular el plan con la ficha vigente.</p>}
            <div className="sowing-actions"><button className="button button-secondary" type="button" onClick={() => goTo(1)}>Editar reparto</button>
              {!currentPreview && <button className="button" type="submit">Volver a calcular</button>}
              {currentPreview && <button className={canShare ? "button button-secondary" : "button"} type="button" disabled={isCurrentDraft} onClick={save}>Guardar borrador</button>}
              {currentPreview && canShare && <button className="button" type="button" onClick={share}>Compartir para revisión</button>}
            </div>
            {currentPreview && !isCurrentDraft && <p className="sowing-copy">Guarda el borrador para poder compartirlo en Métricas.</p>}
          </>}
        </fieldset>
        {error && <p id="sowing-error" className="notice notice-warn" role="alert">{error}</p>}
        {versionNotice && <p className="sowing-version-notice" role="status">{versionNotice}</p>}
        <ActionFeedback pending={busy || (loading ? "Actualizando la ficha…" : undefined)} success={message} />
        {!!draftVersion && <p className="sowing-draft-state">
          Borrador v{draftVersion} · {workspace.shared_version ? `Plan compartido v${workspace.shared_version}` : "Pendiente de compartir"}
        </p>}
      </form>
      <FieldSketch editor={sketch} crops={workspace.crop_options} waitingForArea={step === 0 && Boolean(sizeIssue)}
        onResize={step < 2 && !locked && !sizeIssue ? updateBoundary : undefined} />
    </div>
  </section>;
}

function PlanSummary({ plan, demo }: { plan: SowingPlanResult; demo: boolean }) {
  const zones = plan.zones.filter((zone) => Number(zone.area_ha) > 0);
  const confirmedCrops = plan.economics?.crops.filter((crop) => crop.capacity_confirmation) ?? [];
  const predictedPrices = demo ? [] : plan.economics?.crops.filter((crop) => crop.price_basis === "local_forecast") ?? [];

  return <div className="sowing-summary">
    {plan.estimated_harvest_kg != null ? <p className="sowing-harvest"><strong>{number(Number(plan.estimated_harvest_kg) / 1000)} t</strong>
      <span>Cosecha total estimada</span></p> : <p className="sowing-copy">Falta el rendimiento de alguna zona para estimar la cosecha total.</p>}
    {plan.economics?.estimated_margin_mxn != null && <p className="sowing-copy"><strong>{pesos(plan.economics.estimated_margin_mxn)}</strong> de ganancia estimada tras descontar costos.</p>}
    {predictedPrices.length > 0 && <details className="disclosure">
      <summary>Precios proyectados que se usaron</summary>
      <ul>
        {predictedPrices.map((crop) => <li key={crop.crop_id}>
          {zones.find((zone) => zone.crop_id === crop.crop_id)?.crop_label ?? crop.crop_id}
          {" · "}{pesoRate(crop.price_mxn_kg)} MXN/kg
          {crop.reference_geography && ` · ${crop.reference_geography}`}
        </li>)}
      </ul>
    </details>}
    {!demo && plan.economics?.missing_inputs?.map((row) => <p className="sowing-copy" key={row.crop_id}>
      <strong>{zones.find((zone) => zone.crop_id === row.crop_id)?.crop_label ?? row.crop_id}</strong> · Falta {row.fields.map((field) => ECONOMIC_FIELDS[field].name.toLowerCase()).join(", ")}.
    </p>)}
    {confirmedCrops.length > 0 && <p className="sowing-copy">Con cupo confirmado de la cooperativa para {confirmedCrops.map((crop) =>
      zones.find((zone) => zone.crop_id === crop.crop_id)?.crop_label.toLowerCase() ?? crop.crop_id).join(", ")}.</p>}
    <ul className="sowing-yield">
      {zones.map((zone) => <li key={zone.zone_id}>
        <div><strong>{zone.crop_label}</strong><span>Zona {zoneName(zone.zone_id)} · {number(zone.area_ha)} ha</span></div>
        <div><strong>{zone.estimated_harvest_kg == null ? "Sin estimación" : `${number(Number(zone.estimated_harvest_kg) / 1000)} t`}</strong>
          {zone.yield_basis === "demo_assumption" && <span>Rendimiento supuesto</span>}
          {zone.yield_basis === "user_assumption" && <span>Rendimiento estimado por ti</span>}
          {zone.yield_basis === "reported" && <span>Rendimiento reportado{zone.yield_input?.source ? ` · ${zone.yield_input.source}` : ""}</span>}
          {zone.yield_basis === "municipal_median" && <span>{zone.yield_reference_url
            ? <a href={zone.yield_reference_url} target="_blank" rel="noreferrer">Referencia municipal</a> : "Referencia municipal"}</span>}
          {zone.economics?.margin_mxn != null && <span>{pesos(zone.economics.margin_mxn)} de ganancia estimada</span>}
        </div>
      </li>)}
    </ul>
    {demo && <p className="sowing-copy">Semilla necesaria: falta la dosis de siembra de cada cultivo.</p>}
  </div>;
}
