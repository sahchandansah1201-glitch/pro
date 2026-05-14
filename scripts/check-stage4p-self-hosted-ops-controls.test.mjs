import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { collectStage4PChecks } from "./check-stage4p-self-hosted-ops-controls.mjs";

test("Stage 4P guard passes for the repository", () => {
  const result = collectStage4PChecks({ root: process.cwd() });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles >= 12, true);
});

test("Stage 4P guard detects missing files and managed-runtime coupling", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4p-check-"));
  try {
    mkdirSync(join(root, "backend/self-hosted"), { recursive: true });
    mkdirSync(join(root, "src/lib"), { recursive: true });
    mkdirSync(join(root, "src/pages/sys"), { recursive: true });
    mkdirSync(join(root, "e2e"), { recursive: true });
    mkdirSync(join(root, "scripts"), { recursive: true });
    mkdirSync(join(root, "docs/backend"), { recursive: true });
    mkdirSync(join(root, ".github/workflows"), { recursive: true });
    mkdirSync(join(root, "deploy/self-hosted"), { recursive: true });
    writeFileSync(join(root, "package.json"), "{}");
    writeFileSync(join(root, "scripts/preflight-all.mjs"), "");
    writeFileSync(join(root, "backend/self-hosted/ops-runtime-checks.mjs"), "supabase");

    const result = collectStage4PChecks({ root });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Missing required file/);
    assert.match(result.errors.join("\n"), /forbidden managed-runtime coupling/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
