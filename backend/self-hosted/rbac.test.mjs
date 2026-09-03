import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AuthRequiredError,
  CLINICAL_MEDIA_READ_ROLES,
  CLINICAL_RECORD_READ_ROLES,
  CLINIC_GOVERNANCE_READ_ROLES,
  CLINIC_OPERATIONS_READ_ROLES,
  ForbiddenError,
  assetWriteScope,
  clinicGovernanceReadScope,
  clinicOperationsReadScope,
  clinicalMediaReadScope,
  clinicalRecordReadScope,
  deviceCommandScope,
  deviceReadScope,
  leadsAppointmentsReadScope,
  leadsAppointmentsWriteScope,
  opsStatusScope,
  patientPortalScope,
  patientPhotoProtocolGovernanceWriteScope,
  patientReadScope,
  patientWriteScope,
  requireAnyRole,
  visitWriteScope,
} from "./rbac.mjs";

test("clinic scopes bind each capability to the clinic where its allowed role is assigned", () => {
  const authContext = {
    userId: "multi-role-user",
    roles: ["clinic_admin", "private_doctor", "assistant", "operator", "doctor"],
    clinicIds: ["clinic-admin", "clinic-private", "clinic-assistant", "clinic-operator", "clinic-doctor"],
    roleBindings: [
      { role: "clinic_admin", clinicId: "clinic-admin" },
      { role: "private_doctor", clinicId: "clinic-private" },
      { role: "assistant", clinicId: "clinic-assistant" },
      { role: "operator", clinicId: "clinic-operator" },
      { role: "doctor", clinicId: "clinic-doctor" },
    ],
  };

  for (const scope of [patientReadScope, clinicalRecordReadScope, clinicalMediaReadScope]) {
    assert.deepEqual(scope(authContext).clinicIds, ["clinic-private", "clinic-assistant", "clinic-doctor"]);
  }
  assert.deepEqual(patientWriteScope(authContext).clinicIds, ["clinic-doctor"]);
  assert.deepEqual(visitWriteScope(authContext).clinicIds, ["clinic-doctor"]);
  assert.deepEqual(assetWriteScope(authContext).clinicIds, ["clinic-private", "clinic-assistant", "clinic-doctor"]);
  assert.deepEqual(clinicOperationsReadScope(authContext).clinicIds, [
    "clinic-admin",
    "clinic-private",
    "clinic-assistant",
    "clinic-doctor",
  ]);
  assert.deepEqual(clinicGovernanceReadScope(authContext).clinicIds, [
    "clinic-admin",
    "clinic-private",
    "clinic-assistant",
    "clinic-doctor",
  ]);
  assert.deepEqual(patientPhotoProtocolGovernanceWriteScope(authContext).clinicIds, [
    "clinic-admin",
    "clinic-doctor",
  ]);
  assert.deepEqual(leadsAppointmentsReadScope(authContext).clinicIds, [
    "clinic-admin",
    "clinic-operator",
    "clinic-doctor",
  ]);
  assert.deepEqual(leadsAppointmentsWriteScope(authContext).clinicIds, [
    "clinic-admin",
    "clinic-operator",
    "clinic-doctor",
  ]);
  assert.deepEqual(deviceReadScope(authContext).clinicIds, ["clinic-admin"]);
  assert.deepEqual(deviceCommandScope(authContext).clinicIds, ["clinic-admin"]);
});

test("explicit empty role bindings fail closed while legacy contexts without bindings retain clinic scope", () => {
  assert.throws(
    () => clinicOperationsReadScope({
      userId: "clinic-admin",
      roles: ["clinic_admin"],
      clinicIds: ["clinic-1"],
      roleBindings: [],
    }),
    ForbiddenError,
  );
  for (const roleBindings of [null, {}, "invalid"]) {
    assert.throws(
      () => clinicOperationsReadScope({
        userId: "malformed-clinic-admin",
        roles: ["clinic_admin"],
        clinicIds: ["clinic-untrusted-union"],
        roleBindings,
      }),
      ForbiddenError,
    );
  }
  for (const roleBindings of [null, {}, "invalid", []]) {
    assert.throws(
      () => clinicalRecordReadScope({
        userId: "malformed-system-admin",
        roles: ["system_admin"],
        clinicIds: [],
        roleBindings,
      }),
      ForbiddenError,
    );
  }
  assert.deepEqual(
    clinicalRecordReadScope({
      userId: "system-admin",
      roles: ["system_admin"],
      clinicIds: [],
      roleBindings: [{ role: "system_admin", clinicId: null }],
    }),
    { allClinics: true, clinicIds: [], roles: ["system_admin"] },
  );
  assert.deepEqual(
    clinicOperationsReadScope({
      userId: "legacy-clinic-admin",
      roles: ["clinic_admin"],
      clinicIds: ["clinic-1"],
    }).clinicIds,
    ["clinic-1"],
  );
  assert.throws(
    () => clinicalRecordReadScope({
      userId: "malformed-private-doctor",
      roles: ["private_doctor"],
      clinicIds: ["clinic-untrusted-union"],
      roleBindings: [
        { role: "private_doctor", clinicId: null },
        { role: "private_doctor", clinicId: undefined },
        { role: "private_doctor", clinicId: "   " },
        { role: "doctor", clinicId: "clinic-role-not-active" },
      ],
    }),
    ForbiddenError,
  );
});

test("capability read scopes deny clinic-admin clinical data but preserve operations", () => {
  const clinicAdmin = {
    userId: "clinic-admin",
    roles: ["clinic_admin"],
    clinicIds: ["clinic-1"],
  };

  assert.throws(() => clinicalRecordReadScope(clinicAdmin), ForbiddenError);
  assert.throws(() => clinicalMediaReadScope(clinicAdmin), ForbiddenError);
  assert.deepEqual(clinicOperationsReadScope(clinicAdmin), {
    allClinics: false,
    clinicIds: ["clinic-1"],
    roles: ["clinic_admin"],
  });
  assert.deepEqual(clinicGovernanceReadScope(clinicAdmin), {
    allClinics: false,
    clinicIds: ["clinic-1"],
    roles: ["clinic_admin"],
  });
  assert.notStrictEqual(CLINICAL_RECORD_READ_ROLES, CLINICAL_MEDIA_READ_ROLES);
  assert.notStrictEqual(CLINIC_GOVERNANCE_READ_ROLES, CLINIC_OPERATIONS_READ_ROLES);
  assert.deepEqual(CLINICAL_RECORD_READ_ROLES, ["system_admin", "doctor", "private_doctor", "assistant"]);
  assert.deepEqual(CLINICAL_MEDIA_READ_ROLES, ["system_admin", "doctor", "private_doctor", "assistant"]);
  assert.deepEqual(CLINIC_OPERATIONS_READ_ROLES, ["system_admin", "clinic_admin", "doctor", "private_doctor", "assistant"]);
  assert.deepEqual(CLINIC_GOVERNANCE_READ_ROLES, CLINIC_OPERATIONS_READ_ROLES);

  const multiRole = { ...clinicAdmin, roles: ["clinic_admin", "private_doctor"] };
  assert.deepEqual(clinicalRecordReadScope(multiRole), {
    allClinics: false,
    clinicIds: ["clinic-1"],
    roles: ["clinic_admin", "private_doctor"],
  });

  for (const scope of [
    clinicalRecordReadScope,
    clinicalMediaReadScope,
    clinicOperationsReadScope,
    clinicGovernanceReadScope,
  ]) {
    assert.deepEqual(scope({ userId: "root", roles: ["system_admin"], clinicIds: [] }), {
      allClinics: true,
      clinicIds: [],
      roles: ["system_admin"],
    });
    assert.throws(() => scope({ userId: "u", roles: ["operator"], clinicIds: ["clinic-1"] }), ForbiddenError);
    assert.throws(() => scope({ userId: "u", roles: ["patient"], clinicIds: ["clinic-1"] }), ForbiddenError);
    assert.throws(() => scope({ userId: "u", roles: ["doctor"], clinicIds: [] }), ForbiddenError);
  }
});

test("requireAnyRole rejects anonymous and disallowed roles", () => {
  assert.throws(() => requireAnyRole(null, ["doctor"]), AuthRequiredError);
  assert.throws(
    () => requireAnyRole({ userId: "u", roles: ["operator"] }, ["doctor"]),
    ForbiddenError,
  );
});

test("patientWriteScope denies clinic admins and keeps system-admin write behavior", () => {
  assert.throws(
    () => patientWriteScope({
      userId: "u",
      roles: ["clinic_admin"],
      clinicIds: ["clinic-1", "clinic-2"],
    }),
    ForbiddenError,
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

  assert.throws(
    () => patientReadScope({
      userId: "clinic-admin",
      roles: ["clinic_admin"],
      clinicIds: ["clinic-1"],
    }),
    ForbiddenError,
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
