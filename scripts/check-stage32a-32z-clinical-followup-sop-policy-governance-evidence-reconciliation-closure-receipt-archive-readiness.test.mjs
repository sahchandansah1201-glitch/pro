import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { checkStage32A32Z } from "./check-stage32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.mjs";

function write(root, file, text) {
  const target = join(root, file);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, text);
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "stage32-"));
  write(root, "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.stage32a-32z.json", JSON.stringify({
    stage: "32A-32Z",
    previousBatch: "Stage 31A-31Z",
    nextBatchHypothesis: "Stage 33A-33Z",
    implementedSurfaces: Array.from({ length: 10 }, (_, index) => `surface-${index}`),
    productBoundary: {
      managedRuntimeDependency: "none",
      managedDatabaseDependency: "none",
      managedNotificationProviderDependency: "none",
    },
    privacy: {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessIsLocalMetadataOnly: true,
      clinicGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessIsNotExternalApprovalProof: true,
      archiveReadinessIsNotLegalArchiveSufficiencyProof: true,
    },
    verification: {
      preflight: "npm run preflight:stage32a-32z",
      expectedConfirmation: "Confirmed: Stage 32A-32Z synced from main, no conflicts.",
    },
  }, null, 2));
  write(root, "backend/self-hosted/db/migrations/0039_stage32_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness.sql", "sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readied_at references app_users(id) on delete set null clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_events");
  write(root, "backend/self-hosted/clinical-followup-repository.mjs", "buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummarySql buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSql getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness");
  write(root, "backend/self-hosted/clinical-followup-repository.test.mjs", "Stage 32A-32Z");
  write(root, "backend/self-hosted/clinical-followup-service.mjs", "normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessPayload clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness.summary clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness.update");
  write(root, "backend/self-hosted/clinical-followup-service.test.mjs", "Stage 32A-32Z");
  write(root, "backend/self-hosted/openapi.stage32a-32z.json", "Stage 32A-32Z");
  write(root, "backend/self-hosted/routes.mjs", "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness/summary /api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness openapi.stage32a-32z.json");
  write(root, "backend/self-hosted/routes.test.mjs", "Stage 32A-32Z");
  write(root, "deploy/self-hosted/nginx.stage4a.conf", "/openapi.stage32a-32z.json");
  write(root, "src/lib/self-hosted-follow-up-api.ts", "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary FollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState");
  write(root, "src/lib/self-hosted-follow-up-api.test.ts", "Stage 32A-32Z");
  write(root, "src/pages/doctor/VisitWorkspaceLiveActions.tsx", "Archive ready Archive rework Archived local sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary");
  write(root, "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx", "Stage 32A-32Z");
  write(root, "docs/backend/stage-32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.md", "Stage 32A-32Z Managed runtime/database dependency: none Managed notification provider dependency: none");
  write(root, ".github/workflows/stage32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.yml", "name: stage32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness npm run preflight:stage32a-32z");
  write(root, "scripts/check-stage32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.mjs", "Stage 32A-32Z");
  write(root, "scripts/check-stage32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.test.mjs", "Stage 32A-32Z");
  write(root, "package.json", "\"test:stage32a-32z\" \"check:stage32a-32z\" \"preflight:stage32a-32z\"");
  write(root, "scripts/preflight-all.mjs", "Stage 32A-32Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive readiness preflight preflight:stage32a-32z");
  write(root, "scripts/preflight-all.test.mjs", "Stage 32A-32Z clinical follow-up SOP policy governance evidence reconciliation closure receipt archive readiness preflight preflight:stage32a-32z");
  write(root, "docs/project-memory/PROJECT_STATE.yaml", "Stage 32A-32Z clinical_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_confirmed: true");
  write(root, "docs/project-memory/HANDOFF.md", "Stage 32A-32Z SOP policy governance evidence reconciliation closure receipt archive readiness");
  write(root, "docs/project-memory/NEXT_ACTIONS.md", "Stage 32A-32Z Stage 33A-33Z hypothesis");
  write(root, "docs/project-memory/WORKLOG.md", "Stage 32A-32Z SOP policy governance evidence reconciliation closure receipt archive readiness");
  write(root, "docs/project-memory/RISKS.md", "Stage 32A-32Z SOP policy governance evidence reconciliation closure receipt archive readiness");
  write(root, "docs/project-memory/ARTIFACTS.md", "clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.stage32a-32z.json stage-32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.md check-stage32a-32z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.mjs");
  return root;
}

test("Stage 32A-32Z guard passes for repository fixture", () => {
  const result = checkStage32A32Z(fixture());
  assert.equal(result.ok, true, result.errors.join("\n"));
});

test("Stage 32A-32Z guard rejects missing self-hosted boundary", () => {
  const root = fixture();
  write(root, "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness.stage32a-32z.json", JSON.stringify({
    stage: "32A-32Z",
    previousBatch: "Stage 31A-31Z",
    nextBatchHypothesis: "Stage 33A-33Z",
    implementedSurfaces: Array.from({ length: 10 }, (_, index) => `surface-${index}`),
    productBoundary: { managedRuntimeDependency: "edge" },
    privacy: {
      sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessIsLocalMetadataOnly: true,
      clinicGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessIsNotExternalApprovalProof: true,
      archiveReadinessIsNotLegalArchiveSufficiencyProof: true,
    },
    verification: { preflight: "npm run preflight:stage32a-32z" },
  }));
  const result = checkStage32A32Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /managed runtime dependency/);
});

test("Stage 32A-32Z guard rejects forbidden markers", () => {
  const root = fixture();
  write(root, "src/lib/self-hosted-follow-up-api.ts", "signed_url");
  const result = checkStage32A32Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /forbidden runtime marker/);
});

test("Stage 32A-32Z guard rejects non-self-hosted user table references", () => {
  const root = fixture();
  write(root, "backend/self-hosted/db/migrations/0039_stage32_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness.sql", "sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readied_at references users(id) clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_events");
  const result = checkStage32A32Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /references\\s\+users/);
});
