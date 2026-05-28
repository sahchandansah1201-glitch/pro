import assert from "node:assert/strict";
import test from "node:test";

import { checkStage48A48Z } from "./check-stage48a-48z-clinical-followup-scope-definition.mjs";

test("Stage 48 guard validates clinical follow-up scope definition", () => {
  const result = checkStage48A48Z(process.cwd());

  assert.equal(result.ok, true, result.errors.join("\n"));
  assert.equal(result.checkedFiles, 15);
});
