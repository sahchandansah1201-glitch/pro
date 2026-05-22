import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkStage16A16Z } from "./check-stage16a-16z-product-cycle-readiness.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const REPO_ROOT = ROOT;
const MANIFEST = "deploy/self-hosted/product-cycle-readiness.stage16a-16z.json";

test("Stage 16A-16Z guard passes for repository fixture", () => {
  const result = checkStage16A16Z(REPO_ROOT);

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 15);
});

test("Stage 16A-16Z guard rejects missing product-facing rule", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage16-guard-"));
  try {
    copyFixture(dir);
    const manifestPath = join(dir, MANIFEST);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.readinessRules = manifest.readinessRules.filter((rule) => rule.id !== "product_facing_batch_required");
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = checkStage16A16Z(dir);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /product_facing_batch_required/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 16A-16Z guard rejects missing recommended product candidate", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage16-guard-"));
  try {
    copyFixture(dir);
    const manifestPath = join(dir, MANIFEST);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.selectedProductCandidates = manifest.selectedProductCandidates.map((candidate) => ({
      ...candidate,
      status: "alternate-hypothesis",
    }));
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = checkStage16A16Z(dir);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /recommended product candidate/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 16A-16Z guard rejects forbidden protected-file markers", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage16-guard-"));
  try {
    copyFixture(dir);
    const docsPath = join(dir, "docs/backend/stage-16a-16z-product-cycle-readiness.md");
    writeFileSync(docsPath, `${readFileSync(docsPath, "utf8")}\nSUPABASE_FORBIDDEN=1\n`);

    const result = checkStage16A16Z(dir);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /forbidden runtime marker/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function copyFixture(targetRoot) {
  const files = [
    MANIFEST,
    "scripts/stage16a-16z-product-cycle-readiness.mjs",
    "scripts/stage16a-16z-product-cycle-readiness.test.mjs",
    "scripts/check-stage16a-16z-product-cycle-readiness.mjs",
    "scripts/check-stage16a-16z-product-cycle-readiness.test.mjs",
    "docs/backend/stage-16a-16z-product-cycle-readiness.md",
    "docs/project-memory/WORKING_CONTRACT.md",
    "docs/project-memory/BATCH_TEMPLATE.md",
    "docs/project-memory/PROJECT_STATE.yaml",
    "docs/project-memory/HANDOFF.md",
    "docs/project-memory/NEXT_ACTIONS.md",
    "docs/project-memory/WORKLOG.md",
    "docs/project-memory/RISKS.md",
    "docs/project-memory/ARTIFACTS.md",
    ".github/workflows/stage16a-16z-product-cycle-readiness.yml",
    "package.json",
    "scripts/preflight-all.mjs",
  ];
  for (const file of files) {
    const source = join(REPO_ROOT, file);
    const target = join(targetRoot, file);
    writeFileSyncWithDirs(target, readFileSync(source, "utf8"));
  }
}

function writeFileSyncWithDirs(file, content) {
  mkdirSync(file.slice(0, file.lastIndexOf("/")), { recursive: true });
  writeFileSync(file, content);
}
