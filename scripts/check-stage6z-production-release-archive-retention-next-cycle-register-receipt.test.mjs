import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { collectStage6ZChecks } from "./check-stage6z-production-release-archive-retention-next-cycle-register-receipt.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function copyRequiredTree(root) {
  const files = [
    "deploy/self-hosted/release-archive-retention-next-cycle-register-receipt.stage6z.json",
    "scripts/stage6z-production-release-archive-retention-next-cycle-register-receipt.mjs",
    "scripts/stage6z-production-release-archive-retention-next-cycle-register-receipt.test.mjs",
    "scripts/check-stage6z-production-release-archive-retention-next-cycle-register-receipt.mjs",
    "scripts/check-stage6z-production-release-archive-retention-next-cycle-register-receipt.test.mjs",
    "docs/backend/stage-6z-production-release-archive-retention-next-cycle-register-receipt.md",
    ".github/workflows/stage6z-production-release-archive-retention-next-cycle-register-receipt.yml",
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

test("Stage 6Z guard passes for the repository tree", () => {
  const result = collectStage6ZChecks({ root: ROOT });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});

test("Stage 6Z guard reports missing required files", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6z-check-missing-"));
  try {
    const result = collectStage6ZChecks({ root: dir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Missing required file/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 6Z guard blocks forbidden managed runtime coupling", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage6z-check-forbidden-"));
  try {
    copyRequiredTree(dir);
    const script = join(dir, "scripts/stage6z-production-release-archive-retention-next-cycle-register-receipt.mjs");
    writeFileSync(script, `${readFileSync(script, "utf8")}\nconst bad = "SUPABASE_URL";\n`);
    const result = collectStage6ZChecks({ root: dir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /forbidden Stage 6Z runtime/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
