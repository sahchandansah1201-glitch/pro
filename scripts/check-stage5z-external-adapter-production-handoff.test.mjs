import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5ZChecks } from "./check-stage5z-external-adapter-production-handoff.mjs";

test("Stage 5Z guard passes for bundled production handoff files", () => {
  const result = collectStage5ZChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 7);
});
