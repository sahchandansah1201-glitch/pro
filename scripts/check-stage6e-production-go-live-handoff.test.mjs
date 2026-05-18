import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { collectStage6EChecks } from "./check-stage6e-production-go-live-handoff.mjs";

test("Stage 6E guard passes for the repository", () => {
  const result = collectStage6EChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});

test("Stage 6E guard detects missing files and managed-runtime coupling", () => {
  const root = mkdtempSync(join(tmpdir(), "stage6e-guard-"));
  try {
    mkdirSync(join(root, "deploy/self-hosted"), { recursive: true });
    mkdirSync(join(root, "scripts"), { recursive: true });
    mkdirSync(join(root, "docs/backend"), { recursive: true });
    mkdirSync(join(root, ".github/workflows"), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: {} }));
    writeFileSync(join(root, "scripts/preflight-all.mjs"), "");
    writeFileSync(
      join(root, "deploy/self-hosted/go-live-handoff.stage6e.json"),
      JSON.stringify({ liveInstallEvidenceManifest: "x", handoffInputs: [], goLivePolicy: {} }),
    );
    writeFileSync(
      join(root, "scripts/stage6e-production-go-live-handoff.mjs"),
      "Stage 6E fetch('https://example.com')",
    );
    const result = collectStage6EChecks({ root });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Missing required file/);
    assert.match(result.errors.join("\n"), /forbidden Stage 6E runtime/);
    assert.match(result.errors.join("\n"), /package\.json missing/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
