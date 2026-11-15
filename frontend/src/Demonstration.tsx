import { useEffect, useState } from "react";
import { getDemoP1, type DemoP1 } from "./api";
import { Cooperative } from "./Cooperative";
import { date, number } from "./format";
import { Vegetation } from "./Vegetation";

function Probe({ probe, error }: { probe?: DemoP1["probe"]; error?: string }) {
  return <section className="panel" id="sonda" aria-labelledby="sonda-title">
    <h2 id="sonda-title">Humedad del suelo</h2>
    {!probe && <p role="status" className={error ? "notice notice-warn" : "muted"}>
      {error ? "La lectura simulada no está disponible." : "Cargando lectura de demostración…"}
    </p>}
    {probe && <>
      <p className="tag tag-simulated_assumption">Lectura simulada · {probe.n_observaciones} registro</p>
      <p className="probe-value">{number(probe.value)} <span>{probe.unit}</span></p>
      <p className="muted">Proporción de agua en el suelo</p>
      <dl className="facts probe-facts">
        <dt>Sonda de referencia</dt><dd>{probe.sensor_reference}</dd>
        <dt>Profundidad</dt><dd>{number(probe.depth_cm)} cm</dd>
        <dt>Fecha simulada</dt><dd><time dateTime={probe.simulated_date}>{date(probe.simulated_date)}</time></dd>
        <dt>Calibración supuesta</dt><dd>{probe.calibration}</dd>
      </dl>
      <p className="small muted">El valor es ilustrativo y queda fuera del cálculo de rotaciones y márgenes.</p>
      <p className="small"><a href={probe.manufacturer_url} target="_blank" rel="noreferrer">Ficha técnica de METER Group</a></p>
    </>}
  </section>;
}

export function Demonstration() {
  const [data, setData] = useState<DemoP1>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    const controller = new AbortController();
    getDemoP1(controller.signal).then(setData).catch(() => {
      if (!controller.signal.aborted) setError("No se pudieron cargar los cálculos de demostración.");
    });
    return () => controller.abort();
  }, []);

  return <>
    <Vegetation />
    <Probe probe={data?.probe} error={error} />
    <Cooperative spot={data?.spot} cooperative={data?.cooperative} failed={Boolean(error)} />
  </>;
}
