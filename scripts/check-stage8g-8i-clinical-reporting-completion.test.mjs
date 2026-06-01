import assert from "node:assert/strict";
import { test } from "node:test";

import { checkStage8G8I } from "./check-stage8g-8i-clinical-reporting-completion.mjs";

test("Stage 8G-8I guard passes on repository files", () => {
  const result = checkStage8G8I(process.cwd());
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 24);
});
