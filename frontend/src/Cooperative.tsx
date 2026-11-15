import type { CommercialResult } from "./api";
import { number, period, pesos } from "./format";
import "./Cooperative.css";

const harvestWeeks = [
  {
    start: "2027-03-01", end: "2027-03-07",
    lots: [{ producer: "Productora A", volumeKg: 2100 }],
  },
  {
    start: "2027-03-08", end: "2027-03-14",
    lots: [
      { producer: "Don Tino", volumeKg: 4800 },
      { producer: "Productor B", volumeKg: 3200 },
      { producer: "Productora C", volumeKg: 2800 },
    ],
  },
  {
    start: "2027-03-15", end: "2027-03-21",
    lots: [{ producer: "Productor D", volumeKg: 3000 }],
  },
].map((week) => ({ ...week, totalKg: week.lots.reduce((sum, lot) => sum + lot.volumeKg, 0) }));

function HarvestWindows() {
  const highestKg = Math.max(...harvestWeeks.map((week) => week.totalKg));
  return <section aria-labelledby="cosechas-semana">
    <h3 id="cosechas-semana">Cosechas en la misma semana</h3>
    <p className="small muted">Ejemplo simulado de lotes parciales de maíz en marzo de 2027. El comprador y el cupo siguen por confirmar.</p>
    <ul className="coop-weeks">
      {harvestWeeks.map((week) => <li key={week.start}>
        <div className="coop-week-heading">
          <strong>{period(week)}</strong>
          <b>{number(week.totalKg)} kg</b>
        </div>
        <div className="coop-volume-track" aria-hidden="true">
          <span style={{ width: `${100 * week.totalKg / highestKg}%` }} />
        </div>
        <ul className="coop-lots" aria-label="Lotes de la semana">
          {week.lots.map((lot) => <li key={lot.producer}>{lot.producer} · {number(lot.volumeKg)} kg</li>)}
        </ul>
      </li>)}
    </ul>
  </section>;
}

function MarginRanges({ spot, cooperative }: { spot: CommercialResult; cooperative: CommercialResult }) {
  const ranges = [
    { label: "Venta spot", result: spot, className: "coop-margin-spot" },
    { label: "Cooperativa", result: cooperative, className: "coop-margin-group" },
  ].map((row) => ({
    ...row, low: Number(row.result.margen_min_mxn), high: Number(row.result.margen_max_mxn),
  }));
  const minimum = Math.min(0, ...ranges.map((range) => range.low));
  const maximum = Math.max(0, ...ranges.map((range) => range.high));
  const scale = (value: number) => maximum === minimum ? 50 : 100 * (value - minimum) / (maximum - minimum);
  const cuposMediosIguales = Number(spot.cupo_centro_kg) === Number(cooperative.cupo_centro_kg);

  return <figure className="coop-margin" aria-labelledby="margen-cooperativa">
    <h3 id="margen-cooperativa">Margen bajo supuestos comerciales</h3>
    <p className="small muted">Ejemplo fijo de la demo.{cuposMediosIguales && ` Cupo medio de ${number(spot.cupo_centro_kg)} kg en los dos escenarios.`}</p>
    <p className="small muted" aria-hidden="true">La línea discontinua marca un margen de $0 MXN.</p>
    <ul className="coop-ranges">
      {ranges.map(({ label, result, className, low, high }) => <li key={label}>
        <strong>{label}</strong>
        <p className="small muted">Cupo supuesto de {number(result.bajo.cupo_kg)} a {number(result.alto.cupo_kg)} kg</p>
        <div className="coop-margin-track" aria-hidden="true">
          <span className="coop-zero" style={{ left: `${scale(0)}%` }} />
          <span className={`coop-margin-band ${className}`} style={{
            left: `${scale(low)}%`, width: `${scale(high) - scale(low)}%`,
          }} />
        </div>
        <div className="coop-margin-labels">
          <span>{pesos(low)} a {pesos(high)} MXN</span>
          <span className="small muted">Amplitud de {pesos(high - low)} MXN</span>
        </div>
      </li>)}
    </ul>
    <p className="small muted">La comparación conserva el precio, los costos y la cosecha disponible. Cada rango de margen refleja el cupo supuesto de venta.</p>
  </figure>;
}

export function Cooperative({ spot, cooperative, failed }: {
  spot?: CommercialResult;
  cooperative?: CommercialResult;
  failed: boolean;
}) {
  return <section className="panel coop-panel" id="cooperativa" aria-labelledby="cooperativa-titulo">
    <h2 id="cooperativa-titulo">Cosechas para venta en cooperativa</h2>
    <HarvestWindows />
    {spot && cooperative ? <MarginRanges spot={spot} cooperative={cooperative} /> :
      <p role="status" className="small muted coop-margin">
        {failed ? "La comparación de márgenes no está disponible." : "Cargando la comparación de márgenes…"}
      </p>}
  </section>;
}
