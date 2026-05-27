import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { checkStage43A43Z } from "./check-stage43a-43z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff.mjs";

test("Stage 43A-43Z guard passes for repository fixture", () => {
  const result = checkStage43A43Z(process.cwd());
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 27);
});

test("Stage 43A-43Z guard rejects missing self-hosted boundary", () => {
  const root = mkdtempSync(join(tmpdir(), "stage43-missing-"));
  const result = checkStage43A43Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Missing required file/);
});

test("Stage 43A-43Z guard rejects forbidden markers", () => {
  const root = mkdtempSync(join(tmpdir(), "stage43-forbidden-"));
  mkdirSync(join(root, "docs/backend"), { recursive: true });
  writeFileSync(
    join(root, "docs/backend/stage-43a-43z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff.md"),
    "Stage 43A-43Z\nSUPABASE_URL\n",
    "utf8",
  );
  const result = checkStage43A43Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /SUPABASE_/);
});

test("Stage 43A-43Z guard rejects non-self-hosted user table references", () => {
  const root = mkdtempSync(join(tmpdir(), "stage43-users-"));
  mkdirSync(join(root, "backend/self-hosted/db/migrations"), { recursive: true });
  writeFileSync(
    join(root, "backend/self-hosted/db/migrations/0050_stage43_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff.sql"),
    "alter table x add column user_id uuid references users(id);\n",
    "utf8",
  );
  const result = checkStage43A43Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /forbidden runtime marker/);
  assert.match(result.errors.join("\n"), /references/);
});

test("Stage 43A-43Z guard rejects PostgreSQL identifiers longer than 63 bytes", () => {
  const root = mkdtempSync(join(tmpdir(), "stage43-long-identifiers-"));
  mkdirSync(join(root, "backend/self-hosted/db/migrations"), { recursive: true });
  writeFileSync(
    join(root, "backend/self-hosted/db/migrations/0050_stage43_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff.sql"),
    "alter table clinical_follow_up_tasks add column stage43_archive_handoff_receipt_reconciliation_closure_receipt_archive_closure_receipt_state text;\n",
    "utf8",
  );
  const result = checkStage43A43Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /identifier longer than 63 bytes/);
});
