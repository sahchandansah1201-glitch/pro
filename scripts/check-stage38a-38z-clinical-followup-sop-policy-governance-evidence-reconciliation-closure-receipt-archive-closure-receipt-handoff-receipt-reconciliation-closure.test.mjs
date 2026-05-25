import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { checkStage38A38Z } from "./check-stage38a-38z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure.mjs";

test("Stage 38A-38Z guard passes for repository fixture", () => {
  const result = checkStage38A38Z(process.cwd());
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 27);
});

test("Stage 38A-38Z guard rejects missing self-hosted boundary", () => {
  const root = mkdtempSync(join(tmpdir(), "stage38-missing-"));
  const result = checkStage38A38Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Missing required file/);
});

test("Stage 38A-38Z guard rejects forbidden markers", () => {
  const root = mkdtempSync(join(tmpdir(), "stage38-forbidden-"));
  const protectedFile = "docs/backend/stage-38a-38z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure.md";
  mkdirSync(join(root, "docs/backend"), { recursive: true });
  writeFileSync(join(root, protectedFile), "Stage 38A-38Z\nSUPABASE_URL\n", "utf8");
  const result = checkStage38A38Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /SUPABASE_/);
});

test("Stage 38A-38Z guard rejects non-self-hosted user table references", () => {
  const root = mkdtempSync(join(tmpdir(), "stage38-users-"));
  const protectedFile = "backend/self-hosted/db/migrations/0045_stage38_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure.sql";
  mkdirSync(join(root, "backend/self-hosted/db/migrations"), { recursive: true });
  writeFileSync(join(root, protectedFile), "alter table x add column user_id uuid references users(id);\n", "utf8");
  const result = checkStage38A38Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /references\\s\+users/);
});
