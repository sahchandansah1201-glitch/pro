import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage4UChecks } from "./check-stage4u-device-bridge-worker-observability.mjs";

test("Stage 4U guard validates worker observability contract", () => {
  const result = collectStage4UChecks();

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles >= 17, true);
});
