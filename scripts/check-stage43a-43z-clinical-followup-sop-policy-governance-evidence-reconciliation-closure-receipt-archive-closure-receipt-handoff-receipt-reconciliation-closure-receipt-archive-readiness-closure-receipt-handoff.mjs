#!/usr/bin/env node
// Stage 43A-43Z - Clinical follow-up local sop policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff.stage43a-43z.json",
  "backend/self-hosted/db/migrations/0050_stage43_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage43a-43z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-43a-43z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff.md",
  ".github/workflows/stage43a-43z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff.yml",
  "scripts/check-stage43a-43z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff.mjs",
  "scripts/check-stage43a-43z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff.test.mjs",
  "package.json",
  "scripts/preflight-all.mjs",
  "scripts/preflight-all.test.mjs",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/WORKLOG.md",
  "docs/project-memory/RISKS.md",
  "docs/project-memory/ARTIFACTS.md"
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff.stage43a-43z.json": [
    "\"stage\": \"43A-43Z\"",
    "\"previousBatch\": \"Stage 42A-42Z\"",
    "\"nextBatchHypothesis\": \"Stage 44A-44Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 43A-43Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0050_stage43_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff.sql": [
    "stage43_archive_receipt_handoff_state",
    "stage43_archive_receipt_handed_off_at",
    "references app_users(id) on delete set null",
    "clinical_follow_up_stage43_archive_receipt_handoff_events"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummarySql",
    "buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSql",
    "getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary",
    "updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff",
    "clinical_follow_up_stage43_archive_receipt_handoff_events"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffPayload",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff.summary",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff/summary",
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff",
    "openapi.stage43a-43z.json"
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage43a-43z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary",
    "updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Recon archive closure receipt handoff ready",
    "Recon archive closure receipt handoff rework",
    "Handed off recon archive closure receipt handoffs",
    "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary"
  ],
  "docs/backend/stage-43a-43z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff.md": [
    "Stage 43A-43Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage43a-43z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff.yml": [
    "name: stage43a-43z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff",
    "npm run preflight:stage43a-43z"
  ],
  "package.json": [
    "\"test:stage43a-43z\"",
    "\"check:stage43a-43z\"",
    "\"preflight:stage43a-43z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 43A-43Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff preflight",
    "preflight:stage43a-43z"
  ],
  "scripts/preflight-all.test.mjs": [
    "Stage 43A-43Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff preflight",
    "preflight:stage43a-43z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 43A-43Z",
    "clinical_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 43A-43Z",
    "SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 43A-43Z",
    "Stage 44A-44Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 43A-43Z",
    "SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 43A-43Z",
    "SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff.stage43a-43z.json",
    "stage-43a-43z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff.md",
    "check-stage43a-43z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff.stage43a-43z.json",
  "backend/self-hosted/db/migrations/0050_stage43_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff.sql",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-43a-43z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff.md"
];
const FORBIDDEN = [/\bapi-read\b/i, /\bapi-write\b/i, /edge function/i, /SUPABASE_/i, /navigator\.(usb|bluetooth|serial)/i, /storage_object_path/i, /signed_url/i, /access_token/i, /object_bucket/i, /object_key/i, /vendor\s+(sms|email|notification)/i, /external\s+sop\s+(completion|approval)\s+proof/i, /external\s+governance\s+(approval|sign-off)\s+proof/i, /legal\s+archive\s+sufficiency\s+proof/i, /medical\s+correctness\s+(proof|verification|guarantee)/i, /references\s+users\s*\(/i, /ReceiptReceipt/];
function read(root, file) { return readFileSync(join(root, file), "utf8"); }
function checkMarkers(root, errors, table, label = "marker") { for (const [file, markers] of Object.entries(table)) { if (!existsSync(join(root, file))) { errors.push("Missing " + label + " file: " + file); continue; } const text = read(root, file); for (const marker of markers) if (!text.includes(marker)) errors.push(file + " missing " + label + ": " + marker); } }
function validateManifest(root, errors) { const file = "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff.stage43a-43z.json"; if (!existsSync(join(root, file))) return; const manifest = JSON.parse(read(root, file)); if (manifest.stage !== "43A-43Z") errors.push("Stage 43 manifest stage must be 43A-43Z"); if (manifest.previousBatch !== "Stage 42A-42Z") errors.push("Stage 43 previous batch must be Stage 42A-42Z"); if (manifest.nextBatchHypothesis !== "Stage 44A-44Z") errors.push("Stage 43 must record Stage 44A-44Z as hypothesis"); if ((manifest.implementedSurfaces || []).length < 10) errors.push("Stage 43 must include at least 10 implemented surfaces"); if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 43 managed runtime dependency must be none"); if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 43 managed database dependency must be none"); if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 43 managed notification dependency must be none"); if (!manifest.privacy?.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffIsLocalMetadataOnly) errors.push("Stage 43 archive readiness closure receipt handoff must be local metadata only"); if (!manifest.privacy?.clinicGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffIsNotExternalApprovalProof) errors.push("Stage 43 archive readiness closure receipt handoff boundary must avoid external approval proof claims"); if (!manifest.privacy?.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffIsNotLegalArchiveSufficiencyProof) errors.push("Stage 43 archive readiness closure receipt handoff must avoid legal archive sufficiency claims"); if (!manifest.verification?.preflight?.includes("preflight:stage43a-43z")) errors.push("Stage 43 preflight command missing"); }
function validatePostgresIdentifiers(root, errors) { const file = "backend/self-hosted/db/migrations/0050_stage43_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff.sql"; if (!existsSync(join(root, file))) return; const identifiers = read(root, file).match(/[A-Za-z_][A-Za-z0-9_]*/g) || []; for (const identifier of identifiers) if (/^(stage43_|clinical_follow_up_stage43_|idx_cfut_stage43_|chk_cfut_stage43_|archive_|stage[0-9]+_)/.test(identifier) && identifier.length > 63) errors.push(file + " has PostgreSQL identifier longer than 63 bytes: " + identifier); }
export function checkStage43A43Z(root = process.cwd()) { const errors = []; for (const file of REQUIRED_FILES) if (!existsSync(join(root, file))) errors.push("Missing required file: " + file); checkMarkers(root, errors, REQUIRED_TEXT); checkMarkers(root, errors, PROJECT_MEMORY_REQUIRED_TEXT, "project-memory marker"); validateManifest(root, errors); validatePostgresIdentifiers(root, errors); for (const file of PROTECTED_FILES) { if (!existsSync(join(root, file))) continue; const text = read(root, file); for (const pattern of FORBIDDEN) if (pattern.test(text)) errors.push(file + " contains forbidden runtime marker: " + pattern); } return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length }; }
if (import.meta.url === `file://${process.argv[1]}`) { const result = checkStage43A43Z(process.cwd()); if (!result.ok) { console.error("[stage43a-43z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff] FAILED"); for (const error of result.errors) console.error(`- ${error}`); process.exitCode = 1; } else { console.log(`[stage43a-43z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff] OK (${result.checkedFiles} files checked)`); } }
