import { useId, useRef, useState, type FormEvent } from "react";
import type { FieldCapture, ParcelContext } from "./api";
import { EvidenceSummary, SourceLine } from "./Evidence";
import { date, number, period } from "./format";
import { WeatherLink } from "./WeatherLink";
import "./Field.css";

const offset = "-06:00";
const localDay = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
});

function shiftDay(iso: string, days: number) {
  const value = new Date(`${iso}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function validDay(iso: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && Number.isFinite(Date.parse(`${iso}T00:00:00Z`)) && shiftDay(iso, 0) === iso;
}

export function Field({ context, busy, onSave, onRefresh }: {
  context: ParcelContext;
  busy: boolean;
  onSave: (capture: FieldCapture) => Promise<boolean>;
  onRefresh: () => void;
}) {
  const demo = context.producer.persona_kind === "composite_demo";
  const week = demo ? context.features.find((row) => row.name === "weekly_precipitation_total")?.period : undefined;
  const yesterday = shiftDay(localDay.format(new Date()), -1);
  const [value, setValue] = useState("");
  const [start, setStart] = useState(week?.start ?? yesterday);
  const [end, setEnd] = useState(week?.end ?? yesterday);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<{ name: "amount" | "start" | "end"; message: string }>();
  const formId = useId();
  const submitting = useRef(false);
  const comparison = context.rain_comparison;
  const reading = comparison?.local;
  const gauge = reading?.rain_gauge;
  const power = demo || comparison?.status === "available" ? comparison?.power : undefined;
  const sourceLabel = reading?.kobo ? "KoboCollect" : "Registro manual";
  const closingDay = gauge?.accumulation_end.slice(0, 10);
  const finalDay = closingDay && gauge?.accumulation_end.slice(11, 19) === "00:00:00" ? shiftDay(closingDay, -1) : closingDay;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submitting.current) return;
    setStatus("");
    setError(undefined);
    const form = event.currentTarget;
    function reject(name: "amount" | "start" | "end", message: string) {
      setError({ name, message });
      form.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.focus();
    }
    const text = value.trim().replace(",", ".");
    const amount = Number(text);
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || !Number.isFinite(amount)) {
      reject("amount", "Ingresa un valor de lluvia de cero o más, en milímetros.");
      return;
    }
    if (!validDay(start) || start > yesterday) {
      reject("start", "Elige un primer día completo de acumulación.");
      return;
    }
    if (!validDay(end) || end < start || end > yesterday) {
      reject("end", "El último día debe coincidir con el primero o ser posterior, y haber terminado.");
      return;
    }
    const observed_at = `${shiftDay(end, 1)}T00:00:00${offset}`;
    submitting.current = true;
    try {
      const result = await onSave({
        id: `rain-${crypto.randomUUID()}`, parcel_id: context.parcel.id,
        variable: "precipitation", unit: "mm", value: amount, observed_at,
        author_id: context.producer.id, confirmed: true, data_kind: demo ? "synthetic" : "observed",
        note: demo ? "Lectura hipotética de pluviómetro registrada durante la demo." : "Lectura de pluviómetro informada en Parcela.",
        rain_gauge: {
          method: "rain_gauge", accumulation_start: `${start}T00:00:00${offset}`,
          accumulation_end: observed_at,
          source: {
            id: demo ? "pluviometro-demostracion" : "pluviometro-parcela",
            name: demo ? "Pluviómetro simulado de Don Tino" : "Pluviómetro de la parcela",
            kind: demo ? "synthetic" : "local", retrieved_at: new Date().toISOString(),
          },
        },
      });
      if (result) {
        setStatus("Observación guardada.");
        setValue("");
      }
    } finally {
      submitting.current = false;
    }
  }

  return <section className="panel field-panel" id={demo ? "observacion" : "observacion-parcela"}>
    <h2>Observación de campo</h2>
    {reading || power ? <div className="field-overview">
      {reading && gauge && typeof reading.value === "number" && <div className="field-reading">
        <h3>Lluvia en campo</h3>
        <p className="field-amount">{number(reading.value)} mm</p>
        <p className="small muted">{sourceLabel}{reading.data_kind === "synthetic" && " · Lectura simulada"}</p>
        <p className="small muted">{date(gauge.accumulation_start)} al {finalDay && date(finalDay)}</p>
        {reading.kobo && <small>Guardado en la ficha v{reading.kobo.context_version}</small>}
      </div>}
      {power && <div className="field-reading field-reading-reference">
        <h3>Lluvia regional</h3>
        <p className="field-amount">{power.value == null ? "Sin dato" : `${number(power.value)} mm`}</p>
        <p className="small muted">NASA POWER · {period(power.period)}</p>
      </div>}
    </div> : <p className="muted">Aún no hay registros de lluvia.</p>}

    <details className="field-capture disclosure">
      <summary>{demo ? "Registrar lectura simulada de pluviómetro" : "Registrar lluvia"}</summary>
      <form noValidate onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <div className="form-grid field-inputs">
            <label>Lluvia acumulada (mm)
              <input name="amount" required type="text" inputMode="decimal" value={value}
                aria-invalid={error?.name === "amount" || undefined} aria-describedby={error?.name === "amount" ? `${formId}-error` : undefined}
                onChange={(event) => { setValue(event.target.value); setError(undefined); }} />
            </label>
            <label>Primer día de la acumulación
              <input name="start" required type="date" max={yesterday} value={start}
                aria-invalid={error?.name === "start" || undefined} aria-describedby={error?.name === "start" ? `${formId}-error` : undefined}
                onChange={(event) => { setStart(event.target.value); setError(undefined); }} />
            </label>
            <label>Último día incluido
              <input name="end" required type="date" min={start} max={yesterday} value={end}
                aria-invalid={error?.name === "end" || undefined} aria-describedby={error?.name === "end" ? `${formId}-error` : undefined}
                onChange={(event) => { setEnd(event.target.value); setError(undefined); }} />
            </label>
          </div>
          <p className="small muted">Selecciona días completos en hora de Campeche.</p>
          {error && <p className="notice notice-warn" id={`${formId}-error`} role="alert">{error.message}</p>}
          <div className="button-group">
            <button className="button" type="submit">Guardar observación</button>
            {week && <button className="button button-secondary" type="button" onClick={() => {
              setStart(week.start); setEnd(week.end); setError(undefined);
            }}>Usar semana de NASA POWER</button>}
          </div>
        </fieldset>
      </form>
    </details>
    <p className="form-status" role="status">{status}</p>

    {((reading && gauge) || power || (demo && context.evidence_blocks?.observacion_local)) && <details className="disclosure field-details">
      <summary>Fechas y fuentes</summary>
      <dl className="field-facts">
        {reading && gauge && <>
          <div><dt>Ventana del pluviómetro</dt><dd>{date(gauge.accumulation_start)} al {date(gauge.accumulation_end)} (fin exclusivo)</dd></div>
          <div><dt>Fuente local</dt><dd><SourceLine source={gauge.source} /></dd></div>
        </>}
        {power && <div><dt>Fuente regional</dt><dd><SourceLine source={power.source} /></dd></div>}
      </dl>
      {(demo || power) && comparison?.missing_reason && <p className="small muted">{comparison.missing_reason}</p>}
      {demo && <EvidenceSummary block={context.evidence_blocks?.observacion_local} />}
    </details>}
    {demo && <>
      <div className="button-group">
        <button className="button button-secondary" type="button" disabled={busy} onClick={onRefresh}>Actualizar ficha tras un envío de KoboCollect</button>
      </div>
      <WeatherLink />
    </>}
  </section>;
}
