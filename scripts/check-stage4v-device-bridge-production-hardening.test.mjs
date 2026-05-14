import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage4VChecks } from "./check-stage4v-device-bridge-production-hardening.mjs";

test("Stage 4V guard validates Device Bridge production hardening contract", () => {
  const result = collectStage4VChecks();

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 18);
});
