import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { collectStage7A7CChecks } from "./check-stage7a-7c-development-workflow-contract.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const REQUIRED_TREE = [
  "deploy/self-hosted/development-workflow-contract.stage7a-7c.json",
  "docs/project-memory/WORKING_CONTRACT.md",
  "docs/project-memory/BATCH_TEMPLATE.md",
  "docs/project-memory/PROJECT_STATE.yaml",
  "docs/project-memory/HANDOFF.md",
  "docs/project-memory/WORKLOG.md",
  "docs/project-memory/NEXT_ACTIONS.md",
  "docs/project-memory/RISKS.md",
  "docs/project-memory/ARTIFACTS.md",
  "docs/backend/stage-7a-7c-development-workflow-contract.md",
  "scripts/check-stage7a-7c-development-workflow-contract.mjs",
  "scripts/check-stage7a-7c-development-workflow-contract.test.mjs",
  ".github/workflows/stage7a-7c-development-workflow-contract.yml",
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

test("Stage 7A-7C guard passes for the repository tree", () => {
  const result = collectStage7A7CChecks({ root: ROOT });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});

test("Stage 7A-7C guard reports missing required files", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage7a-7c-check-missing-"));
  try {
    const result = collectStage7A7CChecks({ root: dir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Missing required file/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 7A-7C guard blocks runtime coupling in protected files", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage7a-7c-check-forbidden-"));
  try {
    copyRequiredTree(dir);
    const manifest = join(dir, "deploy/self-hosted/development-workflow-contract.stage7a-7c.json");
    writeFileSync(manifest, `${readFileSync(manifest, "utf8")}\napi-read\n`);
    const result = collectStage7A7CChecks({ root: dir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /forbidden Stage 7A-7C runtime coupling/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 7A-7C guard requires the Lovable-after-merge contract", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage7a-7c-check-contract-"));
  try {
    copyRequiredTree(dir);
    const contract = join(dir, "docs/project-memory/WORKING_CONTRACT.md");
    writeFileSync(
      contract,
      readFileSync(contract, "utf8").replace(
        "Lovable sync prompts are invalid while the stage exists only in an open Pull",
        "Lovable sync prompts can be sent before merge",
      ),
    );
    const result = collectStage7A7CChecks({ root: dir });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Lovable sync prompts are invalid/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
