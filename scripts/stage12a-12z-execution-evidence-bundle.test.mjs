#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildStage12A12ZExecutionEvidenceBundle,
  buildStage12A12ZLovablePrompt,
  renderStage12A12ZExecutionEvidenceBundleMarkdown,
  runStage12A12ZExecutionEvidenceBundle,
} from "./stage12a-12z-execution-evidence-bundle.mjs";

test("Stage 12A-12Z bundle sustains the 26-stage execution evidence contract", () => {
  const bundle = buildStage12A12ZExecutionEvidenceBundle();
  assert.equal(bundle.status, "ready");
  assert.equal(bundle.batchScale.previousIncludedStages, 26);
  assert.equal(bundle.batchScale.currentIncludedStages, 26);
  assert.equal(bundle.includedStages.length, 26);
  assert.equal(bundle.evidenceSectionCount, 5);
  assert.ok(bundle.evidenceRuleCount >= 8);
  assert.equal(bundle.evidenceRuleSeverityCounts.critical, 4);
  assert.equal(bundle.leakFindings.length, 0);
});

test("Stage 12A-12Z prompt is explicit and post-merge oriented", () => {
  const prompt = buildStage12A12ZLovablePrompt();
  assert.match(prompt, /Stage 12A-12Z из main/);
  assert.match(prompt, /npm run preflight:stage12a-12z/);
  assert.match(prompt, /npm run preflight:stage11a-11z/);
  assert.match(prompt, /evidence_not_assertion/);
  assert.match(prompt, /Confirmed: Stage 12A-12Z synced from main, no conflicts/);
});

test("Stage 12A-12Z markdown renders evidence sections and rules", () => {
  const markdown = renderStage12A12ZExecutionEvidenceBundleMarkdown();
  assert.match(markdown, /Implementation Evidence/);
  assert.match(markdown, /Diagnostics Evidence/);
  assert.match(markdown, /Verification Evidence/);
  assert.match(markdown, /GitHub Evidence/);
  assert.match(markdown, /Lovable Evidence/);
  assert.match(markdown, /merge_before_prompt/);
  assert.match(markdown, /Post-Merge Lovable Prompt/);
});

test("Stage 12A-12Z runner writes summary and JSON to absolute paths", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage12a12z-"));
  try {
    const summaryPath = join(dir, "bundle.md");
    const jsonPath = join(dir, "bundle.json");
    const result = runStage12A12ZExecutionEvidenceBundle({ summaryPath, jsonPath });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Execution evidence bundle/);
    const parsed = JSON.parse(readFileSync(jsonPath, "utf8"));
    assert.equal(parsed.status, "ready");
    assert.equal(parsed.includedStages.length, 26);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
