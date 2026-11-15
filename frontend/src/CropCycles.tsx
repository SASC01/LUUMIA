import { useId, useRef, useState, type FormEvent } from "react";
import { ActionFeedback } from "./ActionFeedback";
import { ApiFailure, correctCropCycle, getContext, saveCropCycle, voidCropCycle, type ParcelContext } from "./api";
import { crops, period, todayInCampeche } from "./format";
import "./CropCycles.css";

const cropIds = ["maiz", "frijol", "calabaza", "saladette"] as const;

type CycleKind = "current" | "previous";
type Cycle = ParcelContext["history"][number];
type Operation = { action: "register"; kind: CycleKind } | { action: "correct" | "void"; record: Cycle };
type FieldName = "crop" | "start" | "end";
type Issue = { field?: FieldName; message: string };

const titles: Record<CycleKind, string> = {
  current: "Registrar cultivo actual",
  previous: "Agregar ciclo anterior",
};

function validDay(value: string) {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const day = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value;
}

const cropName = (cycle: Cycle) => cycle.crop_ids.map((id) => crops[id] ?? id).join(" + ");

function recordChanged(context: ParcelContext, before: Cycle, version: number) {
  const current = context.history.find((cycle) => cycle.id === before.id);
  return !current || current.period?.start !== before.period?.start || current.period?.end !== before.period?.end
    || current.crop_ids.join(",") !== before.crop_ids.join(",")
    || context.crop_cycle_history?.some((event) => event.previous.id === before.id && event.context_version > version);
}

export function CropCycles({ context, onSaved }: {
  context: ParcelContext;
  onSaved: (updated: ParcelContext) => void;
}) {
  const [operation, setOperation] = useState<Operation>();
  const [cropId, setCropId] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const [expected, setExpected] = useState(context.context_version);
  const [saving, setSaving] = useState(false);
  const [issue, setIssue] = useState<Issue>();
  const [receipt, setReceipt] = useState("");

  const title = useRef<HTMLHeadingElement>(null);
  const editorTitle = useRef<HTMLHeadingElement>(null);
  const crop = useRef<HTMLSelectElement>(null);
  const error = useRef<HTMLParagraphElement>(null);
  const currentAction = useRef<HTMLButtonElement>(null);
  const previousAction = useRef<HTMLButtonElement>(null);
  const submitting = useRef(false);
  const changeId = useRef<string | undefined>(undefined);
  const formId = useId();
  const today = todayInCampeche();
  const dayBefore = new Date(`${today}T00:00:00Z`);
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  const yesterday = dayBefore.toISOString().slice(0, 10);
  const cycles = [...context.history].reverse().filter((cycle) => cycle.data_kind === "observed" && cycle.period);
  const current = cycles.find((cycle) => cycle.period && cycle.period.start <= today && cycle.period.end >= today);
  const kind = operation?.action === "register" ? operation.kind : undefined;
  const record = operation?.action === "correct" || operation?.action === "void" ? operation.record : undefined;
  const targetChanged = record && recordChanged(context, record, expected);

  function open(next: Operation) {
    const initial = next.action === "register" ? undefined : next.record;
    setOperation(next);
    setCropId(initial?.crop_ids[0] ?? "");
    setStart(initial?.period?.start ?? "");
    setEnd(initial?.period?.end ?? "");
    setReason("");
    setExpected(context.context_version);
    setIssue(undefined);
    setReceipt("");
    changeId.current = undefined;
    requestAnimationFrame(() => (next.action === "void" ? editorTitle : crop).current?.focus());
  }

  const controlId = (action: "correct" | "void", cycle: Cycle) => `${formId}-${action}-${cycle.id}`;

  function close(active: Operation) {
    setOperation(undefined);
    setIssue(undefined);
    requestAnimationFrame(() => {
      const action = active.action === "register"
        ? (active.kind === "current" ? currentAction.current : previousAction.current)
        : document.getElementById(controlId(active.action, active.record));
      (action ?? title.current)?.focus();
    });
  }

  function edit(setter: (value: string) => void, value: string) {
    setter(value);
    setIssue(undefined);
    changeId.current = undefined;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!operation || submitting.current || targetChanged) return;
    const form = event.currentTarget;
    const selected = cropIds.find((id) => id === cropId);
    const lastStart = kind === "previous" ? yesterday : today;

    function reject(field: FieldName, message: string) {
      setIssue({ field, message });
      form.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
    }

    if (operation.action !== "void") {
      if (!selected) return reject("crop", "Elige el cultivo que sembraste.");
      if (!validDay(start) || start > lastStart) {
        return reject("start", kind === "previous" ? "Elige una fecha de inicio anterior a hoy." : "Elige una fecha de inicio que sea hoy o antes.");
      }
      if (!validDay(end) || end < start) return reject("end", "Elige una fecha de fin que sea igual o posterior al inicio.");
      if (kind === "current" && end < today) return reject("end", "La fecha prevista de fin debe ser hoy o después.");
      if (kind === "previous" && end >= today) return reject("end", "El ciclo anterior debe haber terminado antes de hoy.");
    }

    submitting.current = true;
    setSaving(true);
    setIssue(undefined);
    try {
      const parcelId = context.parcel.id;
      let next: ParcelContext;
      if (operation.action === "register") {
        if (!selected) return;
        next = await saveCropCycle(parcelId, { expected_context_version: expected, kind: operation.kind, crop_id: selected, start, end });
        setReceipt(operation.kind === "current" ? "Cultivo actual registrado." : "Ciclo anterior registrado.");
      } else {
        changeId.current ??= crypto.randomUUID();
        const body = { expected_context_version: expected, change_id: changeId.current, reason: reason.trim() || null };
        if (operation.action === "correct") {
          if (!selected) return;
          next = await correctCropCycle(parcelId, operation.record.id, { ...body, crop_id: selected, start, end });
          setReceipt("Ciclo corregido.");
        } else {
          next = await voidCropCycle(parcelId, operation.record.id, body);
          setReceipt("Ciclo anulado.");
        }
      }
      onSaved(next);
      close(operation);
    } catch (failure) {
      let message = failure instanceof Error ? failure.message : "No se pudo guardar el ciclo.";
      if (failure instanceof ApiFailure && failure.status === 409) {
        try {
          const latest = await getContext(context.parcel.id);
          onSaved(latest);
          if (record && recordChanged(latest, record, expected)) {
            requestAnimationFrame(() => error.current?.focus());
            return;
          }
          setExpected(latest.context_version);
          message = "La ficha se actualizó. Revisa tus datos y vuelve a guardar.";
        } catch { /* Conserva el mensaje de la primera solicitud. */ }
      }
      setIssue({ message });
      requestAnimationFrame(() => error.current?.focus());
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  function fieldAttributes(name: FieldName) {
    return {
      name,
      required: true,
      "aria-invalid": issue?.field === name || undefined,
      "aria-describedby": issue?.field === name ? `${formId}-error` : undefined,
    };
  }

  const editorLabel = operation?.action === "correct" ? "Corregir ciclo"
    : operation?.action === "void" ? "Anular ciclo"
    : kind ? titles[kind] : "";
  const submitLabel = operation?.action === "correct" ? "Guardar corrección"
    : operation?.action === "void" ? "Confirmar anulación"
    : kind === "current" ? "Guardar cultivo actual" : "Guardar ciclo anterior";

  return <section className="panel crop-cycles" id="registro-cultivos" aria-labelledby="crop-cycles-title">
    <h2 id="crop-cycles-title" ref={title} tabIndex={-1}>Cultivos registrados</h2>
    {!cycles.length && <p className="muted">Registra qué has sembrado para orientar la rotación de la parcela.</p>}
    {!!cycles.length && <ul className="crop-cycle-list" aria-label="Ciclos vigentes">
      {cycles.map((cycle) => {
        const label = cropName(cycle);
        const datesId = `${formId}-dates-${cycle.id}`;
        return <li key={cycle.id}>
          <div className="crop-cycle-dates">
            <strong>{label}</strong>{cycle.id === current?.id && <span className="muted"> · Cultivo actual</span>}
            <p id={datesId} className="small muted">{cycle.period && period(cycle.period)}</p>
          </div>
          {!operation && <div className="crop-cycle-actions">
            <button type="button" id={controlId("correct", cycle)} className="button button-secondary"
              aria-label={`Corregir ciclo de ${label}`} aria-describedby={datesId}
              onClick={() => open({ action: "correct", record: cycle })}>Corregir</button>
            <button type="button" id={controlId("void", cycle)} className="button button-secondary"
              aria-label={`Anular ciclo de ${label}`} aria-describedby={datesId}
              onClick={() => open({ action: "void", record: cycle })}>Anular</button>
          </div>}
        </li>;
      })}
    </ul>}
    {!operation ? <div className="button-group">
      {!current && <button className="button" type="button" ref={currentAction} onClick={() => open({ action: "register", kind: "current" })}>
        {titles.current}
      </button>}
      <button className={current ? "button" : "button button-secondary"} type="button" ref={previousAction}
        onClick={() => open({ action: "register", kind: "previous" })}>
        {titles.previous}
      </button>
    </div> : <form className="crop-cycle-form" noValidate aria-labelledby={`${formId}-title`} onSubmit={(event) => void submit(event)}>
      <h3 id={`${formId}-title`} ref={editorTitle} tabIndex={-1}>{editorLabel}</h3>
      <fieldset disabled={saving}>
        {operation.action === "void" ? <>
          <p><strong>{cropName(operation.record)}</strong> · {operation.record.period && period(operation.record.period)}</p>
          <p>La rotación se actualizará con los ciclos vigentes. El registro quedará en Historial como anulado.</p>
        </> : <div className="form-grid crop-cycle-fields">
          <label><span id={`${formId}-crop-label`}>Cultivo</span>
            <select {...fieldAttributes("crop")} aria-labelledby={`${formId}-crop-label`} value={cropId} ref={crop}
              onChange={(event) => edit(setCropId, event.currentTarget.value)}>
              <option value="">Selecciona un cultivo</option>
              {cropIds.map((id) => <option key={id} value={id}>{crops[id]}</option>)}
            </select>
          </label>
          <label>Fecha de inicio
            <input {...fieldAttributes("start")} type="date" value={start} max={kind === "previous" ? yesterday : today}
              onChange={(event) => edit(setStart, event.currentTarget.value)} />
          </label>
          <label>{kind === "current" ? "Fecha prevista de fin" : "Fecha de fin"}
            <input {...fieldAttributes("end")} type="date" value={end} min={kind === "current" ? today : start || undefined}
              max={kind === "previous" ? yesterday : undefined} onChange={(event) => edit(setEnd, event.currentTarget.value)} />
          </label>
        </div>}
        {record && <div className="form-grid crop-cycle-reason">
          <label>Motivo (opcional)<input type="text" value={reason} maxLength={240}
            onChange={(event) => edit(setReason, event.currentTarget.value)} /></label>
        </div>}
        {(targetChanged || issue) && <p className="notice notice-warn" id={`${formId}-error`} tabIndex={-1} role="alert" ref={error}>
          {targetChanged ? "Este ciclo cambió. Cancela y vuelve a abrirlo desde los ciclos vigentes." : issue?.message}
        </p>}
        <div className="button-group">
          <button className={operation.action === "void" ? "button crop-cycle-danger" : "button"} type="submit"
            disabled={Boolean(targetChanged)}>{submitLabel}</button>
          <button className="button button-secondary" type="button" onClick={() => close(operation)}>Cancelar</button>
        </div>
      </fieldset>
    </form>}
    <ActionFeedback pending={saving ? (operation?.action === "void" ? "Anulando ciclo…" : "Guardando ciclo…") : undefined} success={receipt} />
    {!operation && !!context.crop_cycle_history?.length && <p className="crop-cycle-history-link">
      <a href="#parcela-historial">Ver cambios en Historial</a>
    </p>}
  </section>;
}
