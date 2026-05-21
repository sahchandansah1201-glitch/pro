import { test } from "node:test";
import assert from "node:assert/strict";

import { collectStage8D8FChecks } from "./check-stage8d-8f-availability-sync.mjs";

test("Stage 8D-8F guard passes on repository files", () => {
  const result = collectStage8D8FChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 13);
});
