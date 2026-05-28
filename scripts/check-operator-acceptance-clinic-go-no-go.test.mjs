import test from "node:test";
import assert from "node:assert/strict";

import { checkOperatorAcceptanceClinicGoNoGo } from "./check-operator-acceptance-clinic-go-no-go.mjs";

test("operator acceptance clinic go/no-go guard passes repository state", () => {
  const result = checkOperatorAcceptanceClinicGoNoGo(process.cwd());
  assert.deepEqual(result.errors, []);
  assert.equal(result.checkedFiles, 17);
  assert.equal(result.ok, true);
});
