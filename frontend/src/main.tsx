import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Brand } from "./Brand";
import { DemoWorkspace } from "./DemoWorkspace";
import { GlobalDemo } from "./global/GlobalDemo";
import { OwnWorkspace } from "./OwnWorkspace";
import { isDemoRoute } from "./ParcelSections";
import "./styles.css";

function App() {
  const [anchor, setAnchor] = useState(() => location.hash.slice(1));
  const home = anchor === "" || anchor === "inicio" || anchor.startsWith("inicio/");
  const demo = isDemoRoute(anchor);
  const metrics = anchor === "metricas";

  useEffect(() => {
    function readHash() { setAnchor(location.hash.slice(1)); }
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  return <>
    <a className="skip" href="#contenido" onClick={(event) => {
      event.preventDefault();
      document.getElementById("contenido")?.focus();
    }}>Saltar al contenido</a>
    <header className={home ? "site-header global-site-header" : "site-header"}>
      <div className="wrap header-inner">
        <Brand />
        <nav className="workspace-nav" aria-label="Áreas de LuumIA">
          <a href="#inicio" aria-current={home ? "page" : undefined}>Inicio</a>
          <a href="#parcela" aria-current={!home && !demo && !metrics ? "page" : undefined}>Parcela</a>
          <a href="#metricas" aria-current={metrics ? "page" : undefined}>Métricas</a>
          <a href="#demo" aria-current={demo ? "page" : undefined}>Demo</a>
        </nav>
      </div>
    </header>
    <main id="contenido" className={home ? undefined : "wrap"} tabIndex={-1}>
      {home ? <GlobalDemo anchor={anchor} /> : demo ? <DemoWorkspace anchor={anchor} /> : <OwnWorkspace showsMetrics={metrics} anchor={anchor} />}
    </main>
  </>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
