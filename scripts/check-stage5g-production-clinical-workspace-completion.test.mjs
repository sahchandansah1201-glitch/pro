import test from "node:test";
import assert from "node:assert/strict";

import { collectStage5GChecks } from "./check-stage5g-production-clinical-workspace-completion.mjs";

test("Stage 5G guard validates production clinical workspace completion", () => {
  const result = collectStage5GChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 9);
});
