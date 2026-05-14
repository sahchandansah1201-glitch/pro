import assert from "node:assert/strict";
import { test } from "node:test";

import { collectStage5EChecks } from "./check-stage5e-production-auth-bootstrap-ux.mjs";

test("Stage 5E guard validates production auth/bootstrap UX", () => {
  const result = collectStage5EChecks({ root: process.cwd() });

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 10);
});
