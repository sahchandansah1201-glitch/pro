import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createPatientWriteService,
  normalizeCreatePatientPayload,
  normalizeUpdatePatientPayload,
  PatientNotFoundError,
  PatientValidationError,
  resolvePatientWriteClinicId,
} from "./patient-write-service.mjs";
import { ForbiddenError } from "./rbac.mjs";

const AUTH_CONTEXT = {
  userId: "10000000-0000-4000-8000-000000000101",
  roles: ["doctor"],
  clinicIds: ["10000000-0000-4000-8000-000000000001"],
};

const PATIENT = {
  id: "10000000-0000-4000-8000-000000000201",
  code: "DP-1",
  fullName: "Demo Patient",
  clinic: {
    id: "10000000-0000-4000-8000-000000000001",
    slug: "demo-clinic",
    name: "Demo Clinic",
  },
};

test("normalizes and validates patient create/update payloads", () => {
  const createPayload = normalizeCreatePatientPayload({
    fullName: "  Demo   Patient  ",
    birthDate: "1984-02-14",
    sex: "female",
    phototype: "II",
    imagingConsent: true,
  });
  assert.equal(createPayload.fullName, "Demo Patient");
  assert.equal(createPayload.imagingConsent, true);

  assert.throws(
    () => normalizeCreatePatientPayload({ fullName: "Only", birthDate: "1899-01-01" }),
    PatientValidationError,
  );
  assert.throws(
    () => normalizeCreatePatientPayload({ fullName: "Demo Patient", imagingConsent: "false" }),
    PatientValidationError,
  );
  assert.deepEqual(normalizeUpdatePatientPayload({ notes: "  follow up  " }), {
    notes: "follow up",
  });
  assert.throws(() => normalizeUpdatePatientPayload({}), PatientValidationError);
});

test("resolvePatientWriteClinicId enforces clinic scoping", () => {
  assert.equal(
    resolvePatientWriteClinicId(
      { allClinics: false, clinicIds: ["clinic-1"], roles: ["doctor"] },
      null,
    ),
    "clinic-1",
  );
  assert.throws(
    () =>
      resolvePatientWriteClinicId(
        { allClinics: false, clinicIds: ["clinic-1"], roles: ["doctor"] },
        "clinic-2",
      ),
    ForbiddenError,
  );
  assert.throws(
    () => resolvePatientWriteClinicId({ allClinics: true, clinicIds: [], roles: ["system_admin"] }),
    PatientValidationError,
  );
});

test("create/update/archive patient writes call repository and append audit events", async () => {
  const calls = [];
  const auditEvents = [];
  const service = createPatientWriteService({
    patientRepository: {
      async createPatient(input) {
        calls.push(["create", input]);
        return PATIENT;
      },
      async updatePatient(input) {
        calls.push(["update", input]);
        return { ...PATIENT, fullName: input.changes.fullName };
      },
      async archivePatient(input) {
        calls.push(["archive", input]);
        return { ...PATIENT, deletedAt: "2026-05-13T00:00:00.000Z" };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-1" };
      },
    },
  });

  const created = await service.createPatient(
    { fullName: "Demo Patient", birthDate: "1984-02-14" },
    AUTH_CONTEXT,
    { correlationId: "corr-1" },
  );
  assert.equal(created.patient.id, PATIENT.id);
  assert.equal(calls[0][0], "create");
  assert.equal(calls[0][1].clinicId, AUTH_CONTEXT.clinicIds[0]);
  assert.equal(auditEvents[0].action, "patient.create");

  const updated = await service.updatePatient(
    PATIENT.id,
    { fullName: "Updated Patient" },
    AUTH_CONTEXT,
    { correlationId: "corr-2" },
  );
  assert.equal(updated.patient.fullName, "Updated Patient");
  assert.equal(calls[1][0], "update");
  assert.deepEqual(auditEvents[1].metadata.changedFields, ["fullName"]);

  const archived = await service.archivePatient(
    PATIENT.id,
    { reason: "duplicate local record" },
    AUTH_CONTEXT,
    { correlationId: "corr-3" },
  );
  assert.equal(archived.patient.deletedAt, "2026-05-13T00:00:00.000Z");
  assert.equal(auditEvents[2].action, "patient.archive");
  assert.equal(auditEvents[2].metadata.reason, "duplicate local record");
});

test("write service maps missing rows to patient_not_found", async () => {
  const service = createPatientWriteService({
    patientRepository: {
      async updatePatient() {
        return null;
      },
    },
    auditRepository: {
      async recordEvent() {
        throw new Error("should not audit missing rows");
      },
    },
  });

  await assert.rejects(
    () => service.updatePatient(PATIENT.id, { fullName: "Updated Patient" }, AUTH_CONTEXT),
    PatientNotFoundError,
  );
});
