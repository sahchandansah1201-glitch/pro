import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";

import { collectStage6OChecks } from "./check-stage6o-production-release-archive-retention-register.mjs";

test("Stage 6O guard passes for the repository tree", () => {
  const result = collectStage6OChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});

test("Stage 6O guard reports missing required files", () => {
  const root = mkdtempSync(join(tmpdir(), "stage6o-missing-"));
  try {
    const result = collectStage6OChecks({ root });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /release-archive-retention-register\.stage6o\.json/);
    assert.match(result.errors.join("\n"), /package\.json/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 6O guard blocks forbidden managed runtime coupling", () => {
  const root = mkdtempSync(join(tmpdir(), "stage6o-forbidden-"));
  try {
    const protectedPath = join(root, "deploy/self-hosted/release-archive-retention-register.stage6o.json");
    mkdirSync(dirname(protectedPath), { recursive: true });
    writeFileSync(protectedPath, "SUPABASE_URL=bad");
    const result = collectStage6OChecks({ root });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /forbidden Stage 6O runtime/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
