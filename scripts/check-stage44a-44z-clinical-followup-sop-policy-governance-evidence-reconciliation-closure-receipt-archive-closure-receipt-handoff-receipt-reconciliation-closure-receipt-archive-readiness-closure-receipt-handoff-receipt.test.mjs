import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { tmpdir } from "node:os";

import { checkStage44A44Z } from "./check-stage44a-44z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt.mjs";

test("Stage 44A-44Z guard passes for repository fixture", () => {
  const result = checkStage44A44Z(process.cwd());
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 27);
});

test("Stage 44A-44Z guard rejects missing self-hosted boundary", () => {
  const dir = join(tmpdir(), `stage44-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const result = checkStage44A44Z(dir);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Missing required file/);
});

test("Stage 44A-44Z guard rejects forbidden markers", () => {
  const dir = join(tmpdir(), `stage44-forbidden-${Date.now()}`);
  mkdirSync(join(dir, "deploy/self-hosted"), { recursive: true });
  writeFileSync(join(dir, "deploy/self-hosted/clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt.stage44a-44z.json"), "Stage 44A-44Z\nSUPABASE_URL\n");
  const result = checkStage44A44Z(dir);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /SUPABASE_/);
});

test("Stage 44A-44Z guard rejects non-self-hosted user table references", () => {
  const dir = join(tmpdir(), `stage44-users-${Date.now()}`);
  mkdirSync(join(dir, "backend/self-hosted/db/migrations"), { recursive: true });
  writeFileSync(join(dir, "backend/self-hosted/db/migrations/0051_stage44_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff_receipt.sql"), "alter table x add column y uuid references users(id);\n");
  const result = checkStage44A44Z(dir);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /references/);
});

test("Stage 44A-44Z guard rejects PostgreSQL identifiers longer than 63 bytes", () => {
  const dir = join(tmpdir(), `stage44-ident-${Date.now()}`);
  mkdirSync(join(dir, "backend/self-hosted/db/migrations"), { recursive: true });
  writeFileSync(join(dir, "backend/self-hosted/db/migrations/0051_stage44_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff_receipt.sql"), "create index stage44_this_identifier_is_far_too_long_for_postgresql_identifier_limits_x on t (id);\n");
  const result = checkStage44A44Z(dir);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /longer than 63/);
});
