import { useEffect, useState } from "react";
import { getWeatherLinkCurrent, type WeatherLinkCurrent } from "./api";
import { number } from "./format";

const timestamp = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium", timeStyle: "short", timeZone: "UTC",
});

function measured(value: number | null | undefined, unit: string) {
  return value == null ? "Sin dato" : `${number(value)} ${unit}`;
}

export function WeatherLink() {
  const [request, setRequest] = useState({ example: false });
  const [report, setReport] = useState<WeatherLinkCurrent>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    getWeatherLinkCurrent(controller.signal, request.example).then((result) => {
      if (!controller.signal.aborted) setReport(result);
    }).catch((failure: Error) => {
      if (!controller.signal.aborted) setError(failure.message);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [request]);

  function select(example: boolean) {
    setLoading(true);
    setError(undefined);
    setReport(undefined);
    setRequest({ example });
  }

  const example = report?.origin === "documentation";
  const status = example ? "Ejemplo oficial de Davis" : report?.delivery === "cache"
    ? "Consulta reciente guardada en memoria" : "Consulta en vivo";

  return <section id="weatherlink" className="disclosure" aria-labelledby="weatherlink-title">
    <h3 id="weatherlink-title">Estación WeatherLink</h3>
    <div className="button-group">
      <button className="button button-secondary" type="button" disabled={loading}
        onClick={() => select(false)}>Consultar estación</button>
      {(error || (report && report.status !== "available")) && <button className="button button-secondary" type="button"
        disabled={loading} onClick={() => select(true)}>Ver ejemplo oficial</button>}
    </div>
    <div aria-live="polite" aria-atomic="true">
      {loading && <p className="small muted">Cargando información de WeatherLink…</p>}
      {error && <p className="notice notice-warn">{error}</p>}
      {report?.message && <p className={report.status === "available" ? "small muted" : "notice notice-warn"}>{report.message}</p>}
      {report?.status === "available" && <>
        <p><span className={`tag ${example ? "tag-simulated_assumption" : "tag-observed"}`}>{status}</span>
          {report.station_label && <> · {report.station_label}</>}</p>
        {report.readings?.map((reading) => <dl className="facts readings" key={reading.sensor_id}>
          <dt>Sensor</dt><dd>{reading.sensor_id}</dd>
          <dt>Fecha de la lectura</dt><dd><time dateTime={reading.observed_at}>{timestamp.format(new Date(reading.observed_at))} UTC</time></dd>
          <dt>Temperatura</dt><dd>{measured(reading.temperature_c, "°C")}</dd>
          <dt>Humedad relativa</dt><dd>{measured(reading.humidity_pct, "%")}</dd>
          <dt>Lluvia desde medianoche de la estación</dt><dd>{measured(reading.rain_today_mm, "mm")}</dd>
        </dl>)}
      </>}
    </div>
    {report && <p className="small"><a href={report.source_url} target="_blank" rel="noreferrer">Fuente WeatherLink</a></p>}
  </section>;
}
