import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5QChecks } from "./check-stage5q-external-intake-import-contracts.mjs";

test("Stage 5Q guard passes for current repository", () => {
  const result = collectStage5QChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 16);
});
