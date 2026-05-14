import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage4WChecks } from "./check-stage4w-device-bridge-command-safety.mjs";

test("Stage 4W guard validates Device Bridge command safety contract", () => {
  const result = collectStage4WChecks();

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 18);
});
