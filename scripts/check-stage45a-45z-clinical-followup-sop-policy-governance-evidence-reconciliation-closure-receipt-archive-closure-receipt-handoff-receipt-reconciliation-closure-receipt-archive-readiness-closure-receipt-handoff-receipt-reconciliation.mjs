#!/usr/bin/env node
// Stage 45A-45Z - Clinical follow-up local archive readiness closure receipt handoff receipt reconciliation guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MANIFEST = "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation.stage45a-45z.json";
const MIGRATION = "backend/self-hosted/db/migrations/0052_stage45_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff_receipt_reconciliation.sql";
const DOC = "docs/backend/stage-45a-45z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation.md";
const WORKFLOW = ".github/workflows/stage45a-45z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation.yml";
const GUARD = "scripts/check-stage45a-45z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation.mjs";
const GUARD_TEST = "scripts/check-stage45a-45z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation.test.mjs";

const REQUIRED_FILES = [
  MANIFEST,
  MIGRATION,
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage45a-45z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  DOC,
  WORKFLOW,
  GUARD,
  GUARD_TEST,
  "package.json",
  "scripts/preflight-all.mjs",
  "scripts/preflight-all.test.mjs",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/WORKLOG.md",
  "docs/project-memory/RISKS.md",
  "docs/project-memory/ARTIFACTS.md",
];

const REQUIRED_TEXT = {
  [MANIFEST]: [
    "\"stage\": \"45A-45Z\"",
    "\"previousBatch\": \"Stage 44A-44Z\"",
    "\"nextBatchHypothesis\": \"Stage 46A-46Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 45A-45Z synced from main, no conflicts.\"",
  ],
  [MIGRATION]: [
    "stage45_archive_handoff_receipt_reconciliation_state",
    "stage45_archive_handoff_receipt_reconciled_at",
    "references app_users(id) on delete set null",
    "clinical_follow_up_stage45_handoff_receipt_recon_events",
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummarySql",
    "buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSql",
    "getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummary",
    "updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliation",
    "clinical_follow_up_stage45_handoff_receipt_recon_events",
  ],
  "backend/self-hosted/clinical-followup-repository.test.mjs": [
    "buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummarySql",
    "stage45_archive_handoff_receipt_reconciliation_state = 'reconciled'",
    "clinical_follow_up_stage45_handoff_receipt_recon_events",
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationPayload",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff_receipt_reconciliation.summary",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff_receipt_reconciliation.update",
  ],
  "backend/self-hosted/clinical-followup-service.test.mjs": [
    "normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationPayload",
    "Local archive readiness closure receipt handoff receipt reconciliation recorded.",
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation/summary",
    "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation",
    "openapi.stage45a-45z.json",
  ],
  "deploy/self-hosted/nginx.stage4a.conf": ["/openapi.stage45a-45z.json"],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummary",
    "updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliation",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummary",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationState",
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Recon archive handoff receipt reconciliation ready",
    "Recon archive handoff receipt reconciliation rework",
    "Reconciled recon archive handoff receipts",
    "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationSummary",
  ],
  [DOC]: [
    "Stage 45A-45Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none",
  ],
  [WORKFLOW]: ["name: stage45a-45z-clinical-followup", "npm run preflight:stage45a-45z"],
  "package.json": ["\"test:stage45a-45z\"", "\"check:stage45a-45z\"", "\"preflight:stage45a-45z\""],
  "scripts/preflight-all.mjs": [
    "Stage 45A-45Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation preflight",
    "preflight:stage45a-45z",
  ],
  "scripts/preflight-all.test.mjs": [
    "Stage 45A-45Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation preflight",
    "preflight:stage45a-45z",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 45A-45Z",
    "clinical_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff_receipt_reconciliation_confirmed: true",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 45A-45Z",
    "SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": ["Stage 45A-45Z", "Stage 46A-46Z", "hypothesis"],
  "docs/project-memory/WORKLOG.md": [
    "Stage 45A-45Z",
    "SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation",
  ],
  "docs/project-memory/RISKS.md": ["Stage 45A-45Z", "archive readiness closure receipt handoff receipt reconciliation"],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation.stage45a-45z.json",
    "stage-45a-45z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation.md",
    "check-stage45a-45z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation.mjs",
  ],
};

const PROTECTED_FILES = [
  MANIFEST,
  MIGRATION,
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
];

const FORBIDDEN = [
  /\bapi-read\b/i,
  /\bapi-write\b/i,
  /edge function/i,
  /SUPABASE_/i,
  /navigator\.(usb|bluetooth|serial)/i,
  /storage_object_path/i,
  /signed_url/i,
  /access_token/i,
  /object_bucket/i,
  /object_key/i,
  /vendor\s+(sms|email|notification)/i,
  /external\s+sop\s+(completion|approval)\s+proof/i,
  /external\s+governance\s+(approval|sign-off)\s+proof/i,
  /legal\s+archive\s+sufficiency\s+proof/i,
  /medical\s+correctness\s+(proof|verification|guarantee)/i,
  /references\s+users\s*\(/i,
  /ReceiptReceipt/,
  /ClosureReceiptarchive/,
  /needsarchive/,
];

function read(root, file) {
  return readFileSync(join(root, file), "utf8");
}

function checkMarkers(root, errors, table, label = "marker") {
  for (const [file, markers] of Object.entries(table)) {
    if (!existsSync(join(root, file))) {
      errors.push("Missing " + label + " file: " + file);
      continue;
    }
    const text = read(root, file);
    for (const marker of markers) {
      if (!text.includes(marker)) errors.push(file + " missing " + label + ": " + marker);
    }
  }
}

function validateManifest(root, errors) {
  if (!existsSync(join(root, MANIFEST))) return;
  let manifest;
  try {
    manifest = JSON.parse(read(root, MANIFEST));
  } catch {
    errors.push("Stage 45 manifest must be valid JSON");
    return;
  }
  if (manifest.stage !== "45A-45Z") errors.push("Stage 45 manifest stage must be 45A-45Z");
  if (manifest.previousBatch !== "Stage 44A-44Z") errors.push("Stage 45 previous batch must be Stage 44A-44Z");
  if (manifest.nextBatchHypothesis !== "Stage 46A-46Z") errors.push("Stage 45 must record Stage 46A-46Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 10) errors.push("Stage 45 must include at least 10 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 45 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 45 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 45 managed notification dependency must be none");
  if (!manifest.privacy?.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationIsLocalMetadataOnly) {
    errors.push("Stage 45 handoff receipt reconciliation must be local metadata only");
  }
  if (!manifest.verification?.preflight?.includes("preflight:stage45a-45z")) errors.push("Stage 45 preflight command missing");
}

function validatePostgresIdentifiers(root, errors) {
  if (!existsSync(join(root, MIGRATION))) return;
  const identifiers = read(root, MIGRATION).match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  for (const identifier of identifiers) {
    if (/^(stage45_|clinical_follow_up_stage45_|idx_cfut_stage45_|chk_cfut_stage45_|archive_|stage[0-9]+_)/.test(identifier) && identifier.length > 63) {
      errors.push(MIGRATION + " has PostgreSQL identifier longer than 63 bytes: " + identifier);
    }
  }
}

export function checkStage45A45Z(root = process.cwd()) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) errors.push("Missing required file: " + file);
  }
  checkMarkers(root, errors, REQUIRED_TEXT);
  checkMarkers(root, errors, PROJECT_MEMORY_REQUIRED_TEXT, "project-memory marker");
  validateManifest(root, errors);
  validatePostgresIdentifiers(root, errors);
  for (const file of PROTECTED_FILES) {
    if (!existsSync(join(root, file))) continue;
    const text = read(root, file);
    for (const pattern of FORBIDDEN) {
      if (pattern.test(text)) errors.push(file + " contains forbidden runtime marker: " + pattern);
    }
  }
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = checkStage45A45Z(process.cwd());
  if (!result.ok) {
    console.error("[stage45a-45z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`[stage45a-45z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation] OK (${result.checkedFiles} files checked)`);
  }
}
