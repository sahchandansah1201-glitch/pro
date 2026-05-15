import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5OChecks } from "./check-stage5o-production-patient-portal-writes.mjs";

test("Stage 5O guard confirms production patient portal writes boundary", () => {
  const result = collectStage5OChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 17);
});
