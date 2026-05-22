import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildStage15A15ZLovablePrompt,
  buildStage15A15ZPostSyncHandoffReadiness,
  renderStage15A15ZPostSyncHandoffReadinessMarkdown,
  runStage15A15ZPostSyncHandoffReadiness,
} from "./stage15a-15z-post-sync-handoff-readiness.mjs";

test("Stage 15A-15Z ledger sustains the 26-stage post-sync handoff readiness contract", () => {
  const ledger = buildStage15A15ZPostSyncHandoffReadiness();

  assert.equal(ledger.stage, "15A-15Z");
  assert.equal(ledger.status, "ready");
  assert.equal(ledger.includedStages.length, 26);
  assert.equal(ledger.batchScale.previousIncludedStages, 26);
  assert.equal(ledger.batchScale.currentIncludedStages, 26);
  assert.equal(ledger.confirmedPreviousSync.stage, "Stage 14A-14Z");
  assert.equal(ledger.previousLovableConfirmation, "Confirmed: Stage 14A-14Z synced from main, no conflicts.");
  assert.equal(ledger.expectedLovableConfirmation, "Confirmed: Stage 15A-15Z synced from main, no conflicts.");
  assert.equal(ledger.leakFindings.length, 0);
});

test("Stage 15A-15Z prompt is manifest-derived and post-merge oriented", () => {
  const prompt = buildStage15A15ZLovablePrompt();

  assert.match(prompt, /Stage 15A-15Z из main/);
  assert.match(prompt, /post-sync handoff readiness/);
  assert.match(prompt, /npm run preflight:stage15a-15z/);
  assert.match(prompt, /Confirmed: Stage 15A-15Z synced from main, no conflicts/);
  assert.doesNotMatch(prompt, /branch-only/i);
});

test("Stage 15A-15Z markdown renders previous confirmation, sections and rules", () => {
  const markdown = renderStage15A15ZPostSyncHandoffReadinessMarkdown();

  assert.match(markdown, /Confirmed Previous Sync/);
  assert.match(markdown, /Confirmed: Stage 14A-14Z synced from main, no conflicts/);
  assert.match(markdown, /Sync Diagnostics/);
  assert.match(markdown, /post_sync_confirmation_not_memory/);
  assert.match(markdown, /Post-Merge Lovable Prompt/);
});

test("Stage 15A-15Z runner writes summary and JSON to absolute paths", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage15-ledger-"));
  try {
    const summaryPath = join(dir, "summary.md");
    const jsonPath = join(dir, "summary.json");
    const result = runStage15A15ZPostSyncHandoffReadiness({ summaryPath, jsonPath });

    assert.equal(result.ledger.status, "ready");
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 15A-15Z/);
    const parsed = JSON.parse(readFileSync(jsonPath, "utf8"));
    assert.equal(parsed.ledger.stage, "15A-15Z");
    assert.equal(parsed.ledger.status, "ready");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
