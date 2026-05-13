import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import { collectStage4HChecks } from "./check-stage4h-self-hosted-visit-workspace-writes.mjs";

test("Stage 4H visit workspace write guard passes in the repository", () => {
  const result = collectStage4HChecks({ root: process.cwd() });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 14);
});

test("Stage 4H visit workspace write guard CLI exits zero", () => {
  const result = spawnSync(process.execPath, ["scripts/check-stage4h-self-hosted-visit-workspace-writes.mjs"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /visit workspace write guardrails verified/);
});
