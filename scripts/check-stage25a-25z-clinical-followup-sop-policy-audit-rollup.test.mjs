import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { checkStage25A25Z } from "./check-stage25a-25z-clinical-followup-sop-policy-audit-rollup.mjs";

const REQUIRED_FILES = [
  "deploy/self-hosted/clinical-followup-sop-policy-audit-rollup.stage25a-25z.json",
  "backend/self-hosted/db/migrations/0032_stage25_followup_sop_policy_audit_rollup.sql",
  "backend/self-hosted/clinical-followup-repository.mjs",
  "backend/self-hosted/clinical-followup-repository.test.mjs",
  "backend/self-hosted/clinical-followup-service.mjs",
  "backend/self-hosted/clinical-followup-service.test.mjs",
  "backend/self-hosted/openapi.stage25a-25z.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-follow-up-api.ts",
  "src/lib/self-hosted-follow-up-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-25a-25z-clinical-followup-sop-policy-audit-rollup.md",
  ".github/workflows/stage25a-25z-clinical-followup-sop-policy-audit-rollup.yml",
  "scripts/check-stage25a-25z-clinical-followup-sop-policy-audit-rollup.mjs",
  "scripts/check-stage25a-25z-clinical-followup-sop-policy-audit-rollup.test.mjs",
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

test("Stage 25 guard reports missing files", () => {
  const root = mkdtempSync(join(tmpdir(), "stage25-missing-"));
  try {
    const result = checkStage25A25Z(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("Missing required file")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 25 guard passes for repository files", () => {
  const result = checkStage25A25Z(process.cwd());
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, REQUIRED_FILES.length);
});

test("Stage 25 guard validates manifest and forbidden markers", () => {
  const root = mkdtempSync(join(tmpdir(), "stage25-fixture-"));
  try {
    for (const file of REQUIRED_FILES) write(root, file, "Stage 25A-25Z\nSOP policy audit rollup\n");
    write(root, "deploy/self-hosted/clinical-followup-sop-policy-audit-rollup.stage25a-25z.json", JSON.stringify({
      stage: "25A-25Z",
      previousBatch: "Stage 24A-24Z",
      nextBatchHypothesis: "Stage 26A-26Z",
      implementedSurfaces: Array.from({ length: 9 }, (_, index) => `surface-${index}`),
      productBoundary: {
        managedRuntimeDependency: "none",
        managedDatabaseDependency: "none",
        managedNotificationProviderDependency: "none"
      },
      privacy: {
        sopPolicyAuditRollupIsLocalMetadataOnly: true,
        clinicSpecificSopIsNotExternalProof: true
      },
      verification: {
        preflight: "npm run preflight:stage25a-25z"
      },
      expectedConfirmation: "Confirmed: Stage 25A-25Z synced from main, no conflicts."
    }, null, 2));
    write(root, "backend/self-hosted/clinical-followup-service.mjs", "normalizeClinicalFollowUpSopPolicyAuditRollupPayload\nclinical_follow_up.sop_policy_audit_rollup.summary\nclinical_follow_up.sop_policy_audit_rollup.update\nsigned_url\n");
    const result = checkStage25A25Z(root);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("signed_url")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
