import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { collectStage4NChecks } from "./check-stage4n-production-observability.mjs";

test("Stage 4N guard passes for the repository", () => {
  const result = collectStage4NChecks({ root: process.cwd() });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles >= 10, true);
});

test("Stage 4N guard detects missing files and managed-runtime coupling", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4n-check-"));
  try {
    mkdirSync(join(root, "backend/self-hosted"), { recursive: true });
    mkdirSync(join(root, "scripts"), { recursive: true });
    mkdirSync(join(root, "docs/backend"), { recursive: true });
    mkdirSync(join(root, ".github/workflows"), { recursive: true });
    mkdirSync(join(root, "deploy/self-hosted"), { recursive: true });
    writeFileSync(join(root, "package.json"), "{}");
    writeFileSync(join(root, "scripts/preflight-all.mjs"), "");
    writeFileSync(join(root, "backend/self-hosted/ops-logger.mjs"), "supabase");

    const result = collectStage4NChecks({ root });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Missing required file/);
    assert.match(result.errors.join("\n"), /forbidden managed-runtime coupling/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
