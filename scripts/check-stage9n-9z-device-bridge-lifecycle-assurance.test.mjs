import assert from "node:assert/strict";
import { test } from "node:test";

import { checkStage9N9Z } from "./check-stage9n-9z-device-bridge-lifecycle-assurance.mjs";

test("Stage 9N-9Z guard validates repository files", () => {
  const result = checkStage9N9Z();

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 17);
});
