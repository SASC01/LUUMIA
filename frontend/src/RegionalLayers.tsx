import { useEffect, useState } from "react";
import { date } from "./format";
import "./RegionalLayers.css";

const choices = [
  { id: "smap", label: "Humedad · SMAP" },
  { id: "imerg", label: "Precipitación · IMERG" },
] as const;

type LayerId = typeof choices[number]["id"];
type RegionalLayer = {
  id: LayerId;
  title: string;
  variable: string;
  unit: string;
  resolution: string;
  temporal_label: string;
  date: string;
  retrieved_at: string;
  product: string;
  source_url: string;
  request_url: string;
  image_url: string;
  image_width: number;
  image_height: number;
  bounds: [west: number, south: number, east: number, north: number];
  legend_url?: string;
  legend_image_url?: string;
  legend_alt?: string;
  legend_is_sampled?: boolean;
  legend: { label: string; color?: string }[];
  notes: string[];
  metadata_url?: string;
  citation?: string;
};

type LayerState =
  | { id: LayerId; status: "available"; layer: RegionalLayer }
  | { id: LayerId; status: "missing" };

const region = [-92, 17.5, -87.5, 22];
const donTino = { longitude: -89.8415, latitude: 19.7418 };

function RegionalMap({ layer }: { layer: RegionalLayer }) {
  const [imageMissing, setImageMissing] = useState(false);
  const [west, south, east, north] = layer.bounds;
  const x = 100 * (donTino.longitude - west) / (east - west);
  const y = 100 * (north - donTino.latitude) / (north - south);
  const coastlineMatches = layer.bounds.every((value, index) => value === region[index]);

  return <div className="regional-results">
    <figure className="regional-map">
      {imageMissing ? <p className="notice notice-warn" role="status">La imagen regional no se pudo cargar. La fuente y la leyenda siguen disponibles.</p> :
        <div className="regional-map-frame">
          <img className="regional-data" src={layer.image_url}
            width={layer.image_width} height={layer.image_height}
            alt={`${layer.variable} en la península de Yucatán y sus alrededores, ${date(layer.date)}.`}
            onError={() => setImageMissing(true)} />
          {coastlineMatches && <img className="regional-coast" src="/regional/coastline.png" alt="" aria-hidden="true" />}
          {x >= 0 && x <= 100 && y >= 0 && y <= 100 && <span className="regional-pin" style={{ left: `${x}%`, top: `${y}%` }}>
            <i aria-hidden="true" /><b>Don Tino</b>
          </span>}
        </div>}
      <figcaption className="small muted">El punto marca la ubicación sintética de Don Tino dentro de la región.</figcaption>
    </figure>

    <div className="regional-detail">
      <h3>{layer.title}</h3>
      <dl className="regional-facts">
        <div><dt>Fecha</dt><dd><time dateTime={layer.date}>{date(layer.date)}</time></dd></div>
        <div><dt>Ventana de la capa</dt><dd>{layer.temporal_label}</dd></div>
        <div><dt>Resolución del producto</dt><dd>{layer.resolution}</dd></div>
        <div><dt>Unidad</dt><dd>{layer.unit}</dd></div>
      </dl>
      <fieldset className="regional-legend">
        <legend>Leyenda · {layer.unit}</legend>
        {layer.legend_image_url && <img className="regional-legend-image" src={layer.legend_image_url}
          alt={layer.legend_alt ?? `Escala oficial de ${layer.variable} en ${layer.unit}.`} />}
        {layer.legend_is_sampled && <p className="small muted">Clases seleccionadas de la escala oficial.</p>}
        <ul>
          {layer.legend.map(({ label, color }) => <li key={`${label}-${color}`}>
            <i aria-hidden="true" style={color ? { background: color } : undefined} />{label}
          </li>)}
        </ul>
        {layer.legend_url && <p className="small"><a href={layer.legend_url} target="_blank" rel="noreferrer">Leyenda original de NASA</a></p>}
      </fieldset>
      {layer.notes.map((note) => <p className="small muted" key={note}>{note}</p>)}
      <details className="disclosure regional-sources">
        <summary>Producto y procedencia</summary>
        <p>{layer.product}</p>
        {layer.citation && <p className="small">{layer.citation}</p>}
        <p>Imagen y línea de costa de NASA EOSDIS GIBS. Descarga <time dateTime={layer.retrieved_at}>{date(layer.retrieved_at)}</time>.</p>
        <ul><li><a href={layer.source_url} target="_blank" rel="noreferrer">Ficha del producto</a></li>
          {layer.metadata_url && <li><a href={layer.metadata_url} target="_blank" rel="noreferrer">Metadatos de la capa</a></li>}
          <li><a href={layer.request_url} target="_blank" rel="noreferrer">Imagen original de NASA GIBS</a></li></ul>
      </details>
    </div>
  </div>;
}

export function RegionalLayers() {
  const [selected, setSelected] = useState<LayerId>("smap");
  const [result, setResult] = useState<LayerState>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/regional/${selected}.json`, { signal: controller.signal });
        if (!response.ok) throw new Error("Archivo de capa ausente");
        const layer = await response.json() as RegionalLayer;
        if (layer.id !== selected || !layer.image_url || !layer.legend?.length) throw new Error("Metadatos de capa incompletos");
        if (!controller.signal.aborted) setResult({ id: selected, status: "available", layer });
      } catch {
        if (!controller.signal.aborted) setResult({ id: selected, status: "missing" });
      }
    }
    void load();
    return () => controller.abort();
  }, [selected, attempt]);

  const current = result?.id === selected ? result : undefined;
  return <section className="panel regional-panel" id="region" aria-labelledby="regional-title">
    <h2 id="regional-title">Contexto regional</h2>
    <p className="muted">Capas de NASA para la península de Yucatán. El mapa muestra una cuadrícula regional y el punto de Don Tino sirve de referencia. Estos mapas quedan fuera del cálculo de rotaciones y márgenes.</p>
    <fieldset className="regional-choices">
      <legend>Capa regional</legend>
      {choices.map(({ id, label }) => <label key={id}>
        <input type="radio" name="regional-layer" value={id} checked={selected === id} onChange={() => {
          setResult(undefined);
          setSelected(id);
        }} />{label}
      </label>)}
    </fieldset>
    {!current && <p role="status">Cargando la capa regional…</p>}
    {current?.status === "missing" && <div className="notice notice-warn">
      <p role="status">No se pudo cargar esta capa regional.</p>
      <button type="button" className="button button-secondary" onClick={() => {
        setResult(undefined);
        setAttempt(attempt + 1);
      }}>Volver a cargar la capa</button>
    </div>}
    {current?.status === "available" && <RegionalMap key={selected} layer={current.layer} />}
    <p className="small muted regional-credit">Imágenes de <a href="https://nasa-gibs.github.io/gibs-api-docs/#data-use-guidance-and-acknowledgements" target="_blank" rel="noreferrer">NASA Global Imagery Browse Services (GIBS)</a>, parte de NASA ESDIS.</p>
  </section>;
}
