import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import { collectStage5HChecks } from "./check-stage5h-production-clinical-backend-contracts.mjs";

test("Stage 5H guard validates production clinical backend contracts", () => {
  const result = collectStage5HChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 40);
});

test("Stage 5H guard CLI exits zero", () => {
  const result = spawnSync(process.execPath, ["scripts/check-stage5h-production-clinical-backend-contracts.mjs"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 5H|stage5h-production-clinical-backend-contracts|OK/);
});
