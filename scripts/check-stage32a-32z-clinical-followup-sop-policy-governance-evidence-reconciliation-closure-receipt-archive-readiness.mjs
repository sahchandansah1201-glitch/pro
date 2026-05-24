#!/usr/bin/env node
// Stage 32A-32Z - Clinical follow-up local SOP policy governance evidence reconciliation closure receipt archive readiness guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.stage32a-32z.json",
  "backend/self-hosted/db/migrations/0039_stage32_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage32a-32z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.md",
  ".github/workflows/stage32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.yml",
  "scripts/check-stage32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.mjs",
  "scripts/check-stage32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.test.mjs",
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
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.stage32a-32z.json": [
    "\"stage\": \"32A-32Z\"",
    "\"previousBatch\": \"Stage 31A-31Z\"",
    "\"nextBatchHypothesis\": \"Stage 33A-33Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 32A-32Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0039_stage32_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness.sql": [
    "sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state",
    "sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readied_at",
    "references app_users(id) on delete set null",
    "clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_events"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummarySql",
    "buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSql",
    "getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary",
    "updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessPayload",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness.summary",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness/summary",
    "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness",
    "openapi.stage32a-32z.json"
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage32a-32z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary",
    "updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Archive ready",
    "Archive rework",
    "Archived local",
    "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary"
  ],
  "docs/backend/stage-32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.md": [
    "Stage 32A-32Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.yml": [
    "name: stage32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness",
    "npm run preflight:stage32a-32z"
  ],
  "package.json": [
    "\"test:stage32a-32z\"",
    "\"check:stage32a-32z\"",
    "\"preflight:stage32a-32z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 32A-32Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive readiness preflight",
    "preflight:stage32a-32z"
  ],
  "scripts/preflight-all.test.mjs": [
    "Stage 32A-32Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive readiness preflight",
    "preflight:stage32a-32z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 32A-32Z",
    "clinical_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 32A-32Z",
    "SOP policy governance evidence reconciliation closure receipt archive readiness"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 32A-32Z",
    "Stage 33A-33Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 32A-32Z",
    "SOP policy governance evidence reconciliation closure receipt archive readiness"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 32A-32Z",
    "SOP policy governance evidence reconciliation closure receipt archive readiness"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.stage32a-32z.json",
    "stage-32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.md",
    "check-stage32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.stage32a-32z.json",
  "backend/self-hosted/db/migrations/0039_stage32_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness.sql",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.md"
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
  /references\s+users\s*\(/i
];

function read(root, file) {
  return readFileSync(join(root, file), "utf8");
}

function checkMarkers(root, errors, table, label = "marker") {
  for (const [file, markers] of Object.entries(table)) {
    if (!existsSync(join(root, file))) {
      errors.push(`Missing ${label} file: ${file}`);
      continue;
    }
    const text = read(root, file);
    for (const marker of markers) {
      if (!text.includes(marker)) errors.push(`${file} missing ${label}: ${marker}`);
    }
  }
}

function validateManifest(root, errors) {
  const file = "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.stage32a-32z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "32A-32Z") errors.push("Stage 32 manifest stage must be 32A-32Z");
  if (manifest.previousBatch !== "Stage 31A-31Z") errors.push("Stage 32 previous batch must be Stage 31A-31Z");
  if (manifest.nextBatchHypothesis !== "Stage 33A-33Z") errors.push("Stage 32 must record Stage 33A-33Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 10) errors.push("Stage 32 must include at least 10 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 32 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 32 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 32 managed notification dependency must be none");
  if (!manifest.privacy?.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessIsLocalMetadataOnly) errors.push("Stage 32 archive readiness must be local metadata only");
  if (!manifest.privacy?.clinicGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessIsNotExternalApprovalProof) errors.push("Stage 32 archive readiness boundary must avoid external approval proof claims");
  if (!manifest.privacy?.archiveReadinessIsNotLegalArchiveSufficiencyProof) errors.push("Stage 32 archive readiness must avoid legal archive sufficiency claims");
  if (!manifest.verification?.preflight?.includes("preflight:stage32a-32z")) errors.push("Stage 32 preflight command missing");
}

export function checkStage32A32Z(root = process.cwd()) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) errors.push(`Missing required file: ${file}`);
  }
  checkMarkers(root, errors, REQUIRED_TEXT);
  checkMarkers(root, errors, PROJECT_MEMORY_REQUIRED_TEXT, "project-memory marker");
  validateManifest(root, errors);
  for (const file of PROTECTED_FILES) {
    if (!existsSync(join(root, file))) continue;
    const text = read(root, file);
    for (const pattern of FORBIDDEN) {
      if (pattern.test(text)) errors.push(`${file} contains forbidden runtime marker: ${pattern}`);
    }
  }
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = checkStage32A32Z(process.cwd());
  if (!result.ok) {
    console.error("[stage32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness] OK (${result.checkedFiles} files checked)`);
}
