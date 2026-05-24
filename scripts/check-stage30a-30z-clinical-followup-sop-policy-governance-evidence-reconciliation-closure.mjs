#!/usr/bin/env node
// Stage 30A-30Z - Clinical follow-up local SOP policy governance evidence reconciliation closure guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure.stage30a-30z.json",
  "backend/self-hosted/db/migrations/0037_stage30_followup_sop_policy_governance_evidence_reconciliation_closure.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage30a-30z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure.md",
  ".github/workflows/stage30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure.yml",
  "scripts/check-stage30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure.mjs",
  "scripts/check-stage30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure.test.mjs",
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
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure.stage30a-30z.json": [
    "\"stage\": \"30A-30Z\"",
    "\"previousBatch\": \"Stage 29A-29Z\"",
    "\"nextBatchHypothesis\": \"Stage 31A-31Z\"",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"managedNotificationProviderDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 30A-30Z synced from main, no conflicts.\""
  ],
  "backend/self-hosted/db/migrations/0037_stage30_followup_sop_policy_governance_evidence_reconciliation_closure.sql": [
    "sop_policy_governance_evidence_reconciliation_closure_state",
    "sop_policy_governance_evidence_reconciliation_closed_at",
    "clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_events"
  ],
  "backend/self-hosted/clinical-followup-repository.mjs": [
    "buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummarySql",
    "buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSql",
    "getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary",
    "updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure"
  ],
  "backend/self-hosted/clinical-followup-service.mjs": [
    "normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosurePayload",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure.summary",
    "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure.update"
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure/summary",
    "/api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure",
    "openapi.stage30a-30z.json"
  ],
  "deploy/self-hosted/nginx.stage4a.conf": [
    "/openapi.stage30a-30z.json"
  ],
  "src/lib/self-hosted-follow-up-api.ts": [
    "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary",
    "updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary",
    "FollowUpSopPolicyGovernanceEvidenceReconciliationClosureState"
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Close recon",
    "Closure rework",
    "sopPolicyGovernanceEvidenceReconciliationClosureSummary"
  ],
  "docs/backend/stage-30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure.md": [
    "Stage 30A-30Z",
    "Managed runtime/database dependency: none",
    "Managed notification provider dependency: none"
  ],
  ".github/workflows/stage30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure.yml": [
    "name: stage30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure",
    "npm run preflight:stage30a-30z"
  ],
  "package.json": [
    "\"test:stage30a-30z\"",
    "\"check:stage30a-30z\"",
    "\"preflight:stage30a-30z\""
  ],
  "scripts/preflight-all.mjs": [
    "Stage 30A-30Z clinical follow-up SOP policy governance evidence reconciliation closure preflight",
    "preflight:stage30a-30z"
  ],
  "scripts/preflight-all.test.mjs": [
    "Stage 30A-30Z clinical follow-up SOP policy governance evidence reconciliation closure preflight",
    "preflight:stage30a-30z"
  ]
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "Stage 30A-30Z",
    "clinical_followup_sop_policy_governance_evidence_reconciliation_closure_confirmed: true"
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 30A-30Z",
    "SOP policy governance evidence reconciliation closure"
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 30A-30Z",
    "Stage 31A-31Z",
    "hypothesis"
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 30A-30Z",
    "SOP policy governance evidence reconciliation closure"
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 30A-30Z",
    "SOP policy governance evidence reconciliation closure"
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-followup-sop-policy-governance-evidence-reconciliation-closure.stage30a-30z.json",
    "stage-30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure.md",
    "check-stage30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure.mjs"
  ]
};

const PROTECTED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure.stage30a-30z.json",
  "backend/self-hosted/db/migrations/0037_stage30_followup_sop_policy_governance_evidence_reconciliation_closure.sql",
  "backend/self-hosted/clinical-followup-service.mjs",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "docs/backend/stage-30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure.md"
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
  /medical\s+correctness\s+(proof|verification|guarantee)/i
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
  const file = "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure.stage30a-30z.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.stage !== "30A-30Z") errors.push("Stage 30 manifest stage must be 30A-30Z");
  if (manifest.previousBatch !== "Stage 29A-29Z") errors.push("Stage 30 previous batch must be Stage 29A-29Z");
  if (manifest.nextBatchHypothesis !== "Stage 31A-31Z") errors.push("Stage 30 must record Stage 31A-31Z as hypothesis");
  if ((manifest.implementedSurfaces || []).length < 10) errors.push("Stage 30 must include at least 10 implemented surfaces");
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") errors.push("Stage 30 managed runtime dependency must be none");
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") errors.push("Stage 30 managed database dependency must be none");
  if (manifest.productBoundary?.managedNotificationProviderDependency !== "none") errors.push("Stage 30 managed notification dependency must be none");
  if (!manifest.privacy?.sopPolicyGovernanceEvidenceReconciliationClosureIsLocalMetadataOnly) errors.push("Stage 30 reconciliation closure must be local metadata only");
  if (!manifest.privacy?.clinicGovernanceEvidenceReconciliationClosureIsNotExternalApprovalProof) errors.push("Stage 30 reconciliation closure boundary must avoid external approval proof claims");
  if (!manifest.verification?.preflight?.includes("preflight:stage30a-30z")) errors.push("Stage 30 preflight command missing");
}

export function checkStage30A30Z(root = process.cwd()) {
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
  const result = checkStage30A30Z(process.cwd());
  if (!result.ok) {
    console.error("[stage30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure] OK (${result.checkedFiles} files checked)`);
}
