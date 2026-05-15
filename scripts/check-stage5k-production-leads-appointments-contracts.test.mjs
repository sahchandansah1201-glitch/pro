import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { collectStage5KChecks } from "./check-stage5k-production-leads-appointments-contracts.mjs";

test("Stage 5K guard validates production leads appointments contracts", () => {
  const result = collectStage5KChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 14);
});

test("Stage 5K guard CLI exits zero", () => {
  const result = spawnSync(process.execPath, ["scripts/check-stage5k-production-leads-appointments-contracts.mjs"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /stage5k-production-leads-appointments-contracts|OK/);
});
