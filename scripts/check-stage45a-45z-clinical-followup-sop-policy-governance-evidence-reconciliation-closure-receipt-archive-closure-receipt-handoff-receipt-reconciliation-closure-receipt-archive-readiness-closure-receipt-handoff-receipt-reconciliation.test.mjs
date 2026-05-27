import test from "node:test";
import assert from "node:assert/strict";

import { checkStage45A45Z } from "./check-stage45a-45z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation.mjs";

test("Stage 45 guard validates clinical follow-up archive readiness closure receipt handoff receipt reconciliation", () => {
  const result = checkStage45A45Z(process.cwd());
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 27);
});
