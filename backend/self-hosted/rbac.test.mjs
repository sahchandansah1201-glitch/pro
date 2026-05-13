import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AuthRequiredError,
  ForbiddenError,
  patientReadScope,
  requireAnyRole,
} from "./rbac.mjs";

test("requireAnyRole rejects anonymous and disallowed roles", () => {
  assert.throws(() => requireAnyRole(null, ["doctor"]), AuthRequiredError);
  assert.throws(
    () => requireAnyRole({ userId: "u", roles: ["operator"] }, ["doctor"]),
    ForbiddenError,
  );
});

test("patientReadScope scopes clinic roles and allows system_admin globally", () => {
  assert.deepEqual(
    patientReadScope({
      userId: "u",
      roles: ["doctor"],
      clinicIds: ["clinic-1"],
    }),
    {
      allClinics: false,
      clinicIds: ["clinic-1"],
      roles: ["doctor"],
    },
  );

  assert.deepEqual(
    patientReadScope({
      userId: "admin",
      roles: ["system_admin"],
      clinicIds: [],
    }),
    {
      allClinics: true,
      clinicIds: [],
      roles: ["system_admin"],
    },
  );
});
