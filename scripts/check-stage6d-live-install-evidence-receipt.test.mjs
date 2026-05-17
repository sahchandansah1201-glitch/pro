import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage6DChecks } from "./check-stage6d-live-install-evidence-receipt.mjs";

test("Stage 6D guard passes for bundled live install evidence receipt files", () => {
  const result = collectStage6DChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});
