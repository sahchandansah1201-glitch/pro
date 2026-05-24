import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { checkStage31A31Z } from "./check-stage31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.mjs";

function write(root, file, text) {
  const target = join(root, file);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, text);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "stage31-"));
  write(root, "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.stage31a-31z.json", JSON.stringify({
    stage: "31A-31Z",
    previousBatch: "Stage 30A-30Z",
    nextBatchHypothesis: "Stage 32A-32Z",
    implementedSurfaces: Array.from({ length: 10 }, (_, index) => `surface-${index}`),
    productBoundary: {
      managedRuntimeDependency: "none",
      managedDatabaseDependency: "none",
      managedNotificationProviderDependency: "none",
    },
    privacy: {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptIsLocalMetadataOnly: true,
      clinicGovernanceEvidenceReconciliationClosureReceiptIsNotExternalApprovalProof: true,
    },
    verification: {
      preflight: "npm run preflight:stage31a-31z",
      expectedConfirmation: "Confirmed: Stage 31A-31Z synced from main, no conflicts.",
    },
  }, null, 2));
  write(root, "backend/self-hosted/db/migrations/0038_stage31_followup_sop_policy_governance_evidence_reconciliation_closure_receipt.sql", "sop_policy_governance_evidence_reconciliation_closure_receipt_state sop_policy_governance_evidence_reconciliation_closure_received_at references app_users(id) on delete set null clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_events");
  write(root, "backend/self-hosted/clinical-followup-repository.mjs", "buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummarySql buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSql getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt");
  write(root, "backend/self-hosted/clinical-followup-repository.test.mjs", "Stage 31A-31Z");
  write(root, "backend/self-hosted/clinical-followup-service.mjs", "normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptPayload clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt.summary clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt.update");
  write(root, "backend/self-hosted/clinical-followup-service.test.mjs", "Stage 31A-31Z");
  write(root, "backend/self-hosted/openapi.stage31a-31z.json", "Stage 31A-31Z");
  write(root, "backend/self-hosted/routes.mjs", "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt/summary /api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt openapi.stage31a-31z.json");
  write(root, "backend/self-hosted/routes.test.mjs", "Stage 31A-31Z");
  write(root, "deploy/self-hosted/nginx.stage4a.conf", "/openapi.stage31a-31z.json");
  write(root, "src/lib/self-hosted-follow-up-api.ts", "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptState");
  write(root, "src/lib/self-hosted-follow-up-api.test.ts", "Stage 31A-31Z");
  write(root, "src/pages/doctor/VisitWorkspaceLiveActions.tsx", "Receive receipt Receipt rework sopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary");
  write(root, "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx", "Stage 31A-31Z");
  write(root, "docs/backend/stage-31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.md", "Stage 31A-31Z Managed runtime/database dependency: none Managed notification provider dependency: none");
  write(root, ".github/workflows/stage31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.yml", "name: stage31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt npm run preflight:stage31a-31z");
  write(root, "scripts/check-stage31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.mjs", "Stage 31A-31Z");
  write(root, "scripts/check-stage31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.test.mjs", "Stage 31A-31Z");
  write(root, "package.json", "\"test:stage31a-31z\" \"check:stage31a-31z\" \"preflight:stage31a-31z\"");
  write(root, "scripts/preflight-all.mjs", "Stage 31A-31Z clinical follow-up SOP policy governance evidence reconciliation closure receipt preflight preflight:stage31a-31z");
  write(root, "scripts/preflight-all.test.mjs", "Stage 31A-31Z clinical follow-up SOP policy governance evidence reconciliation closure receipt preflight preflight:stage31a-31z");
  write(root, "docs/project-memory/PROJECT_STATE.yaml", "Stage 31A-31Z clinical_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_confirmed: true");
  write(root, "docs/project-memory/HANDOFF.md", "Stage 31A-31Z SOP policy governance evidence reconciliation closure receipt");
  write(root, "docs/project-memory/NEXT_ACTIONS.md", "Stage 31A-31Z Stage 32A-32Z hypothesis");
  write(root, "docs/project-memory/WORKLOG.md", "Stage 31A-31Z SOP policy governance evidence reconciliation closure receipt");
  write(root, "docs/project-memory/RISKS.md", "Stage 31A-31Z SOP policy governance evidence reconciliation closure receipt");
  write(root, "docs/project-memory/ARTIFACTS.md", "clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.stage31a-31z.json stage-31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.md check-stage31a-31z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.mjs");
  return root;
}

test("Stage 31A-31Z guard passes for repository fixture", () => {
  const result = checkStage31A31Z(fixture());
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("Stage 31A-31Z guard rejects missing self-hosted boundary", () => {
  const root = fixture();
  write(root, "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt.stage31a-31z.json", JSON.stringify({
    stage: "31A-31Z",
    previousBatch: "Stage 30A-30Z",
    nextBatchHypothesis: "Stage 32A-32Z",
    implementedSurfaces: Array.from({ length: 10 }, (_, index) => `surface-${index}`),
    productBoundary: { managedRuntimeDependency: "edge" },
    privacy: {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptIsLocalMetadataOnly: true,
      clinicGovernanceEvidenceReconciliationClosureReceiptIsNotExternalApprovalProof: true,
    },
    verification: { preflight: "npm run preflight:stage31a-31z" },
  }));
  const result = checkStage31A31Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /managed runtime dependency/);
});

test("Stage 31A-31Z guard rejects forbidden markers", () => {
  const root = fixture();
  write(root, "src/lib/self-hosted-follow-up-api.ts", "signed_url");
  const result = checkStage31A31Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /forbidden runtime marker/);
});

test("Stage 31A-31Z guard rejects non-self-hosted user table references", () => {
  const root = fixture();
  write(root, "backend/self-hosted/db/migrations/0038_stage31_followup_sop_policy_governance_evidence_reconciliation_closure_receipt.sql", "sop_policy_governance_evidence_reconciliation_closure_receipt_state sop_policy_governance_evidence_reconciliation_closure_received_at references users(id) clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_events");
  const result = checkStage31A31Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /references\\s\+users/);
});
