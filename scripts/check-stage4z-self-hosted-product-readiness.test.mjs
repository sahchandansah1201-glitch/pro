import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage4ZChecks } from "./check-stage4z-self-hosted-product-readiness.mjs";

test("Stage 4Z guard validates self-hosted product readiness contract", () => {
  const result = collectStage4ZChecks();

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 16);
});
