import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import { collectStage6SChecks } from "./check-stage6s-production-release-archive-retention-cycle-closure.mjs";

const ROOT = resolve(new URL("..", import.meta.url).pathname);

test("Stage 6S guard passes for the repository files", () => {
  const result = collectStage6SChecks({ root: ROOT });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});

test("Stage 6S guard reports missing files", () => {
  const root = mkdtempSync(join(tmpdir(), "stage6s-guard-"));
  try {
    const result = collectStage6SChecks({ root });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("release-archive-retention-cycle-closure.stage6s.json")));
    assert.ok(result.errors.some((error) => error.includes("package.json")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
