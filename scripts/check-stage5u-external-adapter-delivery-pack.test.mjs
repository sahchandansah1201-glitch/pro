import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5UChecks } from "./check-stage5u-external-adapter-delivery-pack.mjs";

test("Stage 5U guard passes on repository files", () => {
  const result = collectStage5UChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});
