import { areaUnits } from "../parcelArea";

export type PlannerSite = { id: string; areaHa: number; crops: readonly string[] };
export type DemoZone = { id: string; crop: string; areaHa: number };
export type DemoPlan = { areaHa: number; zones: DemoZone[] };

type SoilType = "Franco" | "Franco arcilloso" | "Somero calizo";
type Conditions = { soil: SoilType; moisturePct: number; waterMm: number; previousCrop: string };
type CropProfile = {
  family: string;
  soils: readonly SoilType[];
  moisturePct: readonly [number, number];
  waterMm: number;
  yieldT: number;
  priceUsd: number;
  costUsd: number;
  loss: number;
  color: string;
};

const profiles: Record<string, CropProfile> = {
  maiz: { family: "Gramíneas", soils: ["Franco", "Franco arcilloso"], moisturePct: [24, 36], waterMm: 520,
    yieldT: 6.6, priceUsd: 215, costUsd: 690, loss: .07, color: "#efbc58" },
  soya: { family: "Leguminosas", soils: ["Franco", "Franco arcilloso"], moisturePct: [21, 33], waterMm: 450,
    yieldT: 3.2, priceUsd: 468, costUsd: 630, loss: .06, color: "#a6ce70" },
  sorgo: { family: "Gramíneas", soils: ["Franco", "Franco arcilloso", "Somero calizo"], moisturePct: [16, 29], waterMm: 345,
    yieldT: 4.2, priceUsd: 198, costUsd: 480, loss: .08, color: "#e18d70" },
  frijol: { family: "Leguminosas", soils: ["Franco", "Somero calizo"], moisturePct: [18, 28], waterMm: 395,
    yieldT: 1.65, priceUsd: 1070, costUsd: 770, loss: .09, color: "#75c7b2" },
  avena: { family: "Gramíneas", soils: ["Franco", "Franco arcilloso"], moisturePct: [25, 38], waterMm: 405,
    yieldT: 3.5, priceUsd: 263, costUsd: 610, loss: .05, color: "#d6b491" },
  trigo: { family: "Gramíneas", soils: ["Franco", "Franco arcilloso"], moisturePct: [22, 35], waterMm: 445,
    yieldT: 7.2, priceUsd: 237, costUsd: 835, loss: .04, color: "#efbc58" },
  cebada: { family: "Gramíneas", soils: ["Franco", "Somero calizo"], moisturePct: [20, 33], waterMm: 380,
    yieldT: 6.6, priceUsd: 215, costUsd: 720, loss: .05, color: "#d6a876" },
  colza: { family: "Brassicáceas", soils: ["Franco", "Franco arcilloso"], moisturePct: [22, 35], waterMm: 440,
    yieldT: 3.5, priceUsd: 475, costUsd: 780, loss: .06, color: "#a8cf70" },
  algodon: { family: "Malváceas", soils: ["Franco", "Franco arcilloso"], moisturePct: [24, 35], waterMm: 620,
    yieldT: 1.85, priceUsd: 1470, costUsd: 1420, loss: .07, color: "#b9b9ec" },
};

const siteConditions: Record<string, Conditions> = {
  campeche: { soil: "Franco arcilloso", moisturePct: 24, waterMm: 478, previousCrop: "Maíz" },
  yucatan: { soil: "Somero calizo", moisturePct: 20, waterMm: 365, previousCrop: "Maíz" },
  iowa: { soil: "Franco", moisturePct: 31, waterMm: 540, previousCrop: "Soya" },
  beauce: { soil: "Franco", moisturePct: 28, waterMm: 480, previousCrop: "Trigo" },
  "mato-grosso": { soil: "Franco arcilloso", moisturePct: 28, waterMm: 565, previousCrop: "Soya" },
};

const regionalYield: Record<string, Record<string, number>> = {
  campeche: { maiz: 4.55, soya: 2.55, sorgo: 3.85 },
  yucatan: { maiz: 3.4, frijol: 1.25, sorgo: 3.7 },
  iowa: { maiz: 11.4, soya: 3.6, avena: 3.9 },
  "mato-grosso": { maiz: 6.2, soya: 3.5, algodon: 1.8 },
};

const regionalCost: Record<string, number> = { campeche: .9, yucatan: .84, iowa: 1.48, beauce: 1.18, "mato-grosso": 1.08 };
const defaultConditions: Conditions = { soil: "Franco", moisturePct: 24, waterMm: 420, previousCrop: "Maíz" };
const defaultCrop: CropProfile = { family: "Sin clasificar", soils: ["Franco"], moisturePct: [20, 32], waterMm: 470,
  yieldT: 3.8, priceUsd: 250, costUsd: 620, loss: .08, color: "#92bb9f" };

export const MAX_DEMO_ZONES = 5;
export const MAX_DEMO_AREA_HA = 200;

const cropKey = (crop: string) => crop.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
const thousandths = (area: number) => Math.round(area * 1000);
const hectares = (units: number) => units / 1000;
const round = (value: number, places = 2) => Number(value.toFixed(places));

export const cropColor = (crop: string) => (profiles[cropKey(crop)] ?? defaultCrop).color;
export const conditionsFor = (site: PlannerSite) => siteConditions[site.id] ?? defaultConditions;

export function parseDemoArea(raw: string, max: number, allowZero = false) {
  const units = areaUnits(raw);
  if (units === null || (!allowZero && units === 0) || units > thousandths(max)) return null;
  return hectares(units);
}

export function assignedArea(plan: DemoPlan) {
  return hectares(plan.zones.reduce((total, row) => total + thousandths(row.areaHa), 0));
}

export function initialPlan(site: PlannerSite): DemoPlan {
  const areaHa = site.areaHa;
  const [first, second] = site.crops;
  const firstHa = second ? hectares(Math.round(thousandths(areaHa) * .6)) : areaHa;
  const zones = [{ id: "zone-a", crop: first, areaHa: firstHa }];
  if (second) zones.push({ id: "zone-b", crop: second, areaHa: hectares(thousandths(areaHa) - thousandths(firstHa)) });
  return { areaHa, zones };
}

export function scalePlan(plan: DemoPlan, areaHa: number): DemoPlan {
  if (!Number.isFinite(areaHa) || areaHa <= 0 || areaHa > MAX_DEMO_AREA_HA || plan.areaHa === areaHa) return plan;
  const size = thousandths(areaHa);
  const previous = thousandths(plan.areaHa);
  const oldZones = plan.zones.map((zone) => thousandths(zone.areaHa));
  const remaining = Math.max(0, previous - oldZones.reduce((sum, units) => sum + units, 0));
  const result = [...oldZones, remaining].map((units, index) => ({
    index,
    area: Math.floor(units * size / previous),
    remainder: (units * size) % previous,
  }));
  const unassigned = size - result.reduce((sum, part) => sum + part.area, 0);
  for (const part of [...result].sort((a, b) => b.remainder - a.remainder).slice(0, unassigned)) part.area += 1;
  return { areaHa, zones: plan.zones.map((zone, index) => ({ ...zone, areaHa: hectares(result[index].area) })) };
}

export function zoneLimit(plan: DemoPlan, index: number) {
  return hectares(thousandths(plan.areaHa) - thousandths(assignedArea(plan)) + thousandths(plan.zones[index].areaHa));
}

export function setZoneArea(plan: DemoPlan, index: number, areaHa: number): DemoPlan {
  if (!plan.zones[index] || !Number.isFinite(areaHa) || areaHa < 0 || areaHa > zoneLimit(plan, index)) return plan;
  return { ...plan, zones: plan.zones.map((zone, i) => i === index ? { ...zone, areaHa } : zone) };
}

export function setZoneCrop(plan: DemoPlan, index: number, crop: string): DemoPlan {
  return { ...plan, zones: plan.zones.map((zone, i) => i === index ? { ...zone, crop } : zone) };
}

export function resizeBoundary(plan: DemoPlan, boundary: number, leftAreaHa: number): DemoPlan {
  const left = plan.zones[boundary];
  if (!left || !Number.isFinite(leftAreaHa)) return plan;
  const right = plan.zones[boundary + 1];
  const pairTotal = thousandths(right ? left.areaHa + right.areaHa : zoneLimit(plan, boundary));
  const newLeft = Math.max(0, Math.min(pairTotal, thousandths(leftAreaHa)));
  const zones = plan.zones.map((zone, i) => i === boundary ? { ...zone, areaHa: hectares(newLeft) }
    : right && i === boundary + 1 ? { ...zone, areaHa: hectares(pairTotal - newLeft) } : zone);
  return { ...plan, zones };
}

export function appendZone(site: PlannerSite, plan: DemoPlan): DemoPlan {
  if (plan.zones.length >= MAX_DEMO_ZONES) return plan;
  const ids = Array.from({ length: MAX_DEMO_ZONES }, (_, i) => `zone-${String.fromCharCode(97 + i)}`);
  const id = ids.find((candidate) => !plan.zones.some((zone) => zone.id === candidate));
  const crop = site.crops.find((candidate) => !plan.zones.some((zone) => zone.crop === candidate)) ?? site.crops[0];
  if (!id || !crop) return plan;
  const free = thousandths(plan.areaHa) - thousandths(assignedArea(plan));
  if (free > 0) return { ...plan, zones: [...plan.zones, { id, crop, areaHa: hectares(free) }] };
  const largest = plan.zones.reduce((previous, zone) => zone.areaHa > previous.areaHa ? zone : previous);
  const split = hectares(Math.floor(thousandths(largest.areaHa) / 4));
  return { ...plan, zones: [...plan.zones.map((zone) => zone === largest
    ? { ...zone, areaHa: hectares(thousandths(zone.areaHa) - thousandths(split)) } : zone), { id, crop, areaHa: split }] };
}

function cropScenario(site: PlannerSite, crop: string) {
  const key = cropKey(crop);
  const profile = profiles[key] ?? defaultCrop;
  const conditions = conditionsFor(site);
  const baseYield = regionalYield[site.id]?.[key] ?? profile.yieldT;
  const soilFit = profile.soils.includes(conditions.soil);
  const [moistureMin, moistureMax] = profile.moisturePct;
  const moistureDistance = Math.max(0, moistureMin - conditions.moisturePct, conditions.moisturePct - moistureMax);
  const moistureFactor = Math.max(.72, 1 - moistureDistance * .025);
  const waterFactor = Math.min(1, conditions.waterMm / profile.waterMm);
  const rotates = profiles[cropKey(conditions.previousCrop)]?.family !== profile.family;
  const yieldFactor = (soilFit ? 1 : .84) * moistureFactor * waterFactor * (rotates ? 1 : .9);
  return { profile, soilFit, moistureDistance, waterFactor, rotates, baseYield, yieldFactor,
    costPerHa: Math.round(profile.costUsd * (regionalCost[site.id] ?? 1)),
    capacityT: Math.round(site.areaHa * baseYield * .85 + 8) };
}

function rowEconomics(site: PlannerSite, crop: string, areaHa: number) {
  const factors = cropScenario(site, crop);
  const harvestT = round(areaHa * factors.baseYield * factors.yieldFactor, 3);
  const saleableT = round(harvestT * (1 - factors.profile.loss), 3);
  const soldT = Math.min(saleableT, factors.capacityT);
  const costUsd = round(areaHa * factors.costPerHa);
  const revenueUsd = round(soldT * factors.profile.priceUsd);
  return { crop, areaHa, harvestT, saleableT, soldT, costUsd, revenueUsd, marginUsd: round(revenueUsd - costUsd), ...factors };
}

export function recommendCrop(site: PlannerSite, areaHa = site.areaHa) {
  const ranked = site.crops.map((crop) => rowEconomics(site, crop, areaHa))
    .sort((left, right) => right.marginUsd - left.marginUsd);
  const best = ranked[0];
  if (!best) return undefined;
  const reasons = [
    best.soilFit ? "suelo compatible" : "rendimiento ajustado al suelo",
    best.moistureDistance === 0 ? "humedad en rango" : "humedad fuera del rango",
    best.waterFactor >= 1 ? "agua suficiente" : "agua limitada",
    best.rotates ? "alterna la familia del cultivo anterior" : "repite la familia del cultivo anterior",
  ];
  return { ...best, reasons, ranked };
}

export function evaluatePlan(site: PlannerSite, plan: DemoPlan) {
  const areas = new Map<string, number>();
  for (const zone of plan.zones) {
    areas.set(zone.crop, (areas.get(zone.crop) ?? 0) + thousandths(zone.areaHa));
  }
  // Si un cultivo se repite en el croquis, las zonas comparten el mismo cupo de venta.
  const rows = [...areas].filter(([, units]) => units > 0).map(([crop, units]) => rowEconomics(site, crop, hectares(units)));
  return { rows,
    harvestT: round(rows.reduce((sum, row) => sum + row.harvestT, 0), 3),
    soldT: round(rows.reduce((sum, row) => sum + row.soldT, 0), 3),
    costUsd: round(rows.reduce((sum, row) => sum + row.costUsd, 0)),
    revenueUsd: round(rows.reduce((sum, row) => sum + row.revenueUsd, 0)),
    marginUsd: round(rows.reduce((sum, row) => sum + row.marginUsd, 0)),
  };
}
