#!/usr/bin/env node

import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { checkStage13A13Z } from "./check-stage13a-13z-execution-evidence-closure.mjs";

const ROOT = join(import.meta.dirname, "..");

function makeRepoFixture() {
  const root = mkdtempSync(join(tmpdir(), "stage13a13z-check-"));
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

test("Stage 13A-13Z guard passes for repository fixture", () => {
  const root = makeRepoFixture();
  try {
    const result = checkStage13A13Z(root);
    assert.deepEqual(result.errors, []);
    assert.equal(result.ok, true);
    assert.equal(result.checkedFiles, 15);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 13A-13Z guard rejects incomplete closure rules", () => {
  const root = makeRepoFixture();
  try {
    const path = join(root, "deploy/self-hosted/execution-evidence-closure.stage13a-13z.json");
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    manifest.closureRules = [];
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = checkStage13A13Z(root);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /at least 10 closure rules/);
    assert.match(result.errors.join("\n"), /closure_not_assumption/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 13A-13Z guard rejects thin closure sections", () => {
  const root = makeRepoFixture();
  try {
    const path = join(root, "deploy/self-hosted/execution-evidence-closure.stage13a-13z.json");
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    manifest.closureSections[0].requiredEvidence = ["stage id"];
    writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = checkStage13A13Z(root);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /at least 6 evidence items/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 13A-13Z guard rejects forbidden protected-file markers", () => {
  const root = makeRepoFixture();
  try {
    const path = join(root, "docs/backend/stage-13a-13z-execution-evidence-closure.md");
    writeFileSync(path, `${readFileSync(path, "utf8")}\nSUPABASE_SERVICE_ROLE_KEY\n`);

    const result = checkStage13A13Z(root);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /forbidden runtime marker/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
