#!/usr/bin/env node

import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { checkStage10A10Z } from "./check-stage10a-10z-error-prevention.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

test("Stage 10A-10Z guard passes for the repository", () => {
  const result = checkStage10A10Z(ROOT);
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 15);
});

test("Stage 10A-10Z guard rejects missing diagnosed defects", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage10a10z-guard-"));
  try {
    for (const top of ["deploy", "scripts", "docs", ".github"]) {
      cpSync(join(ROOT, top), join(dir, top), { recursive: true });
    }
    cpSync(join(ROOT, "package.json"), join(dir, "package.json"));
    const manifestPath = join(dir, "deploy/self-hosted/error-prevention.stage10a-10z.json");
    const manifest = JSON.parse(readText(manifestPath));
    manifest.diagnosedDefects = [];
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const result = checkStage10A10Z(dir);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /at least 6 diagnosed defects/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 10A-10Z guard rejects managed runtime markers", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage10a10z-boundary-"));
  try {
    for (const top of ["deploy", "scripts", "docs", ".github"]) {
      cpSync(join(ROOT, top), join(dir, top), { recursive: true });
    }
    cpSync(join(ROOT, "package.json"), join(dir, "package.json"));
    const docPath = join(dir, "docs/backend/stage-10a-10z-error-prevention.md");
    writeFileSync(docPath, `${readText(docPath)}\nSUPABASE_SERVICE_ROLE_KEY\n`);
    const result = checkStage10A10Z(dir);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /forbidden runtime marker/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function readText(path) {
  return readFileSync(path, "utf8");
}
