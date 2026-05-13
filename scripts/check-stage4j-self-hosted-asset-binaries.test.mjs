import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage4JChecks } from "./check-stage4j-self-hosted-asset-binaries.mjs";

test("Stage 4J guard passes on the repository files", () => {
  const result = collectStage4JChecks({ root: process.cwd() });
  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 13);
});
