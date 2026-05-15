import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5SChecks } from "./check-stage5s-booking-slot-confirmation.mjs";

test("Stage 5S guard confirms booking slot confirmation boundary", () => {
  const result = collectStage5SChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 16);
});
