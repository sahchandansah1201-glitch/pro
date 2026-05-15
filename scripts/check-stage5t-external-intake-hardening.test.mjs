import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5TChecks } from "./check-stage5t-external-intake-hardening.mjs";

test("Stage 5T guard passes on repository files", () => {
  const result = collectStage5TChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 17);
});
