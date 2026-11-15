const MAX_AREA_UNITS = 999_999_999_999;

// Las superficies se calculan en milésimas de hectárea.
export function areaUnits(value: string | number, truncate = false) {
  const decimal = String(value).trim().replace(",", ".");
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(decimal)) return null;
  const [whole, fraction = ""] = decimal.split(".");
  if (fraction.length > 3 && !truncate) return null;
  const units = Number(whole) * 1000 + Number(fraction.slice(0, 3).padEnd(3, "0"));
  return units <= MAX_AREA_UNITS ? units : null;
}

export const areaText = (units: number) => String(units / 1000);
