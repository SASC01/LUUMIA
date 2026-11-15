import { useEffect, useRef } from "react";

type HistoryPoint = { month: string; value: number };
type ProjectionPoint = { month: string; low: number; central: number; high: number };

const axisFormat = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
const monthTickFormat = new Intl.DateTimeFormat("es-MX", { month: "short", year: "2-digit", timeZone: "UTC" });

function monthIndex(month: string) {
  const [year, number] = month.split("-").map(Number);
  return year * 12 + number - 1;
}

function drawTrend(
  node: HTMLCanvasElement, width: number, height: number, history: HistoryPoint[], projection: ProjectionPoint[],
) {
  const ratio = window.devicePixelRatio || 1;
  node.width = Math.round(width * ratio);
  node.height = Math.round(height * ratio);
  const ctx = node.getContext("2d");
  if (!ctx) return;
  ctx.scale(ratio, ratio);
  ctx.font = "12px Atkinson Hyperlegible Next, Arial, sans-serif";

  const values = [...history.map((row) => row.value), ...projection.flatMap((row) => [row.low, row.high])];
  const first = monthIndex(history[0]?.month ?? projection[0].month);
  const last = monthIndex(projection.at(-1)?.month ?? history.at(-1)!.month);
  const span = Math.max(1, last - first);
  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const step = (highest - lowest || Math.max(1, highest * 0.1)) / 4;
  const floor = Math.max(0, lowest - step * 0.6);
  const ceiling = highest + step * 0.6;
  const yLabels = Array.from({ length: 4 }, (_, index) => floor + (ceiling - floor) * index / 3);
  const left = Math.ceil(Math.max(...yLabels.map((value) => ctx.measureText(axisFormat.format(value)).width))) + 10;
  const right = width - 5;
  const top = 13;
  const bottom = height - 24;
  const x = (month: string) => left + (right - left) * (monthIndex(month) - first) / span;
  const y = (value: number) => bottom - (bottom - top) * (value - floor) / (ceiling - floor);

  ctx.strokeStyle = "#dce3db";
  ctx.fillStyle = "#526459";
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  for (const value of yLabels) {
    const pos = y(value);
    ctx.beginPath();
    ctx.moveTo(left, pos);
    ctx.lineTo(right, pos);
    ctx.stroke();
    ctx.fillText(axisFormat.format(value), left - 6, pos);
  }

  const labelCount = width >= 550 ? 5 : 3;
  const ticks = [...new Set(Array.from({ length: labelCount }, (_, index) => Math.round(span * index / (labelCount - 1))))];
  for (const tick of ticks) {
    const absolute = first + tick;
    ctx.textAlign = tick === 0 ? "left" : tick === span ? "right" : "center";
    ctx.fillText(monthTickFormat.format(Date.UTC(Math.floor(absolute / 12), absolute % 12, 1)),
      left + (right - left) * tick / span, height - 9);
  }

  const edge = projection[0];
  if (edge) {
    ctx.fillStyle = "#f2dec3";
    ctx.beginPath();
    ctx.moveTo(x(edge.month), y(edge.high));
    for (const row of projection.slice(1)) ctx.lineTo(x(row.month), y(row.high));
    for (const row of [...projection].reverse()) ctx.lineTo(x(row.month), y(row.low));
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#8c591f";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x(edge.month), y(edge.central));
    for (const row of projection.slice(1)) ctx.lineTo(x(row.month), y(row.central));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = "#296148";
  ctx.fillStyle = "#296148";
  ctx.lineWidth = 2;
  ctx.beginPath();
  history.forEach((row, index) => {
    const previous = history[index - 1];
    if (previous && monthIndex(row.month) === monthIndex(previous.month) + 1) ctx.lineTo(x(row.month), y(row.value));
    else ctx.moveTo(x(row.month), y(row.value));
  });
  ctx.stroke();
  for (const row of history) {
    ctx.beginPath();
    ctx.arc(x(row.month), y(row.value), 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function PriceTrend({ history, projection, unit }: {
  history: HistoryPoint[];
  projection: ProjectionPoint[];
  unit: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current;
    if (!node || !history.length && !projection.length) return;
    const render = () => drawTrend(node, node.clientWidth, node.clientHeight, history, projection);
    render();
    const observer = new ResizeObserver(render);
    observer.observe(node);
    return () => observer.disconnect();
  }, [history, projection]);

  if (!history.length && !projection.length) return null;
  return <div className="price-trend">
    <p className="small muted">{unit}</p>
    <canvas ref={canvas} role="img" aria-label={`Historial y pronóstico mensual en ${unit}. Los valores exactos están en la tabla de precios.`} />
    <ul className="price-trend-key small" aria-label="Series del gráfico">
      {!!history.length && <li>Observado</li>}
      {!!projection.length && <><li>Pronóstico central</li><li>Rango estimado</li></>}
    </ul>
  </div>;
}
