import type { Confidence, Period } from "./api";

const numberFormat = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 4 });
const pesoFormat = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });
const rateFormat = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 6 });
const campecheDate = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
});
const dateFormat = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeZone: "UTC",
});

// El navegador admite cadenas decimales y conserva sus cifras antes del redondeo de presentación.
type FormatDecimal = (value: string | number) => string;
export const number = numberFormat.format as FormatDecimal;
export const pesos = pesoFormat.format as FormatDecimal;
export const pesoRate = rateFormat.format as FormatDecimal;
export const date = (iso: string) => dateFormat.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
export const period = (value: Period) => `${date(value.start)} – ${date(value.end)}`;
export const todayInCampeche = () => campecheDate.format(new Date());

export const crops: Record<string, string> = {
  maiz: "Maíz", frijol: "Frijol", calabaza: "Calabaza", saladette: "Jitomate Saladette",
};
export const dimensions: Record<string, string> = {
  nitrogen: "Nitrógeno", erosion_cover: "Cobertura contra erosión", organic_matter: "Materia orgánica",
  pest_break: "Alternancia de familias", water_fit: "Aptitud hídrica", forage: "Forraje", market: "Mercado",
};
export const confidenceLabels: Record<Confidence["level"], string> = {
  high: "alta", medium: "media", low: "baja", unknown: "por determinar",
};
export const evidenceLabels: Record<string, string> = {
  observed: "Registro observado", derived: "Cálculo trazable", simulated_assumption: "Supuesto de la demo",
};

