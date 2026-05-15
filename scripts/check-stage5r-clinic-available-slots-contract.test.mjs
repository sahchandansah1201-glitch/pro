import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5RChecks } from "./check-stage5r-clinic-available-slots-contract.mjs";

test("Stage 5R guard confirms clinic available slots contract boundary", () => {
  const result = collectStage5RChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 16);
});

