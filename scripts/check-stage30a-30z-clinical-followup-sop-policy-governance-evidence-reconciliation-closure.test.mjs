import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { checkStage30A30Z } from "./check-stage30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure.mjs";

function write(root, file, text = "") {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
}

function writeRequiredTree(root) {
  write(root, "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure.stage30a-30z.json", JSON.stringify(
    {
      stage: "30A-30Z",
      previousBatch: "Stage 29A-29Z",
      nextBatchHypothesis: "Stage 31A-31Z",
      implementedSurfaces: Array.from({ length: 10 }, (_, index) => `surface-${index}`),
      productBoundary: {
        managedRuntimeDependency: "none",
        managedDatabaseDependency: "none",
        managedNotificationProviderDependency: "none",
      },
      privacy: {
        sopPolicyGovernanceEvidenceReconciliationClosureIsLocalMetadataOnly: true,
        clinicGovernanceEvidenceReconciliationClosureIsNotExternalApprovalProof: true,
      },
      verification: { preflight: "npm run preflight:stage30a-30z" },
      expectedConfirmation: "Confirmed: Stage 30A-30Z synced from main, no conflicts.",
    },
    null,
    2,
  ));
  write(root, "backend/self-hosted/db/migrations/0037_stage30_followup_sop_policy_governance_evidence_reconciliation_closure.sql", "sop_policy_governance_evidence_reconciliation_closure_state sop_policy_governance_evidence_reconciliation_closed_at clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_events");
  write(root, "backend/self-hosted/clinical-followup-repository.mjs", "buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummarySql buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSql getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure");
  write(root, "backend/self-hosted/clinical-followup-repository.test.mjs", "Stage 30A-30Z");
  write(root, "backend/self-hosted/clinical-followup-service.mjs", "normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosurePayload clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure.summary clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure.update");
  write(root, "backend/self-hosted/clinical-followup-service.test.mjs", "Stage 30A-30Z");
  write(root, "backend/self-hosted/openapi.stage30a-30z.json", "Stage 30A-30Z");
  write(root, "backend/self-hosted/routes.mjs", "/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure/summary /api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence-reconciliation-closure openapi.stage30a-30z.json");
  write(root, "backend/self-hosted/routes.test.mjs", "Stage 30A-30Z");
  write(root, "deploy/self-hosted/nginx.stage4a.conf", "/openapi.stage30a-30z.json");
  write(root, "src/lib/self-hosted-follow-up-api.ts", "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure FollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary FollowUpSopPolicyGovernanceEvidenceReconciliationClosureState");
  write(root, "src/lib/self-hosted-follow-up-api.test.ts", "Stage 30A-30Z");
  write(root, "src/pages/doctor/VisitWorkspaceLiveActions.tsx", "Close recon Closure rework sopPolicyGovernanceEvidenceReconciliationClosureSummary");
  write(root, "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx", "Stage 30A-30Z");
  write(root, "docs/backend/stage-30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure.md", "Stage 30A-30Z Managed runtime/database dependency: none Managed notification provider dependency: none");
  write(root, ".github/workflows/stage30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure.yml", "name: stage30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure npm run preflight:stage30a-30z");
  write(root, "scripts/check-stage30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure.mjs", "Stage 30A-30Z");
  write(root, "scripts/check-stage30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure.test.mjs", "Stage 30A-30Z");
  write(root, "package.json", "\"test:stage30a-30z\" \"check:stage30a-30z\" \"preflight:stage30a-30z\"");
  write(root, "scripts/preflight-all.mjs", "Stage 30A-30Z clinical follow-up SOP policy governance evidence reconciliation closure preflight preflight:stage30a-30z");
  write(root, "scripts/preflight-all.test.mjs", "Stage 30A-30Z clinical follow-up SOP policy governance evidence reconciliation closure preflight preflight:stage30a-30z");
  write(root, "docs/project-memory/PROJECT_STATE.yaml", "Stage 30A-30Z clinical_followup_sop_policy_governance_evidence_reconciliation_closure_confirmed: true");
  write(root, "docs/project-memory/HANDOFF.md", "Stage 30A-30Z SOP policy governance evidence reconciliation closure");
  write(root, "docs/project-memory/NEXT_ACTIONS.md", "Stage 30A-30Z Stage 31A-31Z hypothesis");
  write(root, "docs/project-memory/WORKLOG.md", "Stage 30A-30Z SOP policy governance evidence reconciliation closure");
  write(root, "docs/project-memory/RISKS.md", "Stage 30A-30Z SOP policy governance evidence reconciliation closure");
  write(root, "docs/project-memory/ARTIFACTS.md", "clinical-followup-sop-policy-governance-evidence-reconciliation-closure.stage30a-30z.json stage-30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure.md check-stage30a-30z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure.mjs");
}

test("Stage 30 guard passes when governance evidence reconciliation closure files and markers are present", () => {
  const root = mkdtempSync(join(tmpdir(), "stage30-"));
  writeRequiredTree(root);
  assert.deepEqual(checkStage30A30Z(root), { ok: true, errors: [], checkedFiles: 27 });
});

test("Stage 30 guard fails on forbidden managed runtime markers", () => {
  const root = mkdtempSync(join(tmpdir(), "stage30-forbidden-"));
  writeRequiredTree(root);
  write(root, "src/lib/self-hosted-follow-up-api.ts", "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure FollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary FollowUpSopPolicyGovernanceEvidenceReconciliationClosureState signed_url");
  const result = checkStage30A30Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /signed_url/);
});
