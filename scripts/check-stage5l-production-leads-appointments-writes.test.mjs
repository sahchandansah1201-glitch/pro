import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";

import { collectStage5LChecks } from "./check-stage5l-production-leads-appointments-writes.mjs";

test("Stage 5L guard validates production leads/appointments write contracts", () => {
  const result = collectStage5LChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 14);
});

test("Stage 5L guard CLI exits zero", () => {
  const result = spawnSync(process.execPath, ["scripts/check-stage5l-production-leads-appointments-writes.mjs"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OK \(14 files checked\)/);
});
