#!/usr/bin/env node
// Stage 5H · fetch real aggregate clinical evidence from self-hosted API and run strict closure.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildProductionClinicalEvidenceBundle } from "./build-stage5h-production-clinical-evidence-bundle.mjs";
import { validateProductionClinicalEvidenceClosure } from "./check-stage5h-production-clinical-evidence-closure.mjs";
import { runProductionClinicalEvidenceClosure } from "./run-stage5h-production-clinical-evidence-closure.mjs";

const DEFAULT_OUT_DIR = "reports/stage5h-production-clinical-evidence";
export const PRODUCTION_AGGREGATE_CONFIRMATION = "I_CONFIRM_REAL_AGGREGATE_NO_PATIENT_ROWS";

const SECTION_KEYS = [
  "timelineRolloutLongitudinalClinicalValidation",
  "timelineRolloutProductionDatasetEvidence",
  "timelineRolloutProductionReviewerRollbackEvidence",
  "timelineRolloutProductionReviewerGovernance",
  "timelineRolloutProductionReviewerEvidence",
];

const FORBIDDEN_API_EXPORT_KEY_PATTERN =
  /^(pairKey|imageIds|assetId|patientId|caseId|storagePath|storageObjectPath|objectKey|bucketKey|signedUrl|accessToken|qrToken|sessionId|credential|doctorVersionText|patientSafeText|diagnosis|risk|prognosis|treatment|measurement|dynamicConclusion|raw[A-Z].*|.*Payload|.*Details|reviewerName|reviewerEmail|validatorName|validatorEmail)$/i;

function parseArgs(argv, env = process.env) {
  const result = {
    apiBaseUrl: env.SELF_HOSTED_API_BASE_URL ?? "",
    apiToken: env.SELF_HOSTED_BEARER_TOKEN ?? "",
    visitId: env.STAGE5H_VISIT_ID ?? "",
    outDir: env.STAGE5H_EVIDENCE_OUT_DIR ?? DEFAULT_OUT_DIR,
    confirmation: env.STAGE5H_CONFIRM_REAL_PRODUCTION_AGGREGATE ?? "",
    errors: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--api-base-url") {
      if (!next) result.errors.push("--api-base-url requires a value");
      else {
        result.apiBaseUrl = next;
        index += 1;
      }
    } else if (arg === "--api-token") {
      if (!next) result.errors.push("--api-token requires a value");
      else {
        result.apiToken = next;
        index += 1;
      }
    } else if (arg === "--visit-id") {
      if (!next) result.errors.push("--visit-id requires a value");
      else {
        result.visitId = next;
        index += 1;
      }
    } else if (arg === "--out-dir") {
      if (!next) result.errors.push("--out-dir requires a value");
      else {
        result.outDir = next;
        index += 1;
      }
    } else if (arg === "--confirm-real-production-aggregate") {
      if (!next) result.errors.push("--confirm-real-production-aggregate requires a value");
      else {
        result.confirmation = next;
        index += 1;
      }
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else {
      result.errors.push(`Unknown argument: ${arg}`);
    }
  }

  if (!result.help) {
    if (!result.apiBaseUrl) result.errors.push("--api-base-url or SELF_HOSTED_API_BASE_URL is required");
    if (!result.apiToken) result.errors.push("--api-token or SELF_HOSTED_BEARER_TOKEN is required");
    if (!result.visitId) result.errors.push("--visit-id or STAGE5H_VISIT_ID is required");
    if (result.confirmation !== PRODUCTION_AGGREGATE_CONFIRMATION) {
      result.errors.push(
        `--confirm-real-production-aggregate must equal ${PRODUCTION_AGGREGATE_CONFIRMATION}`,
      );
    }
  }

  return result;
}

function collectForbiddenKeys(value, path = "$", found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenKeys(item, `${path}[${index}]`, found));
    return found;
  }

  if (!value || typeof value !== "object") return found;

  for (const [key, nested] of Object.entries(value)) {
    const nextPath = `${path}.${key}`;
    if (FORBIDDEN_API_EXPORT_KEY_PATTERN.test(key)) found.push(nextPath);
    collectForbiddenKeys(nested, nextPath, found);
  }

  return found;
}

function buildDatasetValidationUrl(apiBaseUrl, visitId) {
  const base = apiBaseUrl.replace(/\/+$/, "");
  return `${base}/api/v1/visits/${encodeURIComponent(visitId)}/longitudinal-dataset-validation`;
}

function unwrapApiValidationResponse(payload) {
  if (payload && typeof payload === "object" && payload.validation && typeof payload.validation === "object") {
    return payload.validation;
  }
  if (payload && typeof payload === "object" && payload.data?.validation && typeof payload.data.validation === "object") {
    return payload.data.validation;
  }
  if (payload && typeof payload === "object" && payload.data && typeof payload.data === "object") {
    return payload.data;
  }
  return payload;
}

function pickClosureEvidenceSections(validation) {
  const picked = {};
  for (const key of SECTION_KEYS) {
    picked[key] = validation?.[key];
  }
  return picked;
}

function buildProductionEvidenceScope() {
  return {
    source: "production_clinic_operations",
    sampleContract: false,
    realClinicalDataset: true,
    realProtectedAssets: true,
    mockDataUsed: false,
    patientRowsIncluded: false,
    sourceLogsIncluded: false,
  };
}

function buildSourceExportFromApiResponse(payload) {
  const validation = unwrapApiValidationResponse(payload);
  if (!validation || typeof validation !== "object") {
    throw new Error("API response must include an aggregate validation object");
  }

  const forbiddenKeys = collectForbiddenKeys(validation);
  if (forbiddenKeys.length > 0) {
    throw new Error(`Forbidden protected or clinical keys found in API validation response: ${forbiddenKeys.join(", ")}`);
  }

  return {
    evidenceScope: buildProductionEvidenceScope(),
    validation: pickClosureEvidenceSections(validation),
  };
}

function validateSourceExportBeforeWrite(sourceExport) {
  const bundle = buildProductionClinicalEvidenceBundle(sourceExport);
  const validationResult = validateProductionClinicalEvidenceClosure(bundle, {
    strictProduction: true,
  });
  if (!validationResult.ok) {
    throw new Error(validationResult.errors.join("\n"));
  }
}

async function fetchValidationFromApi({ apiBaseUrl, apiToken, visitId, fetchImpl }) {
  if (typeof fetchImpl !== "function") {
    throw new Error("This runtime does not provide fetch; use Node.js 18+");
  }

  const url = buildDatasetValidationUrl(apiBaseUrl, visitId);
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText ?? ""}`.trim());
  }

  return response.json();
}

export function redactSecrets(value, secrets) {
  let output = String(value);
  for (const secret of secrets) {
    if (secret) output = output.split(secret).join("[redacted]");
  }
  return output;
}

export async function exportProductionClinicalEvidenceFromApi({
  apiBaseUrl,
  apiToken,
  visitId,
  outDir = DEFAULT_OUT_DIR,
  confirmation,
  fetchImpl = globalThis.fetch,
}) {
  const config = parseArgs([], {
    SELF_HOSTED_API_BASE_URL: apiBaseUrl,
    SELF_HOSTED_BEARER_TOKEN: apiToken,
    STAGE5H_VISIT_ID: visitId,
    STAGE5H_EVIDENCE_OUT_DIR: outDir,
    STAGE5H_CONFIRM_REAL_PRODUCTION_AGGREGATE: confirmation,
  });
  if (config.errors.length > 0) {
    throw new Error(config.errors.join("\n"));
  }

  const payload = await fetchValidationFromApi({
    apiBaseUrl: config.apiBaseUrl,
    apiToken: config.apiToken,
    visitId: config.visitId,
    fetchImpl,
  });
  const sourceExport = buildSourceExportFromApiResponse(payload);
  validateSourceExportBeforeWrite(sourceExport);

  const resolvedOutDir = resolve(process.cwd(), config.outDir);
  mkdirSync(resolvedOutDir, { recursive: true });
  const validationExportPath = join(resolvedOutDir, "validation-export.json");
  writeFileSync(validationExportPath, `${JSON.stringify(sourceExport, null, 2)}\n`);

  const closureResult = runProductionClinicalEvidenceClosure({
    sourcePath: validationExportPath,
    outDir: resolvedOutDir,
  });
  if (!closureResult.ok) {
    throw new Error(closureResult.errors.join("\n"));
  }

  return {
    ok: true,
    validationExportPath,
    bundlePath: closureResult.bundlePath,
    receiptPath: closureResult.receiptPath,
    receipt: closureResult.receipt,
  };
}

export async function main(argv = process.argv.slice(2), env = process.env, fetchImpl = globalThis.fetch) {
  const args = parseArgs(argv, env);
  if (args.help) {
    console.log(`Usage: node scripts/export-stage5h-production-clinical-evidence-from-api.mjs --api-base-url <url> --api-token <bearer> --visit-id <visit> --confirm-real-production-aggregate ${PRODUCTION_AGGREGATE_CONFIRMATION} [--out-dir reports/stage5h-production-clinical-evidence]`);
    console.log("Environment alternatives: SELF_HOSTED_API_BASE_URL, SELF_HOSTED_BEARER_TOKEN, STAGE5H_VISIT_ID, STAGE5H_CONFIRM_REAL_PRODUCTION_AGGREGATE, STAGE5H_EVIDENCE_OUT_DIR");
    return 0;
  }
  if (args.errors.length > 0) {
    console.error("[export-stage5h-production-clinical-evidence-from-api] FAILED");
    for (const error of args.errors) console.error(`- ${error}`);
    return 1;
  }

  try {
    const result = await exportProductionClinicalEvidenceFromApi({
      apiBaseUrl: args.apiBaseUrl,
      apiToken: args.apiToken,
      visitId: args.visitId,
      outDir: args.outDir,
      confirmation: args.confirmation,
      fetchImpl,
    });
    console.log(`[export-stage5h-production-clinical-evidence-from-api] OK validation-export=${result.validationExportPath}`);
    console.log(`[export-stage5h-production-clinical-evidence-from-api] OK bundle=${result.bundlePath}`);
    console.log(`[export-stage5h-production-clinical-evidence-from-api] OK receipt=${result.receiptPath}`);
    return 0;
  } catch (error) {
    console.error("[export-stage5h-production-clinical-evidence-from-api] FAILED");
    console.error(`- ${redactSecrets(error.message, [args.apiToken])}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(await main());
}
