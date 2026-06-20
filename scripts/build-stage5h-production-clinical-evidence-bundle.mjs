#!/usr/bin/env node
// Stage 5H · build a production clinical evidence closure bundle from an aggregate validation export.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateProductionClinicalEvidenceClosure } from "./check-stage5h-production-clinical-evidence-closure.mjs";

const SCHEMA_VERSION = "stage5h-production-clinical-evidence-closure/v1";

const SECTION_KEYS = [
  "timelineRolloutLongitudinalClinicalValidation",
  "timelineRolloutProductionDatasetEvidence",
  "timelineRolloutProductionReviewerRollbackEvidence",
  "timelineRolloutProductionReviewerGovernance",
  "timelineRolloutProductionReviewerEvidence",
];

function parseArgs(argv) {
  const result = {
    sourcePath: null,
    outPath: null,
    strictProduction: false,
    errors: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source") {
      const next = argv[index + 1];
      if (!next) result.errors.push("--source requires a path");
      else {
        result.sourcePath = resolve(process.cwd(), next);
        index += 1;
      }
    } else if (arg === "--out") {
      const next = argv[index + 1];
      if (!next) result.errors.push("--out requires a path");
      else {
        result.outPath = resolve(process.cwd(), next);
        index += 1;
      }
    } else if (arg === "--strict-production") {
      result.strictProduction = true;
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else {
      result.errors.push(`Unknown argument: ${arg}`);
    }
  }

  if (!result.help && !result.sourcePath) {
    result.errors.push("--source is required");
  }

  return result;
}

function readJson(filePath) {
  if (!existsSync(filePath)) throw new Error(`Source export not found: ${filePath}`);
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function unwrapValidationExport(source) {
  if (source && typeof source === "object" && source.validation && typeof source.validation === "object") {
    return {
      evidenceScope: source.evidenceScope,
      validation: source.validation,
    };
  }

  if (source && typeof source === "object" && source.data?.validation && typeof source.data.validation === "object") {
    return {
      evidenceScope: source.evidenceScope ?? source.data.evidenceScope,
      validation: source.data.validation,
    };
  }

  return {
    evidenceScope: source?.evidenceScope,
    validation: source,
  };
}

export function buildProductionClinicalEvidenceBundle(source) {
  const { evidenceScope, validation } = unwrapValidationExport(source);
  if (!evidenceScope || typeof evidenceScope !== "object") {
    throw new Error("Source export must include evidenceScope");
  }
  if (!validation || typeof validation !== "object") {
    throw new Error("Source export must include a validation object");
  }

  const bundle = {
    schemaVersion: SCHEMA_VERSION,
    evidenceScope,
  };

  for (const key of SECTION_KEYS) {
    bundle[key] = validation[key];
  }

  return bundle;
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log("Usage: node scripts/build-stage5h-production-clinical-evidence-bundle.mjs --source <validation-export.json> [--out bundle.json] [--strict-production]");
    return 0;
  }
  if (args.errors.length > 0) {
    console.error("[build-stage5h-production-clinical-evidence-bundle] FAILED");
    for (const error of args.errors) console.error(`- ${error}`);
    return 1;
  }

  let source;
  try {
    source = readJson(args.sourcePath);
  } catch (error) {
    console.error("[build-stage5h-production-clinical-evidence-bundle] FAILED");
    console.error(`- ${error.message}`);
    return 1;
  }

  let bundle;
  try {
    bundle = buildProductionClinicalEvidenceBundle(source);
  } catch (error) {
    console.error("[build-stage5h-production-clinical-evidence-bundle] FAILED");
    console.error(`- ${error.message}`);
    return 1;
  }

  const validationResult = validateProductionClinicalEvidenceClosure(bundle, {
    strictProduction: args.strictProduction,
  });
  if (!validationResult.ok) {
    console.error("[build-stage5h-production-clinical-evidence-bundle] FAILED");
    for (const error of validationResult.errors) console.error(`- ${error}`);
    return 1;
  }

  const output = `${JSON.stringify(bundle, null, 2)}\n`;
  if (args.outPath) {
    writeFileSync(args.outPath, output);
    console.log(`[build-stage5h-production-clinical-evidence-bundle] OK wrote ${args.outPath}`);
  } else {
    process.stdout.write(output);
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
