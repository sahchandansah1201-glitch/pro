import test from "node:test";
import assert from "node:assert/strict";

import { checkStage46A46Z } from "./check-stage46a-46z-clinical-followup-sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure.mjs";

test("Stage 46 guard validates clinical follow-up archive readiness closure receipt handoff receipt reconciliation closure", () => {
  const result = checkStage46A46Z(process.cwd());
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 27);
});
