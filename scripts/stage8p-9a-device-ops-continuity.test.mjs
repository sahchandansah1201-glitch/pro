#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  buildDeviceOpsContinuityPackage,
  buildStage8P9ALovablePrompt,
  renderDeviceOpsContinuityMarkdown,
} from "./stage8p-9a-device-ops-continuity.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "stage8p-9a-device-ops-continuity.mjs");

test("Stage 8P-9A continuity package covers the x2 batch and boundary", () => {
  const pkg = buildDeviceOpsContinuityPackage();

  assert.equal(pkg.status, "ready");
  assert.equal(pkg.includedStages.length, 12);
  assert.deepEqual(pkg.includedStages, [
    "Stage 8P",
    "Stage 8Q",
    "Stage 8R",
    "Stage 8S",
    "Stage 8T",
    "Stage 8U",
    "Stage 8V",
    "Stage 8W",
    "Stage 8X",
    "Stage 8Y",
    "Stage 8Z",
    "Stage 9A",
  ]);
  assert.equal(pkg.productBoundary.managedRuntimeDependency, "none");
  assert.equal(pkg.productBoundary.managedDatabaseDependency, "none");
  assert.equal(pkg.productBoundary.payloadVisibility, "backend-only");
  assert.equal(pkg.leakFindings.length, 0);
  assert.ok(pkg.requiredCommands.includes("npm run preflight:stage8p-9a"));
});

test("Stage 8P-9A markdown includes continuity registers and Lovable prompt", () => {
  const markdown = renderDeviceOpsContinuityMarkdown();
  const prompt = buildStage8P9ALovablePrompt();

  assert.match(markdown, /Stage: `8P-9A`/);
  assert.match(markdown, /Worker telemetry retention: 30 days/);
  assert.match(markdown, /Managed runtime\/database dependency: none\/none/);
  assert.match(markdown, /Post-Merge Lovable Prompt/);
  assert.match(prompt, /Confirmed: Stage 8P-9A synced from main, no conflicts\./);
  assert.doesNotMatch(markdown, /SUPABASE_|api-read|api-write|storage_object_path|signed_url|access_token/i);
});

test("Stage 8P-9A CLI dry-run exits 0 from script-relative paths", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    cwd: "/tmp",
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Device Bridge operations continuity/);
  assert.match(result.stdout, /Stage 9A/);
});
