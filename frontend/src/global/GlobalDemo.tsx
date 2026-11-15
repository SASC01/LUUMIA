import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { date, number } from "../format";
import { Globe } from "./Globe";
import { PlotPlanner } from "./PlotPlanner";
import { cropColor, initialPlan, resizeBoundary, type DemoPlan } from "./planner";
import { globalSites, type GlobalSite } from "./sites";
import "./GlobalDemo.css";

type NdviLayer = {
  imageUrl: string;
  date: string;
  granule: string;
  coverage: number;
  sideMeters: number;
  sourceUrl: string;
};

const blueMarble = "https://science.nasa.gov/earth/earth-observatory/collections/blue-marble/";
const nasaPower = "https://power.larc.nasa.gov/docs/services/api/temporal/daily/";

function PlotMap({ site, plan, onPlanChange, showNASA, onShowNASA }: {
  site: GlobalSite;
  plan: DemoPlan;
  onPlanChange: (plan: DemoPlan) => void;
  showNASA: boolean;
  onShowNASA: (visible: boolean) => void;
}) {
  const [layer, setLayer] = useState<NdviLayer | null>();
  const [terrainFailed, setTerrainFailed] = useState(false);
  const [layerFailed, setLayerFailed] = useState(false);
  const boundaryDrag = useRef<{ x: number; area: number; width: number; pointer: number } | null>(null);
  const fieldRect = useRef<HTMLDivElement>(null);
  const width = Math.sqrt(plan.areaHa * 10_000 * 1.24);
  const height = width / 1.24;
  const extent = Math.max(620, width * 1.72);
  const assigned = plan.zones.reduce((total, zone) => total + zone.areaHa, 0);
  const terrain = !terrainFailed ? site.terrain : undefined;
  const activeLayer = !layerFailed ? layer : null;

  useEffect(() => {
    if (!showNASA || layer !== undefined) return;
    const controller = new AbortController();
    async function loadLayer() {
      try {
        const response = await fetch("/global/ndvi.json", { signal: controller.signal });
        if (!response.ok) throw new Error("La visualización no está disponible.");
        const manifest = await response.json() as Partial<Record<string, NdviLayer>>;
        if (!controller.signal.aborted) setLayer(manifest[site.id] ?? null);
      } catch {
        if (!controller.signal.aborted) setLayer(null);
      }
    }
    void loadLayer();
    return () => controller.abort();
  }, [showNASA, layer, site.id]);

  function adjustWithKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.shiftKey ? 1 : 0.25;
    const change = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    if (change === 0) return;
    event.preventDefault();
    onPlanChange(resizeBoundary(plan, index, plan.zones[index].areaHa + change));
  }

  function startBoundary(event: PointerEvent<HTMLButtonElement>, index: number) {
    const width = fieldRect.current?.getBoundingClientRect().width;
    if (!width || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    boundaryDrag.current = { x: event.clientX, area: plan.zones[index].areaHa, width, pointer: event.pointerId };
  }

  function moveBoundary(event: PointerEvent<HTMLButtonElement>, index: number) {
    const drag = boundaryDrag.current;
    if (event.pointerId !== drag?.pointer) return;
    const area = drag.area + (event.clientX - drag.x) / drag.width * plan.areaHa;
    onPlanChange(resizeBoundary(plan, index, area));
  }

  let offset = 0;
  return <div className="global-map-column">
    <div className="global-map-toolbar">
      <div>
        <h2>Croquis de siembra</h2>
        <span>{number(plan.areaHa)} ha · Parcela simulada</span>
      </div>
      <div className="global-layer-switch" role="group" aria-label="Vista del croquis">
        <button type="button" aria-pressed={!showNASA} onClick={() => onShowNASA(false)}>Solo terreno</button>
        <button type="button" aria-pressed={showNASA} onClick={() => onShowNASA(true)}>Datos NASA</button>
      </div>
    </div>
    <div className="global-plot-map" role="group" aria-label={`Croquis de ${site.name}`}>
      <div className="global-map-coordinates">
        {terrain && <img className="global-map-image global-map-terrain" src={terrain.imageUrl} alt=""
          onError={() => setTerrainFailed(true)}
          style={{ width: `${100 * terrain.widthMeters / extent}%`, height: `${100 * terrain.heightMeters / extent}%` }} />}
        {showNASA && activeLayer && <img className="global-map-image global-map-ndvi" src={activeLayer.imageUrl}
          onError={() => setLayerFailed(true)} alt="Cuadrícula satelital de vigor de la vegetación, NASA HLS"
          style={{ width: `${100 * activeLayer.sideMeters / extent}%`, height: `${100 * activeLayer.sideMeters / extent}%` }} />}
        <div className="global-map-field" ref={fieldRect} style={{ width: `${width / extent * 100}%`, height: `${height / extent * 100}%` }}>
          <div className="global-map-strips">
            {plan.zones.map((zone) => zone.areaHa > 0 && <div className="global-map-strip" key={zone.id}
              style={{ flexBasis: `${zone.areaHa / plan.areaHa * 100}%`, "--crop-tone": cropColor(zone.crop) } as CSSProperties}>
              {zone.areaHa / plan.areaHa >= 0.17 && <span>{zone.crop}</span>}
            </div>)}
          </div>
          {plan.zones.slice(0, -1).map((zone, index) => {
            offset += zone.areaHa;
            const pair = zone.areaHa + plan.zones[index + 1].areaHa;
            if (pair <= 0 || offset <= 0 || offset >= plan.areaHa) return null;
            return <button className="global-map-boundary" type="button" key={zone.id}
              role="slider" aria-label={`Ajustar límite entre zona ${index + 1} y zona ${index + 2}`}
              aria-valuemin={0} aria-valuemax={pair} aria-valuenow={zone.areaHa}
              aria-valuetext={`${number(zone.areaHa)} ha en la primera zona de este límite`}
              title="Arrastra el límite para cambiar las hectáreas"
              style={{ left: `${offset / plan.areaHa * 100}%` }}
              onPointerDown={(event) => startBoundary(event, index)}
              onPointerMove={(event) => moveBoundary(event, index)}
              onLostPointerCapture={() => { boundaryDrag.current = null; }}
              onKeyDown={(event) => adjustWithKey(event, index)}
            >↔</button>;
          })}
        </div>
        {showNASA && site.weather && <div className="global-nasa-pin"><i /> <span>NASA POWER</span></div>}
      </div>
      {!terrain && <span className="global-map-no-terrain">Fondo esquemático</span>}
      <span className="global-map-north" aria-label="Norte hacia arriba">↑ N</span>
      <span className="global-map-scale"><span />{Math.round(extent / 5)} m aprox.</span>
    </div>
    <div className="global-map-key">
      {plan.zones.filter((zone) => zone.areaHa > 0).map((zone) =>
        <span key={zone.id}><i style={{ background: cropColor(zone.crop) }} />{zone.crop} · <strong>{number(zone.areaHa)} ha</strong></span>)}
      {plan.areaHa - assigned > 0.005 && <span>Sin asignar · <strong>{number(plan.areaHa - assigned)} ha</strong></span>}
      {terrain && <a className="global-terrain-credit" href={terrain.sourceUrl} target="_blank" rel="noreferrer"
        title={terrain.credit}>{terrain.sourceName} · {date(terrain.date)}</a>}
    </div>
    {showNASA && <section className="global-nasa-context" aria-label="Datos NASA para la región">
      <header><h3>Datos NASA para {site.name}</h3>
        <a href={site.weather?.sourceUrl ?? nasaPower} target="_blank" rel="noreferrer">NASA POWER ↗</a>
      </header>
      {site.weather ? <>
        <dl><div><dt>Lluvia acumulada</dt><dd>{number(site.weather.precipitationMm)} mm</dd></div>
          <div><dt>Temperatura media</dt><dd>{number(site.weather.temperatureC)} °C</dd></div></dl>
        <p>Clima regional del {date(site.weather.start)} al {date(site.weather.end)}.</p>
      </> : <p>Sin datos climáticos precargados para esta región.</p>}
      {activeLayer ? <div className="global-ndvi-legend">
        <span className="global-ndvi-ramp" aria-hidden="true" />
        <div>Vigor de la vegetación · <a href={activeLayer.sourceUrl} target="_blank" rel="noreferrer" title={activeLayer.granule}>HLS · {date(activeLayer.date)} ↗</a>
          <small>Menor a mayor vigor · píxeles de ~30 m · {Math.round(activeLayer.coverage * 100)}% de cobertura válida</small></div>
      </div> : <p role="status">{layer === undefined && !layerFailed ? "Cargando cuadrícula de vegetación…" : "Cuadrícula de vegetación sin imagen disponible."}</p>}
    </section>}
  </div>;
}

export function GlobalDemo({ anchor }: { anchor: string }) {
  const [selected, setSelected] = useState<string>();
  const [showNASA, setShowNASA] = useState(false);
  const [plans, setPlans] = useState<Record<string, DemoPlan>>(() =>
    Object.fromEntries(globalSites.map((site) => [site.id, initialPlan(site)])));
  const introHeading = useRef<HTMLHeadingElement>(null);
  const plotHeading = useRef<HTMLHeadingElement>(null);
  const returning = useRef(false);
  const target = useRef<string | undefined>(undefined);
  const site = globalSites.find((item) => anchor === `inicio/${item.id}`);

  const selectSite = useCallback((id: string) => {
    target.current = id;
    setSelected(id);
    if (location.hash.startsWith("#inicio/")) location.hash = "inicio";
  }, []);

  const openPlot = useCallback((id: string) => {
    if (id !== target.current) return;
    target.current = undefined;
    setSelected(undefined);
    location.hash = `inicio/${id}`;
  }, []);

  useEffect(() => {
    if (site) {
      window.scrollTo(0, 0);
      plotHeading.current?.focus({ preventScroll: true });
    } else if (returning.current) {
      returning.current = false;
      window.scrollTo(0, 0);
      introHeading.current?.focus({ preventScroll: true });
    }
  }, [site]);

  function returnToGlobe() {
    returning.current = true;
    target.current = undefined;
    setSelected(undefined);
    location.hash = "inicio";
  }

  if (!site) return <section className="global-explorer" id="inicio" data-enter aria-labelledby="global-heading">
    <div className="global-explorer-inner">
      <header className="global-intro">
        <p className="global-kicker"><span /> Demo global</p>
        <h1 id="global-heading" ref={introHeading} tabIndex={-1}>Explora dónde sembrar</h1>
        <p>Elige una región para ver el terreno y comparar cultivos con tu propio reparto de hectáreas.</p>
      </header>
      <div className="global-orbit">
        <Globe sites={globalSites} selected={selected} onSelect={selectSite} onFocused={openPlot} />
      </div>
      <nav className="global-site-list" aria-label="Regiones agrícolas">
        {globalSites.map((item) => <button type="button" key={item.id} onClick={() => selectSite(item.id)}
          aria-current={selected === item.id ? "true" : undefined}>
          <span><strong>{item.name}</strong><small>{item.location}</small></span>
          <span aria-hidden="true">→</span>
        </button>)}
      </nav>
      <div className="global-credit"><a href={blueMarble} target="_blank" rel="noreferrer">Imagen de la Tierra · NASA Blue Marble</a></div>
    </div>
  </section>;

  const plan = plans[site.id];
  const updatePlan = (next: DemoPlan) => setPlans((current) => ({ ...current, [site.id]: next }));
  return <section className="global-plot" id="inicio" aria-labelledby="global-plot-title">
    <header className="global-plot-header">
      <div>
        <button className="global-back" type="button" onClick={returnToGlobe}>← Volver al globo</button>
        <h1 id="global-plot-title" ref={plotHeading} tabIndex={-1}>{site.name}</h1>
        <p>{site.location} · Parcela de demostración</p>
      </div>
      <label htmlFor="global-region-picker">Cambiar región
        <select id="global-region-picker" value={site.id} onChange={(event) => selectSite(event.currentTarget.value)}>
          {globalSites.map((item) => <option value={item.id} key={item.id}>{item.name} · {item.location}</option>)}
        </select>
      </label>
    </header>
    <div className="global-workbench">
      <PlotMap key={site.id} site={site} plan={plan} onPlanChange={updatePlan} showNASA={showNASA} onShowNASA={setShowNASA} />
      <PlotPlanner key={site.id} site={site} plan={plan} onPlanChange={updatePlan} />
    </div>
    <details className="global-regional-sources">
      <summary>Cultivos y fuentes de la región</summary>
      <p>{site.description}</p>
      <ul>{site.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.name}</a></li>)}</ul>
      {site.terrain && <p className="small muted">{site.terrain.credit}. <a href={site.terrain.licenseUrl}
        target="_blank" rel="noreferrer">Licencia de la imagen</a></p>}
    </details>
  </section>;
}
