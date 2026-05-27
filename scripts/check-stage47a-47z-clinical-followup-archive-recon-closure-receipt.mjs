#!/usr/bin/env node
// Stage 47A-47Z - Clinical follow-up local archive readiness closure receipt handoff receipt reconciliation closure receipt guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MANIFEST = "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt.stage47a-47z.json";
const MIGRATION = "backend/self-hosted/db/migrations/0054_stage47_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff_receipt_reconciliation_closure_receipt.sql";
const DOC = "docs/backend/stage-47a-47z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt.md";
const WORKFLOW = ".github/workflows/stage47a-47z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt.yml";
const GUARD = "scripts/check-stage47a-47z-clinical-followup-archive-recon-closure-receipt.mjs";
const GUARD_TEST = "scripts/check-stage47a-47z-clinical-followup-archive-recon-closure-receipt.test.mjs";

const REQUIRED_FILES = [
  MANIFEST, MIGRATION,
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage47a-47z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  DOC, WORKFLOW, GUARD, GUARD_TEST,
  "package.json", "scripts/preflight-all.mjs", "scripts/preflight-all.test.mjs",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/WORKLOG.md",
  "docs/project-memory/RISKS.md",
  "docs/project-memory/ARTIFACTS.md",
];

const REQUIRED_TEXT = {
  [MANIFEST]: ["\"stage\": \"47A-47Z\"", "\"previousBatch\": \"Stage 46A-46Z\"", "\"nextBatchHypothesis\": \"Stage 48A-48Z\"", "\"managedRuntimeDependency\": \"none\"", "\"expectedConfirmation\": \"Confirmed: Stage 47A-47Z synced from main, no conflicts.\""],
  [MIGRATION]: ["stage47_archive_handoff_recon_closure_receipt_state", "stage47_archive_handoff_recon_closure_receipt_at", "references app_users(id) on delete set null", "clinical_follow_up_stage47_recon_closure_receipt_events"],
  "backend/self-hosted/clinical-followup-repository.mjs": ["buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummarySql", "buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSql", "getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary", "updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipt", "clinical_follow_up_stage47_recon_closure_receipt_events"],
  "backend/self-hosted/clinical-followup-repository.test.mjs": ["buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummarySql", "stage47_archive_handoff_recon_closure_receipt_state = 'received'", "clinical_follow_up_stage47_recon_closure_receipt_events"],
  "backend/self-hosted/clinical-followup-service.mjs": ["normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptPayload", "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff_receipt_reconciliation_closure_receipt.summary", "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff_receipt_reconciliation_closure_receipt.update"],
  "backend/self-hosted/clinical-followup-service.test.mjs": ["normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptPayload", "Local archive readiness closure receipt handoff receipt reconciliation closure receipt recorded."],
  "backend/self-hosted/routes.mjs": ["/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt/summary", "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt", "openapi.stage47a-47z.json"],
  "deploy/self-hosted/nginx.stage4a.conf": ["/openapi.stage47a-47z.json"],
  "src/lib/self-hosted-follow-up-api.ts": ["getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary", "updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipt", "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary", "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptState"],
  "src/lib/self-hosted-follow-up-api.test.ts": ["toFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary", "updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipt"],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": ["Recon archive handoff receipt reconciliation closure receipt ready", "Recon archive handoff receipt reconciliation closure receipt rework", "Received recon archive handoff receipt reconciliation closure receipts", "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary"],
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx": ["Receive recon archive handoff receipt reconciliation closure receipt", "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptState"],
  [DOC]: ["Stage 47A-47Z", "Managed runtime/database dependency: none", "Managed notification provider dependency: none"],
  [WORKFLOW]: ["name: stage47a-47z-clinical-followup", "npm run preflight:stage47a-47z"],
  "package.json": ["\"test:stage47a-47z\"", "\"check:stage47a-47z\"", "\"preflight:stage47a-47z\""],
  "scripts/preflight-all.mjs": ["Stage 47A-47Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation closure receipt preflight", "preflight:stage47a-47z"],
  "scripts/preflight-all.test.mjs": ["Stage 47A-47Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation closure receipt preflight", "preflight:stage47a-47z"],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": ["Stage 47A-47Z", "clinical_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff_receipt_reconciliation_closure_receipt_confirmed: true"],
  "docs/project-memory/HANDOFF.md": ["Stage 47A-47Z", "SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation closure receipt"],
  "docs/project-memory/NEXT_ACTIONS.md": ["Stage 47A-47Z", "Stage 48A-48Z", "hypothesis"],
  "docs/project-memory/WORKLOG.md": ["Stage 47A-47Z", "SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation closure receipt"],
  "docs/project-memory/RISKS.md": ["Stage 47A-47Z", "archive readiness closure receipt handoff receipt reconciliation closure receipt"],
  "docs/project-memory/ARTIFACTS.md": ["clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt.stage47a-47z.json", "stage-47a-47z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt.md", "check-stage47a-47z-clinical-followup-archive-recon-closure-receipt.mjs"],
};

const PROTECTED_FILES = [MANIFEST, MIGRATION, "backend/self-hosted/clinical-followup-service.mjs", "src/lib/self-hosted-follow-up-api.ts", "src/pages/doctor/VisitWorkspaceLiveActions.tsx"];
const FORBIDDEN = [/\bapi-read\b/i, /\bapi-write\b/i, /edge function/i, /SUPABASE_/i, /navigator\.(usb|bluetooth|serial)/i, /storage_object_path/i, /signed_url/i, /access_token/i, /object_bucket/i, /object_key/i, /vendor\s+(sms|email|notification)/i, /external\s+sop\s+(completion|approval)\s+proof/i, /external\s+governance\s+(approval|sign-off)\s+proof/i, /legal\s+archive\s+sufficiency\s+proof/i, /medical\s+correctness\s+(proof|verification|guarantee)/i, /references\s+users\s*\(/i, /ReceiptReceipt/, /ClosureReceiptarchive/, /needsarchive/];

function read(root, file) { return readFileSync(join(root, file), "utf8"); }
function checkMarkers(root, errors, table, label = "marker") { for (const [file, markers] of Object.entries(table)) { if (!existsSync(join(root, file))) { errors.push("Missing " + label + " file: " + file); continue; } const text = read(root, file); for (const marker of markers) if (!text.includes(marker)) errors.push(file + " missing " + label + ": " + marker); } }
function validateManifest(root, errors) { if (!existsSync(join(root, MANIFEST))) return; let manifest; try { manifest = JSON.parse(read(root, MANIFEST)); } catch { errors.push("Stage 47 manifest must be valid JSON"); return; } if (manifest.stage !== "47A-47Z") errors.push("Stage 47 manifest stage must be 47A-47Z"); if (manifest.previousBatch !== "Stage 46A-46Z") errors.push("Stage 47 previous batch must be Stage 46A-46Z"); if (manifest.nextBatchHypothesis !== "Stage 48A-48Z") errors.push("Stage 47 must record Stage 48A-48Z as hypothesis"); if ((manifest.implementedSurfaces || []).length < 10) errors.push("Stage 47 must include at least 10 implemented surfaces"); if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 47 managed runtime dependency must be none"); if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 47 managed database dependency must be none"); if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 47 managed notification dependency must be none"); if (!manifest.privacy?.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptIsLocalMetadataOnly) errors.push("Stage 47 receipt must be local metadata only"); if (!manifest.verification?.preflight?.includes("preflight:stage47a-47z")) errors.push("Stage 47 preflight command missing"); }
function validatePostgresIdentifiers(root, errors) { if (!existsSync(join(root, MIGRATION))) return; const identifiers = read(root, MIGRATION).match(/[A-Za-z_][A-Za-z0-9_]*/g) || []; for (const identifier of identifiers) { if (/^(stage47_|clinical_follow_up_stage47_|idx_cfut_stage47_|chk_cfut_stage47_|archive_|stage[0-9]+_)/.test(identifier) && identifier.length > 63) errors.push(MIGRATION + " has PostgreSQL identifier longer than 63 bytes: " + identifier); } }

export function checkStage47A47Z(root = process.cwd()) {
  const errors = [];
  for (const file of REQUIRED_FILES) if (!existsSync(join(root, file))) errors.push("Missing required file: " + file);
  checkMarkers(root, errors, REQUIRED_TEXT);
  checkMarkers(root, errors, PROJECT_MEMORY_REQUIRED_TEXT, "project-memory marker");
  validateManifest(root, errors);
  validatePostgresIdentifiers(root, errors);
  for (const file of PROTECTED_FILES) {
    if (!existsSync(join(root, file))) continue;
    const text = read(root, file);
    for (const pattern of FORBIDDEN) if (pattern.test(text)) errors.push(file + " contains forbidden runtime marker: " + pattern);
  }
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = checkStage47A47Z(process.cwd());
  if (!result.ok) {
    console.error("[stage47a-47z-clinical-followup-archive-recon-closure-receipt] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`[stage47a-47z-clinical-followup-archive-recon-closure-receipt] OK (${result.checkedFiles} files checked)`);
  }
}
