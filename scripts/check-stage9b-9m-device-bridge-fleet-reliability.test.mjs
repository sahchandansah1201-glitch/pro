import assert from "node:assert/strict";
import { test } from "node:test";

import { checkStage9B9M } from "./check-stage9b-9m-device-bridge-fleet-reliability.mjs";

test("Stage 9B-9M guard passes for repository files", () => {
  const result = checkStage9B9M();

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 17);
});
