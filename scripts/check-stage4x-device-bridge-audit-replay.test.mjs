import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage4XChecks } from "./check-stage4x-device-bridge-audit-replay.mjs";

test("Stage 4X guard validates Device Bridge audit/replay contract", () => {
  const result = collectStage4XChecks();

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 18);
});
