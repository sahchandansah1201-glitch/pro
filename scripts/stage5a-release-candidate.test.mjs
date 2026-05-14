import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  buildStage5AReleaseCandidate,
  parseStage5AArgs,
  renderStage5AReleaseCandidate,
  runStage5AReleaseCandidate,
} from "./stage5a-release-candidate.mjs";

test("builds a ready release candidate from repository files", () => {
  const candidate = buildStage5AReleaseCandidate({
    root: process.cwd(),
    generatedAt: "2026-05-14T00:00:00.000Z",
  });

  assert.equal(candidate.stage, "5A");
  assert.equal(candidate.status, "ready", candidate.missingFiles.join("\n"));
  assert.equal(candidate.productBoundary.managedRuntime, "none");
  assert.equal(candidate.productBoundary.managedDatabase, "none");
  assert.equal(candidate.productBoundary.database, "operator-owned PostgreSQL");
  assert.ok(candidate.migrations.includes("0001_stage4a_core.sql"));
  assert.ok(candidate.migrations.includes("0013_stage4x_device_bridge_audit_replay.sql"));
  assert.ok(candidate.releaseGates.some((gate) => gate.command === "npm run preflight:all"));
});

test("renders safe markdown without secret-like values", () => {
  const candidate = buildStage5AReleaseCandidate({
    root: process.cwd(),
    generatedAt: "2026-05-14T00:00:00.000Z",
  });
  const out = renderStage5AReleaseCandidate(candidate);

  assert.match(out, /## Stage 5A self-hosted release candidate/);
  assert.match(out, /Managed runtime: `none`/);
  assert.match(out, /operator-owned PostgreSQL/);
  assert.match(out, /release-candidate\.stage5a\.env\.example/);
  assert.match(out, /npm run preflight:stage5a/);
  assert.doesNotMatch(out, /password=|Bearer\s+[A-Za-z0-9]|access_token|patient_full_name|storage_object_path|signed_url/);
});

test("argument parser supports dry-run and summary forms", () => {
  assert.deepEqual(parseStage5AArgs(["--dry-run"]), {
    dryRun: true,
    summaryPath: null,
  });
  assert.deepEqual(parseStage5AArgs(["--summary", "x.md"]), {
    dryRun: false,
    summaryPath: "x.md",
  });
  assert.deepEqual(parseStage5AArgs(["--summary=x.md"]), {
    dryRun: false,
    summaryPath: "x.md",
  });
  assert.throws(() => parseStage5AArgs(["--summary"]), /requires a path/);
  assert.throws(() => parseStage5AArgs(["--bad"]), /Unknown argument/);
});

test("writes summary file when requested", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage5a-"));
  try {
    const path = join(dir, "release-candidate.md");
    const result = runStage5AReleaseCandidate({
      root: process.cwd(),
      generatedAt: "2026-05-14T00:00:00.000Z",
      summaryPath: path,
    });
    assert.equal(result.ok, true);
    assert.match(readFileSync(path, "utf8"), /Stage 5A self-hosted release candidate/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("cli dry-run exits 0", () => {
  const result = spawnSync(process.execPath, ["scripts/stage5a-release-candidate.mjs", "--dry-run"], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 5A self-hosted release candidate/);
  assert.match(result.stdout, /npm run preflight:stage5a/);
});
