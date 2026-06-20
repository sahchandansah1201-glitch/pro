#!/usr/bin/env node
// Stage 5H · verify a production clinical evidence closure receipt package.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateProductionClinicalEvidenceClosure } from "./check-stage5h-production-clinical-evidence-closure.mjs";

const DEFAULT_DIR = "reports/stage5h-production-clinical-evidence";
const RECEIPT_SCHEMA_VERSION = "stage5h-production-clinical-evidence-closure-receipt/v1";
const BUNDLE_SCHEMA_VERSION = "stage5h-production-clinical-evidence-closure/v1";

const REQUIRED_SECTION_STATUSES = {
  timelineRolloutLongitudinalClinicalValidation: "ready_for_longitudinal_clinical_validation",
  timelineRolloutProductionDatasetEvidence: "ready_for_production_dataset_evidence",
  timelineRolloutProductionReviewerRollbackEvidence: "ready_for_production_reviewer_rollback_evidence",
  timelineRolloutProductionReviewerGovernance: "ready_for_production_reviewer_governance",
  timelineRolloutProductionReviewerEvidence: "ready_for_production_reviewer_evidence",
};

const RECEIPT_FORBIDDEN_TEXT_PATTERN =
  /"(patientId|caseId|assetId|pairKey|imageIds|storagePath|storageObjectPath|objectKey|bucketKey|signedUrl|accessToken|qrToken|sessionId|credential|doctorVersionText|patientSafeText|diagnosis|risk|prognosis|treatment|measurement|dynamicConclusion)"\s*:|"(realClinicWindowCount|productionReviewWindowCount)"\s*:/i;

function parseArgs(argv) {
  const result = {
    dir: DEFAULT_DIR,
    errors: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--dir") {
      if (!next) result.errors.push("--dir requires a value");
      else {
        result.dir = next;
        index += 1;
      }
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else {
      result.errors.push(`Unknown argument: ${arg}`);
    }
  }

  return result;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readJsonWithBytes(filePath) {
  if (!existsSync(filePath)) throw new Error(`Missing receipt package file: ${filePath}`);
  const bytes = readFileSync(filePath);
  return {
    bytes,
    json: JSON.parse(bytes.toString("utf8")),
    text: bytes.toString("utf8"),
  };
}

function hasFalseBoundaryFlags(value) {
  return value?.patientDeliveryAllowed === false
    && value?.medicalMeasurementAllowed === false
    && value?.protectedFieldsExposed === false
    && value?.clinicalOutputGenerated === false;
}

function validateReceiptPackage({ source, bundle, receipt, receiptText }) {
  const errors = [];

  if (receipt.json.schemaVersion !== RECEIPT_SCHEMA_VERSION) {
    errors.push(`receipt.schemaVersion must be ${RECEIPT_SCHEMA_VERSION}`);
  }
  if (bundle.json.schemaVersion !== BUNDLE_SCHEMA_VERSION) {
    errors.push(`bundle.schemaVersion must be ${BUNDLE_SCHEMA_VERSION}`);
  }
  if (receipt.json.source?.sha256 !== sha256(source.bytes)) {
    errors.push("receipt.source.sha256 does not match validation-export.json");
  }
  if (receipt.json.bundle?.sha256 !== sha256(bundle.bytes)) {
    errors.push("receipt.bundle.sha256 does not match evidence-bundle.json");
  }
  if (receipt.json.source?.patientRowsIncluded !== false) {
    errors.push("receipt.source.patientRowsIncluded must be false");
  }
  if (receipt.json.source?.sourceLogsIncluded !== false) {
    errors.push("receipt.source.sourceLogsIncluded must be false");
  }
  if (receipt.json.verification?.strictProduction !== true) {
    errors.push("receipt.verification.strictProduction must be true");
  }
  if (receipt.json.verification?.ok !== true) {
    errors.push("receipt.verification.ok must be true");
  }
  if (receipt.json.verification?.checkedSections !== Object.keys(REQUIRED_SECTION_STATUSES).length) {
    errors.push("receipt.verification.checkedSections must equal the required evidence section count");
  }
  for (const id of ["SD-MF-025", "SD-MF-026", "SD-MF-028"]) {
    if (!receipt.json.verification?.sdMfCoverage?.includes(id)) {
      errors.push(`receipt.verification.sdMfCoverage must include ${id}`);
    }
  }
  if (!hasFalseBoundaryFlags(receipt.json.boundaries)) {
    errors.push("receipt.boundaries must keep patient delivery, measurement, protected fields and clinical output false");
  }
  if (receipt.json.boundaries?.rawSourcePayloadStoredInReceipt !== false) {
    errors.push("receipt.boundaries.rawSourcePayloadStoredInReceipt must be false");
  }
  if (!hasFalseBoundaryFlags(bundle.json.timelineRolloutLongitudinalClinicalValidation)
    || !hasFalseBoundaryFlags(bundle.json.timelineRolloutProductionDatasetEvidence)
    || !hasFalseBoundaryFlags(bundle.json.timelineRolloutProductionReviewerRollbackEvidence)
    || !hasFalseBoundaryFlags(bundle.json.timelineRolloutProductionReviewerGovernance)
    || !hasFalseBoundaryFlags(bundle.json.timelineRolloutProductionReviewerEvidence)) {
    errors.push("bundle evidence sections must keep all boundary flags false");
  }

  const strictValidation = validateProductionClinicalEvidenceClosure(bundle.json, {
    strictProduction: true,
  });
  if (!strictValidation.ok) {
    errors.push(...strictValidation.errors.map((error) => `strict bundle validation failed: ${error}`));
  }

  for (const [key, expectedStatus] of Object.entries(REQUIRED_SECTION_STATUSES)) {
    const receiptStatus = receipt.json.bundle?.sectionStatuses?.[key];
    const bundleStatus = bundle.json[key]?.status;
    if (receiptStatus !== expectedStatus) {
      errors.push(`receipt.bundle.sectionStatuses.${key} must be ${expectedStatus}`);
    }
    if (bundleStatus !== expectedStatus) {
      errors.push(`bundle.${key}.status must be ${expectedStatus}`);
    }
  }

  if (RECEIPT_FORBIDDEN_TEXT_PATTERN.test(receiptText)) {
    errors.push("receipt contains forbidden raw, protected, clinical or aggregate-count text");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function verifyProductionClinicalEvidenceReceiptPackage({ dir = DEFAULT_DIR }) {
  const resolvedDir = resolve(process.cwd(), dir);
  const source = readJsonWithBytes(join(resolvedDir, "validation-export.json"));
  const bundle = readJsonWithBytes(join(resolvedDir, "evidence-bundle.json"));
  const receipt = readJsonWithBytes(join(resolvedDir, "evidence-closure-receipt.json"));
  const result = validateReceiptPackage({
    source,
    bundle,
    receipt,
    receiptText: receipt.text,
  });

  return {
    ...result,
    dir: resolvedDir,
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log("Usage: node scripts/verify-stage5h-production-clinical-evidence-receipt.mjs [--dir reports/stage5h-production-clinical-evidence]");
    return 0;
  }
  if (args.errors.length > 0) {
    console.error("[verify-stage5h-production-clinical-evidence-receipt] FAILED");
    for (const error of args.errors) console.error(`- ${error}`);
    return 1;
  }

  let result;
  try {
    result = verifyProductionClinicalEvidenceReceiptPackage({ dir: args.dir });
  } catch (error) {
    console.error("[verify-stage5h-production-clinical-evidence-receipt] FAILED");
    console.error(`- ${error.message}`);
    return 1;
  }

  if (!result.ok) {
    console.error("[verify-stage5h-production-clinical-evidence-receipt] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }

  console.log(`[verify-stage5h-production-clinical-evidence-receipt] OK dir=${result.dir}`);
  console.log("Coverage: SD-MF-025, SD-MF-026, SD-MF-028");
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
