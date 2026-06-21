import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage4MChecks } from "./check-stage4m-production-deploy.mjs";

test("Stage 4M production deployment guard passes on repository files", () => {
  const result = collectStage4MChecks({ root: process.cwd() });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 11);
});
