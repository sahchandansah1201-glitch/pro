import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildStage14A14ZLovablePrompt,
  buildStage14A14ZSyncConfirmationLedger,
  renderStage14A14ZSyncConfirmationLedgerMarkdown,
  runStage14A14ZSyncConfirmationLedger,
} from "./stage14a-14z-sync-confirmation-ledger.mjs";

test("Stage 14A-14Z ledger sustains the 26-stage sync confirmation contract", () => {
  const ledger = buildStage14A14ZSyncConfirmationLedger();

  assert.equal(ledger.stage, "14A-14Z");
  assert.equal(ledger.status, "ready");
  assert.equal(ledger.includedStages.length, 26);
  assert.equal(ledger.batchScale.previousIncludedStages, 26);
  assert.equal(ledger.batchScale.currentIncludedStages, 26);
  assert.equal(ledger.confirmedPreviousSync.stage, "Stage 13A-13Z");
  assert.equal(ledger.previousLovableConfirmation, "Confirmed: Stage 13A-13Z synced from main, no conflicts.");
  assert.equal(ledger.expectedLovableConfirmation, "Confirmed: Stage 14A-14Z synced from main, no conflicts.");
  assert.equal(ledger.leakFindings.length, 0);
});

test("Stage 14A-14Z prompt is manifest-derived and post-merge oriented", () => {
  const prompt = buildStage14A14ZLovablePrompt();

  assert.match(prompt, /Stage 14A-14Z из main/);
  assert.match(prompt, /sync confirmation ledger/);
  assert.match(prompt, /npm run preflight:stage14a-14z/);
  assert.match(prompt, /Confirmed: Stage 14A-14Z synced from main, no conflicts/);
  assert.doesNotMatch(prompt, /branch-only/i);
});

test("Stage 14A-14Z markdown renders previous confirmation, sections and rules", () => {
  const markdown = renderStage14A14ZSyncConfirmationLedgerMarkdown();

  assert.match(markdown, /Confirmed Previous Sync/);
  assert.match(markdown, /Confirmed: Stage 13A-13Z synced from main, no conflicts/);
  assert.match(markdown, /Sync Diagnostics/);
  assert.match(markdown, /sync_confirmation_not_memory/);
  assert.match(markdown, /Post-Merge Lovable Prompt/);
});

test("Stage 14A-14Z runner writes summary and JSON to absolute paths", () => {
  const dir = mkdtempSync(join(tmpdir(), "stage14-ledger-"));
  try {
    const summaryPath = join(dir, "summary.md");
    const jsonPath = join(dir, "summary.json");
    const result = runStage14A14ZSyncConfirmationLedger({ summaryPath, jsonPath });

    assert.equal(result.ledger.status, "ready");
    assert.match(readFileSync(summaryPath, "utf8"), /Stage 14A-14Z/);
    const parsed = JSON.parse(readFileSync(jsonPath, "utf8"));
    assert.equal(parsed.ledger.stage, "14A-14Z");
    assert.equal(parsed.ledger.status, "ready");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
