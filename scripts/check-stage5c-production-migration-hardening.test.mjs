import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5CChecks } from "./check-stage5c-production-migration-hardening.mjs";

test("Stage 5C guard validates production migration hardening", () => {
  const result = collectStage5CChecks({ root: process.cwd() });

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 9);
});
