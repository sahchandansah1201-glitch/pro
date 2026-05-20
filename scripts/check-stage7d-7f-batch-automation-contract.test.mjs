#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { collectStage7D7FChecks } from "./check-stage7d-7f-batch-automation-contract.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_TREE = [
  "deploy/self-hosted/batch-automation-contract.stage7d-7f.json",
  "scripts/stage7d-7f-batch-handoff.mjs",
  "scripts/stage7d-7f-batch-handoff.test.mjs",
  "scripts/check-stage7d-7f-batch-automation-contract.mjs",
  "scripts/check-stage7d-7f-batch-automation-contract.test.mjs",
  "docs/backend/stage-7d-7f-batch-automation-contract.md",
  ".github/workflows/stage7d-7f-batch-automation-contract.yml",
  "docs/project-memory/WORKING_CONTRACT.md",
  "docs/project-memory/BATCH_TEMPLATE.md",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/WORKLOG.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/RISKS.md",
  "docs/project-memory/ARTIFACTS.md",
  "package.json",
  "scripts/preflight-all.mjs",
];

function copyRequiredTree(root) {
  for (const file of REQUIRED_TREE) {
    const source = join(ROOT, file);
    const target = join(root, file);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, readFileSync(source, "utf8"));
  }
}

test("Stage 7D-7F guard passes for the repository tree", () => {
  const result = collectStage7D7FChecks({ root: ROOT });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 9);
});

test("Stage 7D-7F guard reports missing required files", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage7d-7f-check-missing-"));
  try {
    const result = collectStage7D7FChecks({ root: dir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Missing required file/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 7D-7F guard blocks runtime coupling in protected files", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage7d-7f-check-forbidden-"));
  try {
    copyRequiredTree(dir);
    const manifest = join(dir, "deploy/self-hosted/batch-automation-contract.stage7d-7f.json");
    writeFileSync(manifest, `${readFileSync(manifest, "utf8")}\nSUPABASE_SERVICE_ROLE_KEY\n`);
    const result = collectStage7D7FChecks({ root: dir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /forbidden Stage 7D-7F runtime coupling/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 7D-7F guard requires the merge-before-Lovable gate", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage7d-7f-check-gate-"));
  try {
    copyRequiredTree(dir);
    const handoff = join(dir, "scripts/stage7d-7f-batch-handoff.mjs");
    writeFileSync(
      handoff,
      readFileSync(handoff, "utf8").replace("pull request must be merged", "prompt can be sent early"),
    );
    const result = collectStage7D7FChecks({ root: dir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /pull request must be merged/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
