import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { checkStage29A29Z } from "./check-stage29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation.mjs";

function write(root, file, text = "") {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
}

function writeRequiredTree(root) {
  write(root, "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation.stage29a-29z.json", JSON.stringify(
    {
      stage: "29A-29Z",
      previousBatch: "Stage 28A-28Z",
      nextBatchHypothesis: "Stage 30A-30Z",
      implementedSurfaces: Array.from({ length: 10 }, (_, index) => `surface-${index}`),
      productBoundary: {
        managedRuntimeDependency: "none",
        managedDatabaseDependency: "none",
        managedNotificationProviderDependency: "none",
      },
      privacy: {
        sopPolicyGovernanceEvidenceReconciliationIsLocalMetadataOnly: true,
        clinicGovernanceEvidenceReconciliationIsNotExternalApprovalProof: true,
      },
      verification: { preflight: "npm run preflight:stage29a-29z" },
      expectedConfirmation: "Confirmed: Stage 29A-29Z synced from main, no conflicts.",
    },
    null,
    2,
  ));
  write(root, "backend/self-hosted/db/migrations/0036_stage29_followup_sop_policy_governance_evidence_reconciliation.sql", "sop_policy_governance_evidence_reconciliation_state sop_policy_governance_evidence_reconciled_at clinical_follow_up_sop_policy_governance_evidence_reconciliation_events");
  write(root, "backend/self-hosted/clinical-followup-repository.mjs", "buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummarySql buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSql getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummary updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliation");
  write(root, "backend/self-hosted/clinical-followup-repository.test.mjs", "Stage 29A-29Z");
  write(root, "backend/self-hosted/clinical-followup-service.mjs", "normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationPayload clinical_follow_up.sop_policy_governance_evidence_reconciliation.summary clinical_follow_up.sop_policy_governance_evidence_reconciliation.update");
  write(root, "backend/self-hosted/clinical-followup-service.test.mjs", "Stage 29A-29Z");
  write(root, "backend/self-hosted/openapi.stage29a-29z.json", "Stage 29A-29Z");
  write(root, "backend/self-hosted/routes.mjs", "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation/summary /api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation openapi.stage29a-29z.json");
  write(root, "backend/self-hosted/routes.test.mjs", "Stage 29A-29Z");
  write(root, "deploy/self-hosted/nginx.stage4a.conf", "/openapi.stage29a-29z.json");
  write(root, "src/lib/self-hosted-follow-up-api.ts", "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummary updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliation FollowUpSopPolicyGovernanceEvidenceReconciliationSummary FollowUpSopPolicyGovernanceEvidenceReconciliationState");
  write(root, "src/lib/self-hosted-follow-up-api.test.ts", "Stage 29A-29Z");
  write(root, "src/pages/doctor/VisitWorkspaceLiveActions.tsx", "Reconcile evidence Recon mismatch sopPolicyGovernanceEvidenceReconciliationSummary");
  write(root, "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx", "Stage 29A-29Z");
  write(root, "docs/backend/stage-29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation.md", "Stage 29A-29Z Managed runtime/database dependency: none Managed notification provider dependency: none");
  write(root, ".github/workflows/stage29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation.yml", "name: stage29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation npm run preflight:stage29a-29z");
  write(root, "scripts/check-stage29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation.mjs", "Stage 29A-29Z");
  write(root, "scripts/check-stage29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation.test.mjs", "Stage 29A-29Z");
  write(root, "package.json", "\"test:stage29a-29z\" \"check:stage29a-29z\" \"preflight:stage29a-29z\"");
  write(root, "scripts/preflight-all.mjs", "Stage 29A-29Z clinical follow-up SOP policy governance evidence reconciliation preflight preflight:stage29a-29z");
  write(root, "scripts/preflight-all.test.mjs", "Stage 29A-29Z clinical follow-up SOP policy governance evidence reconciliation preflight preflight:stage29a-29z");
  write(root, "docs/project-memory/PROJECT_STATE.yaml", "Stage 29A-29Z clinical_followup_sop_policy_governance_evidence_reconciliation_confirmed: true");
  write(root, "docs/project-memory/HANDOFF.md", "Stage 29A-29Z SOP policy governance evidence reconciliation");
  write(root, "docs/project-memory/NEXT_ACTIONS.md", "Stage 29A-29Z Stage 30A-30Z hypothesis");
  write(root, "docs/project-memory/WORKLOG.md", "Stage 29A-29Z SOP policy governance evidence reconciliation");
  write(root, "docs/project-memory/RISKS.md", "Stage 29A-29Z SOP policy governance evidence reconciliation");
  write(root, "docs/project-memory/ARTIFACTS.md", "clinical-followup-sop-policy-governance-evidence-reconciliation.stage29a-29z.json stage-29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation.md check-stage29a-29z-clinical-followup-sop-policy-governance-evidence-reconciliation.mjs");
}

test("Stage 29 guard passes when governance evidence reconciliation files and markers are present", () => {
  const root = mkdtempSync(join(tmpdir(), "stage29-"));
  writeRequiredTree(root);
  assert.deepEqual(checkStage29A29Z(root), { ok: true, errors: [], checkedFiles: 27 });
});

test("Stage 29 guard fails on forbidden managed runtime markers", () => {
  const root = mkdtempSync(join(tmpdir(), "stage29-forbidden-"));
  writeRequiredTree(root);
  write(root, "src/lib/self-hosted-follow-up-api.ts", "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummary updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliation FollowUpSopPolicyGovernanceEvidenceReconciliationSummary FollowUpSopPolicyGovernanceEvidenceReconciliationState signed_url");
  const result = checkStage29A29Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /signed_url/);
});
