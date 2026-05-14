import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { collectStage4OChecks } from "./check-stage4o-self-hosted-ops-ui.mjs";

test("Stage 4O guard passes for the repository", () => {
  const result = collectStage4OChecks({ root: process.cwd() });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles >= 9, true);
});

test("Stage 4O guard detects missing files and managed-runtime coupling", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4o-check-"));
  try {
    mkdirSync(join(root, "src/lib"), { recursive: true });
    mkdirSync(join(root, "src/pages/sys"), { recursive: true });
    mkdirSync(join(root, "src/components/shell"), { recursive: true });
    mkdirSync(join(root, "scripts"), { recursive: true });
    mkdirSync(join(root, "docs/backend"), { recursive: true });
    mkdirSync(join(root, ".github/workflows"), { recursive: true });
    mkdirSync(join(root, "e2e"), { recursive: true });
    writeFileSync(join(root, "package.json"), "{}");
    writeFileSync(join(root, "scripts/preflight-all.mjs"), "");
    writeFileSync(join(root, "src/lib/self-hosted-ops-api.ts"), "supabase");

    const result = collectStage4OChecks({ root });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Missing required file/);
    assert.match(result.errors.join("\n"), /forbidden managed-runtime coupling/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
