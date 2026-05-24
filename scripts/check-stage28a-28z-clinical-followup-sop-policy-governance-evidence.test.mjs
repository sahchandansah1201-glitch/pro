import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { checkStage28A28Z } from "./check-stage28a-28z-clinical-followup-sop-policy-governance-evidence.mjs";

function write(root, file, text = "") {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
}

function writeRequiredTree(root) {
  write(root, "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence.stage28a-28z.json", JSON.stringify(
    {
      stage: "28A-28Z",
      previousBatch: "Stage 27A-27Z",
      nextBatchHypothesis: "Stage 29A-29Z",
      implementedSurfaces: Array.from({ length: 10 }, (_, index) => `surface-${index}`),
      productBoundary: {
        managedRuntimeDependency: "none",
        managedDatabaseDependency: "none",
        managedNotificationProviderDependency: "none",
      },
      privacy: {
        sopPolicyGovernanceEvidenceIsLocalMetadataOnly: true,
        clinicGovernanceEvidenceIsNotExternalApprovalProof: true,
      },
      verification: { preflight: "npm run preflight:stage28a-28z" },
      expectedConfirmation: "Confirmed: Stage 28A-28Z synced from main, no conflicts.",
    },
    null,
    2,
  ));
  write(root, "backend/self-hosted/db/migrations/0035_stage28_followup_sop_policy_governance_evidence.sql", "sop_policy_governance_evidence_state sop_policy_governance_evidence_reviewed_at clinical_follow_up_sop_policy_governance_evidence_events");
  write(root, "backend/self-hosted/clinical-followup-repository.mjs", "buildClinicalFollowUpSopPolicyGovernanceEvidenceSummarySql buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceSql getClinicalFollowUpSopPolicyGovernanceEvidenceSummary updateClinicalFollowUpSopPolicyGovernanceEvidence");
  write(root, "backend/self-hosted/clinical-followup-repository.test.mjs", "Stage 28A-28Z");
  write(root, "backend/self-hosted/clinical-followup-service.mjs", "normalizeClinicalFollowUpSopPolicyGovernanceEvidencePayload clinical_follow_up.sop_policy_governance_evidence.summary clinical_follow_up.sop_policy_governance_evidence.update");
  write(root, "backend/self-hosted/clinical-followup-service.test.mjs", "Stage 28A-28Z");
  write(root, "backend/self-hosted/openapi.stage28a-28z.json", "Stage 28A-28Z");
  write(root, "backend/self-hosted/routes.mjs", "/api/v1/clinical/follow-ups/sop-policy-governance-evidence/summary /api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-evidence openapi.stage28a-28z.json");
  write(root, "backend/self-hosted/routes.test.mjs", "Stage 28A-28Z");
  write(root, "deploy/self-hosted/nginx.stage4a.conf", "/openapi.stage28a-28z.json");
  write(root, "src/lib/self-hosted-follow-up-api.ts", "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceSummary updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidence FollowUpSopPolicyGovernanceEvidenceSummary FollowUpSopPolicyGovernanceEvidenceState");
  write(root, "src/lib/self-hosted-follow-up-api.test.ts", "Stage 28A-28Z");
  write(root, "src/pages/doctor/VisitWorkspaceLiveActions.tsx", "Export evidence Evidence follow-up sopPolicyGovernanceEvidenceSummary");
  write(root, "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx", "Stage 28A-28Z");
  write(root, "docs/backend/stage-28a-28z-clinical-followup-sop-policy-governance-evidence.md", "Stage 28A-28Z Managed runtime/database dependency: none Managed notification provider dependency: none");
  write(root, ".github/workflows/stage28a-28z-clinical-followup-sop-policy-governance-evidence.yml", "name: stage28a-28z-clinical-followup-sop-policy-governance-evidence npm run preflight:stage28a-28z");
  write(root, "scripts/check-stage28a-28z-clinical-followup-sop-policy-governance-evidence.mjs", "Stage 28A-28Z");
  write(root, "scripts/check-stage28a-28z-clinical-followup-sop-policy-governance-evidence.test.mjs", "Stage 28A-28Z");
  write(root, "package.json", "\"test:stage28a-28z\" \"check:stage28a-28z\" \"preflight:stage28a-28z\"");
  write(root, "scripts/preflight-all.mjs", "Stage 28A-28Z clinical follow-up SOP policy governance evidence preflight preflight:stage28a-28z");
  write(root, "scripts/preflight-all.test.mjs", "Stage 28A-28Z clinical follow-up SOP policy governance evidence preflight preflight:stage28a-28z");
  write(root, "docs/project-memory/PROJECT_STATE.yaml", "Stage 28A-28Z clinical_followup_sop_policy_governance_evidence_confirmed: true");
  write(root, "docs/project-memory/HANDOFF.md", "Stage 28A-28Z SOP policy governance evidence");
  write(root, "docs/project-memory/NEXT_ACTIONS.md", "Stage 28A-28Z Stage 29A-29Z hypothesis");
  write(root, "docs/project-memory/WORKLOG.md", "Stage 28A-28Z SOP policy governance evidence");
  write(root, "docs/project-memory/RISKS.md", "Stage 28A-28Z SOP policy governance evidence");
  write(root, "docs/project-memory/ARTIFACTS.md", "clinical-followup-sop-policy-governance-evidence.stage28a-28z.json stage-28a-28z-clinical-followup-sop-policy-governance-evidence.md check-stage28a-28z-clinical-followup-sop-policy-governance-evidence.mjs");
}

test("Stage 28 guard passes when governance evidence files and markers are present", () => {
  const root = mkdtempSync(join(tmpdir(), "stage28-"));
  writeRequiredTree(root);
  assert.deepEqual(checkStage28A28Z(root), { ok: true, errors: [], checkedFiles: 27 });
});

test("Stage 28 guard fails on forbidden managed runtime markers", () => {
  const root = mkdtempSync(join(tmpdir(), "stage28-forbidden-"));
  writeRequiredTree(root);
  write(root, "src/lib/self-hosted-follow-up-api.ts", "getSelfHostedClinicalFollowUpSopPolicyGovernanceEvidenceSummary updateSelfHostedClinicalFollowUpSopPolicyGovernanceEvidence FollowUpSopPolicyGovernanceEvidenceSummary FollowUpSopPolicyGovernanceEvidenceState signed_url");
  const result = checkStage28A28Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /signed_url/);
});
