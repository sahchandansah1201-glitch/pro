#!/usr/bin/env node

import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { checkStage11A11Z } from "./check-stage11a-11z-development-quality-ledger.mjs";

const ROOT = join(import.meta.dirname, "..");

function makeRepoFixture() {
  const root = mkdtempSync(join(tmpdir(), "stage11a11z-check-"));
  for (const path of [
    "deploy/self-hosted",
    "scripts",
    "docs/backend",
    "docs/project-memory",
    ".github/workflows",
  ]) {
    cpSync(join(ROOT, path), join(root, path), { recursive: true });
  }
  cpSync(join(ROOT, "package.json"), join(root, "package.json"));
  return root;
}

test("Stage 11A-11Z guard passes for repository fixture", () => {
  const root = makeRepoFixture();
  try {
    const result = checkStage11A11Z(root);
    assert.deepEqual(result.errors, []);
    assert.equal(result.ok, true);
    assert.equal(result.checkedFiles, 15);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 11A-11Z guard rejects incomplete quality rules", () => {
  const root = makeRepoFixture();
  try {
    const path = join(root, "deploy/self-hosted/development-quality-ledger.stage11a-11z.json");
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    manifest.qualityRules = [];
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = checkStage11A11Z(root);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /at least 7 quality rules/);
    assert.match(result.errors.join("\n"), /defect_requires_prevention/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 11A-11Z guard rejects forbidden protected-file markers", () => {
  const root = makeRepoFixture();
  try {
    const path = join(root, "docs/backend/stage-11a-11z-development-quality-ledger.md");
    writeFileSync(path, `${readFileSync(path, "utf8")}\nSUPABASE_SERVICE_ROLE_KEY\n`);

    const result = checkStage11A11Z(root);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /forbidden runtime marker/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
