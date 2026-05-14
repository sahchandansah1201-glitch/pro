import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5DChecks } from "./check-stage5d-production-mode-cutover.mjs";

test("Stage 5D guard validates production mode cutover", () => {
  const result = collectStage5DChecks({ root: process.cwd() });

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 15);
});
