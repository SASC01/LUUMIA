import { mkdir, readFile, writeFile } from "node:fs/promises";
import openapiTS, { astToString } from "openapi-typescript";

const source = new URL("../contracts/openapi.json", import.meta.url);
const folder = new URL("../contracts/generated/", import.meta.url);
const target = new URL("luumia.ts", folder);
const output = "/* Generado desde OpenAPI. Ejecuta npm run contracts:types. */\n" + astToString(await openapiTS(source));

if (process.argv.includes("--check")) {
  const current = await readFile(target, "utf8").catch(() => "");
  if (current !== output) {
    console.error("Los tipos requieren regeneración.");
    process.exitCode = 1;
  } else {
    console.log("Tipos LuumIA sincronizados.");
  }
} else {
  await mkdir(folder, { recursive: true });
  await writeFile(target, output);
}
