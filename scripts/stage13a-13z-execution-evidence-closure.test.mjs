#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildStage13A13ZExecutionEvidenceClosure,
  buildStage13A13ZLovablePrompt,
  renderStage13A13ZExecutionEvidenceClosureMarkdown,
  runStage13A13ZExecutionEvidenceClosure,
} from "./stage13a-13z-execution-evidence-closure.mjs";

test("Stage 13A-13Z closure sustains the 26-stage evidence closure contract", () => {
  const closure = buildStage13A13ZExecutionEvidenceClosure();
  assert.equal(closure.status, "ready");
  assert.equal(closure.batchScale.previousIncludedStages, 26);
  assert.equal(closure.batchScale.currentIncludedStages, 26);
  assert.equal(closure.includedStages.length, 26);
  assert.equal(closure.closureSectionCount, 6);
  assert.ok(closure.closureRuleCount >= 10);
  assert.equal(closure.closureRuleSeverityCounts.critical, 6);
  assert.equal(closure.leakFindings.length, 0);
});

test("Stage 13A-13Z prompt is manifest-derived and post-merge oriented", () => {
  const prompt = buildStage13A13ZLovablePrompt();
  assert.match(prompt, /Stage 13A-13Z из main/);
  assert.match(prompt, /npm run preflight:stage13a-13z/);
  assert.match(prompt, /npm run preflight:stage12a-12z/);
  assert.match(prompt, /closure_not_assumption/);
  assert.match(prompt, /Confirmed: Stage 13A-13Z synced from main, no conflicts/);
});

test("Stage 13A-13Z markdown renders closure sections and rules", () => {
  const markdown = renderStage13A13ZExecutionEvidenceClosureMarkdown();
  assert.match(markdown, /Closure Schema/);
  assert.match(markdown, /Previous Evidence Regression/);
  assert.match(markdown, /Verification Closure/);
  assert.match(markdown, /GitHub Closure/);
  assert.match(markdown, /Lovable Closure/);
  assert.match(markdown, /prompt_after_merge_only/);
  assert.match(markdown, /Post-Merge Lovable Prompt/);
});

test("Stage 13A-13Z runner writes summary and JSON to absolute paths", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage13a13z-"));
  try {
    const summaryPath = join(dir, "closure.md");
    const jsonPath = join(dir, "closure.json");
    const result = runStage13A13ZExecutionEvidenceClosure({ summaryPath, jsonPath });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Execution evidence closure/);
    const parsed = JSON.parse(readFileSync(jsonPath, "utf8"));
    assert.equal(parsed.status, "ready");
    assert.equal(parsed.includedStages.length, 26);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
