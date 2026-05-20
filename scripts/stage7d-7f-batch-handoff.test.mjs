#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildStage7D7FBatchPlan,
  evaluateStage7D7FHandoffReadiness,
  renderStage7D7FBatchPlanMarkdown,
} from "./stage7d-7f-batch-handoff.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = resolve(ROOT, "scripts/stage7d-7f-batch-handoff.mjs");

test("builds the Stage 7D-7F batch plan from the manifest", () => {
  const plan = buildStage7D7FBatchPlan();
  assert.equal(plan.stage, "7D-7F");
  assert.deepEqual(plan.includedStages, ["Stage 7D", "Stage 7E", "Stage 7F"]);
  assert.equal(plan.minimumRelatedStagesPerBatch, 3);
  assert.equal(plan.productBoundary.managedRuntimeDependency, "none");
  assert.ok(plan.requiredChecks.includes("npm run preflight:stage7d-7f"));
});

test("blocks Lovable prompt until PR merge and local main verification are complete", () => {
  const blocked = evaluateStage7D7FHandoffReadiness({
    pullRequestMerged: false,
    localBranch: "codex/stage7d-7f-batch-automation-contract",
  });
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.lovablePromptAllowed, false);
  assert.match(blocked.failedGates.join("\n"), /pull request must be merged/);
  assert.match(blocked.failedGates.join("\n"), /local branch must be main/);
});

test("allows Lovable prompt only after every handoff gate is satisfied", () => {
  const ready = evaluateStage7D7FHandoffReadiness({
    pullRequestMerged: true,
    baseBranch: "main",
    localBranch: "main",
    localMainVerified: true,
    stagePreflightPassed: true,
    projectMemoryPassed: true,
    denoLockGuardPassed: true,
  });
  assert.equal(ready.status, "ready");
  assert.equal(ready.lovablePromptAllowed, true);
  assert.deepEqual(ready.failedGates, []);
});

test("renders markdown with required checks and blocked gates", () => {
  const markdown = renderStage7D7FBatchPlanMarkdown();
  assert.match(markdown, /Stage 7D-7F Batch Handoff/);
  assert.match(markdown, /npm run preflight:stage7d-7f/);
  assert.match(markdown, /Lovable prompt allowed: no/);
  assert.match(markdown, /Blocked Gates/);
});

test("CLI dry-run prints a safe markdown report", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 7D-7F Batch Handoff/);
  assert.match(result.stdout, /Managed runtime\/database dependency: none\/none/);
});
