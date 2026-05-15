import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5YChecks } from "./check-stage5y-external-adapter-reconciliation-package.mjs";

test("Stage 5Y guard passes for bundled reconciliation package files", () => {
  const result = collectStage5YChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});
