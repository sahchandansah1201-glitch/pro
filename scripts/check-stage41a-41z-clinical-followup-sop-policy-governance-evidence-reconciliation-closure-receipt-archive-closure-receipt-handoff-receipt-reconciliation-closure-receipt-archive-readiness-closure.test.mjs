import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { checkStage41A41Z } from "./check-stage41a-41z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure.mjs";

test("Stage 41A-41Z guard passes for repository fixture", () => {
  const result = checkStage41A41Z(process.cwd());
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 27);
});

test("Stage 41A-41Z guard rejects missing self-hosted boundary", () => {
  const root = mkdtempSync(join(tmpdir(), "stage41-missing-"));
  const result = checkStage41A41Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Missing required file/);
});

test("Stage 41A-41Z guard rejects forbidden markers", () => {
  const root = mkdtempSync(join(tmpdir(), "stage41-forbidden-"));
  const protectedFile = "docs/backend/stage-41a-41z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure.md";
  mkdirSync(join(root, "docs/backend"), { recursive: true });
  writeFileSync(join(root, protectedFile), "Stage 41A-41Z\nSUPABASE_URL\n", "utf8");
  const result = checkStage41A41Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /SUPABASE_/);
});

test("Stage 41A-41Z guard rejects non-self-hosted user table references", () => {
  const root = mkdtempSync(join(tmpdir(), "stage41-users-"));
  const protectedFile = "backend/self-hosted/db/migrations/0048_stage41_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure.sql";
  mkdirSync(join(root, "backend/self-hosted/db/migrations"), { recursive: true });
  writeFileSync(join(root, protectedFile), "alter table x add column user_id uuid references users(id);\n", "utf8");
  const result = checkStage41A41Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /forbidden runtime marker/);
  assert.match(result.errors.join("\n"), /references/);
});

test("Stage 41A-41Z guard rejects PostgreSQL identifiers longer than 63 bytes", () => {
  const root = mkdtempSync(join(tmpdir(), "stage41-long-identifiers-"));
  const protectedFile = "backend/self-hosted/db/migrations/0048_stage41_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure.sql";
  mkdirSync(join(root, "backend/self-hosted/db/migrations"), { recursive: true });
  writeFileSync(
    join(root, protectedFile),
    "alter table clinical_follow_up_tasks add column stage41_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_state text;\n",
    "utf8",
  );
  const result = checkStage41A41Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /identifier longer than 63 bytes/);
});
