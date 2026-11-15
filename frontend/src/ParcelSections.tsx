import { useEffect, useRef, useState, type ReactNode } from "react";
import "./ParcelSections.css";

const sections = [
  { id: "overview", suffix: "", label: "Resumen" },
  { id: "environment", suffix: "-ambiente", label: "Análisis ambiental" },
  { id: "crops", suffix: "-cultivos", label: "Cultivos y rotaciones" },
  { id: "history", suffix: "-historial", label: "Historial" },
  { id: "advanced", suffix: "-avanzado", label: "Análisis avanzado" },
] as const;

export type ParcelView = typeof sections[number]["id"];
type ParcelRoute = { view: ParcelView; demo: boolean; target?: string };

export function parcelSectionId(view: ParcelView, demo = false) {
  return (demo ? "demo" : "parcela") + sections.find((section) => section.id === view)!.suffix;
}

const routes = new Map<string, ParcelRoute>();
for (const demo of [false, true]) {
  for (const { id } of sections) routes.set(parcelSectionId(id, demo), { view: id, demo });
}

const demoLinks = {
  "environment": ["observacion", "weatherlink"],
  "crops": ["rotaciones", "venta", "siguiente-ciclo", "precios-productor"],
  "advanced": ["vigor", "sonda", "region", "cooperativa", "mayoreo", "usda"],
} as const;
for (const view of ["environment", "crops", "advanced"] as const) {
  for (const target of demoLinks[view]) routes.set(target, { view, demo: true, target });
}
routes.set("datos-parcela", { view: "environment", demo: true });
routes.set("observacion-parcela", { view: "environment", demo: false, target: "observacion-parcela" });
routes.set("plan-siembra", { view: "crops", demo: false, target: "plan-siembra" });
routes.set("registro-cultivos", { view: "crops", demo: false, target: "registro-cultivos" });
routes.set("rotaciones-parcela", { view: "crops", demo: false, target: "rotaciones-parcela" });

export const parcelRoute = (anchor: string): ParcelRoute => routes.get(anchor) ?? { view: "overview", demo: false };
export const isDemoRoute = (anchor: string) => anchor === "demo-metricas" || parcelRoute(anchor).demo;

export function useParcelFocus(anchor: string, ready: boolean) {
  const last = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!ready) return;
    const changed = last.current !== undefined && last.current !== anchor;
    last.current = anchor;
    const route = parcelRoute(anchor);
    const region = anchor === "metricas" || anchor === "demo-metricas"
      ? anchor : parcelSectionId(route.view, route.demo);
    if (!changed && !route.target && route.view === "overview") return;

    const root = document.getElementById("contenido");
    if (!root) return;
    let observer: MutationObserver | undefined;
    function focus(target: string, direct: boolean): boolean {
      const section = document.getElementById(target);
      const heading = section?.querySelector<HTMLElement>("h1, h2, h3");
      if (!section || !heading || !heading.getClientRects().length) return false;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      if (direct) section.scrollIntoView({ block: "start" });
      else window.scrollTo(0, 0);
      return true;
    }

    const frame = requestAnimationFrame(() => {
      if (!route.target) {
        focus(region, false);
        return;
      }
      const target = route.target;
      if (focus(target, true)) return;
      focus(target === "precios-productor" ? "siguiente-ciclo" : region, true);
      observer = new MutationObserver(() => { if (focus(target, true)) observer?.disconnect(); });
      observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["open", "hidden"] });
    });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [anchor, ready]);
}

export function ParcelNavigation({ view, demo = false }: { view: ParcelView; demo?: boolean }) {
  return <nav className="parcel-section-nav" aria-label="Secciones de la parcela">
    <ul>{sections.map((section) => <li key={section.id}>
      <a href={`#${parcelSectionId(section.id, demo)}`} aria-current={section.id === view ? "page" : undefined}>
        {section.label}
      </a>
    </li>)}</ul>
  </nav>;
}

export function ParcelPanel({ id, view, demo = false, children }: {
  id: ParcelView;
  view: ParcelView | undefined;
  demo?: boolean;
  children: ReactNode;
}) {
  const active = id === view;
  const [visited, setVisited] = useState(active);
  useEffect(() => { if (active) setVisited(true); }, [active]);
  if (!active && !visited) return null;
  return <section id={parcelSectionId(id, demo)} className="parcel-view" hidden={!active}>{children}</section>;
}

export function ParcelSectionTitle({ children, parcelName }: { children: ReactNode; parcelName: string }) {
  return <header className="parcel-section-title"><p>{parcelName}</p><h1>{children}</h1></header>;
}

export function ParcelDisclosure({ label, description, linked = false, children }: {
  label: string;
  description?: string;
  linked?: boolean;
  children: ReactNode;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const [visited, setVisited] = useState(linked);

  useEffect(() => {
    if (linked && details.current) {
      details.current.open = true;
      setVisited(true);
    }
  }, [linked]);

  return <details className="parcel-fold" ref={details} onToggle={(event) => {
    if (event.currentTarget.open) setVisited(true);
  }}>
    <summary>{label}{description && <span>{description}</span>}</summary>
    {(visited || linked) && <div className="parcel-fold-body">{children}</div>}
  </details>;
}
