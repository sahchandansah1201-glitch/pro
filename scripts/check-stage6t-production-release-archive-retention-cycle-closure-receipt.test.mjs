import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { collectStage6TChecks } from "./check-stage6t-production-release-archive-retention-cycle-closure-receipt.mjs";

test("Stage 6T guard passes for the repository files", () => {
  const result = collectStage6TChecks({ root: process.cwd() });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});

test("Stage 6T guard reports missing files", () => {
  const root = join(tmpdir(), `stage6t-guard-${Date.now()}`);
  try {
    mkdirSync(root, { recursive: true });
    writeFileSync(join(root, "package.json"), "{\"scripts\":{}}\n");
    const result = collectStage6TChecks({ root });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("release-archive-retention-cycle-closure-receipt.stage6t.json")));
    assert.ok(result.errors.some((error) => error.includes("scripts/preflight-all.mjs")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
