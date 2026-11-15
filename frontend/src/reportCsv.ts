import type { SowingSalesReport } from "./api";

type CsvRows = (string | number)[][];
type Sale = SowingSalesReport["sales"][number];

export const zoneName = (id: string) => id.replace(/^zone-/, "").toUpperCase();
export const missingSales = (sales: SowingSalesReport) => sales.history?.length ? "Sin ventas vigentes" : "Sin ventas registradas";
export const salesComparisonNote = "La ganancia registrada acumula las ventas vigentes. La estimación abarca el plan completo.";

export function downloadCsv(filename: string, rows: CsvRows) {
  const csv = rows.map((row) => row.map((value) => {
    const content = String(value);
    const needsEscape = typeof value === "string" && /^[\s]*[=+\-@]/.test(content) && !/^-?\d+(\.\d+)?$/.test(content);
    return `"${(needsEscape ? `'${content}` : content).replaceAll('"', '""')}"`;
  }).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function salesRows(sales: SowingSalesReport): CsvRows {
  const summary = sales.totals;
  const zoneLabels = new Map(sales.zones.map((zone) => [zone.zone_id, zone.crop_label]));
  const saleHeaders = ["ID de venta", "Zona", "Cultivo", "Fecha de venta", "Kilos vendidos", "Precio (MXN/kg)", "Ingreso (MXN)",
    "Costos (MXN)", "Ganancia (MXN)", "Folio o referencia", "Fecha de registro", "Revisión"];
  const saleRow = (sale: Sale) => [sale.sale_id, zoneName(sale.zone_id), zoneLabels.get(sale.zone_id) ?? "", sale.sold_on,
    sale.sold_kg, sale.price_mxn_kg, sale.revenue_mxn, sale.cost_mxn, sale.margin_mxn, sale.reference ?? "", sale.recorded_at, sale.revision ?? 1];
  return [
    ["Ganancia registrada (MXN)", summary.actual_margin_mxn ?? missingSales(sales)],
    ["Ganancia estimada del plan por zonas (MXN)", summary.estimated_margin_mxn ?? "Sin estimación"],
    ["Diferencia frente a la estimación (MXN)", summary.margin_difference_mxn ?? ""],
    ["Comparación", salesComparisonNote],
    ["Zona", "Cultivo", "Ventas vigentes", "Venta estimada (kg)", "Kilos vendidos", "Ingreso registrado (MXN)", "Costos registrados (MXN)",
      "Ganancia registrada (MXN)", "Ganancia estimada (MXN)", "Diferencia (MXN)"],
    ...sales.zones.map((zone) => [zoneName(zone.zone_id), zone.crop_label, zone.sale_count, zone.estimated_sold_kg ?? "", zone.actual_sold_kg ?? "",
      zone.actual_revenue_mxn ?? "", zone.actual_cost_mxn ?? "", zone.actual_margin_mxn ?? "", zone.estimated_margin_mxn ?? "", zone.margin_difference_mxn ?? ""]),
    ...(sales.sales.length ? [["Ventas vigentes"], saleHeaders, ...sales.sales.map(saleRow)] : []),
    ...(sales.history?.length ? [
      ["Historial de cambios en ventas"],
      ["ID de cambio", "Acción", "Datos de la venta", "Fecha y hora del cambio", "Motivo", ...saleHeaders],
      ...sales.history.flatMap((change) => {
        const details = [change.change_id, change.action === "corrected" ? "Corrección" : "Anulación"];
        const metadata = [change.recorded_at, change.reason ?? ""];
        return [
          [...details, "Antes", ...metadata, ...saleRow(change.previous)],
          ...(change.replacement ? [[...details, "Después", ...metadata, ...saleRow(change.replacement)]] : []),
        ];
      }),
    ] : []),
  ];
}

export function downloadSalesReport(report: SowingSalesReport) {
  const plan = report.plans.find((item) => item.plan_version === report.plan_version);
  if (!plan) return;
  downloadCsv(`luumia-ventas-plan-v${plan.plan_version}.csv`, [
    ["Plan compartido", `v${plan.plan_version}`],
    ["Versión de la ficha", `v${plan.context_version}`],
    ["Fecha del plan", plan.shared_at],
    ["Ciclo", `Primavera–verano ${plan.campaign_year}`],
    ...salesRows(report),
  ]);
}
