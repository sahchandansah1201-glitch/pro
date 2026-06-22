import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import { readDeployStatus } from "./stage4m-production-deploy-status.mjs";

test("Stage 4M deploy status renders safe receipt metadata", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-status-"));
  try {
    const statusPath = join(root, "status.json");
    writeFileSync(statusPath, JSON.stringify({
      schemaVersion: "stage4m-production-deploy-receipt/v1",
      runId: "run-001",
      status: "ok",
      command: "update",
      projectName: "prod",
      startedAt: "2026-06-22T12:00:00.000Z",
      finishedAt: "2026-06-22T12:05:00.000Z",
      git: {
        before: { head: "aaaaaaa", branch: "main" },
        after: { head: "bbbbbbb", branch: "main" },
      },
      results: [{ label: "Health check", ok: true }],
    }));
    const result = readDeployStatus({ statusPath, summaryPath: join(root, "summary.md") });
    assert.equal(result.ok, true);
    assert.match(result.text, /Run ID: `run-001`/);
    assert.match(result.text, /Git HEAD after: `bbbbbbb`/);
    assert.doesNotMatch(result.text, /accessToken|credential|storagePath|patientName/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Stage 4M deploy status reports missing status file", () => {
  const result = readDeployStatus({ statusPath: "/tmp/missing-stage4m-status.json" });
  assert.equal(result.ok, false);
  assert.match(result.error, /Status file not found/);
});

test("Stage 4M deploy status CLI exits nonzero for failed deploy", () => {
  const root = mkdtempSync(join(tmpdir(), "stage4m-status-cli-"));
  try {
    const statusPath = join(root, "status.json");
    writeFileSync(statusPath, JSON.stringify({
      status: "fail",
      runId: "run-fail",
      command: "update",
      projectName: "prod",
    }));
    const result = spawnSync(process.execPath, [
      "scripts/stage4m-production-deploy-status.mjs",
      `--status-json=${statusPath}`,
    ], { cwd: process.cwd(), encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /Status: `fail`/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
