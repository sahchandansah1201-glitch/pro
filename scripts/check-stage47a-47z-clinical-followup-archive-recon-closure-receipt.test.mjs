import assert from "node:assert/strict";
import test from "node:test";

import { checkStage47A47Z } from "./check-stage47a-47z-clinical-followup-archive-recon-closure-receipt.mjs";

test("Stage 47 guard validates clinical follow-up archive readiness closure receipt handoff receipt reconciliation closure receipt", () => {
  const result = checkStage47A47Z(process.cwd());

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 27);
});
