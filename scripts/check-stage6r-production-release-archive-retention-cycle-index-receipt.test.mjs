import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { collectStage6RChecks } from "./check-stage6r-production-release-archive-retention-cycle-index-receipt.mjs";

const ROOT = resolve(new URL("..", import.meta.url).pathname);

test("Stage 6R guard passes for the repository files", () => {
  const result = collectStage6RChecks({ root: ROOT });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});

test("Stage 6R guard reports missing files", () => {
  const root = mkdtempSync(join(tmpdir(), "stage6r-guard-"));
  try {
    const result = collectStage6RChecks({ root });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("release-archive-retention-cycle-index-receipt.stage6r.json")));
    assert.ok(result.errors.some((error) => error.includes("package.json")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
