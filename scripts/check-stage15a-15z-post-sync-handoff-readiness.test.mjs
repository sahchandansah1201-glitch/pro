import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { checkStage15A15Z } from "./check-stage15a-15z-post-sync-handoff-readiness.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const REPO_ROOT = ROOT;
const MANIFEST = "deploy/self-hosted/post-sync-handoff-readiness.stage15a-15z.json";

test("Stage 15A-15Z guard passes for repository fixture", () => {
  const result = checkStage15A15Z(REPO_ROOT);

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 15);
});

test("Stage 15A-15Z guard rejects missing previous confirmation rule", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage15-guard-"));
  try {
    copyFixture(dir);
    const manifestPath = join(dir, MANIFEST);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.ledgerRules = manifest.ledgerRules.filter((rule) => rule.id !== "post_sync_confirmation_not_memory");
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = checkStage15A15Z(dir);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /post_sync_confirmation_not_memory/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 15A-15Z guard rejects mismatched previous confirmation", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage15-guard-"));
  try {
    copyFixture(dir);
    const manifestPath = join(dir, MANIFEST);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.confirmedPreviousSync.confirmation = "Confirmed: wrong stage.";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const result = checkStage15A15Z(dir);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /previous confirmation/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Stage 15A-15Z guard rejects forbidden protected-file markers", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage15-guard-"));
  try {
    copyFixture(dir);
    const docsPath = join(dir, "docs/backend/stage-15a-15z-post-sync-handoff-readiness.md");
    writeFileSync(docsPath, `${readFileSync(docsPath, "utf8")}\nSUPABASE_FORBIDDEN=1\n`);

    const result = checkStage15A15Z(dir);
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /forbidden runtime marker/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function copyFixture(targetRoot) {
  const files = [
    MANIFEST,
    "scripts/stage15a-15z-post-sync-handoff-readiness.mjs",
    "scripts/stage15a-15z-post-sync-handoff-readiness.test.mjs",
    "scripts/check-stage15a-15z-post-sync-handoff-readiness.mjs",
    "scripts/check-stage15a-15z-post-sync-handoff-readiness.test.mjs",
    "docs/backend/stage-15a-15z-post-sync-handoff-readiness.md",
    "docs/project-memory/WORKING_CONTRACT.md",
    "docs/project-memory/BATCH_TEMPLATE.md",
    "docs/project-memory/PROJECT_STATE.yaml",
    "docs/project-memory/HANDOFF.md",
    "docs/project-memory/NEXT_ACTIONS.md",
    "docs/project-memory/WORKLOG.md",
    "docs/project-memory/RISKS.md",
    "docs/project-memory/ARTIFACTS.md",
    ".github/workflows/stage15a-15z-post-sync-handoff-readiness.yml",
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
