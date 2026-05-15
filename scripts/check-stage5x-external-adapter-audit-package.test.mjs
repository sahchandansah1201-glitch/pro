import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5XChecks } from "./check-stage5x-external-adapter-audit-package.mjs";

test("Stage 5X guard passes for bundled audit package files", () => {
  const result = collectStage5XChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});
