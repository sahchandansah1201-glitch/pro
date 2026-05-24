import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { checkStage24A24Z } from "./check-stage24a-24z-clinical-followup-sop-policy-exception-closure.mjs";

test("Stage 24A-24Z guard passes for repository fixture", () => {
  const result = checkStage24A24Z(process.cwd());
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 27);
});

test("Stage 24A-24Z guard rejects managed notification dependency", () => {
  const root = mkdtempSync(join(tmpdir(), "stage24-"));
  const files = [
    "deploy/self-hosted/clinical-followup-sop-policy-exception-closure.stage24a-24z.json",
    "backend/self-hosted/db/migrations/0031_stage24_followup_sop_policy_exception_closure.sql",
    "backend/self-hosted/clinical-followup-service.mjs",
    "src/lib/self-hosted-follow-up-api.ts",
    "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
    "docs/backend/stage-24a-24z-clinical-followup-sop-policy-exception-closure.md"
  ];
  for (const file of files) {
    mkdirSync(join(root, file.split("/").slice(0, -1).join("/")), { recursive: true });
    const content = file.endsWith(".json")
      ? JSON.stringify({
          stage: "24A-24Z",
          previousBatch: "Stage 23A-23Z",
          nextBatchHypothesis: "Stage 25A-25Z",
          implementedSurfaces: Array.from({ length: 9 }, (_, index) => `surface-${index}`),
          productBoundary: {
            managedRuntimeDependency: "none",
            managedDatabaseDependency: "none",
            managedNotificationProviderDependency: "vendor sms notification"
          },
          privacy: {
            sopPolicyExceptionClosureIsLocalMetadataOnly: true,
            clinicSpecificSopIsNotExternalProof: true
          },
          verification: { preflight: "npm run preflight:stage24a-24z" }
        })
      : "vendor sms notification";
    writeFileSync(join(root, file), content, "utf8");
  }
  const result = checkStage24A24Z(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /vendor/.test(error)));
});

test("Stage 24A-24Z guard rejects forbidden protected markers", () => {
  const root = mkdtempSync(join(tmpdir(), "stage24-"));
  const file = "src/lib/self-hosted-follow-up-api.ts";
  mkdirSync(join(root, "src/lib"), { recursive: true });
  writeFileSync(join(root, file), "signed_url", "utf8");
  const result = checkStage24A24Z(root);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => /signed_url/.test(error)));
});
