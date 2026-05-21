import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage8A8CChecks } from "./check-stage8a-8c-crm-inbound-adapter.mjs";

test("Stage 8A-8C guard passes on repository files", () => {
  const result = collectStage8A8CChecks();
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 10);
});
