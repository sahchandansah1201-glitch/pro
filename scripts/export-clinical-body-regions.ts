import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { CLINICAL_BODY_REGIONS } from "../src/lib/clinical-body-regions";

const outputArg = process.argv[2];
if (!outputArg) {
  throw new Error("Usage: tsx scripts/export-clinical-body-regions.ts <output.json>");
}

const outputPath = resolve(outputArg);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({ schemaVersion: 1, regions: CLINICAL_BODY_REGIONS }, null, 2)}\n`,
  "utf8",
);

console.log(`Exported ${CLINICAL_BODY_REGIONS.length} regions to ${outputPath}`);
