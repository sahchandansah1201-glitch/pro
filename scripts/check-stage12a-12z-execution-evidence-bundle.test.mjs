#!/usr/bin/env node

import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { checkStage12A12Z } from "./check-stage12a-12z-execution-evidence-bundle.mjs";

const ROOT = join(import.meta.dirname, "..");

function makeRepoFixture() {
  const root = mkdtempSync(join(tmpdir(), "stage12a12z-check-"));
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

test("Stage 12A-12Z guard passes for repository fixture", () => {
  const root = makeRepoFixture();
  try {
    const result = checkStage12A12Z(root);
    assert.deepEqual(result.errors, []);
    assert.equal(result.ok, true);
    assert.equal(result.checkedFiles, 15);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 12A-12Z guard rejects incomplete evidence rules", () => {
  const root = makeRepoFixture();
  try {
    const path = join(root, "deploy/self-hosted/execution-evidence-bundle.stage12a-12z.json");
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    manifest.evidenceRules = [];
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = checkStage12A12Z(root);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /at least 8 evidence rules/);
    assert.match(result.errors.join("\n"), /evidence_not_assertion/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 12A-12Z guard rejects evidence sections with too little evidence", () => {
  const root = makeRepoFixture();
  try {
    const path = join(root, "deploy/self-hosted/execution-evidence-bundle.stage12a-12z.json");
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    manifest.evidenceSections[0].requiredEvidence = ["base commit"];
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = checkStage12A12Z(root);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /at least 6 evidence items/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 12A-12Z guard rejects forbidden protected-file markers", () => {
  const root = makeRepoFixture();
  try {
    const path = join(root, "docs/backend/stage-12a-12z-execution-evidence-bundle.md");
    writeFileSync(path, `${readFileSync(path, "utf8")}\nSUPABASE_SERVICE_ROLE_KEY\n`);

    const result = checkStage12A12Z(root);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /forbidden runtime marker/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
