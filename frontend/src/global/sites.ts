import terrainData from "./terrain.json";
import weatherData from "./weather.json";

export type SiteSource = { name: string; url: string };

export type WeatherSnapshot = {
  start: string;
  end: string;
  precipitationMm: number;
  temperatureC: number;
  sourceUrl: string;
};

export type TerrainSnapshot = {
  imageUrl: string;
  sourceUrl: string;
  sourceName: string;
  date: string;
  widthMeters: number;
  heightMeters: number;
  bounds: readonly [west: number, south: number, east: number, north: number];
  credit: string;
  licenseUrl: string;
};

export type GlobalSite = {
  id: string;
  name: string;
  location: string;
  lat: number;
  lon: number;
  areaHa: number;
  crops: string[];
  description: string;
  sources: SiteSource[];
  weather: WeatherSnapshot | null;
  terrain?: TerrainSnapshot;
};

const weather: Partial<Record<string, WeatherSnapshot>> = weatherData;
const terrain: Partial<Record<string, TerrainSnapshot>> = Object.fromEntries(
  Object.entries(terrainData).map(([id, { bounds: [west, south, east, north], ...snapshot }]) => [
    id,
    { ...snapshot, bounds: [west, south, east, north] } satisfies TerrainSnapshot,
  ]),
);

const regions: Omit<GlobalSite, "weather" | "terrain">[] = [
  {
    id: "campeche",
    name: "Campeche",
    location: "Hopelchén, México",
    lat: 19.7456,
    lon: -89.8306,
    areaHa: 12,
    crops: ["Maíz", "Soya", "Sorgo"],
    description: "El programa municipal registra maíz, soya y sorgo de grano entre los cultivos de Hopelchén.",
    sources: [
      { name: "Programa Municipal de Desarrollo Urbano de Hopelchén", url: "https://www.municipiohopelchen.com/public/files/src_criterios/PROGRAMA_MUNICIPAL_DE_DESARROLLO_URBANO_2024.pdf" },
    ],
  },
  {
    id: "yucatan",
    name: "Yucatán",
    location: "Tizimín, México",
    lat: 21.129,
    lon: -88.215,
    areaHa: 16,
    crops: ["Maíz", "Frijol", "Sorgo"],
    description: "Los registros del municipio incluyen maíz de grano y, a menor escala, frijol y sorgo forrajero.",
    sources: [
      { name: "Gaceta Municipal de Tizimín", url: "https://tizimin.gob.mx/GACETAS20212024/2021/GACETA%2015%202021%202024.pdf" },
    ],
  },
  {
    id: "iowa",
    name: "Iowa",
    location: "Cerca de Ames, Estados Unidos",
    lat: 42.0159,
    lon: -93.7936,
    areaHa: 32,
    crops: ["Maíz", "Soya", "Avena"],
    description: "Maíz y soya destacan en las estadísticas agrícolas estatales. El USDA también registra cultivos de avena.",
    sources: [
      { name: "USDA NASS · Estadísticas agrícolas de Iowa", url: "https://www.nass.usda.gov/Quick_Stats/Ag_Overview/stateOverview.php?state=iowa" },
    ],
  },
  {
    id: "beauce",
    name: "Beauce",
    location: "Eure-et-Loir, Francia",
    lat: 48.2633,
    lon: 1.6095,
    areaHa: 25,
    crops: ["Trigo", "Cebada", "Colza"],
    description: "Agreste registra trigo, cebada y colza entre los cultivos extensivos de Eure-et-Loir.",
    sources: [
      { name: "DRAAF Centre-Val de Loire · Mémento Agreste 2025", url: "https://draaf.centre-val-de-loire.agriculture.gouv.fr/IMG/pdf/2025_memento.pdf" },
    ],
  },
  {
    id: "mato-grosso",
    name: "Mato Grosso",
    location: "Sorriso, Brasil",
    lat: -12.5954,
    lon: -55.7180,
    areaHa: 40,
    crops: ["Soya", "Maíz", "Algodón"],
    description: "El IBGE registra soya, maíz y algodón entre los cultivos de Sorriso.",
    sources: [
      { name: "IBGE · Produção Agrícola Municipal", url: "https://agenciadenoticias.ibge.gov.br/agencia-sala-de-imprensa/2013-agencia-de-noticias/releases/31672-pam-2020-valor-da-producao-agricola-nacional-cresce-30-4-e-chega-a-r-470-5-bilhoes-recorde-da-serie" },
    ],
  },
];

export const globalSites: GlobalSite[] = regions.map((region) => ({
  ...region,
  weather: weather[region.id] ?? null,
  terrain: terrain[region.id],
}));
