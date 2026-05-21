#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildStage10A10ZErrorPreventionPackage,
  buildStage10A10ZLovablePrompt,
  renderStage10A10ZErrorPreventionMarkdown,
  runStage10A10ZErrorPrevention,
} from "./stage10a-10z-error-prevention.mjs";

test("Stage 10A-10Z package enforces x2 batch scale and prevention coverage", () => {
  const pkg = buildStage10A10ZErrorPreventionPackage();
  assert.equal(pkg.status, "ready");
  assert.equal(pkg.batchScale.previousIncludedStages, 13);
  assert.equal(pkg.batchScale.currentIncludedStages, 26);
  assert.equal(pkg.batchScale.scaleFactor, 2);
  assert.equal(pkg.includedStages.length, 26);
  assert.ok(pkg.diagnosedDefectCount >= 8);
  assert.ok(pkg.preventionRuleCount >= 8);
  assert.equal(pkg.leakFindings.length, 0);
  assert.equal(pkg.productBoundary.managedRuntimeDependency, "none");
  assert.equal(pkg.productBoundary.managedDatabaseDependency, "none");
});

test("Stage 10A-10Z prompt is post-merge only and lists verification commands", () => {
  const prompt = buildStage10A10ZLovablePrompt();
  assert.match(prompt, /Stage 10A-10Z из main/);
  assert.match(prompt, /npm run preflight:stage10a-10z/);
  assert.match(prompt, /npm run preflight:stage9n-9z/);
  assert.match(prompt, /npm run typecheck/);
  assert.match(prompt, /Confirmed: Stage 10A-10Z synced from main, no conflicts/);
  assert.doesNotMatch(prompt, /pull request branch/i);
});

test("Stage 10A-10Z markdown summarizes diagnosed defects and rules", () => {
  const markdown = renderStage10A10ZErrorPreventionMarkdown();
  assert.match(markdown, /Stage 10A-10Z/);
  assert.match(markdown, /stage9n-ui-fetch-count/);
  assert.match(markdown, /stage9n-temp-artifact/);
  assert.match(markdown, /merge-before-lovable/);
  assert.match(markdown, /Post-Merge Lovable Prompt/);
});

test("Stage 10A-10Z runner writes summary and JSON to absolute paths", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage10a10z-"));
  try {
    const summaryPath = join(dir, "summary.md");
    const jsonPath = join(dir, "summary.json");
    const result = runStage10A10ZErrorPrevention({ summaryPath, jsonPath });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Error prevention/);
    const parsed = JSON.parse(readFileSync(jsonPath, "utf8"));
    assert.equal(parsed.status, "ready");
    assert.equal(parsed.includedStages.length, 26);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
