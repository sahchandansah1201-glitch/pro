import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage6BChecks } from "./check-stage6b-server-install-package.mjs";

test("Stage 6B guard passes for bundled server install package files", () => {
  const result = collectStage6BChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});
