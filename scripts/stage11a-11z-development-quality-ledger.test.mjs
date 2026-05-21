#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildStage11A11ZDevelopmentQualityLedger,
  buildStage11A11ZLovablePrompt,
  renderStage11A11ZDevelopmentQualityLedgerMarkdown,
  runStage11A11ZDevelopmentQualityLedger,
} from "./stage11a-11z-development-quality-ledger.mjs";

test("Stage 11A-11Z ledger sustains the 26-stage batch contract", () => {
  const ledger = buildStage11A11ZDevelopmentQualityLedger();
  assert.equal(ledger.status, "ready");
  assert.equal(ledger.batchScale.previousIncludedStages, 26);
  assert.equal(ledger.batchScale.currentIncludedStages, 26);
  assert.equal(ledger.includedStages.length, 26);
  assert.equal(ledger.ledgerSectionCount, 4);
  assert.ok(ledger.qualityRuleCount >= 7);
  assert.equal(ledger.qualityRuleSeverityCounts.critical, 4);
  assert.equal(ledger.leakFindings.length, 0);
});

test("Stage 11A-11Z prompt is explicit and post-merge oriented", () => {
  const prompt = buildStage11A11ZLovablePrompt();
  assert.match(prompt, /Stage 11A-11Z из main/);
  assert.match(prompt, /npm run preflight:stage11a-11z/);
  assert.match(prompt, /npm run preflight:stage10a-10z/);
  assert.match(prompt, /defect_requires_prevention/);
  assert.match(prompt, /Confirmed: Stage 11A-11Z synced from main, no conflicts/);
});

test("Stage 11A-11Z markdown renders ledger sections and quality rules", () => {
  const markdown = renderStage11A11ZDevelopmentQualityLedgerMarkdown();
  assert.match(markdown, /Batch Intake/);
  assert.match(markdown, /Diagnostics/);
  assert.match(markdown, /Verification/);
  assert.match(markdown, /Handoff/);
  assert.match(markdown, /merge_before_lovable/);
  assert.match(markdown, /Post-Merge Lovable Prompt/);
});

test("Stage 11A-11Z runner writes summary and JSON to absolute paths", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage11a11z-"));
  try {
    const summaryPath = join(dir, "ledger.md");
    const jsonPath = join(dir, "ledger.json");
    const result = runStage11A11ZDevelopmentQualityLedger({ summaryPath, jsonPath });
    assert.equal(result.ok, true);
    assert.match(readFileSync(summaryPath, "utf8"), /Development quality ledger/);
    const parsed = JSON.parse(readFileSync(jsonPath, "utf8"));
    assert.equal(parsed.status, "ready");
    assert.equal(parsed.includedStages.length, 26);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
