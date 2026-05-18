import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { collectStage6IChecks } from "./check-stage6i-production-release-archive-index.mjs";

test("Stage 6I guard passes for the repository", () => {
  const result = collectStage6IChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});

test("Stage 6I guard detects missing files and managed-runtime coupling", () => {
  const root = mkdtempSync(join(tmpdir(), "stage6i-guard-"));
  try {
    mkdirSync(join(root, "deploy/self-hosted"), { recursive: true });
    mkdirSync(join(root, "scripts"), { recursive: true });
    mkdirSync(join(root, "docs/backend"), { recursive: true });
    mkdirSync(join(root, ".github/workflows"), { recursive: true });
    writeFileSync(
      join(root, "deploy/self-hosted/release-archive-index.stage6i.json"),
      "Stage 6I releaseMemoryClosureManifest archiveInputs archiveSections externalArchiveRecords archiveGates archivePolicy releaseArchiveContentsStoredOutsideGit",
    );
    writeFileSync(
      join(root, "scripts/stage6i-production-release-archive-index.mjs"),
      "Stage 6I buildProductionReleaseArchiveIndex renderProductionReleaseArchiveIndexMarkdown readyForExternalReleaseArchiveIndex no network calls does not approve or verify a live production go-live fetch('https://example.invalid')",
    );
    writeFileSync(join(root, "scripts/stage6i-production-release-archive-index.test.mjs"), "ready release archive index CLI writes markdown and JSON outputs leak scanner blocks unsafe archive content");
    writeFileSync(join(root, "docs/backend/stage-6i-production-release-archive-index.md"), "Stage 6I npm run preflight:stage6i production release archive index Stage 6H Managed runtime/database dependency: none");
    writeFileSync(join(root, ".github/workflows/stage6i-production-release-archive-index.yml"), "name: stage6i-production-release-archive-index npm run preflight:stage6i stage6i-production-release-archive-index.md GITHUB_STEP_SUMMARY");
    writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: {} }));
    writeFileSync(join(root, "scripts/preflight-all.mjs"), "");

    const result = collectStage6IChecks({ root });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Missing required file/);
    assert.match(result.errors.join("\n"), /forbidden Stage 6I runtime/);
    assert.match(result.errors.join("\n"), /package\.json missing/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
