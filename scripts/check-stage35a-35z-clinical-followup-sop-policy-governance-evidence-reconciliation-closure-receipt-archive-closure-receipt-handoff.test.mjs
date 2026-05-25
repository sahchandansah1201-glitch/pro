import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { checkStage35A35Z } from "./check-stage35a-35z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff.mjs";

test("Stage 35A-35Z guard passes for repository fixture", () => {
  const result = checkStage35A35Z(process.cwd());
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 27);
});

test("Stage 35A-35Z guard rejects missing self-hosted boundary", () => {
  const root = mkdtempSync(join(tmpdir(), "stage35-missing-"));
  const result = checkStage35A35Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /Missing required file/);
});

test("Stage 35A-35Z guard rejects forbidden markers", () => {
  const root = mkdtempSync(join(tmpdir(), "stage35-forbidden-"));
  const protectedFile = "docs/backend/stage-35a-35z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff.md";
  mkdirSync(join(root, "docs/backend"), { recursive: true });
  writeFileSync(join(root, protectedFile), "Stage 35A-35Z\nSUPABASE_URL\n", "utf8");
  const result = checkStage35A35Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /SUPABASE_/);
});

test("Stage 35A-35Z guard rejects non-self-hosted user table references", () => {
  const root = mkdtempSync(join(tmpdir(), "stage35-users-"));
  const protectedFile = "backend/self-hosted/db/migrations/0042_stage35_followup_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff.sql";
  mkdirSync(join(root, "backend/self-hosted/db/migrations"), { recursive: true });
  writeFileSync(join(root, protectedFile), "alter table x add column user_id uuid references users(id);\n", "utf8");
  const result = checkStage35A35Z(root);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /references\\s\+users/);
});
