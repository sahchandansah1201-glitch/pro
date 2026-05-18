import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { collectStage6GChecks } from "./check-stage6g-production-post-go-live-observation.mjs";

test("Stage 6G guard passes for the repository", () => {
  const result = collectStage6GChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});

test("Stage 6G guard detects missing files and managed-runtime coupling", () => {
  const root = mkdtempSync(join(tmpdir(), "stage6g-guard-"));
  try {
    mkdirSync(join(root, "deploy/self-hosted"), { recursive: true });
    mkdirSync(join(root, "scripts"), { recursive: true });
    mkdirSync(join(root, "docs/backend"), { recursive: true });
    mkdirSync(join(root, ".github/workflows"), { recursive: true });
    writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: {} }));
    writeFileSync(join(root, "scripts/preflight-all.mjs"), "");
    writeFileSync(
      join(root, "deploy/self-hosted/post-go-live-observation.stage6g.json"),
      JSON.stringify({ goLiveDecisionRecordManifest: "x", observationInputs: [], observationPolicy: {} }),
    );
    writeFileSync(
      join(root, "scripts/stage6g-production-post-go-live-observation.mjs"),
      "Stage 6G fetch('https://example.com')",
    );
    const result = collectStage6GChecks({ root });
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /Missing required file/);
    assert.match(result.errors.join("\n"), /forbidden Stage 6G runtime/);
    assert.match(result.errors.join("\n"), /package\.json missing/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
