import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { collectStage5IChecks } from "./check-stage5i-production-doctor-dashboard-contracts.mjs";

test("Stage 5I guard validates production doctor dashboard contracts", () => {
  const result = collectStage5IChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 15);
});

test("Stage 5I guard CLI exits zero", () => {
  const result = spawnSync(process.execPath, ["scripts/check-stage5i-production-doctor-dashboard-contracts.mjs"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /stage5i-production-doctor-dashboard-contracts|OK/);
});
