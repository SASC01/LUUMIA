import { useEffect, useState } from "react";
import {
  ApiFailure, collectWeekly, getContext, getDemoRequest, getExplanation, getHistorical, historicalUrl,
  previewEvaluation, saveEvaluation, saveFieldCapture,
  type CommercialResult, type CommercialScenario, type Evaluation, type EvaluationRequest, type Explanation,
  type FieldCapture, type ParcelContext,
} from "./api";
import { Commercial, HistoricalMargin } from "./Commercial";
import { ActionFeedback } from "./ActionFeedback";
import { CyclePlan } from "./CyclePlan";
import { Demonstration } from "./Demonstration";
import { EvidenceSummary, RegionalClimate } from "./Evidence";
import { Field } from "./Field";
import { Market } from "./Market";
import { Metrics } from "./Metrics";
import { ParcelAdvancedData } from "./ParcelAnalysis";
import { ParcelHistory } from "./ParcelHistory";
import { ParcelOverview } from "./ParcelOverview";
import { ParcelDisclosure, ParcelNavigation, ParcelPanel, ParcelSectionTitle, parcelRoute, useParcelFocus } from "./ParcelSections";
import { PlantingPlanner } from "./PlantingPlanner";
import { RegionalLayers } from "./RegionalLayers";
import { focusRegisteredArea, RegisteredArea } from "./RegisteredArea";
import { UsdaMarket } from "./UsdaMarket";
import { Rotations } from "./Rotations";

function getResult(evaluation: Evaluation | null | undefined, id: string) {
  return evaluation?.commercial_results?.find((item) => item.scenario_id === id);
}

function withScenario(request: EvaluationRequest, scenario: CommercialScenario): EvaluationRequest {
  return {
    ...request, commercial_scenarios: request.commercial_scenarios?.map((item) => item.id === scenario.id ? scenario : item),
  };
}

export function DemoWorkspace({ anchor }: { anchor: string }) {
  const [context, setContext] = useState<ParcelContext>();
  const [historical, setHistorical] = useState<ParcelContext>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [scenario, setScenario] = useState<CommercialScenario>();
  const [preview, setPreview] = useState<Evaluation>();
  const [comparison, setComparison] = useState<CommercialResult>();
  const [dirty, setDirty] = useState(false);
  const [explanation, setExplanation] = useState<{ candidate: string; response: Explanation }>();
  const [metricsRevision, setMetricsRevision] = useState(0);
  const showsMetrics = anchor === "demo-metricas";
  const view = showsMetrics ? undefined : parcelRoute(anchor).view;
  const needsPrior = view === "crops";
  useParcelFocus(anchor, Boolean(context));

  function accept(next: ParcelContext) {
    setContext(next);
    setPreview(undefined);
    setComparison(undefined);
    setExplanation(undefined);
    setDirty(false);
    const scenarios = next.evaluation?.request_snapshot.commercial_scenarios;
    setScenario((selected) => scenarios?.find((item) => item.id === selected?.id) ?? scenarios?.[0]);
  }

  useEffect(() => {
    const controller = new AbortController();
    getContext(undefined, controller.signal).then(accept).catch((failure: Error) => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [attempt]);

  const parcelId = context?.parcel.id;
  const priorVersion = context?.prior_commercial?.context_version ?? context?.last_evaluation_version;
  useEffect(() => {
    if (!needsPrior) return;
    let current = true;
    setHistorical(undefined);
    if (parcelId && priorVersion) {
      getHistorical(parcelId, priorVersion).then((old) => {
        if (current) setHistorical(old);
      }).catch((failure: Error) => {
        if (current) setError(failure.message);
      });
    }
    return () => { current = false; };
  }, [parcelId, priorVersion, needsPrior]);

  async function handle(message: string, operation: () => Promise<void>) {
    setBusy(message);
    setError("");
    try {
      await operation();
      return true;
    } catch (failure) {
      if (failure instanceof ApiFailure && failure.status === 409) {
        try {
          accept(await getContext(parcelId));
          setError("La ficha cambió. Cargué su versión vigente. Revisa los datos antes de volver a guardar.");
        } catch {
          setError(failure.message);
        }
      } else {
        setError(failure instanceof Error ? failure.message : "La operación no se pudo completar.");
      }
      return false;
    } finally {
      setBusy("");
    }
  }

  async function recalculate() {
    if (!context) return;
    const existing = historical?.evaluation?.request_snapshot ?? context.evaluation?.request_snapshot;
    if (context.last_evaluation_version && !existing) {
      throw new Error("Todavía no se recupera la evaluación anterior.");
    }
    const template = existing ?? await getDemoRequest();
    const inactive = new Set(context.cooperative_capacity_history?.map((change) => change.previous.id));
    const scenarios = template.commercial_scenarios?.filter((scenario) =>
      Number(scenario.superficie_ha) <= context.parcel.declared_area_ha
      && (!scenario.cupo_confirmacion || !inactive.has(scenario.cupo_confirmacion)));
    const cells = context.weekly_cells?.length ? context.weekly_cells : await collectWeekly();
    accept(await saveEvaluation({ ...template, commercial_scenarios: scenarios, context_version: context.context_version }, cells));
  }

  function refreshContext() {
    if (!context) return;
    void handle("Actualizando la ficha…", async () => {
      const latest = await getContext(context.parcel.id);
      if (latest.context_version !== context.context_version) accept(latest);
    });
  }

  const pending = context?.evaluation_state === "pendiente_de_recalculo";
  const evaluation = pending ? null : preview ?? context?.evaluation;
  const availableScenarios = context?.evaluation?.request_snapshot.commercial_scenarios ?? [];
  const result = scenario ? getResult(evaluation, scenario.id) : undefined;

  function requireCalculation() {
    if (!context?.evaluation || !context.weekly_cells?.length || !scenario || pending) {
      throw new Error("Se requiere una ficha evaluada con celdas semanales.");
    }
    const request = withScenario(context.evaluation.request_snapshot, scenario);
    return { request, cells: context.weekly_cells, draft: scenario };
  }

  return <>
      <div className="demo-menu">
        <nav aria-label="Vistas de la demo">
          <a href="#demo" aria-current={!showsMetrics ? "page" : undefined}>Parcela de ejemplo</a>
          <a href="#demo-metricas" aria-current={showsMetrics ? "page" : undefined}>Métricas de ejemplo</a>
        </nav>
      </div>
      {busy && <div className="operation-status"><ActionFeedback pending={busy} /></div>}
      {error && <div className="notice notice-warn operation-status" role="alert">
        <p>{error}</p>
        <button className="button button-secondary" onClick={() => {
          setError("");
          if (!context) setAttempt(attempt + 1);
        }}>{context ? "Cerrar mensaje" : "Volver a cargar ficha"}</button>
      </div>}
      {!context ? <section className="hero">
        <h1>{showsMetrics ? "Métricas" : "Parcela"}</h1>
        {!error && <ActionFeedback pending="Cargando ficha de Don Tino…" />}
      </section> : <>
        <section className="workspace" hidden={showsMetrics}>
        {view && <ParcelNavigation view={view} demo />}
        <ParcelPanel id="overview" view={view} demo>
          <ParcelOverview context={context} titleId="parcela-title" environmentHref="#demo-ambiente"
            rotationsHref={context.evaluation && !pending ? "#rotaciones" : "#demo-cultivos"} historyHref="#demo-historial" />
        </ParcelPanel>
        <ParcelPanel id="environment" view={view} demo>
          <ParcelSectionTitle parcelName={context.producer.display_name}>Análisis ambiental</ParcelSectionTitle>
          <div className="parcel-view-blocks">
            <RegionalClimate context={context} />
            <ParcelDisclosure label="Observaciones de campo y estación" linked={anchor === "observacion" || anchor === "weatherlink"}>
              <Field context={context} busy={!!busy} onRefresh={refreshContext} onSave={(capture: FieldCapture) =>
                handle("Guardando observación…", async () => {
                  accept(await saveFieldCapture(context.context_version, capture));
                })
              } />
            </ParcelDisclosure>
            <p className="parcel-section-note"><a href="#region">Consultar los mapas regionales de humedad y lluvia</a></p>
          </div>
        </ParcelPanel>
        <ParcelPanel id="crops" view={view} demo>
          <ParcelSectionTitle parcelName={context.producer.display_name}>Cultivos y rotaciones</ParcelSectionTitle>
          {pending && <section className="notice notice-warn recalculate" aria-label="Estado de la evaluación">
          <h2>Pendiente de recálculo</h2>
          <p>{context.recalculation_reason ?? "Cambió la evidencia de la parcela."}</p>
          <button className="button" disabled={!!busy || Boolean(context.last_evaluation_version && !historical)}
            onClick={() => void handle("Recalculando la ficha…", recalculate)}>Recalcular ficha</button>
          </section>}
          {!context.evaluation && !pending && <div className="button-group">
            <button className="button" disabled={!!busy} onClick={() => void handle("Preparando la demostración con NASA POWER…", recalculate)}>
              Preparar demostración
            </button>
          </div>}
          <div className="parcel-view-blocks">
            <ParcelDisclosure label="Comparar cultivos para el siguiente ciclo"
              description="Revisa la rotación, la ganancia y los precios previstos."
              linked={anchor === "siguiente-ciclo" || anchor === "precios-productor"}>
              <CyclePlan key={context.context_version} context={context} onRefreshContext={refreshContext} />
            </ParcelDisclosure>
            <ParcelDisclosure label="Ver opciones de rotación" linked={anchor === "rotaciones"}>
              <Rotations context={context} evaluation={evaluation} busy={!!busy} explanation={explanation}
                preview={Boolean(preview && preview.id !== context.evaluation?.id)} onExplain={(candidate) => {
                void handle("Preparando la explicación…", async () => {
                  const scenario_id = availableScenarios.find((item) => item.candidate_id === candidate)?.id;
                  const response = await getExplanation(
                    context.parcel.id, context.context_version, candidate, "¿Por qué se excluyó esta rotación?", scenario_id,
                  );
                  setExplanation({ candidate, response });
                });
              }} />
            </ParcelDisclosure>
            <ParcelDisclosure label="Simular la venta" linked={anchor === "venta"}>
            <section className="panel" id="venta">
              <h2>Venta de la cosecha</h2>
              <EvidenceSummary block={context.evidence_blocks?.comercial} />
              {pending && <>
                <p className="notice notice-warn">{context.recalculation_reason}</p>
                {context.prior_commercial && !historical && <p role="status">Cargando el margen anterior…</p>}
                {historical && <p><a href={historicalUrl(context.parcel.id, historical.context_version)}
                  target="_blank" rel="noreferrer">Abrir ficha histórica v{historical.context_version} (JSON)</a></p>}
                {context.prior_commercial?.scenario_ids.map((id) => <HistoricalMargin
                  key={id} version={context.prior_commercial?.context_version} result={getResult(historical?.evaluation, id)}
                  scenario={historical?.evaluation?.request_snapshot.commercial_scenarios?.find((item) => item.id === id)} />)}
              </>}
              {scenario && !pending && <Commercial
                scenario={scenario} scenarios={availableScenarios} result={result} comparison={comparison}
                selectable={availableScenarios.length > 1} editing={true} dirty={dirty} busy={!!busy}
                excluded={!!evaluation?.excluded.some((item) => item.candidate_id === scenario.candidate_id)}
                onChange={(draft) => {
                  setScenario(draft);
                  setDirty(true);
                  setComparison(undefined);
                }}
                onSelect={(id) => {
                  setScenario(availableScenarios.find((item) => item.id === id));
                  setDirty(false);
                  setComparison(undefined);
                  setPreview(undefined);
                }}
                onCalculate={() => void handle("Calculando el margen…", async () => {
                  const { request, cells } = requireCalculation();
                  setPreview(await previewEvaluation(request, cells));
                  setExplanation(undefined);
                  setDirty(false);
                  setComparison(undefined);
                })}
                onCompare={() => void handle("Comparando estructuras de venta…", async () => {
                  const { request, cells, draft } = requireCalculation();
                  const spot: CommercialScenario = { ...draft, sales_structure: "spot", cupo_range: [6000, 12000], cupo_confirmacion: null };
                  const coop: CommercialScenario = { ...draft, sales_structure: "cooperative", cupo_range: [8000, 10000], cupo_confirmacion: null };
                  const [spotResult, coopResult] = await Promise.all([
                    previewEvaluation(withScenario(request, spot), cells),
                    previewEvaluation(withScenario(request, coop), cells),
                  ]);
                  setScenario(spot);
                  setPreview(spotResult);
                  setExplanation(undefined);
                  setComparison(getResult(coopResult, draft.id));
                  setDirty(false);
                })}
              />}
              {preview && !pending && <div className="notice">
                <p>Vista previa · Ficha v{context.context_version}. Al guardar una observación quedará obsoleto el margen del último escenario guardado.</p>
                <div className="button-group">
                  <button className="button" type="button" disabled={!!busy || dirty} onClick={() => void handle("Guardando el escenario…", async () => {
                    const cells = context.weekly_cells;
                    if (!cells?.length) throw new Error("No se encontraron las celdas semanales para guardar el escenario.");
                    accept(await saveEvaluation(preview.request_snapshot, cells));
                  })}>Guardar escenario</button>
                </div>
              </div>}
              {!pending && !scenario && <p>Prepara la demostración para consultar el escenario comercial.</p>}
            </section>
            </ParcelDisclosure>
            <div className="parcel-planner-block">
              <div className="parcel-plan-settings"><RegisteredArea context={context} onSaved={accept} /></div>
              <PlantingPlanner context={context} onEditRegisteredArea={focusRegisteredArea}
                onShared={() => setMetricsRevision((version) => version + 1)} />
            </div>
          </div>
        </ParcelPanel>
        <ParcelPanel id="history" view={view} demo>
          <ParcelSectionTitle parcelName={context.producer.display_name}>Historial</ParcelSectionTitle>
          <ParcelHistory context={context} fieldHref="#observacion" />
        </ParcelPanel>
        <ParcelPanel id="advanced" view={view} demo>
          <ParcelSectionTitle parcelName={context.producer.display_name}>Análisis avanzado</ParcelSectionTitle>
          <div className="parcel-view-blocks">
            <ParcelAdvancedData context={context} />
            <ParcelDisclosure label="Capas regionales de NASA" linked={anchor === "region"}>
              <RegionalLayers />
            </ParcelDisclosure>
            <ParcelDisclosure label="Imagen de vegetación, sonda y cooperativa"
              linked={anchor === "vigor" || anchor === "sonda" || anchor === "cooperativa"}>
              <Demonstration />
            </ParcelDisclosure>
            <ParcelDisclosure label="Precios mayoristas de SNIIM" linked={anchor === "mayoreo"}>
              <Market />
            </ParcelDisclosure>
            <ParcelDisclosure label="Producción nacional de USDA" linked={anchor === "usda"}>
              <UsdaMarket />
            </ParcelDisclosure>
          </div>
        </ParcelPanel>
        </section>
        <section id="demo-metricas" className="workspace" aria-labelledby="metrics-title" hidden={!showsMetrics}>
          {showsMetrics && <Metrics context={context} refreshKey={metricsRevision} onContextSaved={accept} parcelLink="#demo-cultivos" />}
        </section>
      </>}
    {context?.producer.persona_kind === "composite_demo" && <footer className="site-footer">
      <p>Don Tino es un caso de demostración.</p>
    </footer>}
  </>;
}

