import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { checkStage23A23Z } from "./check-stage23a-23z-clinical-followup-sop-policy-application.mjs";

test("Stage 23A-23Z guard passes for repository fixture", () => {
  const result = checkStage23A23Z(process.cwd());
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 24);
});

test("Stage 23A-23Z guard rejects managed notification dependency", () => {
  const root = mkdtempSync(join(tmpdir(), "stage23-"));
  const files = [
    "deploy/self-hosted/clinical-followup-sop-policy-application.stage23a-23z.json",
    "backend/self-hosted/db/migrations/0030_stage23_followup_sop_policy_application.sql",
    "backend/self-hosted/clinical-followup-service.mjs",
    "src/lib/self-hosted-follow-up-api.ts",
    "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
    "docs/backend/stage-23a-23z-clinical-followup-sop-policy-application.md"
  ];
  for (const file of files) {
    mkdirSync(join(root, file.split("/").slice(0, -1).join("/")), { recursive: true });
    const content = file.endsWith(".json")
      ? JSON.stringify({
          stage: "23A-23Z",
          previousBatch: "Stage 22A-22Z",
          nextBatchHypothesis: "Stage 24A-24Z",
          implementedSurfaces: Array.from({ length: 9 }, (_, index) => `surface-${index}`),
          productBoundary: {
            managedRuntimeDependency: "none",
            managedDatabaseDependency: "none",
            managedNotificationProviderDependency: "vendor sms notification"
          },
          privacy: {
            sopPolicyApplicationIsLocalMetadataOnly: true,
            clinicSpecificSopIsNotExternalProof: true
          },
          verification: { preflight: "npm run preflight:stage23a-23z" }
        })
      : "vendor sms notification";
    writeFileSync(join(root, file), content, "utf8");
  }
  const result = checkStage23A23Z(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /vendor/.test(error)));
});

test("Stage 23A-23Z guard rejects forbidden protected markers", () => {
  const root = mkdtempSync(join(tmpdir(), "stage23-"));
  const file = "src/lib/self-hosted-follow-up-api.ts";
  mkdirSync(join(root, "src/lib"), { recursive: true });
  writeFileSync(join(root, file), "signed_url", "utf8");
  const result = checkStage23A23Z(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /signed_url/.test(error)));
});
