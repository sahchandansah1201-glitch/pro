import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5NChecks } from "./check-stage5n-production-patient-portal-contracts.mjs";

test("Stage 5N guard passes on repository state", () => {
  const result = collectStage5NChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.errors.length, 0);
  assert.ok(result.checkedFiles >= 30);
});
