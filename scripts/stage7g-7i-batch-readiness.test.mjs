#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildStage7G7IBatchReadiness,
  buildStage7G7ILovablePrompt,
  evaluateStage7G7ISyncReadiness,
  renderStage7G7IBatchReadinessMarkdown,
} from "./stage7g-7i-batch-readiness.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = resolve(ROOT, "scripts/stage7g-7i-batch-readiness.mjs");

test("builds the Stage 7G-7I readiness model from the manifest", () => {
  const readiness = buildStage7G7IBatchReadiness();
  assert.equal(readiness.stage, "7G-7I");
  assert.deepEqual(readiness.includedStages, ["Stage 7G", "Stage 7H", "Stage 7I"]);
  assert.equal(readiness.minimumRelatedStagesPerBatch, 3);
  assert.ok(readiness.requiredChecks.includes("npm run preflight:stage7g-7i"));
  assert.equal(readiness.nextStageHypothesis, "Stage 7J");
  assert.equal(readiness.productBoundary.managedRuntimeDependency, "none");
});

test("blocks Lovable prompt until every post-merge gate passes", () => {
  const blocked = evaluateStage7G7ISyncReadiness();
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.lovablePromptAllowed, false);
  assert.ok(blocked.failedGates.includes("pull request must be merged into main"));
  assert.ok(blocked.failedGates.includes("npm run check:stage7g-7i"));

  const ready = evaluateStage7G7ISyncReadiness({
    pullRequestMerged: true,
    localMainVerified: true,
    stagePreflightPassed: true,
    projectMemoryPassed: true,
    driftGuardPassed: true,
    githubChecksPassed: true,
    denoLockGuardPassed: true,
    packageLockUnchanged: true,
  });
  assert.equal(ready.status, "ready");
  assert.equal(ready.lovablePromptAllowed, true);
  assert.deepEqual(ready.failedGates, []);
});

test("renders the Lovable sync verification prompt from repository data", () => {
  const prompt = buildStage7G7ILovablePrompt();
  assert.match(prompt, /Stage 7G-7I/);
  assert.match(prompt, /scripts\/stage7g-7i-batch-readiness\.mjs/);
  assert.match(prompt, /npm run preflight:stage7g-7i/);
  assert.match(prompt, /Confirmed: Stage 7G-7I synced from main, no conflicts/);
});

test("renders markdown with readiness, drift guard, and blocked gates", () => {
  const markdown = renderStage7G7IBatchReadinessMarkdown();
  assert.match(markdown, /Stage 7G-7I Batch Readiness/);
  assert.match(markdown, /Lovable Sync Verification Manifest/);
  assert.match(markdown, /Batch Drift Guard/);
  assert.match(markdown, /pull request must be merged into main/);
  assert.match(markdown, /Post-Merge Lovable Prompt/);
});

test("CLI dry-run prints a safe readiness report", () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--dry-run"], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Stage 7G-7I Batch Readiness/);
  assert.match(result.stdout, /Lovable prompt status: `blocked`/);
  assert.doesNotMatch(result.stdout, /SUPABASE_/);
  assert.doesNotMatch(result.stdout, /access_token/);
});
