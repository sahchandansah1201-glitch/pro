import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { collectStage5JChecks } from "./check-stage5j-production-visit-schedule-contracts.mjs";

test("Stage 5J guard validates production visit schedule contracts", () => {
  const result = collectStage5JChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 15);
});

test("Stage 5J guard CLI exits zero", () => {
  const result = spawnSync(process.execPath, ["scripts/check-stage5j-production-visit-schedule-contracts.mjs"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /stage5j-production-visit-schedule-contracts|OK/);
});
