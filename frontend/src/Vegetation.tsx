import { useEffect, useState } from "react";
import { date, number } from "./format";

type HlsScene = {
  granule_id: string;
  product: "HLSL30" | "HLSS30";
  version: string;
  acquired_at: string;
  source_url: string;
  item_url: string;
  resolution_m: number;
  mask_method: string;
  ndvi_method: string;
  count_method: string;
  mask_source_url: string;
  image_url: string;
  image_width?: number;
  image_height?: number;
  coverage: { valid_pixels: number; total_pixels: number; fraction: number };
  mask_breakdown: { high_aerosol: number };
  ndvi: { min: number; median: number; max: number };
  legend: { min: number; max: number; colors: string[]; no_data_color: string; parcel_outline_color: string };
  evidence_tier: "derived";
};

const percent = new Intl.NumberFormat("es-MX", { style: "percent", maximumFractionDigits: 1 });

export function Vegetation() {
  const [scene, setScene] = useState<HlsScene>();
  const [failed, setFailed] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/hls/scene.json", { signal: controller.signal });
        if (!response.ok) throw new Error("Falta la escena HLS");
        setScene(await response.json() as HlsScene);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  return <section className="panel hls-panel" id="vigor" aria-labelledby="vigor-title">
    <h2 id="vigor-title">Vigor de la vegetación</h2>
    {!scene && <p className={failed ? "notice notice-warn" : "muted"} role="status">
      {failed ? "La escena HLS no está disponible." : "Cargando la escena HLS…"}
    </p>}
    {scene && <>
      <p className="hls-date"><time dateTime={scene.acquired_at}>{date(scene.acquired_at)}</time> · NASA HLS · {scene.resolution_m} m por píxel</p>
      <div className="hls-layout">
        <figure className="hls-map">
          {imageFailed ? <p role="status" className="notice notice-warn">La imagen NDVI no se pudo cargar. Las cifras de la escena siguen disponibles.</p>
            : <img src={scene.image_url} alt={`Mapa NDVI del ${date(scene.acquired_at)}. El contorno marca la geometría simulada de Don Tino.`}
              width={scene.image_width} height={scene.image_height} onError={() => setImageFailed(true)} />}
          <figcaption className="hls-legend">
            <span className="hls-gradient" aria-hidden="true" style={{ backgroundImage: `linear-gradient(to right, ${scene.legend.colors.join(", ")})` }} />
            <div className="hls-scale"><span>Menor · {number(scene.legend.min)}</span><strong>NDVI</strong><span>Mayor · {number(scene.legend.max)}</span></div>
            <div className="hls-keys">
              <span><i aria-hidden="true" style={{ backgroundColor: scene.legend.no_data_color }} />Sin dato válido</span>
              <span><i className="hls-outline" aria-hidden="true" style={{ borderColor: scene.legend.parcel_outline_color }} />Parcela simulada</span>
            </div>
          </figcaption>
        </figure>
        <div className="hls-explanation">
          <span className="tag tag-derived">Cálculo trazable</span>
          <dl className="facts hls-facts">
            <dt>NDVI mediano</dt><dd>{number(scene.ndvi.median)}</dd>
            <dt>Rango de NDVI</dt><dd>{number(scene.ndvi.min)} a {number(scene.ndvi.max)}</dd>
            <dt>Píxeles válidos</dt><dd>{number(scene.coverage.valid_pixels)} de {number(scene.coverage.total_pixels)} · {percent.format(scene.coverage.fraction)}</dd>
          </dl>
          {scene.coverage.fraction < 1 && <p className="small muted">Cobertura parcial tras aplicar la máscara de calidad. Las cifras se calculan sobre los píxeles válidos de la parcela.</p>}
          <p>El NDVI indica qué tan verde se ve la vegetación el día de la imagen. Para identificar cultivos por ciclo se requieren imágenes de distintas fechas y registros de campo.</p>
          <details className="disclosure hls-source">
            <summary>Fuente y máscara de calidad</summary>
            <p>{scene.product} v{scene.version} · <a href={scene.item_url} target="_blank" rel="noreferrer">{scene.granule_id}</a></p>
            <p>{scene.ndvi_method} {scene.count_method}</p>
            <p>{scene.mask_method} <a href={scene.mask_source_url} target="_blank" rel="noreferrer">Máscara de calidad</a></p>
            {scene.mask_breakdown.high_aerosol > 0 && <p>Píxeles descartados por aerosol alto en la parcela: {number(scene.mask_breakdown.high_aerosol)}.</p>}
            <p><a href={scene.source_url} target="_blank" rel="noreferrer">Ficha del producto NASA HLS</a></p>
          </details>
        </div>
      </div>
    </>}
  </section>;
}
