import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { collectStage6VChecks } from "./check-stage6v-production-release-archive-retention-cycle-final-closure-receipt.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function copyRequiredTree(root) {
  const files = [
    "deploy/self-hosted/release-archive-retention-cycle-final-closure-receipt.stage6v.json",
    "scripts/stage6v-production-release-archive-retention-cycle-final-closure-receipt.mjs",
    "scripts/stage6v-production-release-archive-retention-cycle-final-closure-receipt.test.mjs",
    "scripts/check-stage6v-production-release-archive-retention-cycle-final-closure-receipt.mjs",
    "scripts/check-stage6v-production-release-archive-retention-cycle-final-closure-receipt.test.mjs",
    "docs/backend/stage-6v-production-release-archive-retention-cycle-final-closure-receipt.md",
    ".github/workflows/stage6v-production-release-archive-retention-cycle-final-closure-receipt.yml",
    "package.json",
    "scripts/preflight-all.mjs",
  ];
  for (const file of files) {
    const source = join(ROOT, file);
    const target = join(root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(source, "utf8"));
  }
}

test("Stage 6V guard passes for the repository tree", () => {
  const result = collectStage6VChecks({ root: ROOT });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});

test("Stage 6V guard reports missing required files", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6v-check-missing-"));
  try {
    const result = collectStage6VChecks({ root: dir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Missing required file/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6V guard blocks forbidden managed runtime coupling", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6v-check-forbidden-"));
  try {
    copyRequiredTree(dir);
    const script = join(dir, "scripts/stage6v-production-release-archive-retention-cycle-final-closure-receipt.mjs");
    writeFileSync(script, `${readFileSync(script, "utf8")}\nconst bad = "SUPABASE_URL";\n`);
    const result = collectStage6VChecks({ root: dir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /forbidden Stage 6V runtime/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
