import { useRef, useState, type FormEvent } from "react";
import { ActionFeedback } from "./ActionFeedback";
import {
  ApiFailure, cancelCooperativeCapacity, correctCooperativeCapacity, getContext, saveCooperativeCapacity,
  type CooperativeCapacityRegistration, type ParcelContext,
} from "./api";
import { crops, date, number, period } from "./format";
import "./CooperativeCapacities.css";

type Capacity = NonNullable<ParcelContext["confirmed_purchase_capacities"]>[number];
type Crop = CooperativeCapacityRegistration["crop_id"];
type Operation = { kind: "register" } | { kind: "correct" | "cancel"; record: Capacity };

const CAPACITY_CROPS: Crop[] = ["calabaza", "frijol", "maiz", "saladette"];
const MAX_KG = 1_000_000_000;
const campecheDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Mexico_City", dateStyle: "short" });
const today = () => campecheDate.format(new Date());
const calendarDate = (iso: string) => /^\d{4}-\d{2}-\d{2}$/.test(iso);
const kilograms = (raw: string) => /^\d+$/.test(raw) && Number(raw) <= MAX_KG;
const operationLabels = {
  register: { title: "Nuevo cupo de venta", submit: "Guardar cupo confirmado", pending: "Guardando cupo…", receipt: "Cupo registrado" },
  correct: { title: "Corregir cupo", submit: "Guardar corrección", pending: "Guardando corrección…", receipt: "Cupo corregido" },
  cancel: { title: "Cancelar cupo", submit: "Confirmar cancelación", pending: "Cancelando cupo…", receipt: "Cupo cancelado" },
};

function newForm(record?: Capacity) {
  return {
    crop: CAPACITY_CROPS.find((crop) => crop === record?.crop_id) ?? "" as const,
    start: record?.sales_period.start ?? "",
    end: record?.sales_period.end ?? "",
    confirmed: record ? campecheDate.format(new Date(record.confirmed_at)) : today(),
    minimum: record ? String(record.cupo_range[0]) : "",
    maximum: record ? String(record.cupo_range[1]) : "",
    source: record?.source.name ?? "", url: record?.source.url ?? "", reason: "",
  };
}

type CapacityForm = ReturnType<typeof newForm>;
type FormIssue = { field?: keyof CapacityForm; message: string };

function issueFor(values: CapacityForm): FormIssue | undefined {
  if (!values.crop) return { field: "crop", message: "Selecciona el cultivo para el cupo." };
  if (!calendarDate(values.start)) return { field: "start", message: "Indica cuándo comienzan las entregas." };
  if (!calendarDate(values.end) || values.end < values.start) {
    return { field: "end", message: "El fin de entregas debe ser igual o posterior al inicio." };
  }
  if (!calendarDate(values.confirmed) || values.confirmed > today()) {
    return { field: "confirmed", message: "La fecha de confirmación debe ser hoy o una fecha anterior." };
  }
  if (values.confirmed > values.end) {
    return { field: "confirmed", message: "La confirmación debe ocurrir como máximo el último día de entregas." };
  }
  if (!kilograms(values.minimum)) return { field: "minimum", message: "Escribe el cupo mínimo en kilos enteros, desde cero." };
  if (!kilograms(values.maximum) || Number(values.maximum) < Number(values.minimum)) {
    return { field: "maximum", message: "El cupo máximo debe ser un número entero igual o mayor al mínimo." };
  }
  if (!values.source.trim()) return { field: "source", message: "Escribe el nombre o folio del documento que confirma el cupo." };
  if (values.url.trim()) {
    try {
      const url = new URL(values.url.trim());
      if (url.protocol === "https:" && /^https:\/\//i.test(values.url.trim())) {
        if (url.username || url.password) return { field: "url", message: "Usa el enlace de la fuente sin usuario ni contraseña." };
        return;
      }
    } catch { /* El mensaje indica el formato esperado. */ }
    return { field: "url", message: "Usa un enlace completo que empiece con https://." };
  }
}

function capacityRange(record: Capacity) {
  const [minimum, maximum] = record.cupo_range;
  return minimum === maximum ? `${number(minimum)} kg` : `${number(minimum)}–${number(maximum)} kg`;
}

function RecordDetails({ record }: { record: Capacity }) {
  const source = record.source;
  return <div className="capacity-record-details">
    <div className="capacity-record-main"><strong>{crops[record.crop_id] ?? record.crop_id}</strong>
      <strong className="capacity-range">{capacityRange(record)}</strong></div>
    <span>Entregas {period(record.sales_period)}</span>
    <span className="muted">Confirmado el <time dateTime={record.confirmed_at}>{date(campecheDate.format(new Date(record.confirmed_at)))}</time>
      {" · "}{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.name}</a> : source.name}</span>
  </div>;
}

function CapacityHistory({ history }: { history: NonNullable<ParcelContext["cooperative_capacity_history"]> }) {
  return <details className="disclosure capacity-history">
    <summary>Historial de cupos</summary>
    {history.length ? <ol className="capacity-history-list">
      {history.slice().reverse().map((event) => <li key={event.context_version}>
        <h3>{event.action === "corrected" ? "Corrección" : "Cancelación"}</h3>
        <p className="muted">Ficha v{event.context_version} · <time dateTime={event.recorded_at}>{date(campecheDate.format(new Date(event.recorded_at)))}</time></p>
        {event.reason && <p>{event.reason}</p>}
        <div className="capacity-history-comparison">
          <div><h4>{event.action === "corrected" ? "Cupo anterior" : "Cupo cancelado"}</h4><RecordDetails record={event.previous} /></div>
          {event.replacement && <div><h4>Cupo corregido</h4><RecordDetails record={event.replacement} /></div>}
        </div>
      </li>)}
    </ol> : <p className="muted">Todavía no hay correcciones ni cancelaciones.</p>}
  </details>;
}

export function CooperativeCapacities({ context, onContextSaved }: {
  context: ParcelContext;
  onContextSaved: (next: ParcelContext) => void;
}) {
  const [operation, setOperation] = useState<Operation>();
  const [values, setValues] = useState(() => newForm());
  const [issue, setIssue] = useState<FormIssue>();
  const [receipt, setReceipt] = useState<{ kind: Operation["kind"]; version: number }>();
  const [saving, setSaving] = useState(false);
  const actionHeading = useRef<HTMLHeadingElement>(null);
  const registryHeading = useRef<HTMLHeadingElement>(null);
  const records = (context.confirmed_purchase_capacities ?? [])
    .filter((entry) => entry.sales_structure === "cooperative")
    .sort((left, right) => Date.parse(right.confirmed_at) - Date.parse(left.confirmed_at)
      || Date.parse(right.source.retrieved_at) - Date.parse(left.source.retrieved_at));
  const labels = operation && operationLabels[operation.kind];
  const targetMissing = operation && operation.kind !== "register" && !records.some((record) => record.id === operation.record.id);

  function open(next: Operation) {
    setValues(newForm(next.kind === "register" ? undefined : next.record));
    setOperation(next);
    setIssue(undefined);
    setReceipt(undefined);
    requestAnimationFrame(() => actionHeading.current?.focus());
  }

  function dismiss() {
    setOperation(undefined);
    setIssue(undefined);
    requestAnimationFrame(() => registryHeading.current?.focus());
  }

  function edit<Field extends keyof CapacityForm>(field: Field, value: CapacityForm[Field]) {
    setValues((current) => ({ ...current, [field]: value }));
    setIssue(undefined);
  }

  function fieldProps(field: keyof CapacityForm) {
    const invalid = issue?.field === field;
    return {
      id: `capacity-${field}`,
      "aria-invalid": invalid || undefined,
      "aria-describedby": invalid ? "capacity-error" : undefined,
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!operation || saving || targetMissing) return;
    const validation = operation.kind === "cancel" ? undefined : issueFor(values);
    if (validation) {
      setIssue(validation);
      if (validation.field) requestAnimationFrame(() => document.getElementById(`capacity-${validation.field}`)?.focus());
      return;
    }

    const expected_context_version = context.context_version;
    const parcel = context.parcel.id;
    const reason = values.reason.trim() || null;
    setSaving(true);
    setIssue(undefined);
    try {
      let next: ParcelContext;
      if (operation.kind === "cancel") {
        next = await cancelCooperativeCapacity(parcel, operation.record.id, { expected_context_version, reason });
      } else {
        if (!values.crop) return;
        const body: CooperativeCapacityRegistration = {
          expected_context_version, crop_id: values.crop,
          sales_period: { start: values.start, end: values.end },
          cupo_range: [Number(values.minimum), Number(values.maximum)],
          confirmed_on: values.confirmed, source_name: values.source.trim(), source_url: values.url.trim() || null,
        };
        next = operation.kind === "correct"
          ? await correctCooperativeCapacity(parcel, operation.record.id, { ...body, reason })
          : await saveCooperativeCapacity(parcel, body);
      }
      onContextSaved(next);
      setReceipt({ kind: operation.kind, version: next.context_version });
      dismiss();
    } catch (error) {
      if (error instanceof ApiFailure && error.status === 409) {
        try {
          onContextSaved(await getContext(parcel));
          setIssue({ message: "La ficha cambió. Tus datos siguen en el formulario. Revisa los cupos vigentes antes de guardar." });
        } catch (refreshError) {
          setIssue({ message: refreshError instanceof Error ? refreshError.message : error.message });
        }
      } else {
        setIssue({ message: error instanceof Error ? error.message : "No se pudo guardar el cambio." });
      }
    } finally {
      setSaving(false);
    }
  }

  return <section className="capacity-registry" aria-labelledby="capacity-title">
    <header className="capacity-heading">
      <h2 id="capacity-title" tabIndex={-1} ref={registryHeading}>Cupos confirmados de la cooperativa</h2>
      <button className="button" type="button" disabled={saving} aria-expanded={operation?.kind === "register"}
        onClick={() => operation?.kind === "register" ? dismiss() : open({ kind: "register" })}>Registrar cupo confirmado</button>
    </header>

    {operation && labels && <div className="capacity-editor">
      <h3 tabIndex={-1} ref={actionHeading}>{labels.title}</h3>
      {operation.kind !== "register" && <RecordDetails record={operation.record} />}
      <form noValidate aria-label={labels.title} onSubmit={(event) => void submit(event)}>
        <fieldset disabled={saving}>
          {operation.kind === "cancel" ? <p className="capacity-help">Parcela usará otro cupo aplicable o el respaldo. La cancelación quedará en el historial.</p>
            : <>
              <div className="form-grid capacity-fields">
                <label>Cultivo<select required {...fieldProps("crop")} value={values.crop} onChange={(event) => {
                  const crop = CAPACITY_CROPS.find((id) => id === event.currentTarget.value);
                  edit("crop", crop ?? "");
                }}><option value="">Selecciona un cultivo</option>
                  {CAPACITY_CROPS.map((id) => <option key={id} value={id}>{crops[id]}</option>)}</select></label>
                <label>Fecha de confirmación<input required {...fieldProps("confirmed")} type="date" max={today()}
                  value={values.confirmed} onChange={(event) => edit("confirmed", event.currentTarget.value)} /></label>
                <label>Inicio de entregas<input required {...fieldProps("start")} type="date" value={values.start}
                  onChange={(event) => edit("start", event.currentTarget.value)} /></label>
                <label>Fin de entregas<input required {...fieldProps("end")} type="date" min={values.start} value={values.end}
                  onChange={(event) => edit("end", event.currentTarget.value)} /></label>
                <label>Cupo mínimo (kg)<input required {...fieldProps("minimum")} type="number" inputMode="numeric" min="0" max={MAX_KG}
                  step="1" value={values.minimum} onChange={(event) => edit("minimum", event.currentTarget.value)} /></label>
                <label>Cupo máximo (kg)<input required {...fieldProps("maximum")} type="number" inputMode="numeric" min={values.minimum || "0"} max={MAX_KG}
                  step="1" value={values.maximum} onChange={(event) => edit("maximum", event.currentTarget.value)} /></label>
                <label>Fuente o folio<input required {...fieldProps("source")} type="text" maxLength={180} value={values.source}
                  onChange={(event) => edit("source", event.currentTarget.value)} /></label>
                <label>Enlace de la fuente (opcional)<input {...fieldProps("url")} type="url" maxLength={2048} value={values.url}
                  onChange={(event) => edit("url", event.currentTarget.value)} /></label>
              </div>
              <p className="small muted capacity-help">Para un cupo fijo, escribe la misma cantidad en ambos campos.</p>
            </>}
          {operation.kind !== "register" && <div className="form-grid capacity-note">
            <label>Motivo (opcional)<input {...fieldProps("reason")} type="text" maxLength={240} value={values.reason}
              onChange={(event) => edit("reason", event.currentTarget.value)} /></label>
          </div>}
          {issue && <p id="capacity-error" className="notice notice-warn" role="alert">{issue.message}</p>}
          {targetMissing && <p className="notice notice-warn" role="status">Este cupo ya tiene una corrección o cancelación. El historial muestra el cambio.</p>}
          <div className="button-group">
            <button className={`button${operation.kind === "cancel" ? " capacity-danger" : ""}`} type="submit" disabled={targetMissing}>{labels.submit}</button>
            <button className="button button-secondary" type="button" onClick={dismiss}>Volver a los cupos</button>
          </div>
        </fieldset>
      </form>
    </div>}

    <ActionFeedback pending={saving ? labels?.pending : undefined} success={receipt && <p>
      <strong>{operationLabels[receipt.kind].receipt} en la ficha v{receipt.version}.</strong> <a href="#parcela">Recalcular el plan en Parcela</a>
    </p>} />

    {records.length ? <ul className="capacity-records" aria-label="Cupos vigentes">{records.map((record) => <li key={record.id}>
      <RecordDetails record={record} />
      <div className="capacity-row-actions">
        <button className="button button-secondary" type="button" disabled={saving} onClick={() => open({ kind: "correct", record })}>Corregir cupo</button>
        <button className="capacity-cancel" type="button" disabled={saving} onClick={() => open({ kind: "cancel", record })}>Cancelar cupo</button>
      </div>
    </li>)}</ul> : <p className="muted capacity-empty">Aún no hay cupos vigentes en la ficha.</p>}

    <CapacityHistory history={context.cooperative_capacity_history ?? []} />
  </section>;
}
