import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { checkStage39A39Z } from "./check-stage39a-39z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt.mjs";

test("Stage 39A-39Z guard passes for repository fixture", () => {
  const result = checkStage39A39Z(process.cwd());
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 27);
});

test("Stage 39A-39Z guard rejects missing self-hosted boundary", () => {
  const root = mkdtempSync(join(tmpdir(), "stage39-missing-"));
  const result = checkStage39A39Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Missing required file/);
});

test("Stage 39A-39Z guard rejects forbidden markers", () => {
  const root = mkdtempSync(join(tmpdir(), "stage39-forbidden-"));
  const protectedFile = "docs/backend/stage-39a-39z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt.md";
  mkdirSync(join(root, "docs/backend"), { recursive: true });
  writeFileSync(join(root, protectedFile), "Stage 39A-39Z\nSUPABASE_URL\n", "utf8");
  const result = checkStage39A39Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /SUPABASE_/);
});

test("Stage 39A-39Z guard rejects non-self-hosted user table references", () => {
  const root = mkdtempSync(join(tmpdir(), "stage39-users-"));
  const protectedFile = "backend/self-hosted/db/migrations/0046_stage39_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt.sql";
  mkdirSync(join(root, "backend/self-hosted/db/migrations"), { recursive: true });
  writeFileSync(join(root, protectedFile), "alter table x add column user_id uuid references users(id);\n", "utf8");
  const result = checkStage39A39Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /forbidden runtime marker: \/references\\s\+users/);
});
