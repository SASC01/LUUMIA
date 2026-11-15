import { useRef, useState, type FormEvent } from "react";
import { ActionFeedback } from "./ActionFeedback";
import {
  ApiFailure, correctZoneSale, getSowingSales, registerZoneSale, voidZoneSale,
  type SowingSalesReport, type ZoneSaleCorrection, type ZoneSaleRegistration, type ZoneSaleVoid,
} from "./api";
import { date, number, pesoRate, pesos } from "./format";
import { downloadSalesReport, zoneName as zoneCode } from "./reportCsv";
import "./ZoneSales.css";

type SaleTotals = SowingSalesReport["totals"];
type SaleZone = SowingSalesReport["zones"][number];
type Sale = SowingSalesReport["sales"][number];
type Operation = { kind: "register" } | { kind: "correct" | "void"; saleId: string; revision: number };
type PendingSale =
  | { kind: "register"; planVersion: number; payload: ZoneSaleRegistration }
  | { kind: "correct"; planVersion: number; saleId: string; payload: ZoneSaleCorrection }
  | { kind: "void"; planVersion: number; saleId: string; payload: ZoneSaleVoid };

const campecheDate = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Mexico_City", dateStyle: "short" });
const changeTime = new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" });
const currentDate = () => campecheDate.format(new Date());
const zoneName = (zone: SaleZone) => `Zona ${zoneCode(zone.zone_id)} · ${zone.crop_label}`;

function newForm(sale?: Pick<ZoneSaleRegistration, "zone_id" | "sold_on" | "sold_kg" | "price_mxn_kg" | "cost_mxn" | "reference">, reason = "") {
  return {
    zone: sale?.zone_id ?? "", soldOn: sale?.sold_on ?? currentDate(), kilos: String(sale?.sold_kg ?? ""),
    price: String(sale?.price_mxn_kg ?? ""), costs: String(sale?.cost_mxn ?? ""), reference: sale?.reference ?? "", reason,
  };
}

type SaleForm = ReturnType<typeof newForm>;
type Issue = { field?: keyof SaleForm; message: string };
const retryIssue: Issue = { message: "No pudimos confirmar el guardado. Reintenta con el mismo botón para enviar la misma operación." };
const saleActions = {
  register: { title: "Registrar una venta", submit: "Guardar venta", pending: "Guardando venta…", receipt: "Venta registrada" },
  correct: { title: "Corregir una venta", submit: "Guardar corrección", pending: "Guardando corrección…", receipt: "Venta corregida" },
  void: { title: "Anular una venta", submit: "Confirmar anulación", pending: "Anulando venta…", receipt: "Venta anulada" },
} as const;

function decimalInput(value: string, integerDigits: number, places: number) {
  const normalized = value.trim().replace(",", ".");
  const [whole, fraction = ""] = normalized.replace(/^0+(?=\d)/, "").split(".");
  const valid = /^(?:\d+\.?\d*|\.\d+)$/.test(normalized) && whole.length <= integerDigits && fraction.length <= places;
  return valid ? `${whole || "0"}${fraction ? `.${fraction}` : ""}` : null;
}

function parseForm(form: SaleForm, zones: SowingSalesReport["zones"]): { payload: Omit<ZoneSaleRegistration, "sale_id" | "plan_version"> } | { issue: Issue } {
  if (!zones.some((zone) => zone.zone_id === form.zone)) return { issue: { field: "zone", message: "Elige la zona donde se produjo la cosecha." } };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.soldOn) || form.soldOn > currentDate()) {
    return { issue: { field: "soldOn", message: "Elige la fecha en que ocurrió la venta. Puede ser hoy o una fecha anterior." } };
  }
  const kilos = decimalInput(form.kilos, 9, 3);
  if (kilos === null || Number(kilos) <= 0) return { issue: { field: "kilos", message: "Escribe cuántos kilos vendiste. Usa un número mayor a cero con hasta tres decimales." } };
  const price = decimalInput(form.price, 10, 6);
  if (price === null) return { issue: { field: "price", message: "Escribe el precio por kilo con hasta seis decimales." } };
  const costs = decimalInput(form.costs, 14, 2);
  if (costs === null) return { issue: { field: "costs", message: "Escribe los costos de esta venta con hasta dos decimales. Usa 0 si no tuviste costos." } };
  return { payload: { zone_id: form.zone, sold_on: form.soldOn, sold_kg: kilos, price_mxn_kg: price,
    cost_mxn: costs, reference: form.reference.trim() || null } };
}

function pendingSale(key: string, planVersion: number | null): PendingSale | undefined {
  try {
    const serialized = sessionStorage.getItem(key);
    if (!serialized) return;
    const sale = JSON.parse(serialized) as PendingSale | ZoneSaleRegistration | null;
    if (!sale || typeof sale !== "object") return;
    if ("kind" in sale && sale.planVersion === planVersion && sale.payload) {
      if (sale.kind === "register" && typeof sale.payload.sale_id === "string") return sale;
      if ((sale.kind === "correct" || sale.kind === "void") && typeof sale.saleId === "string" && typeof sale.payload.change_id === "string") return sale;
    }
    if ("sale_id" in sale && sale.plan_version === planVersion && typeof sale.sale_id === "string") {
      return { kind: "register", planVersion, payload: sale };
    }
  } catch { /* El formulario puede reintentar durante la sesión aunque el almacenamiento no esté disponible. */ }
}

function rememberSale(key: string, sale?: PendingSale) {
  try {
    if (sale) sessionStorage.setItem(key, JSON.stringify(sale));
    else sessionStorage.removeItem(key);
  } catch { /* El mismo intento también se conserva en el formulario. */ }
}

function openedOperation(attempt: PendingSale | undefined): Operation | undefined {
  if (!attempt) return;
  if (attempt.kind === "register") return { kind: "register" };
  return { kind: attempt.kind, saleId: attempt.saleId, revision: attempt.payload.expected_revision };
}

function sendSale(parcelId: string, attempt: PendingSale) {
  switch (attempt.kind) {
    case "register": return registerZoneSale(parcelId, attempt.payload);
    case "correct": return correctZoneSale(parcelId, attempt.saleId, attempt.payload);
    case "void": return voidZoneSale(parcelId, attempt.saleId, attempt.payload);
  }
}

function SalesComparison({ report }: { report: SowingSalesReport }) {
  const changedZones = new Set(report.history?.map((change) => change.previous.zone_id));
  return <section className="zone-sales-comparison" aria-labelledby="zone-sales-comparison">
    <h3 id="zone-sales-comparison">Ganancia registrada y estimada</h3>
    <p className="muted">La ganancia registrada acumula los ingresos y costos de las ventas vigentes. La estimación corresponde al plan completo. Los importes están en MXN.</p>
    <SaleAmounts title="Total del plan" amounts={report.totals} hasHistory={changedZones.size > 0} />
    <ul className="zone-sales-list" aria-label="Comparación por zona">
      {report.zones.map((zone) => <li key={zone.zone_id}><SaleAmounts title={zoneName(zone)} amounts={zone} hasHistory={changedZones.has(zone.zone_id)} /></li>)}
    </ul>
  </section>;
}

function SaleAmounts({ title, amounts, hasHistory }: { title: string; amounts: SaleTotals; hasHistory: boolean }) {
  const { estimated_margin_mxn: estimate, actual_margin_mxn: actual, margin_difference_mxn: difference } = amounts;
  const actualLabel = actual != null ? pesos(actual) : hasHistory ? "Sin ventas vigentes" : "Sin ventas registradas";
  return <article className="zone-sales-amounts">
    <h4>{title}</h4>
    <dl>
      <div><dt>Ganancia estimada</dt><dd>{estimate == null ? "Sin estimación" : pesos(estimate)}</dd></div>
      <div><dt>Ganancia real acumulada</dt><dd>{actualLabel}</dd></div>
      <div><dt>Diferencia hasta ahora</dt><dd>{difference == null ? "Sin comparación" : pesos(difference)}</dd></div>
    </dl>
    <dl className="zone-sales-volume">
      <div><dt>Kilos previstos para venta</dt><dd>{amounts.estimated_sold_kg == null ? "Sin estimación" : `${number(amounts.estimated_sold_kg)} kg`}</dd></div>
      {amounts.sale_count > 0 && <>
        <div><dt>Kilos vendidos</dt><dd>{amounts.actual_sold_kg == null ? "Sin dato" : `${number(amounts.actual_sold_kg)} kg`}</dd></div>
        <div><dt>Ingresos registrados</dt><dd>{amounts.actual_revenue_mxn == null ? "Sin dato" : pesos(amounts.actual_revenue_mxn)}</dd></div>
        <div><dt>Costos registrados</dt><dd>{amounts.actual_cost_mxn == null ? "Sin dato" : pesos(amounts.actual_cost_mxn)}</dd></div>
      </>}
    </dl>
  </article>;
}

function SaleDetails({ sale, zone }: { sale: Sale; zone: string }) {
  return <>
    <div>
      <strong>{zone}</strong>
      <p><time dateTime={sale.sold_on}>{date(sale.sold_on)}</time> · {number(sale.sold_kg)} kg a {pesoRate(sale.price_mxn_kg)}/kg</p>
      <p className="muted">Capturada el <time dateTime={sale.recorded_at}>{date(campecheDate.format(new Date(sale.recorded_at)))}</time>{sale.reference && ` · ${sale.reference}`}</p>
    </div>
    <dl>
      <div><dt>Ingreso</dt><dd>{pesos(sale.revenue_mxn)}</dd></div>
      <div><dt>Costo</dt><dd>{pesos(sale.cost_mxn)}</dd></div>
      <div><dt>Ganancia de la venta</dt><dd>{pesos(sale.margin_mxn)}</dd></div>
    </dl>
  </>;
}

function SalesHistory({ report, actionsDisabled, onOpen }: {
  report: SowingSalesReport;
  actionsDisabled: boolean;
  onOpen: (operation: "correct" | "void", sale: Sale) => void;
}) {
  const names = new Map(report.zones.map((zone) => [zone.zone_id, zoneName(zone)]));
  const history = report.history ?? [];
  return <section aria-labelledby="zone-sales-history" className="zone-sales-history">
    <h3 id="zone-sales-history">Historial de ventas</h3>
    {report.sales.length === 0 ? <p className="muted">{history.length ? "Este plan ya no tiene ventas vigentes." : "Aún no hay ventas registradas para este plan."}</p>
      : <ul className="zone-sales-list" aria-label="Ventas vigentes">
      {report.sales.map((sale) => <li className="zone-sale-record" key={sale.sale_id}>
        <SaleDetails sale={sale} zone={names.get(sale.zone_id) ?? sale.zone_id} />
        <div className="zone-sale-actions">
          <button className="button button-secondary" type="button" id={`zone-sale-correct-${sale.sale_id}`} disabled={actionsDisabled}
            onClick={() => onOpen("correct", sale)}>Corregir venta</button>
          <button className="zone-sale-void" type="button" disabled={actionsDisabled} onClick={() => onOpen("void", sale)}>Anular venta</button>
        </div>
      </li>)}
    </ul>}
    {history.length > 0 && <section className="zone-sale-changes" aria-labelledby="zone-sale-changes-title">
      <h4 id="zone-sale-changes-title">Historial de cambios</h4>
      <ul className="zone-sales-list" aria-labelledby="zone-sale-changes-title">
        {history.map((change) => <li key={change.change_id}>
          <h5>{change.action === "corrected" ? "Corrección" : "Anulación"}</h5>
          <p className="muted"><time dateTime={change.recorded_at}>{changeTime.format(new Date(change.recorded_at))}</time>
            {change.reason && ` · ${change.reason}`}</p>
          <div className="zone-sale-change-grid">
            <div className="zone-sale-change-values">
              <p className="zone-sale-version-label">{change.action === "corrected" ? "Venta anterior" : "Venta anulada"}</p>
              <SaleDetails sale={change.previous} zone={names.get(change.previous.zone_id) ?? change.previous.zone_id} />
            </div>
            {change.replacement && <div className="zone-sale-change-values">
              <p className="zone-sale-version-label">Venta corregida</p>
              <SaleDetails sale={change.replacement} zone={names.get(change.replacement.zone_id) ?? change.replacement.zone_id} />
            </div>}
          </div>
        </li>)}
      </ul>
    </section>}
  </section>;
}

export function ZoneSales({ parcelId, report, onSelectPlan, onRegistered }: {
  parcelId: string;
  report: SowingSalesReport;
  onSelectPlan: (planVersion: number) => void;
  onRegistered: (report: SowingSalesReport) => void;
}) {
  const planVersion = report.plan_version;
  const pendingKey = `luumia-sale-pending/${parcelId}/${planVersion}`;
  const [retry, setRetry] = useState(() => pendingSale(pendingKey, planVersion));
  const [operation, setOperation] = useState(() => openedOperation(retry));
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<Pick<PendingSale, "kind" | "planVersion">>();
  const [form, setForm] = useState<SaleForm>(() => {
    if (retry?.kind === "register") return newForm(retry.payload);
    return newForm(retry?.kind === "correct" ? retry.payload : undefined, retry?.payload.reason ?? "");
  });
  const [issue, setIssue] = useState<Issue | undefined>(retry ? retryIssue : undefined);
  const submitLock = useRef(false);
  const openButton = useRef<HTMLButtonElement>(null);
  const formTitle = useRef<HTMLHeadingElement>(null);
  const open = Boolean(operation);
  const labels = operation && saleActions[operation.kind];
  const selected = operation?.kind === "register" || !operation ? undefined : report.sales.find((sale) => sale.sale_id === operation.saleId);
  const stale = operation && operation.kind !== "register" && (!selected || (selected.revision ?? 1) !== operation.revision) && !retry;

  function edit(field: keyof SaleForm, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
    setIssue(undefined);
  }

  function dismiss(focusId?: string) {
    setOperation(undefined);
    setIssue(undefined);
    requestAnimationFrame(() => (focusId ? document.getElementById(focusId) ?? openButton.current : openButton.current)?.focus());
  }

  function showForm(kind: "register" | "correct" | "void", sale?: Sale) {
    setForm(newForm(sale));
    setIssue(undefined);
    setReceipt(undefined);
    if (kind === "register") setOperation({ kind });
    else if (sale) setOperation({ kind, saleId: sale.sale_id, revision: sale.revision ?? 1 });
    requestAnimationFrame(() => formTitle.current?.focus());
  }

  function inputProps(field: keyof SaleForm) {
    return {
      id: `zone-sale-${field}`,
      "aria-invalid": issue?.field === field || undefined,
      "aria-describedby": issue?.field === field ? "zone-sale-error" : undefined,
    };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || planVersion == null || !operation || stale) return;
    let attempt = retry;
    if (!attempt) {
      const kind = operation.kind;
      const id = crypto.randomUUID();
      const reason = form.reason.trim() || null;
      if (kind === "void") {
        attempt = { kind, planVersion, saleId: operation.saleId, payload: { change_id: id, expected_revision: operation.revision, reason } };
      } else {
        const parsed = parseForm(form, report.zones);
        if ("issue" in parsed) {
          setIssue(parsed.issue);
          requestAnimationFrame(() => document.getElementById(`zone-sale-${parsed.issue.field}`)?.focus());
          return;
        }
        attempt = kind === "register" ? { kind, planVersion, payload: { ...parsed.payload, sale_id: id, plan_version: planVersion } }
          : { kind, planVersion, saleId: operation.saleId,
            payload: { ...parsed.payload, change_id: id, expected_revision: operation.revision, reason } };
      }
    }

    submitLock.current = true;
    rememberSale(pendingKey, attempt);
    setSaving(true);
    setIssue(undefined);
    try {
      const next = await sendSale(parcelId, attempt);
      rememberSale(pendingKey);
      onRegistered(next);
      setRetry(undefined);
      setReceipt({ kind: attempt.kind, planVersion });
      dismiss(attempt.kind === "correct" ? `zone-sale-correct-${attempt.saleId}` : undefined);
    } catch (error) {
      if (!(error instanceof ApiFailure) || error.status === 0 || error.status >= 500) {
        setRetry(attempt);
        setIssue(retryIssue);
      } else {
        rememberSale(pendingKey);
        setRetry(undefined);
        if (error.status === 409 && attempt.kind !== "register") {
          try {
            onRegistered(await getSowingSales(parcelId, planVersion));
            setIssue({ message: "La venta cambió. Tus datos siguen en el formulario. Revisa la versión vigente antes de enviar otro cambio." });
          } catch {
            setIssue({ message: error.message });
          }
        } else setIssue({ message: error.message });
      }
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }

  return <section className="metrics-content zone-sales" aria-labelledby="zone-sales-title">
    <header className="zone-sales-heading">
      <div><h2 id="zone-sales-title">Ventas por zona</h2>{planVersion != null && <p className="muted">Plan v{planVersion}</p>}</div>
      {planVersion != null && <div className="zone-sales-actions">
        {report.zones.length > 0 && <button className="button" type="button" ref={openButton}
          aria-expanded={operation?.kind === "register"} aria-controls={operation?.kind === "register" ? "zone-sale-form" : undefined}
          disabled={open || saving} onClick={() => showForm("register")}>Registrar venta</button>}
        <button className="button button-secondary" type="button" disabled={saving}
          onClick={() => downloadSalesReport(report)}>Descargar ventas y cambios (CSV)</button>
      </div>}
    </header>
    {planVersion == null ? <p>Comparte un plan en <a href="#parcela">Parcela</a> para registrar las ventas de sus zonas.</p> : <>
      <div className="form-grid zone-sales-plan">
        <label>Plan compartido<select id="zone-sales-plan-select" value={planVersion} disabled={open || saving} onChange={(event) => {
          setReceipt(undefined);
          onSelectPlan(Number(event.currentTarget.value));
        }}>
          {report.plans.map((plan) => <option key={plan.plan_version} value={plan.plan_version}>
            Plan v{plan.plan_version} · Ficha v{plan.context_version} · Primavera–verano {plan.campaign_year}
          </option>)}
        </select></label>
      </div>
      {operation && labels && <section className="zone-sale-editor" id="zone-sale-form" aria-labelledby="zone-sale-form-title">
        <h3 ref={formTitle} tabIndex={-1} id="zone-sale-form-title">{labels.title}</h3>
        <form aria-labelledby="zone-sale-form-title" noValidate onSubmit={(event) => void submit(event)}>
          <fieldset disabled={saving || !!retry}>
            {operation.kind === "void" ? <div className="zone-sale-void-summary">
              {selected && <SaleDetails sale={selected} zone={report.zones.find((zone) => zone.zone_id === selected.zone_id)?.crop_label ?? selected.zone_id} />}
              <p>Al anularla, se recalcula la ganancia con las demás ventas vigentes. Esta venta queda en el historial.</p>
            </div> : <><div className="form-grid zone-sale-fields">
              <label>Zona<select required {...inputProps("zone")} value={form.zone} onChange={(event) => edit("zone", event.currentTarget.value)}>
                <option value="">Selecciona una zona</option>
                {report.zones.map((zone) => <option key={zone.zone_id} value={zone.zone_id}>{zoneName(zone)}</option>)}
              </select></label>
              <label>Fecha de venta<input required type="date" max={currentDate()} {...inputProps("soldOn")} value={form.soldOn} onChange={(event) => edit("soldOn", event.currentTarget.value)} /></label>
              <label>Kilos vendidos (kg)<input required type="text" inputMode="decimal" {...inputProps("kilos")} value={form.kilos} onChange={(event) => edit("kilos", event.currentTarget.value)} /></label>
              <label>Precio por kilo (MXN/kg)<input required type="text" inputMode="decimal" {...inputProps("price")} value={form.price} onChange={(event) => edit("price", event.currentTarget.value)} /></label>
              <label>Costos de esta venta (MXN)<input required type="text" inputMode="decimal" {...inputProps("costs")} value={form.costs}
                aria-describedby={issue?.field === "costs" ? "zone-sale-error zone-sale-costs-help" : "zone-sale-costs-help"}
                onChange={(event) => edit("costs", event.currentTarget.value)} /></label>
              <label>Folio o referencia (opcional)<input type="text" maxLength={180} {...inputProps("reference")} value={form.reference} onChange={(event) => edit("reference", event.currentTarget.value)} /></label>
            </div>
            <p id="zone-sale-costs-help" className="small muted">Captura la parte de los costos que corresponde a esta venta. Si vendiste en varios lotes, distribuye los costos de la zona entre ellos.</p></>}
            {operation.kind !== "register" && <div className="form-grid zone-sale-reason">
              <label>Motivo (opcional)<input type="text" maxLength={240} {...inputProps("reason")} value={form.reason} onChange={(event) => edit("reason", event.currentTarget.value)} /></label>
            </div>}
          </fieldset>
          {issue && <p id="zone-sale-error" className="notice notice-warn" role="alert">{issue.message}</p>}
          {stale && <p className="notice" role="status">Hay otra versión de esta venta o ya se anuló. Consulta el historial antes de abrir otra corrección.</p>}
          <div className="button-group">
            <button className={`button${operation.kind === "void" ? " zone-sale-danger" : ""}`} disabled={saving || stale} type="submit">{labels.submit}</button>
            <button className="button button-secondary" disabled={saving || !!retry} type="button" onClick={() => dismiss(operation.kind === "register" ? undefined : `zone-sale-correct-${operation.saleId}`)}>Volver a las ventas</button>
          </div>
        </form>
      </section>}
      <ActionFeedback pending={saving ? labels?.pending : undefined}
        success={receipt && <strong>{saleActions[receipt.kind].receipt} en el plan v{receipt.planVersion}.</strong>} />
      <SalesComparison report={report} />
      <SalesHistory report={report} actionsDisabled={open || saving} onOpen={showForm} />
    </>}
  </section>;
}
