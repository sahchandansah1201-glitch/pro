#!/usr/bin/env node
// Stage 5H · strict production clinical evidence closure run with an audit-safe receipt.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildProductionClinicalEvidenceBundle } from "./build-stage5h-production-clinical-evidence-bundle.mjs";
import { validateProductionClinicalEvidenceClosure } from "./check-stage5h-production-clinical-evidence-closure.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT_DIR = join(ROOT, "reports/stage5h-production-clinical-evidence");
const RECEIPT_SCHEMA_VERSION = "stage5h-production-clinical-evidence-closure-receipt/v1";

function parseArgs(argv) {
  const result = {
    sourcePath: null,
    outDir: DEFAULT_OUT_DIR,
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
    } else if (arg === "--out-dir") {
      const next = argv[index + 1];
      if (!next) result.errors.push("--out-dir requires a path");
      else {
        result.outDir = resolve(process.cwd(), next);
        index += 1;
      }
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else {
      result.errors.push(`Unknown argument: ${arg}`);
    }
  }

  if (!result.help && !result.sourcePath) result.errors.push("--source is required");
  return result;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function readJsonWithBytes(filePath) {
  if (!existsSync(filePath)) throw new Error(`Source export not found: ${filePath}`);
  const bytes = readFileSync(filePath);
  return {
    bytes,
    json: JSON.parse(bytes.toString("utf8")),
  };
}

function gitValue(args) {
  try {
    return execFileSync("git", args, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function sectionStatusSummary(bundle) {
  return {
    timelineRolloutLongitudinalClinicalValidation:
      bundle.timelineRolloutLongitudinalClinicalValidation?.status ?? "missing",
    timelineRolloutProductionDatasetEvidence:
      bundle.timelineRolloutProductionDatasetEvidence?.status ?? "missing",
    timelineRolloutProductionReviewerRollbackEvidence:
      bundle.timelineRolloutProductionReviewerRollbackEvidence?.status ?? "missing",
    timelineRolloutProductionReviewerGovernance:
      bundle.timelineRolloutProductionReviewerGovernance?.status ?? "missing",
    timelineRolloutProductionReviewerEvidence:
      bundle.timelineRolloutProductionReviewerEvidence?.status ?? "missing",
  };
}

function buildReceipt({ bundle, sourcePath, sourceBytes, bundleBytes, validationResult }) {
  return {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    repository: {
      head: gitValue(["rev-parse", "--short", "HEAD"]),
      headFull: gitValue(["rev-parse", "HEAD"]),
      branch: gitValue(["branch", "--show-current"]),
    },
    source: {
      fileName: basename(sourcePath),
      sha256: sha256(sourceBytes),
      patientRowsIncluded: bundle.evidenceScope.patientRowsIncluded,
      sourceLogsIncluded: bundle.evidenceScope.sourceLogsIncluded,
    },
    bundle: {
      schemaVersion: bundle.schemaVersion,
      sha256: sha256(bundleBytes),
      evidenceScope: bundle.evidenceScope,
      sectionStatuses: sectionStatusSummary(bundle),
    },
    verification: {
      strictProduction: true,
      ok: validationResult.ok,
      checkedSections: validationResult.checkedSections,
      sdMfCoverage: [
        ...validationResult.sdMfCoverage,
        "SD-MF-028",
      ],
      checks: {
        positiveAggregateCounts: "passed",
        unresolvedAndBlockersZero: "passed",
        boundaryFlagsFalse: "passed",
        protectedAndClinicalKeysAbsent: "passed",
      },
    },
    boundaries: {
      patientDeliveryAllowed: false,
      medicalMeasurementAllowed: false,
      protectedFieldsExposed: false,
      clinicalOutputGenerated: false,
      rawSourcePayloadStoredInReceipt: false,
    },
  };
}

export function runProductionClinicalEvidenceClosure({ sourcePath, outDir = DEFAULT_OUT_DIR }) {
  const source = readJsonWithBytes(sourcePath);
  const bundle = buildProductionClinicalEvidenceBundle(source.json);
  const validationResult = validateProductionClinicalEvidenceClosure(bundle, {
    strictProduction: true,
  });
  if (!validationResult.ok) {
    return {
      ok: false,
      errors: validationResult.errors,
    };
  }

  mkdirSync(outDir, { recursive: true });
  const bundlePath = join(outDir, "evidence-bundle.json");
  const receiptPath = join(outDir, "evidence-closure-receipt.json");
  const bundleBytes = Buffer.from(`${JSON.stringify(bundle, null, 2)}\n`);
  const receipt = buildReceipt({
    bundle,
    sourcePath,
    sourceBytes: source.bytes,
    bundleBytes,
    validationResult,
  });

  writeFileSync(bundlePath, bundleBytes);
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

  return {
    ok: true,
    bundlePath,
    receiptPath,
    receipt,
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log("Usage: node scripts/run-stage5h-production-clinical-evidence-closure.mjs --source <validation-export.json> [--out-dir reports/stage5h-production-clinical-evidence]");
    return 0;
  }
  if (args.errors.length > 0) {
    console.error("[run-stage5h-production-clinical-evidence-closure] FAILED");
    for (const error of args.errors) console.error(`- ${error}`);
    return 1;
  }

  let result;
  try {
    result = runProductionClinicalEvidenceClosure({
      sourcePath: args.sourcePath,
      outDir: args.outDir,
    });
  } catch (error) {
    console.error("[run-stage5h-production-clinical-evidence-closure] FAILED");
    console.error(`- ${error.message}`);
    return 1;
  }

  if (!result.ok) {
    console.error("[run-stage5h-production-clinical-evidence-closure] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }

  console.log(`[run-stage5h-production-clinical-evidence-closure] OK bundle=${result.bundlePath}`);
  console.log(`[run-stage5h-production-clinical-evidence-closure] OK receipt=${result.receiptPath}`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
