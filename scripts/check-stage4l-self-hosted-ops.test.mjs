import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage4LChecks } from "./check-stage4l-self-hosted-ops.mjs";

test("Stage 4L ops hardening guard passes on repository files", () => {
  const result = collectStage4LChecks({ root: process.cwd() });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 9);
});
