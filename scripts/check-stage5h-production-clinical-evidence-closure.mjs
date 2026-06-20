#!/usr/bin/env node
// Stage 5H · production clinical evidence closure guard.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_FIXTURE = join(ROOT, "fixtures/stage5h/production-clinical-evidence-closure.ready.json");

const BOUNDARY_FLAGS = [
  "patientDeliveryAllowed",
  "medicalMeasurementAllowed",
  "protectedFieldsExposed",
  "clinicalOutputGenerated",
];

const FORBIDDEN_KEY_PATTERN =
  /^(pairKey|imageIds|assetId|patientId|caseId|storagePath|storageObjectPath|objectKey|bucketKey|signedUrl|accessToken|qrToken|sessionId|credential|doctorVersionText|patientSafeText|diagnosis|risk|prognosis|treatment|measurement|dynamicConclusion|raw[A-Z].*|.*Payload|.*Details|reviewerName|reviewerEmail|validatorName|validatorEmail)$/i;

const EVIDENCE_SECTIONS = [
  {
    key: "timelineRolloutLongitudinalClinicalValidation",
    sdMf: "SD-MF-025",
    readyStatus: "ready_for_longitudinal_clinical_validation",
    positiveCounts: ["realOutcomeWindowCount", "governanceReviewCount"],
    zeroCounts: ["unresolvedConsensusCaseCount", "blockerCount"],
  },
  {
    key: "timelineRolloutProductionDatasetEvidence",
    sdMf: "SD-MF-025",
    readyStatus: "ready_for_production_dataset_evidence",
    positiveCounts: [
      "realClinicWindowCount",
      "monitoredClinicOperationCount",
      "sampledClinicOperationCount",
      "longitudinalFollowupCount",
      "protectedReviewerLinkedCount",
      "observedOutcomeCount",
      "incidentLinkedCount",
    ],
    zeroCounts: ["unresolvedProductionDatasetEvidenceCount", "blockerCount"],
  },
  {
    key: "timelineRolloutProductionReviewerRollbackEvidence",
    sdMf: "SD-MF-026",
    readyStatus: "ready_for_production_reviewer_rollback_evidence",
    positiveCounts: [
      "productionReviewWindowCount",
      "rollbackDrillProductionCount",
      "rollbackReadyProductionCount",
    ],
    zeroCounts: ["unresolvedRollbackEvidenceCount", "blockerCount"],
  },
  {
    key: "timelineRolloutProductionReviewerGovernance",
    sdMf: "SD-MF-026",
    readyStatus: "ready_for_production_reviewer_governance",
    positiveCounts: [
      "productionReviewWindowCount",
      "assignedProductionReviewerCount",
      "secondReviewedProductionCount",
      "adjudicatedProductionReviewCount",
      "followupClosedProductionCount",
      "exceptionClosedProductionCount",
      "rollbackReadyProductionCount",
    ],
    zeroCounts: ["unresolvedProductionReviewerGovernanceCount", "blockerCount"],
  },
  {
    key: "timelineRolloutProductionReviewerEvidence",
    sdMf: "SD-MF-026",
    readyStatus: "ready_for_production_reviewer_evidence",
    positiveCounts: [
      "productionReviewWindowCount",
      "assignedProductionReviewerCount",
      "secondReviewedProductionCount",
      "adjudicatedProductionReviewCount",
      "followupClosedProductionCount",
      "exceptionClosedProductionCount",
      "rollbackReadyProductionCount",
    ],
    zeroCounts: ["unresolvedProductionReviewerEvidenceCount", "blockerCount"],
  },
];

function parseArgs(argv) {
  const result = {
    fixturePath: DEFAULT_FIXTURE,
    strictProduction: false,
    errors: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--fixture") {
      const next = argv[index + 1];
      if (!next) result.errors.push("--fixture requires a path");
      else {
        result.fixturePath = resolve(process.cwd(), next);
        index += 1;
      }
    } else if (arg === "--strict-production") {
      result.strictProduction = true;
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (!arg.startsWith("--")) {
      result.fixturePath = resolve(process.cwd(), arg);
    } else {
      result.errors.push(`Unknown argument: ${arg}`);
    }
  }

  return result;
}

function readJson(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Evidence bundle not found: ${filePath}`);
  }
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function isPositiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function isZero(value) {
  return Number.isFinite(value) && value === 0;
}

function collectForbiddenKeys(value, path = "$", found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenKeys(item, `${path}[${index}]`, found));
    return found;
  }

  if (!value || typeof value !== "object") return found;

  for (const [key, nested] of Object.entries(value)) {
    const nextPath = `${path}.${key}`;
    if (FORBIDDEN_KEY_PATTERN.test(key)) found.push(nextPath);
    collectForbiddenKeys(nested, nextPath, found);
  }

  return found;
}

function validateScope(bundle, { strictProduction }) {
  const errors = [];
  const scope = bundle.evidenceScope;
  if (!scope || typeof scope !== "object") {
    return ["Missing evidenceScope"];
  }

  if (scope.realClinicalDataset !== true) {
    errors.push("evidenceScope.realClinicalDataset must be true");
  }
  if (scope.realProtectedAssets !== true) {
    errors.push("evidenceScope.realProtectedAssets must be true");
  }
  if (scope.mockDataUsed !== false) {
    errors.push("evidenceScope.mockDataUsed must be false");
  }
  if (scope.patientRowsIncluded !== false) {
    errors.push("evidenceScope.patientRowsIncluded must be false");
  }
  if (scope.sourceLogsIncluded !== false) {
    errors.push("evidenceScope.sourceLogsIncluded must be false");
  }

  if (strictProduction) {
    if (scope.source !== "production_clinic_operations") {
      errors.push('strict production mode requires evidenceScope.source = "production_clinic_operations"');
    }
    if (scope.sampleContract === true) {
      errors.push("strict production mode rejects sampleContract=true");
    }
  }

  return errors;
}

function validateSection(bundle, section) {
  const errors = [];
  const entry = bundle[section.key];
  if (!entry || typeof entry !== "object") {
    return [`${section.key} is missing`];
  }

  if (entry.status !== section.readyStatus) {
    errors.push(`${section.key}.status must be ${section.readyStatus}`);
  }

  for (const countKey of section.positiveCounts) {
    if (!isPositiveNumber(entry[countKey])) {
      errors.push(`${section.key}.${countKey} must be a positive number`);
    }
  }

  for (const countKey of section.zeroCounts) {
    if (!isZero(entry[countKey])) {
      errors.push(`${section.key}.${countKey} must be 0`);
    }
  }

  for (const flag of BOUNDARY_FLAGS) {
    if (entry[flag] !== false) {
      errors.push(`${section.key}.${flag} must be false`);
    }
  }

  return errors;
}

export function validateProductionClinicalEvidenceClosure(bundle, options = {}) {
  const errors = [];
  errors.push(...validateScope(bundle, options));

  const forbiddenKeys = collectForbiddenKeys(bundle);
  if (forbiddenKeys.length > 0) {
    errors.push(`Forbidden protected or clinical keys found: ${forbiddenKeys.join(", ")}`);
  }

  for (const section of EVIDENCE_SECTIONS) {
    errors.push(...validateSection(bundle, section));
  }

  return {
    ok: errors.length === 0,
    errors,
    checkedSections: EVIDENCE_SECTIONS.length,
    sdMfCoverage: [...new Set(EVIDENCE_SECTIONS.map((section) => section.sdMf))],
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log("Usage: node scripts/check-stage5h-production-clinical-evidence-closure.mjs [--fixture path] [--strict-production]");
    return 0;
  }
  if (args.errors.length > 0) {
    console.error("[stage5h-production-clinical-evidence-closure] FAILED");
    for (const error of args.errors) console.error(`- ${error}`);
    return 1;
  }

  let bundle;
  try {
    bundle = readJson(args.fixturePath);
  } catch (error) {
    console.error("[stage5h-production-clinical-evidence-closure] FAILED");
    console.error(`- ${error.message}`);
    return 1;
  }

  const result = validateProductionClinicalEvidenceClosure(bundle, {
    strictProduction: args.strictProduction,
  });

  if (!result.ok) {
    console.error("[stage5h-production-clinical-evidence-closure] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }

  const mode = args.strictProduction ? "strict-production" : "contract-fixture";
  console.log(`[stage5h-production-clinical-evidence-closure] OK (${result.checkedSections} evidence sections, mode=${mode})`);
  console.log(`Coverage: ${result.sdMfCoverage.join(", ")} plus SD-MF-028 safety boundary flags`);
  if (!args.strictProduction) {
    console.log("Strict production certification requires: --strict-production --fixture <real-aggregate-evidence.json>");
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
