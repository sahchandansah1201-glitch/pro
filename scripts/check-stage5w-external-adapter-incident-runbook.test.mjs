import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5WChecks } from "./check-stage5w-external-adapter-incident-runbook.mjs";

test("Stage 5W guard passes on repository files", () => {
  const result = collectStage5WChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 8);
});
