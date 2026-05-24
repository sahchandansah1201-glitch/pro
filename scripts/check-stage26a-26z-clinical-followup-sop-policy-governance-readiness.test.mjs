import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { checkStage26A26Z } from "./check-stage26a-26z-clinical-followup-sop-policy-governance-readiness.mjs";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-governance-readiness.stage26a-26z.json",
  "backend/self-hosted/db/migrations/0033_stage26_followup_sop_policy_governance_readiness.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage26a-26z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-26a-26z-clinical-followup-sop-policy-governance-readiness.md",
  ".github/workflows/stage26a-26z-clinical-followup-sop-policy-governance-readiness.yml",
  "scripts/check-stage26a-26z-clinical-followup-sop-policy-governance-readiness.mjs",
  "scripts/check-stage26a-26z-clinical-followup-sop-policy-governance-readiness.test.mjs",
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

function write(root, file, text) {
  const target = join(root, file);
  mkdirSync(join(target, ".."), { recursive: true });
  writeFileSync(target, text);
}

test("Stage 26 guard reports missing files", () => {
  const root = mkdtempSync(join(tmpdir(), "stage26-missing-"));
  try {
    const result = checkStage26A26Z(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("Missing required file")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 26 guard passes for repository files", () => {
  const result = checkStage26A26Z(process.cwd());
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, REQUIRED_FILES.length);
});

test("Stage 26 guard validates manifest and forbidden markers", () => {
  const root = mkdtempSync(join(tmpdir(), "stage26-fixture-"));
  try {
    for (const file of REQUIRED_FILES) write(root, file, "Stage 26A-26Z\nSOP policy governance readiness\n");
    write(root, "deploy/self-hosted/clinical-followup-sop-policy-governance-readiness.stage26a-26z.json", JSON.stringify({
      stage: "26A-26Z",
      previousBatch: "Stage 25A-25Z",
      nextBatchHypothesis: "Stage 27A-27Z",
      implementedSurfaces: Array.from({ length: 9 }, (_, index) => `surface-${index}`),
      productBoundary: {
        managedRuntimeDependency: "none",
        managedDatabaseDependency: "none",
        managedNotificationProviderDependency: "none"
      },
      privacy: {
        sopPolicyGovernanceReadinessIsLocalMetadataOnly: true,
        clinicGovernanceIsNotExternalApprovalProof: true
      },
      verification: {
        preflight: "npm run preflight:stage26a-26z"
      },
      expectedConfirmation: "Confirmed: Stage 26A-26Z synced from main, no conflicts."
    }, null, 2));
    write(root, "backend/self-hosted/clinical-followup-service.mjs", "normalizeClinicalFollowUpSopPolicyGovernanceReadinessPayload\nclinical_follow_up.sop_policy_governance_readiness.summary\nclinical_follow_up.sop_policy_governance_readiness.update\nsigned_url\n");
    const result = checkStage26A26Z(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("signed_url")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
