import type { Observation, ParcelContext } from "./api";
import { crops, date, number, todayInCampeche } from "./format";
import "./ParcelOverview.css";

type OverviewLinks = { environmentHref: string; rotationsHref: string; historyHref: string; cropRegistrationHref?: string };
type Reading = { label: string; value: string; source: string; timeframe: string };

const shortDate = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: "UTC" });
const temperature = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });
const utcDay = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00Z`);
const timeframe = (start: string, end: Date) => shortDate.formatRange(utcDay(start), end);

function latestRegional(context: ParcelContext, variable: string, unit: string) {
  return context.observations.reduce<Observation | undefined>((latest, row) => {
    if (row.variable !== variable || row.unit !== unit || row.spatial_support !== "regional" ||
        row.status !== "available" || row.value == null || !Number.isFinite(row.value) ||
        (context.producer.persona_kind !== "composite_demo" && row.data_kind === "synthetic")) return latest;
    return !latest || row.period.end > latest.period.end ? row : latest;
  }, undefined);
}

function environmentalReadings(context: ParcelContext) {
  const demo = context.producer.persona_kind === "composite_demo";
  const local = context.rain_comparison?.local;
  const rainfall = latestRegional(context, "precipitation", "mm");
  const warmth = latestRegional(context, "air_temperature_mean", "degC");
  const readings: Reading[] = [];

  if (local?.rain_gauge && typeof local.value === "number" && Number.isFinite(local.value) &&
      (demo || (local.data_kind === "observed" && local.confirmed))) {
    const { accumulation_start: start, accumulation_end: end } = local.rain_gauge;
    const lastDay = utcDay(end);
    if (end.slice(11, 19) === "00:00:00") lastDay.setUTCDate(lastDay.getUTCDate() - 1);
    readings.push({
      label: "Lluvia en campo", value: `${number(local.value)} mm`,
      source: local.data_kind === "synthetic" ? "Lectura simulada" : "Registro de campo",
      timeframe: timeframe(start, lastDay < utcDay(start) ? utcDay(start) : lastDay),
    });
  }
  for (const [label, row, unit] of [
    ["Lluvia en la región", rainfall, "mm"],
    ["Temperatura media regional", warmth, "°C"],
  ] as const) {
    if (row?.value == null) continue;
    readings.push({
      label, value: `${unit === "°C" ? temperature.format(row.value) : number(row.value)} ${unit}`,
      source: row.data_kind === "synthetic" ? "Referencia simulada" : row.source.name,
      timeframe: timeframe(row.period.start, utcDay(row.period.end)),
    });
  }
  return { readings, hasRegionalClimate: Boolean(rainfall || warmth) };
}

function cropRecord(context: ParcelContext) {
  const today = todayInCampeche();
  const records = context.history.filter((item) => context.producer.persona_kind === "composite_demo" || item.data_kind === "observed");
  const current = records.filter((item) =>
    item.data_kind === "observed" && item.period && item.period.start <= today && item.period.end >= today,
  ).sort((left, right) => right.sequence - left.sequence)[0];
  const previous = records.filter((item) => !item.period || item.period.end < today)
    .sort((left, right) => right.sequence - left.sequence)[0];
  const names = (ids: string[]) => ids.map((id) => crops[id] ?? id).join(" + ");
  return {
    current: current ? names(current.crop_ids) : "Sin confirmar",
    confirmed: Boolean(current),
    startedOn: current?.period?.start,
    previous: !current && previous ? `${names(previous.crop_ids)}${previous.period ? "" : " (sin fecha)"}` : null,
  };
}

function nextStep(context: ParcelContext, readings: Reading[], { environmentHref, rotationsHref, cropRegistrationHref }: OverviewLinks) {
  if (context.evaluation_state === "pendiente_de_recalculo") return {
    title: "Actualiza la evaluación",
    text: "Consulta las opciones con la información más reciente de la ficha.",
    action: "Abrir evaluación", href: rotationsHref,
  };
  const evaluation = context.evaluation;
  const first = evaluation?.recommendations[0];
  if (evaluation && first) {
    const leaders = evaluation.recommendations.filter((entry) => entry.total_score === first.total_score);
    const tied = leaders.length > 1;
    if (tied && cropRegistrationHref) return {
      title: leaders.map((entry) => entry.candidate.label).join(" · "),
      text: "Comparten el puntaje más alto para el siguiente ciclo.",
      action: "Comparar cultivos", href: rotationsHref,
    };
    return {
      title: first.candidate.label,
      text: tied ? "Comparte el puntaje más alto de la evaluación." : "Es la primera opción en la evaluación de rotaciones.",
      action: tied ? "Comparar rotaciones" : "Ver la recomendación", href: rotationsHref,
    };
  }
  if (evaluation) return {
    title: "Revisa las opciones de siembra",
    text: "La evaluación no tiene una rotación para recomendar con los datos disponibles.",
    action: "Ver las opciones evaluadas", href: rotationsHref,
  };
  if (context.producer.persona_kind === "composite_demo") return {
    title: "Prepara la evaluación de ejemplo",
    text: "Consulta qué rotaciones admite la ficha de Don Tino.",
    action: "Abrir rotaciones", href: rotationsHref,
  };
  if (cropRegistrationHref && !context.history.some((cycle) => cycle.data_kind === "observed" && cycle.period)) return {
    title: "Registra el cultivo de tu parcela",
    text: "Con un ciclo fechado podrás comparar opciones para la siguiente siembra.",
    action: "Registrar cultivo", href: cropRegistrationHref,
  };
  return readings.length ? {
    title: "Prepara tu plan de siembra",
    text: "Elige qué sembrar en cada zona y estima tu cosecha.",
    action: "Abrir el plan", href: rotationsHref,
  } : {
    title: "Registra la lluvia de tu parcela",
    text: "Si tienes una lectura de pluviómetro, guárdala con sus fechas.",
    action: "Abrir observaciones de campo", href: environmentHref,
  };
}

function importantAlert(context: ParcelContext) {
  if (context.evaluation_state === "pendiente_de_recalculo") {
    return {
      title: "Evaluación pendiente de actualizar",
      text: context.recalculation_reason ?? "Cambió la información de la ficha.",
    };
  }
  const evaluation = context.evaluation;
  const excluded = evaluation?.excluded.length ?? 0;
  if (evaluation?.status === "needs_confirmation") return {
    title: "Hay condiciones por confirmar",
    text: "Revisa los datos pendientes en las rotaciones evaluadas.",
  };
  if (excluded > 0) return {
    title: "Hay restricciones de rotación",
    text: excluded === 1 ? "Una opción quedó fuera." : `${number(excluded)} opciones quedaron fuera.`,
  };
  return null;
}

export function ParcelOverview({ context, titleId, ...links }: { context: ParcelContext; titleId: string } & OverviewLinks) {
  const { parcel, producer } = context;
  const title = typeof parcel.name === "string" ? parcel.name : producer.display_name;
  const location = [parcel.municipality, parcel.state].filter((part) => part && part !== "Sin registrar").join(", ");
  const crop = cropRecord(context);
  const { readings, hasRegionalClimate } = environmentalReadings(context);
  const alert = importantAlert(context);
  const next = nextStep(context, readings, links);
  const suggested = Boolean(context.evaluation?.recommendations.length && context.evaluation_state !== "pendiente_de_recalculo");
  const condition = hasRegionalClimate ? "Hay datos de clima regional" :
    readings.length ? "Hay registros de lluvia en campo" : "Aún faltan mediciones de campo";

  return <div className="parcel-overview">
    <header className="parcel-overview-heading">
      <h1 id={titleId} tabIndex={-1}>{title}</h1>
      <p className="parcel-overview-site"><strong>{number(parcel.declared_area_ha)} ha</strong><span>{location || "Ubicación sin registrar"}</span></p>
      <p className="parcel-overview-crop"><span>Cultivo actual</span><strong>{crop.current}</strong>
        {crop.startedOn && <span>Desde <time dateTime={crop.startedOn}>{date(crop.startedOn)}</time></span>}
        {crop.previous && <a href={links.historyHref}>Último registro · {crop.previous}</a>}
        {!crop.confirmed && links.cropRegistrationHref && (crop.previous || context.evaluation) &&
          <a href={links.cropRegistrationHref}>Registrar el cultivo actual</a>}
      </p>
    </header>

    <div className="parcel-overview-body">
      <section className="parcel-overview-conditions">
        <h2>Condiciones de la parcela</h2>
        <p className="parcel-overview-status">{condition}</p>
      </section>

      {alert && <section className="parcel-overview-alert">
        <span className="parcel-overview-alert-mark" aria-hidden="true">!</span>
        <div><h2>{alert.title}</h2><p>{alert.text}</p></div>
      </section>}

      <section className="parcel-overview-next">
        <h2>{suggested ? (links.cropRegistrationHref ? "Opciones para la siguiente siembra" : "Rotación sugerida") : "Siguiente paso"}</h2>
        <p className="parcel-overview-next-title">{next.title}</p>
        <p className="parcel-overview-next-text">{next.text}</p>
        <a className="button parcel-overview-action" href={next.href}>{next.action}<span aria-hidden="true">→</span></a>
      </section>

      {readings.length > 0 && <dl className="parcel-overview-readings" aria-label="Indicadores ambientales">
        {readings.map((reading) => <div key={reading.label}>
          <dt>{reading.label}</dt>
          <dd><strong>{reading.value}</strong><span>{reading.source} · {reading.timeframe}</span></dd>
        </div>)}
      </dl>}
    </div>
  </div>;
}
