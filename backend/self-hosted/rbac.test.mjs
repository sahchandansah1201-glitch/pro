import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AuthRequiredError,
  ForbiddenError,
  assetWriteScope,
  deviceCommandScope,
  deviceReadScope,
  leadsAppointmentsReadScope,
  leadsAppointmentsWriteScope,
  opsStatusScope,
  patientPortalScope,
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

  assert.deepEqual(
    patientReadScope({
      userId: "assistant-1",
      roles: ["assistant"],
      clinicIds: ["clinic-1"],
    }),
    {
      allClinics: false,
      clinicIds: ["clinic-1"],
      roles: ["assistant"],
    },
  );
});

test("patientPortalScope allows only linked patient role identity", () => {
  assert.deepEqual(
    patientPortalScope({
      userId: "patient-user",
      roles: ["patient"],
      clinicIds: [],
    }),
    {
      userId: "patient-user",
      roles: ["patient"],
    },
  );

  assert.throws(
    () => patientPortalScope({ userId: "doctor", roles: ["doctor"], clinicIds: ["clinic-1"] }),
    ForbiddenError,
  );
  assert.throws(() => patientPortalScope(null), AuthRequiredError);
});

test("visitWriteScope allows doctors/system admins and rejects clinic admins/operators/assistants", () => {
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
  assert.throws(
    () => visitWriteScope({ userId: "assistant", roles: ["assistant"], clinicIds: ["clinic-1"] }),
    ForbiddenError,
  );
});

test("assetWriteScope allows capture roles without broadening visit write scope", () => {
  assert.deepEqual(
    assetWriteScope({
      userId: "assistant-1",
      roles: ["assistant"],
      clinicIds: ["clinic-1"],
    }),
    {
      allClinics: false,
      clinicIds: ["clinic-1"],
      roles: ["assistant"],
    },
  );

  assert.deepEqual(
    assetWriteScope({
      userId: "private-doctor",
      roles: ["private_doctor"],
      clinicIds: ["practice-1"],
    }),
    {
      allClinics: false,
      clinicIds: ["practice-1"],
      roles: ["private_doctor"],
    },
  );

  assert.deepEqual(
    assetWriteScope({
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
    () => assetWriteScope({ userId: "operator", roles: ["operator"], clinicIds: ["clinic-1"] }),
    ForbiddenError,
  );
  assert.throws(
    () => assetWriteScope({ userId: "clinic-admin", roles: ["clinic_admin"], clinicIds: ["clinic-1"] }),
    ForbiddenError,
  );
});

test("opsStatusScope is restricted to system_admin", () => {
  assert.deepEqual(
    opsStatusScope({
      userId: "admin",
      roles: ["system_admin"],
      clinicIds: [],
    }),
    {
      roles: ["system_admin"],
    },
  );

  assert.throws(
    () => opsStatusScope({ userId: "doctor", roles: ["doctor"], clinicIds: ["clinic-1"] }),
    ForbiddenError,
  );
  assert.throws(() => opsStatusScope(null), AuthRequiredError);
});

test("deviceReadScope allows system admins globally and clinic admins by clinic", () => {
  assert.deepEqual(
    deviceReadScope({
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

  assert.deepEqual(
    deviceReadScope({
      userId: "clinic-admin",
      roles: ["clinic_admin"],
      clinicIds: ["clinic-1"],
    }),
    {
      allClinics: false,
      clinicIds: ["clinic-1"],
      roles: ["clinic_admin"],
    },
  );

  assert.throws(
    () => deviceReadScope({ userId: "doctor", roles: ["doctor"], clinicIds: ["clinic-1"] }),
    ForbiddenError,
  );
  assert.throws(
    () => deviceReadScope({ userId: "clinic-admin", roles: ["clinic_admin"], clinicIds: [] }),
    ForbiddenError,
  );
});

test("leadsAppointmentsReadScope allows clinic intake roles and rejects assistants", () => {
  assert.deepEqual(
    leadsAppointmentsReadScope({
      userId: "operator",
      roles: ["operator"],
      clinicIds: ["clinic-1"],
    }),
    {
      allClinics: false,
      clinicIds: ["clinic-1"],
      roles: ["operator"],
    },
  );

  assert.deepEqual(
    leadsAppointmentsReadScope({
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
    () => leadsAppointmentsReadScope({ userId: "assistant", roles: ["assistant"], clinicIds: ["clinic-1"] }),
    ForbiddenError,
  );
});

test("leadsAppointmentsWriteScope allows intake writes and rejects assistants", () => {
  assert.deepEqual(
    leadsAppointmentsWriteScope({
      userId: "operator",
      roles: ["operator"],
      clinicIds: ["clinic-1"],
    }),
    {
      allClinics: false,
      clinicIds: ["clinic-1"],
      roles: ["operator"],
    },
  );

  assert.deepEqual(
    leadsAppointmentsWriteScope({
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
    () => leadsAppointmentsWriteScope({ userId: "assistant", roles: ["assistant"], clinicIds: ["clinic-1"] }),
    ForbiddenError,
  );
});

test("deviceCommandScope allows system admins and clinic admins but rejects clinical roles", () => {
  assert.deepEqual(
    deviceCommandScope({
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

  assert.deepEqual(
    deviceCommandScope({
      userId: "clinic-admin",
      roles: ["clinic_admin"],
      clinicIds: ["clinic-1"],
    }),
    {
      allClinics: false,
      clinicIds: ["clinic-1"],
      roles: ["clinic_admin"],
    },
  );

  assert.throws(
    () => deviceCommandScope({ userId: "doctor", roles: ["doctor"], clinicIds: ["clinic-1"] }),
    ForbiddenError,
  );
  assert.throws(
    () => deviceCommandScope({ userId: "operator", roles: ["operator"], clinicIds: ["clinic-1"] }),
    ForbiddenError,
  );
});
