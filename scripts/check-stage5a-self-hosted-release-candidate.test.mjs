import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5AChecks } from "./check-stage5a-self-hosted-release-candidate.mjs";

test("Stage 5A guard validates release candidate packaging", () => {
  const result = collectStage5AChecks({ root: process.cwd() });

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 11);
});
