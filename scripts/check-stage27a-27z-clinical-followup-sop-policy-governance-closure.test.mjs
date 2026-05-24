import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { checkStage27A27Z } from "./check-stage27a-27z-clinical-followup-sop-policy-governance-closure.mjs";

function write(root, file, text = "") {
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), text);
}

function writeRequiredTree(root) {
  write(root, "deploy/self-hosted/clinical-followup-sop-policy-governance-closure.stage27a-27z.json", JSON.stringify(
    {
      stage: "27A-27Z",
      previousBatch: "Stage 26A-26Z",
      nextBatchHypothesis: "Stage 28A-28Z",
      implementedSurfaces: Array.from({ length: 9 }, (_, index) => `surface-${index}`),
      productBoundary: {
        managedRuntimeDependency: "none",
        managedDatabaseDependency: "none",
        managedNotificationProviderDependency: "none",
      },
      privacy: {
        sopPolicyGovernanceClosureIsLocalMetadataOnly: true,
        clinicGovernanceClosureIsNotExternalApprovalProof: true,
      },
      verification: { preflight: "npm run preflight:stage27a-27z" },
      expectedConfirmation: "Confirmed: Stage 27A-27Z synced from main, no conflicts.",
    },
    null,
    2,
  ));
  write(root, "backend/self-hosted/db/migrations/0034_stage27_followup_sop_policy_governance_closure.sql", "sop_policy_governance_closure_state sop_policy_governance_closed_at clinical_follow_up_sop_policy_governance_closure_events");
  write(root, "backend/self-hosted/clinical-followup-repository.mjs", "buildClinicalFollowUpSopPolicyGovernanceClosureSummarySql buildUpdateClinicalFollowUpSopPolicyGovernanceClosureSql getClinicalFollowUpSopPolicyGovernanceClosureSummary updateClinicalFollowUpSopPolicyGovernanceClosure");
  write(root, "backend/self-hosted/clinical-followup-repository.test.mjs", "Stage 27A-27Z");
  write(root, "backend/self-hosted/clinical-followup-service.mjs", "normalizeClinicalFollowUpSopPolicyGovernanceClosurePayload clinical_follow_up.sop_policy_governance_closure.summary clinical_follow_up.sop_policy_governance_closure.update");
  write(root, "backend/self-hosted/clinical-followup-service.test.mjs", "Stage 27A-27Z");
  write(root, "backend/self-hosted/openapi.stage27a-27z.json", "Stage 27A-27Z");
  write(root, "backend/self-hosted/routes.mjs", "/api/v1/clinical/follow-ups/sop-policy-governance-closure/summary /api/v1/clinical/follow-ups/{followUpId}/sop-policy-governance-closure openapi.stage27a-27z.json");
  write(root, "backend/self-hosted/routes.test.mjs", "Stage 27A-27Z");
  write(root, "deploy/self-hosted/nginx.stage4a.conf", "/openapi.stage27a-27z.json");
  write(root, "src/lib/self-hosted-follow-up-api.ts", "getSelfHostedClinicalFollowUpSopPolicyGovernanceClosureSummary updateSelfHostedClinicalFollowUpSopPolicyGovernanceClosure FollowUpSopPolicyGovernanceClosureSummary FollowUpSopPolicyGovernanceClosureState");
  write(root, "src/lib/self-hosted-follow-up-api.test.ts", "Stage 27A-27Z");
  write(root, "src/pages/doctor/VisitWorkspaceLiveActions.tsx", "Close governance Closure follow-up sopPolicyGovernanceClosureSummary");
  write(root, "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx", "Stage 27A-27Z");
  write(root, "docs/backend/stage-27a-27z-clinical-followup-sop-policy-governance-closure.md", "Stage 27A-27Z Managed runtime/database dependency: none Managed notification provider dependency: none");
  write(root, ".github/workflows/stage27a-27z-clinical-followup-sop-policy-governance-closure.yml", "name: stage27a-27z-clinical-followup-sop-policy-governance-closure npm run preflight:stage27a-27z");
  write(root, "scripts/check-stage27a-27z-clinical-followup-sop-policy-governance-closure.mjs", "Stage 27A-27Z");
  write(root, "scripts/check-stage27a-27z-clinical-followup-sop-policy-governance-closure.test.mjs", "Stage 27A-27Z");
  write(root, "package.json", "\"test:stage27a-27z\" \"check:stage27a-27z\" \"preflight:stage27a-27z\"");
  write(root, "scripts/preflight-all.mjs", "Stage 27A-27Z clinical follow-up SOP policy governance closure preflight preflight:stage27a-27z");
  write(root, "scripts/preflight-all.test.mjs", "Stage 27A-27Z clinical follow-up SOP policy governance closure preflight preflight:stage27a-27z");
  write(root, "docs/project-memory/PROJECT_STATE.yaml", "Stage 27A-27Z clinical_followup_sop_policy_governance_closure_confirmed: true");
  write(root, "docs/project-memory/HANDOFF.md", "Stage 27A-27Z SOP policy governance closure");
  write(root, "docs/project-memory/NEXT_ACTIONS.md", "Stage 27A-27Z Stage 28A-28Z hypothesis");
  write(root, "docs/project-memory/WORKLOG.md", "Stage 27A-27Z SOP policy governance closure");
  write(root, "docs/project-memory/RISKS.md", "Stage 27A-27Z SOP policy governance closure");
  write(root, "docs/project-memory/ARTIFACTS.md", "clinical-followup-sop-policy-governance-closure.stage27a-27z.json stage-27a-27z-clinical-followup-sop-policy-governance-closure.md check-stage27a-27z-clinical-followup-sop-policy-governance-closure.mjs");
}

test("Stage 27 guard passes when governance closure files and markers are present", () => {
  const root = mkdtempSync(join(tmpdir(), "stage27-"));
  writeRequiredTree(root);
  assert.deepEqual(checkStage27A27Z(root), { ok: true, errors: [], checkedFiles: 27 });
});

test("Stage 27 guard fails on forbidden managed runtime markers", () => {
  const root = mkdtempSync(join(tmpdir(), "stage27-forbidden-"));
  writeRequiredTree(root);
  write(root, "src/lib/self-hosted-follow-up-api.ts", "getSelfHostedClinicalFollowUpSopPolicyGovernanceClosureSummary updateSelfHostedClinicalFollowUpSopPolicyGovernanceClosure FollowUpSopPolicyGovernanceClosureSummary FollowUpSopPolicyGovernanceClosureState signed_url");
  const result = checkStage27A27Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /signed_url/);
});
