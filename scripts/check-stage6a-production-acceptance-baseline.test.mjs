import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage6AChecks } from "./check-stage6a-production-acceptance-baseline.mjs";

test("Stage 6A guard passes for bundled acceptance baseline files", () => {
  const result = collectStage6AChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});
