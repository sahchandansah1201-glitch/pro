import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage4KChecks } from "./check-stage4k-self-hosted-deploy-smoke.mjs";

test("Stage 4K guard passes on repository files", () => {
  const result = collectStage4KChecks({ root: process.cwd() });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 9);
});
