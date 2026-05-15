import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5VChecks } from "./check-stage5v-external-adapter-operations.mjs";

test("Stage 5V guard passes on repository files", () => {
  const result = collectStage5VChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 9);
});
