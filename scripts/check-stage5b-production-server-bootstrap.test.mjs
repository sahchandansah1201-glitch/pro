import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5BChecks } from "./check-stage5b-production-server-bootstrap.mjs";

test("Stage 5B guard validates production server bootstrap packaging", () => {
  const result = collectStage5BChecks({ root: process.cwd() });

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 10);
});
