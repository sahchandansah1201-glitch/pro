import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5PChecks } from "./check-stage5p-production-clinic-booking-requests-intake.mjs";

test("Stage 5P guard confirms production clinic booking requests intake boundary", () => {
  const result = collectStage5PChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 20);
});
