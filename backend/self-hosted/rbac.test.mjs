import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AuthRequiredError,
  ForbiddenError,
  patientReadScope,
  patientWriteScope,
  requireAnyRole,
  visitWriteScope,
} from "./rbac.mjs";

test("requireAnyRole rejects anonymous and disallowed roles", () => {
  assert.throws(() => requireAnyRole(null, ["doctor"]), AuthRequiredError);
  assert.throws(
    () => requireAnyRole({ userId: "u", roles: ["operator"] }, ["doctor"]),
    ForbiddenError,
  );
});

test("patientWriteScope mirrors patient read clinic scoping for mutating routes", () => {
  assert.deepEqual(
    patientWriteScope({
      userId: "u",
      roles: ["clinic_admin"],
      clinicIds: ["clinic-1", "clinic-2"],
    }),
    {
      allClinics: false,
      clinicIds: ["clinic-1", "clinic-2"],
      roles: ["clinic_admin"],
    },
  );

  assert.deepEqual(
    patientWriteScope({
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

  assert.throws(
    () => patientWriteScope({ userId: "u", roles: ["assistant"], clinicIds: ["clinic-1"] }),
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

test("visitWriteScope allows doctors/system admins and rejects clinic admins/operators", () => {
  assert.deepEqual(
    visitWriteScope({
      userId: "doctor-1",
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
    visitWriteScope({
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

  assert.throws(
    () => visitWriteScope({ userId: "clinic-admin", roles: ["clinic_admin"], clinicIds: ["clinic-1"] }),
    ForbiddenError,
  );
  assert.throws(
    () => visitWriteScope({ userId: "operator", roles: ["operator"], clinicIds: ["clinic-1"] }),
    ForbiddenError,
  );
});
