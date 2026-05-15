import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage6CChecks } from "./check-stage6c-production-install-verification.mjs";

test("Stage 6C guard passes for bundled production install verification files", () => {
  const result = collectStage6CChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});
