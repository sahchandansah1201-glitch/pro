import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage4IChecks } from "./check-stage4i-self-hosted-assets.mjs";

test("Stage 4I guard passes for the repository", () => {
  const result = collectStage4IChecks({ root: process.cwd() });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 17);
});
