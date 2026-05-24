import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { checkStage33A33Z } from "./check-stage33a-33z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure.mjs";

function write(root, file, text) {
  const target = join(root, file);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, text);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "stage33-"));
  write(root, "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure.stage33a-33z.json", JSON.stringify({
    stage: "33A-33Z",
    previousBatch: "Stage 32A-32Z",
    nextBatchHypothesis: "Stage 34A-34Z",
    implementedSurfaces: Array.from({ length: 10 }, (_, index) => `surface-${index}`),
    productBoundary: {
      managedRuntimeDependency: "none",
      managedDatabaseDependency: "none",
      managedNotificationProviderDependency: "none",
    },
    privacy: {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureIsLocalMetadataOnly: true,
      clinicGovernanceEvidenceReconciliationClosureReceiptArchiveClosureIsNotExternalApprovalProof: true,
      archiveClosureIsNotLegalArchiveSufficiencyProof: true,
    },
    verification: {
      preflight: "npm run preflight:stage33a-33z",
      expectedConfirmation: "Confirmed: Stage 33A-33Z synced from main, no conflicts.",
    },
  }, null, 2));
  write(root, "backend/self-hosted/db/migrations/0040_stage33_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure.sql", "sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closed_at references app_users(id) on delete set null clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_events");
  write(root, "backend/self-hosted/clinical-followup-repository.mjs", "buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummarySql buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSql getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure");
  write(root, "backend/self-hosted/clinical-followup-repository.test.mjs", "Stage 33A-33Z");
  write(root, "backend/self-hosted/clinical-followup-service.mjs", "normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosurePayload clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure.summary clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure.update");
  write(root, "backend/self-hosted/clinical-followup-service.test.mjs", "Stage 33A-33Z");
  write(root, "backend/self-hosted/openapi.stage33a-33z.json", "Stage 33A-33Z");
  write(root, "backend/self-hosted/routes.mjs", "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure/summary /api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure openapi.stage33a-33z.json");
  write(root, "backend/self-hosted/routes.test.mjs", "Stage 33A-33Z");
  write(root, "deploy/self-hosted/nginx.stage4a.conf", "/openapi.stage33a-33z.json");
  write(root, "src/lib/self-hosted-follow-up-api.ts", "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState");
  write(root, "src/lib/self-hosted-follow-up-api.test.ts", "Stage 33A-33Z");
  write(root, "src/pages/doctor/VisitWorkspaceLiveActions.tsx", "Close archive Archive closure rework Closed archives sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary");
  write(root, "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx", "Stage 33A-33Z");
  write(root, "docs/backend/stage-33a-33z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure.md", "Stage 33A-33Z Managed runtime/database dependency: none Managed notification provider dependency: none");
  write(root, ".github/workflows/stage33a-33z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure.yml", "name: stage33a-33z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure npm run preflight:stage33a-33z");
  write(root, "scripts/check-stage33a-33z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure.mjs", "Stage 33A-33Z");
  write(root, "scripts/check-stage33a-33z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure.test.mjs", "Stage 33A-33Z");
  write(root, "package.json", "\"test:stage33a-33z\" \"check:stage33a-33z\" \"preflight:stage33a-33z\"");
  write(root, "scripts/preflight-all.mjs", "Stage 33A-33Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure preflight preflight:stage33a-33z");
  write(root, "scripts/preflight-all.test.mjs", "Stage 33A-33Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure preflight preflight:stage33a-33z");
  write(root, "docs/project-memory/PROJECT_STATE.yaml", "Stage 33A-33Z clinical_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_confirmed: true");
  write(root, "docs/project-memory/HANDOFF.md", "Stage 33A-33Z SOP policy governance evidence reconciliation closure receipt archive closure");
  write(root, "docs/project-memory/NEXT_ACTIONS.md", "Stage 33A-33Z Stage 34A-34Z hypothesis");
  write(root, "docs/project-memory/WORKLOG.md", "Stage 33A-33Z SOP policy governance evidence reconciliation closure receipt archive closure");
  write(root, "docs/project-memory/RISKS.md", "Stage 33A-33Z SOP policy governance evidence reconciliation closure receipt archive closure");
  write(root, "docs/project-memory/ARTIFACTS.md", "clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure.stage33a-33z.json stage-33a-33z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure.md check-stage33a-33z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure.mjs");
  return root;
}

test("Stage 33A-33Z guard passes for repository fixture", () => {
  const result = checkStage33A33Z(fixture());
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("Stage 33A-33Z guard rejects missing self-hosted boundary", () => {
  const root = fixture();
  write(root, "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure.stage33a-33z.json", JSON.stringify({
    stage: "33A-33Z",
    previousBatch: "Stage 32A-32Z",
    nextBatchHypothesis: "Stage 34A-34Z",
    implementedSurfaces: Array.from({ length: 10 }, (_, index) => `surface-${index}`),
    productBoundary: { managedRuntimeDependency: "edge" },
    privacy: {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureIsLocalMetadataOnly: true,
      clinicGovernanceEvidenceReconciliationClosureReceiptArchiveClosureIsNotExternalApprovalProof: true,
      archiveClosureIsNotLegalArchiveSufficiencyProof: true,
    },
    verification: { preflight: "npm run preflight:stage33a-33z" },
  }));
  const result = checkStage33A33Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /managed runtime dependency/);
});

test("Stage 33A-33Z guard rejects forbidden markers", () => {
  const root = fixture();
  write(root, "src/lib/self-hosted-follow-up-api.ts", "signed_url");
  const result = checkStage33A33Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /forbidden runtime marker/);
});

test("Stage 33A-33Z guard rejects non-self-hosted user table references", () => {
  const root = fixture();
  write(root, "backend/self-hosted/db/migrations/0040_stage33_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure.sql", "sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closed_at references users(id) clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_events");
  const result = checkStage33A33Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /references\\s\+users/);
});
