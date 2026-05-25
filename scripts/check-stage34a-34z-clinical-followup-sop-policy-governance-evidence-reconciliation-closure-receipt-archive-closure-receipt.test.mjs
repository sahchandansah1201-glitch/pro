import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { checkStage34A34Z } from "./check-stage34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.mjs";

function write(root, file, text) {
  const target = join(root, file);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, text);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "stage34-"));
  write(root, "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.stage34a-34z.json", JSON.stringify({
    stage: "34A-34Z",
    previousBatch: "Stage 33A-33Z",
    nextBatchHypothesis: "Stage 35A-35Z",
    implementedSurfaces: Array.from({ length: 10 }, (_, index) => `surface-${index}`),
    productBoundary: {
      managedRuntimeDependency: "none",
      managedDatabaseDependency: "none",
      managedNotificationProviderDependency: "none",
    },
    privacy: {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptIsLocalMetadataOnly: true,
      clinicGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptIsNotExternalApprovalProof: true,
      archiveClosureReceiptIsNotLegalArchiveSufficiencyProof: true,
    },
    verification: {
      preflight: "npm run preflight:stage34a-34z",
      expectedConfirmation: "Confirmed: Stage 34A-34Z synced from main, no conflicts.",
    },
  }, null, 2));
  write(root, "backend/self-hosted/db/migrations/0041_stage34_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt.sql", "stage34_archive_closure_receipt_state stage34_archive_closure_received_at references app_users(id) on delete set null clinical_follow_up_stage34_archive_closure_receipt_events");
  write(root, "backend/self-hosted/clinical-followup-repository.mjs", "buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummarySql buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSql getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt");
  write(root, "backend/self-hosted/clinical-followup-repository.test.mjs", "Stage 34A-34Z");
  write(root, "backend/self-hosted/clinical-followup-service.mjs", "normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptPayload clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt.summary clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt.update");
  write(root, "backend/self-hosted/clinical-followup-service.test.mjs", "Stage 34A-34Z");
  write(root, "backend/self-hosted/openapi.stage34a-34z.json", "Stage 34A-34Z");
  write(root, "backend/self-hosted/routes.mjs", "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt/summary /api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt openapi.stage34a-34z.json");
  write(root, "backend/self-hosted/routes.test.mjs", "Stage 34A-34Z");
  write(root, "deploy/self-hosted/nginx.stage4a.conf", "/openapi.stage34a-34z.json");
  write(root, "src/lib/self-hosted-follow-up-api.ts", "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState");
  write(root, "src/lib/self-hosted-follow-up-api.test.ts", "Stage 34A-34Z");
  write(root, "src/pages/doctor/VisitWorkspaceLiveActions.tsx", "Receive archive receipt Archive receipt rework Received archive receipts sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary");
  write(root, "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx", "Stage 34A-34Z");
  write(root, "docs/backend/stage-34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.md", "Stage 34A-34Z Managed runtime/database dependency: none Managed notification provider dependency: none");
  write(root, ".github/workflows/stage34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.yml", "name: stage34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt npm run preflight:stage34a-34z");
  write(root, "scripts/check-stage34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.mjs", "Stage 34A-34Z");
  write(root, "scripts/check-stage34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.test.mjs", "Stage 34A-34Z");
  write(root, "package.json", "\"test:stage34a-34z\" \"check:stage34a-34z\" \"preflight:stage34a-34z\"");
  write(root, "scripts/preflight-all.mjs", "Stage 34A-34Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt preflight preflight:stage34a-34z");
  write(root, "scripts/preflight-all.test.mjs", "Stage 34A-34Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt preflight preflight:stage34a-34z");
  write(root, "docs/project-memory/PROJECT_STATE.yaml", "Stage 34A-34Z clinical_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_confirmed: true");
  write(root, "docs/project-memory/HANDOFF.md", "Stage 34A-34Z SOP policy governance evidence reconciliation closure receipt archive closure receipt");
  write(root, "docs/project-memory/NEXT_ACTIONS.md", "Stage 34A-34Z Stage 35A-35Z hypothesis");
  write(root, "docs/project-memory/WORKLOG.md", "Stage 34A-34Z SOP policy governance evidence reconciliation closure receipt archive closure receipt");
  write(root, "docs/project-memory/RISKS.md", "Stage 34A-34Z SOP policy governance evidence reconciliation closure receipt archive closure receipt");
  write(root, "docs/project-memory/ARTIFACTS.md", "clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.stage34a-34z.json stage-34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.md check-stage34a-34z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.mjs");
  return root;
}

test("Stage 34A-34Z guard passes for repository fixture", () => {
  const result = checkStage34A34Z(fixture());
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("Stage 34A-34Z guard rejects missing self-hosted boundary", () => {
  const root = fixture();
  write(root, "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt.stage34a-34z.json", JSON.stringify({
    stage: "34A-34Z",
    previousBatch: "Stage 33A-33Z",
    nextBatchHypothesis: "Stage 35A-35Z",
    implementedSurfaces: Array.from({ length: 10 }, (_, index) => `surface-${index}`),
    productBoundary: { managedRuntimeDependency: "edge" },
    privacy: {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptIsLocalMetadataOnly: true,
      clinicGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptIsNotExternalApprovalProof: true,
      archiveClosureReceiptIsNotLegalArchiveSufficiencyProof: true,
    },
    verification: { preflight: "npm run preflight:stage34a-34z" },
  }));
  const result = checkStage34A34Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /managed runtime dependency/);
});

test("Stage 34A-34Z guard rejects forbidden markers", () => {
  const root = fixture();
  write(root, "src/lib/self-hosted-follow-up-api.ts", "signed_url");
  const result = checkStage34A34Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /forbidden runtime marker/);
});

test("Stage 34A-34Z guard rejects non-self-hosted user table references", () => {
  const root = fixture();
  write(root, "backend/self-hosted/db/migrations/0041_stage34_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt.sql", "stage34_archive_closure_receipt_state stage34_archive_closure_received_at references users(id) clinical_follow_up_stage34_archive_closure_receipt_events");
  const result = checkStage34A34Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /references\\s\+users/);
});
