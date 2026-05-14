import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage4YChecks } from "./check-stage4y-device-bridge-audit-export.mjs";

test("Stage 4Y guard validates Device Bridge audit export contract", () => {
  const result = collectStage4YChecks();

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 15);
});
