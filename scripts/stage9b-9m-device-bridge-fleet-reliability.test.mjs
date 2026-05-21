import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import {
  buildDeviceBridgeFleetReliabilityPackage,
  buildStage9B9MLovablePrompt,
  renderDeviceBridgeFleetReliabilityMarkdown,
} from "./stage9b-9m-device-bridge-fleet-reliability.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(__dirname, "stage9b-9m-device-bridge-fleet-reliability.mjs");

test("Stage 9B-9M reliability package covers the x2 batch and boundary", () => {
  const pkg = buildDeviceBridgeFleetReliabilityPackage();

  assert.equal(pkg.stage, "9B-9M");
  assert.equal(pkg.status, "ready");
  assert.equal(pkg.includedStages.length, 12);
  assert.equal(pkg.previousBatch, "Stage 8P-9A");
  assert.equal(pkg.originalHypothesis, "Stage 9B-9D");
  assert.equal(pkg.nextBatchHypothesis, "Stage 9N-9Z");
  assert.equal(pkg.productBoundary.managedRuntimeDependency, "none");
  assert.equal(pkg.productBoundary.managedDatabaseDependency, "none");
  assert.equal(pkg.productBoundary.browserHardwareApis, false);
  assert.equal(pkg.productBoundary.payloadVisibility, "backend-only");
  assert.equal(pkg.leakFindings.length, 0);
  assert.ok(pkg.requiredCommands.includes("npm run preflight:stage9b-9m"));
});

test("Stage 9B-9M markdown includes registers and Lovable prompt", () => {
  const prompt = buildStage9B9MLovablePrompt();
  const markdown = renderDeviceBridgeFleetReliabilityMarkdown({ lovablePrompt: prompt });

  assert.match(markdown, /Device Bridge fleet reliability/);
  assert.match(markdown, /Stage 9B/);
  assert.match(markdown, /Stage 9M/);
  assert.match(markdown, /Managed runtime\/database dependency: none\/none/);
  assert.match(prompt, /Confirmed: Stage 9B-9M synced from main, no conflicts\./);
});

test("Stage 9B-9M CLI dry-run exits 0 from script-relative paths", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    cwd: dirname(dirname(__dirname)),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 9B-9M/);
  assert.match(result.stdout, /Post-Merge Lovable Prompt/);
});
