#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { collectStage7G7IChecks } from "./check-stage7g-7i-batch-verification-loop.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_TREE = [
  "deploy/self-hosted/batch-verification-loop.stage7g-7i.json",
  "scripts/stage7g-7i-batch-readiness.mjs",
  "scripts/stage7g-7i-batch-readiness.test.mjs",
  "scripts/check-stage7g-7i-batch-verification-loop.mjs",
  "scripts/check-stage7g-7i-batch-verification-loop.test.mjs",
  "docs/backend/stage-7g-7i-batch-verification-loop.md",
  ".github/workflows/stage7g-7i-batch-verification-loop.yml",
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

test("Stage 7G-7I guard passes for the repository tree", () => {
  const result = collectStage7G7IChecks({ root: ROOT });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});

test("Stage 7G-7I guard reports missing required files", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage7g-7i-check-missing-"));
  try {
    const result = collectStage7G7IChecks({ root: dir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Missing required file/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 7G-7I guard blocks runtime coupling in protected files", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage7g-7i-check-forbidden-"));
  try {
    copyRequiredTree(dir);
    const manifest = join(dir, "deploy/self-hosted/batch-verification-loop.stage7g-7i.json");
    writeFileSync(manifest, `${readFileSync(manifest, "utf8")}\nSUPABASE_SERVICE_ROLE_KEY\n`);
    const result = collectStage7G7IChecks({ root: dir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /forbidden Stage 7G-7I runtime coupling/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 7G-7I guard requires the generated Lovable verification prompt", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage7g-7i-check-prompt-"));
  try {
    copyRequiredTree(dir);
    const reporter = join(dir, "scripts/stage7g-7i-batch-readiness.mjs");
    writeFileSync(
      reporter,
      readFileSync(reporter, "utf8").replaceAll("buildStage7G7ILovablePrompt", "buildPromptLater"),
    );
    const result = collectStage7G7IChecks({ root: dir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /buildStage7G7ILovablePrompt/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
