import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildStage16A16ZLovablePrompt,
  buildStage16A16ZProductCycleReadiness,
  renderStage16A16ZProductCycleReadinessMarkdown,
  runStage16A16ZProductCycleReadiness,
} from "./stage16a-16z-product-cycle-readiness.mjs";

test("Stage 16A-16Z readiness sustains the 26-stage product-cycle contract", () => {
  const readiness = buildStage16A16ZProductCycleReadiness();

  assert.equal(readiness.stage, "16A-16Z");
  assert.equal(readiness.status, "ready");
  assert.equal(readiness.includedStages.length, 26);
  assert.equal(readiness.batchScale.previousIncludedStages, 26);
  assert.equal(readiness.batchScale.currentIncludedStages, 26);
  assert.equal(readiness.previousBatch, "Stage 15A-15Z");
  assert.equal(readiness.previousLovableConfirmation, "Confirmed: Stage 15A-15Z synced from main, no conflicts.");
  assert.equal(readiness.expectedLovableConfirmation, "Confirmed: Stage 16A-16Z synced from main, no conflicts.");
  assert.equal(readiness.recommendedProductCandidate.id, "candidate-stage17-clinical-followup");
  assert.equal(readiness.leakFindings.length, 0);
});

test("Stage 16A-16Z prompt is manifest-derived and product-cycle oriented", () => {
  const prompt = buildStage16A16ZLovablePrompt();

  assert.match(prompt, /Stage 16A-16Z из main/);
  assert.match(prompt, /product cycle readiness/);
  assert.match(prompt, /npm run preflight:stage16a-16z/);
  assert.match(prompt, /clinical follow-up and patient communication loop/);
  assert.match(prompt, /Confirmed: Stage 16A-16Z synced from main, no conflicts/);
});

test("Stage 16A-16Z markdown renders cycle, candidates, sections and rules", () => {
  const markdown = renderStage16A16ZProductCycleReadinessMarkdown();

  assert.match(markdown, /Product Cycle/);
  assert.match(markdown, /Product Candidates/);
  assert.match(markdown, /clinical follow-up and patient communication loop/i);
  assert.match(markdown, /product_cycle_not_chat_memory/);
  assert.match(markdown, /Post-Merge Lovable Prompt/);
});

test("Stage 16A-16Z runner writes summary and JSON to absolute paths", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage16-readiness-"));
  try {
    const summaryPath = join(dir, "summary.md");
    const jsonPath = join(dir, "summary.json");
    const result = runStage16A16ZProductCycleReadiness({ summaryPath, jsonPath });

    assert.equal(result.readiness.status, "ready");
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 16A-16Z/);
    const parsed = JSON.parse(readFileSync(jsonPath, "utf8"));
    assert.equal(parsed.readiness.stage, "16A-16Z");
    assert.equal(parsed.readiness.status, "ready");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
