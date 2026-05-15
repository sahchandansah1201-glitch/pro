import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import { collectStage5MChecks } from "./check-stage5m-production-intake-operator-workspace.mjs";

test("Stage 5M guard validates production intake operator workspace", () => {
  const result = collectStage5MChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 11);
});

test("Stage 5M guard CLI exits zero", () => {
  const result = spawnSync(process.execPath, ["scripts/check-stage5m-production-intake-operator-workspace.mjs"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OK \(11 files checked\)/);
});
