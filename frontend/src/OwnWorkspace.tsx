import { useEffect, useRef, useState, type FormEvent } from "react";
import { ActionFeedback } from "./ActionFeedback";
import {
  ApiFailure, createLocalParcel, getContext, listLocalParcels, refreshCropRotation, saveFieldCapture,
  type FieldCapture, type LocalParcelSummary, type ParcelContext,
} from "./api";
import { RegionalClimate } from "./Evidence";
import { CropCycles } from "./CropCycles";
import { Field } from "./Field";
import { Metrics } from "./Metrics";
import { ParcelAdvancedData } from "./ParcelAnalysis";
import { ParcelHistory } from "./ParcelHistory";
import { ParcelOverview } from "./ParcelOverview";
import { ParcelDisclosure, ParcelNavigation, ParcelPanel, ParcelSectionTitle, parcelRoute, useParcelFocus } from "./ParcelSections";
import { PlantingPlanner } from "./PlantingPlanner";
import { focusRegisteredArea, RegisteredArea } from "./RegisteredArea";
import { Rotations } from "./Rotations";
import { areaText, areaUnits } from "./parcelArea";
import "./OwnWorkspace.css";

const selectedKey = "luumia-selected-parcel";

function lastSelection() {
  try { return localStorage.getItem(selectedKey); } catch { return null; }
}

function rememberSelection(id: string) {
  try { localStorage.setItem(selectedKey, id); } catch { /* La selección sigue disponible en esta pantalla. */ }
}

function summarize(context: ParcelContext): LocalParcelSummary {
  const { parcel, producer } = context;
  return { parcel_id: parcel.id, name: producer.display_name, declared_area_ha: String(parcel.declared_area_ha),
    municipality: parcel.municipality, state: parcel.state };
}

function ParcelForm({ onCreated, onCancel }: { onCreated: (context: ParcelContext) => void; onCancel?: () => void }) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [state, setState] = useState("");
  const [system, setSystem] = useState<"rainfed" | "irrigated">("rainfed");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [invalid, setInvalid] = useState<"name" | "area">();
  const nameInput = useRef<HTMLInputElement>(null);
  const areaInput = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const units = areaUnits(area);
    if (!name.trim() || !units) {
      const needsName = !name.trim();
      setInvalid(needsName ? "name" : "area");
      setError(needsName ? "Escribe un nombre para identificar la parcela." : "Escribe las hectáreas con hasta tres decimales.");
      (needsName ? nameInput : areaInput).current?.focus();
      return;
    }
    setInvalid(undefined);
    setError("");
    setSaving(true);
    try {
      onCreated(await createLocalParcel({ name: name.trim(), declared_area_ha: areaText(units),
        municipality: municipality.trim() || null, state: state.trim() || null, production_system: system }));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo crear la parcela.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="panel parcel-create" aria-labelledby="parcel-create-title">
    <h2 id="parcel-create-title">Registrar parcela</h2>
    <form noValidate onSubmit={(event) => void submit(event)}>
      <fieldset disabled={saving}>
        <div className="form-grid">
          <label>Nombre de la parcela<input type="text" required maxLength={100} value={name} ref={nameInput}
            aria-invalid={invalid === "name" || undefined} aria-describedby={invalid === "name" ? "parcel-create-error" : undefined}
            onChange={(event) => { setName(event.currentTarget.value); setInvalid(undefined); setError(""); }} /></label>
          <label>Superficie (ha)<input type="text" required inputMode="decimal" value={area} ref={areaInput}
            aria-invalid={invalid === "area" || undefined} aria-describedby={invalid === "area" ? "parcel-create-error" : undefined}
            onChange={(event) => { setArea(event.currentTarget.value); setInvalid(undefined); setError(""); }} /></label>
        </div>
        <details className="disclosure">
          <summary>Ubicación y tipo de riego</summary>
          <div className="form-grid">
            <label>Municipio<input type="text" maxLength={100} value={municipality} onChange={(event) => setMunicipality(event.currentTarget.value)} /></label>
            <label>Estado<input type="text" maxLength={100} value={state} onChange={(event) => setState(event.currentTarget.value)} /></label>
            <label>Sistema de producción<select value={system} onChange={(event) => setSystem(event.currentTarget.value === "irrigated" ? "irrigated" : "rainfed")}>
              <option value="rainfed">Temporal</option><option value="irrigated">Riego</option>
            </select></label>
          </div>
        </details>
        {error && <p className="notice notice-warn" id="parcel-create-error" role="alert">{error}</p>}
        <div className="button-group">
          <button className="button" type="submit">Crear parcela</button>
          {onCancel && <button type="button" className="button button-secondary" onClick={onCancel}>Cancelar</button>}
        </div>
      </fieldset>
    </form>
    <ActionFeedback pending={saving ? "Guardando parcela…" : undefined} />
  </section>;
}

export function OwnWorkspace({ showsMetrics, anchor }: { showsMetrics: boolean; anchor: string }) {
  const [parcels, setParcels] = useState<LocalParcelSummary[]>();
  const [id, setId] = useState<string>();
  const [context, setContext] = useState<ParcelContext>();
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [observationError, setObservationError] = useState("");
  const [rotationError, setRotationError] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [metricsRevision, setMetricsRevision] = useState(0);
  const active = context?.parcel.id === id ? context : undefined;
  const view = showsMetrics ? undefined : parcelRoute(anchor).view;
  useParcelFocus(anchor, Boolean(active));

  useEffect(() => {
    const controller = new AbortController();
    listLocalParcels(controller.signal).then((items) => {
      if (controller.signal.aborted) return;
      setParcels(items);
      const previous = lastSelection();
      setId((current) => current ?? (items.find((item) => item.parcel_id === previous) ?? items[0])?.parcel_id);
    }).catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    if (!id || context?.parcel.id === id) return;
    const controller = new AbortController();
    getContext(id, controller.signal).then((next) => {
      if (!controller.signal.aborted) setContext(next);
    }).catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  // La ficha cargada solo se reemplaza al seleccionar otra parcela o reintentar.
  }, [id, retry]);

  function accept(next: ParcelContext) {
    setContext((current) => current?.parcel.id === next.parcel.id && current.context_version <= next.context_version ? next : current);
    setParcels((items) => items?.map((item) => item.parcel_id === next.parcel.id ? summarize(next) : item));
  }

  function select(value: string) {
    setError("");
    setObservationError("");
    setRotationError("");
    setEditing(false);
    setId(value);
    rememberSelection(value);
  }

  function created(next: ParcelContext) {
    setParcels((items) => [...(items ?? []), summarize(next)]);
    setContext(next);
    select(next.parcel.id);
    location.hash = "parcela";
    requestAnimationFrame(() => document.getElementById("own-parcel-title")?.focus());
  }

  async function saveObservation(capture: FieldCapture) {
    if (!active || busy) return false;
    setBusy(true);
    setObservationError("");
    try {
      accept(await saveFieldCapture(active.context_version, capture));
      return true;
    } catch (failure) {
      if (failure instanceof ApiFailure && failure.status === 409) {
        try {
          accept(await getContext(active.parcel.id));
          setObservationError("La ficha cambió. Revisa los registros actuales antes de volver a guardar.");
          return false;
        } catch { /* Se muestra el error original. */ }
      }
      setObservationError(failure instanceof Error ? failure.message : "No se pudo guardar la observación.");
      return false;
    } finally { setBusy(false); }
  }

  async function recalculateRotation() {
    if (!active || busy) return;
    setBusy(true);
    setRotationError("");
    try {
      accept(await refreshCropRotation(active.parcel.id, active.context_version));
      location.hash = "rotaciones-parcela";
      requestAnimationFrame(() => document.querySelector<HTMLElement>("#rotaciones-parcela h2")?.focus());
    } catch (failure) {
      if (failure instanceof ApiFailure && failure.status === 409) {
        try {
          accept(await getContext(active.parcel.id));
          setRotationError("La ficha cambió. Revisa el cultivo registrado antes de actualizar la comparación.");
          return;
        } catch { /* Se muestra el error original. */ }
      }
      setRotationError(failure instanceof Error ? failure.message : "No se pudo actualizar la comparación.");
    } finally { setBusy(false); }
  }

  if (error || !parcels || (id && !active)) return <section className="workspace">
    <h1>{showsMetrics ? "Métricas" : "Parcela"}</h1>
    {error ? <div className="notice notice-warn" role="alert"><p>{error}</p>
      <button type="button" className="button button-secondary" onClick={() => { setError(""); setRetry((count) => count + 1); }}>Volver a cargar</button>
    </div> : <ActionFeedback pending="Cargando parcelas…" />}
  </section>;

  if (!active) return <section id={showsMetrics ? "metricas" : "parcela"} className="workspace own-workspace">
    <header className="parcel-intro">
      <h1 id={showsMetrics ? "metrics-title" : "own-parcel-title"} tabIndex={-1}>{showsMetrics ? "Métricas" : "Planifica tu parcela"}</h1>
      <p>{showsMetrics ? "Los planes que compartas aparecerán aquí." : "Registra tu terreno para repartirlo y estimar tu cosecha."}</p>
    </header>
    {showsMetrics ? <a className="button" href="#parcela">Registrar mi parcela</a> : <ParcelForm onCreated={created} />}
  </section>;

  const name = active.producer.display_name;
  const hasRegionalData = active.features.some((feature) =>
    feature.name === "weekly_precipitation_total" || feature.name === "weekly_air_temperature_mean");
  const pendingRotation = active.evaluation_state === "pendiente_de_recalculo";
  return <section className="workspace own-workspace">
    <div className="own-parcel-bar">
      {parcels.length > 1 && <label>Parcela<select value={id} disabled={busy} onChange={(event) => select(event.currentTarget.value)}>
        {parcels.map((item) => <option key={item.parcel_id} value={item.parcel_id}>{item.name}</option>)}
      </select></label>}
      {!showsMetrics && !editing && <button className="button button-secondary" type="button" onClick={() => setEditing(true)}>Nueva parcela</button>}
    </div>
    <div hidden={showsMetrics}>
      {editing && <ParcelForm onCreated={created} onCancel={() => setEditing(false)} />}
      <div key={active.parcel.id} hidden={editing}>
        {view && <ParcelNavigation view={view} />}
        <ParcelPanel id="overview" view={view}>
          <ParcelOverview context={active} titleId="own-parcel-title" environmentHref="#parcela-ambiente"
            rotationsHref="#rotaciones-parcela" historyHref="#parcela-historial" cropRegistrationHref="#registro-cultivos" />
        </ParcelPanel>
        <ParcelPanel id="environment" view={view}>
          <ParcelSectionTitle parcelName={name}>Análisis ambiental</ParcelSectionTitle>
          <div className="parcel-view-blocks">
            {hasRegionalData && <RegionalClimate context={active} />}
            {observationError && <p className="notice notice-warn" role="alert">{observationError}</p>}
            <Field context={active} busy={busy} onSave={saveObservation} onRefresh={() => {
              void getContext(active.parcel.id).then(accept).catch((failure: Error) => setObservationError(failure.message));
            }} />
          </div>
        </ParcelPanel>
        <ParcelPanel id="crops" view={view}>
          <ParcelSectionTitle parcelName={name}>Cultivos y rotaciones</ParcelSectionTitle>
          <div className="parcel-view-blocks">
            <CropCycles context={active} onSaved={accept} />
            {rotationError && <p className="notice notice-warn" role="alert">{rotationError}</p>}
            {pendingRotation && <section className="panel" id="rotaciones-parcela">
              <h2>Actualiza la comparación de cultivos</h2>
              <p className="muted">Se guardaron cambios en la ficha desde la última evaluación.</p>
              <div className="button-group">
                <button className="button" type="button" disabled={busy} onClick={() => void recalculateRotation()}>
                  Actualizar evaluación
                </button>
              </div>
              <ActionFeedback pending={busy ? "Actualizando la evaluación…" : undefined} />
            </section>}
            {active.evaluation && <ParcelDisclosure label="Ver opciones de rotación" linked={anchor === "rotaciones-parcela"}>
              <Rotations context={active} evaluation={active.evaluation} busy={busy} preview={false} sectionId="rotaciones-parcela" />
            </ParcelDisclosure>}
            <div className="parcel-planner-block">
              <div className="parcel-plan-settings"><RegisteredArea context={active} onSaved={accept} /></div>
              <PlantingPlanner context={active} onEditRegisteredArea={focusRegisteredArea}
                onShared={() => setMetricsRevision((revision) => revision + 1)} />
            </div>
          </div>
        </ParcelPanel>
        <ParcelPanel id="history" view={view}>
          <ParcelSectionTitle parcelName={name}>Historial</ParcelSectionTitle>
          <ParcelHistory context={active} fieldHref="#observacion-parcela" />
        </ParcelPanel>
        <ParcelPanel id="advanced" view={view}>
          <ParcelSectionTitle parcelName={name}>Análisis avanzado</ParcelSectionTitle>
          <ParcelAdvancedData context={active} />
        </ParcelPanel>
      </div>
    </div>
    {showsMetrics && <div id="metricas"><Metrics key={active.parcel.id} context={active}
      refreshKey={metricsRevision} onContextSaved={accept} parcelLink="#parcela-cultivos" /></div>}
  </section>;
}
