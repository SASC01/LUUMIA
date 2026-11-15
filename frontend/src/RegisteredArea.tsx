import { useRef, useState, type FormEvent } from "react";
import { ActionFeedback } from "./ActionFeedback";
import { ApiFailure, getContext, historicalUrl, saveRegisteredArea, type ParcelContext } from "./api";
import { number } from "./format";
import { areaText, areaUnits } from "./parcelArea";
import "./RegisteredArea.css";

const localDate = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "America/Mexico_City" });

export function focusRegisteredArea() {
  const button = document.getElementById("registered-area-action");
  if (button?.getAttribute("aria-expanded") === "false") button.click();
  else document.getElementById("registered-area-value")?.focus();
}

export function RegisteredArea({ context, onSaved }: {
  context: ParcelContext;
  onSaved: (updated: ParcelContext) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [expected, setExpected] = useState(context.context_version);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [invalidArea, setInvalidArea] = useState(false);
  const [receipt, setReceipt] = useState("");
  const action = useRef<HTMLButtonElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const changes = context.registered_area_history ?? [];

  function toggle() {
    setOpen(!open);
    setError("");
    setInvalidArea(false);
    if (!open) {
      setInput(String(context.parcel.declared_area_ha));
      setExpected(context.context_version);
      setReceipt("");
      requestAnimationFrame(() => field.current?.focus());
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const units = areaUnits(input);
    if (!units) {
      setError("Escribe una superficie mayor que cero, con hasta nueve cifras enteras y tres decimales.");
      setInvalidArea(true);
      field.current?.focus();
      return;
    }
    setError("");
    setInvalidArea(false);
    setSaving(true);
    try {
      const next = await saveRegisteredArea(context.parcel.id, {
        expected_context_version: expected,
        declared_area_ha: areaText(units),
      });
      onSaved(next);
      setReceipt(next.context_version === expected
        ? `La ficha v${next.context_version} ya tenía ${number(next.parcel.declared_area_ha)} ha registradas.`
        : `Superficie registrada de ${number(next.parcel.declared_area_ha)} ha en la ficha v${next.context_version}.`);
      setOpen(false);
      requestAnimationFrame(() => action.current?.focus());
    } catch (failure) {
      if (failure instanceof ApiFailure && failure.status === 409) {
        try {
          const latest = await getContext(context.parcel.id);
          onSaved(latest);
          setExpected(latest.context_version);
          setError(`La ficha cambió a ${number(latest.parcel.declared_area_ha)} ha. Conservamos tu cifra. Revísala antes de guardar.`);
        } catch {
          setError(failure.message);
        }
      } else {
        setError(failure instanceof Error ? failure.message : "No se pudo guardar la superficie.");
      }
    } finally {
      setSaving(false);
    }
  }

  return <div className="registered-area">
    <button id="registered-area-action" className="button button-secondary" type="button" ref={action} aria-expanded={open}
      aria-controls={open ? "registered-area-form" : undefined} disabled={saving} onClick={toggle}>Cambiar superficie registrada</button>
    {open && <form className="registered-area-form" id="registered-area-form" aria-label="Cambiar superficie registrada"
      noValidate onSubmit={(event) => void submit(event)}>
      <fieldset disabled={saving}>
        <label className="registered-area-label">Superficie registrada (ha)
          <input id="registered-area-value" type="text" inputMode="decimal" value={input} ref={field} aria-invalid={invalidArea || undefined}
            aria-describedby={invalidArea ? "registered-area-help registered-area-error" : "registered-area-help"}
            onChange={(event) => {
              setInput(event.currentTarget.value);
              setError("");
              setInvalidArea(false);
            }} />
        </label>
        <p className="small muted" id="registered-area-help">El dato declarado define cuántas hectáreas puedes incluir en el plan de siembra.</p>
        {error && <p className="notice notice-warn" id="registered-area-error" role="alert">{error}</p>}
        <div className="button-group"><button className="button" type="submit">Guardar superficie</button></div>
      </fieldset>
    </form>}
    <ActionFeedback pending={saving ? "Guardando superficie…" : undefined} success={receipt} />
    {changes.length > 0 && <details className="disclosure registered-area-history">
      <summary>Historial de superficie</summary>
      <ul>{[...changes].reverse().map((change) => <li key={change.context_version}>
        <strong>{number(change.previous_area_ha)} ha → {number(change.declared_area_ha)} ha</strong>
        <span> Ficha v{change.context_version} · <time dateTime={change.recorded_at}>{localDate.format(new Date(change.recorded_at))}</time></span>
        <a href={historicalUrl(context.parcel.id, change.context_version - 1)} target="_blank" rel="noreferrer">
          Ver ficha anterior v{change.context_version - 1}
        </a>
      </li>)}</ul>
    </details>}
  </div>;
}
