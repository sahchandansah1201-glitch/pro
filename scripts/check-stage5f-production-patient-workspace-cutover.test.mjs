import test from "node:test";
import assert from "node:assert/strict";

import { collectStage5FChecks } from "./check-stage5f-production-patient-workspace-cutover.mjs";

test("Stage 5F guard validates production patient/workspace cutover", () => {
  const result = collectStage5FChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 14);
});

