import test from "node:test";
import assert from "node:assert/strict";

import { checkExternalClinicOperatorExecutionRecord } from "./check-external-clinic-operator-execution-record.mjs";

test("external clinic operator execution record guard passes repository state", () => {
  const result = checkExternalClinicOperatorExecutionRecord(process.cwd());
  assert.deepEqual(result.errors, []);
  assert.equal(result.checkedFiles, 18);
  assert.equal(result.ok, true);
});
