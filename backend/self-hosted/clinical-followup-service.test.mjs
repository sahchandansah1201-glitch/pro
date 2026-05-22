import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createClinicalFollowUpService,
  normalizeClinicalFollowUpCreatePayload,
  normalizeClinicalFollowUpMessagePayload,
  normalizeClinicalFollowUpUpdatePayload,
} from "./clinical-followup-service.mjs";
import { ForbiddenError } from "./rbac.mjs";

const DOCTOR = {
  userId: "10000000-0000-4000-8000-000000000101",
  roles: ["doctor"],
  clinicIds: ["10000000-0000-4000-8000-000000000001"],
};
const PATIENT = {
  userId: "10000000-0000-4000-8000-000000000901",
  roles: ["patient"],
  clinicIds: [],
};
const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const FOLLOW_UP_ID = "10000000-0000-4000-8000-000000000701";

function createService({ repositoryOverrides = {}, auditEvents = [] } = {}) {
  const followUp = {
    id: FOLLOW_UP_ID,
    clinicId: "10000000-0000-4000-8000-000000000001",
    patientId: "10000000-0000-4000-8000-000000000201",
    visitId: VISIT_ID,
    status: "planned",
    priority: "normal",
    reason: "Контроль",
  };
  return createClinicalFollowUpService({
    clinicalFollowUpRepository: {
      async listClinicalFollowUps() {
        return { items: [followUp], limit: 50, offset: 0, source: "postgres" };
      },
      async createClinicalFollowUp() {
        return followUp;
      },
      async updateClinicalFollowUp() {
        return { ...followUp, status: "completed" };
      },
      async createClinicalFollowUpMessage() {
        return { id: "message-1", followUpId: FOLLOW_UP_ID, patientVisible: true };
      },
      async listPatientFollowUps() {
        return { items: [{ id: FOLLOW_UP_ID, reason: "Контроль" }], source: "postgres" };
      },
      async createPatientFollowUpMessage() {
        return { id: "message-2", followUpId: FOLLOW_UP_ID, direction: "patient_to_clinic" };
      },
      ...repositoryOverrides,
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: `audit-${auditEvents.length}` };
      },
    },
  });
}

test("validates create, update, and message payloads", () => {
  assert.deepEqual(
    normalizeClinicalFollowUpCreatePayload({
      dueAt: "2026-05-30T10:00:00.000Z",
      reason: "  Контроль  ",
      priority: "urgent",
    }),
    {
      dueAt: "2026-05-30T10:00:00.000Z",
      reason: "Контроль",
      patientSummary: null,
      internalNote: null,
      priority: "urgent",
      assignedUserId: null,
    },
  );

  assert.deepEqual(normalizeClinicalFollowUpUpdatePayload({ status: "completed" }), {
    status: "completed",
  });
  assert.deepEqual(normalizeClinicalFollowUpMessagePayload({ body: " Ответ " }), {
    body: "Ответ",
    patientVisible: true,
  });
  assert.throws(() => normalizeClinicalFollowUpCreatePayload({ reason: "" }), /validation/i);
  assert.throws(() => normalizeClinicalFollowUpUpdatePayload({}), /validation/i);
});

test("doctor can create, update, list, and message clinical follow-ups with audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const created = await service.createClinicalFollowUp(
    VISIT_ID,
    { dueAt: "2026-05-30T10:00:00.000Z", reason: "Контроль" },
    DOCTOR,
    { correlationId: "corr-1" },
  );
  const listed = await service.listClinicalFollowUps({ status: "planned" }, DOCTOR, { correlationId: "corr-2" });
  const updated = await service.updateClinicalFollowUp(
    FOLLOW_UP_ID,
    { status: "completed" },
    DOCTOR,
    { correlationId: "corr-3" },
  );
  const message = await service.createClinicalFollowUpMessage(
    FOLLOW_UP_ID,
    { body: "Контроль назначен." },
    DOCTOR,
    { correlationId: "corr-4" },
  );

  assert.equal(created.followUp.id, FOLLOW_UP_ID);
  assert.equal(listed.result.items.length, 1);
  assert.equal(updated.followUp.status, "completed");
  assert.equal(message.message.patientVisible, true);
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    [
      "clinical_follow_up.create",
      "clinical_follow_up.list",
      "clinical_follow_up.update",
      "clinical_follow_up.message.create",
    ],
  );
});

test("patient can list visible follow-ups and reply through portal scope", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });
  const list = await service.listPatientFollowUps(PATIENT, { correlationId: "corr-5" });
  const message = await service.createPatientFollowUpMessage(
    FOLLOW_UP_ID,
    { body: "Подтверждаю." },
    PATIENT,
    { correlationId: "corr-6" },
  );

  assert.equal(list.result.items[0].id, FOLLOW_UP_ID);
  assert.equal(message.message.direction, "patient_to_clinic");
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    ["patient_portal.follow_up.list", "patient_portal.follow_up.message.create"],
  );
});

test("operator cannot mutate clinical follow-ups and missing rows map to 404", async () => {
  const service = createService({
    repositoryOverrides: {
      async createClinicalFollowUp() {
        return null;
      },
    },
  });
  await assert.rejects(
    () => service.createClinicalFollowUp(
      VISIT_ID,
      { dueAt: "2026-05-30T10:00:00.000Z", reason: "Контроль" },
      { ...DOCTOR, roles: ["operator"] },
    ),
    ForbiddenError,
  );
  await assert.rejects(
    () => service.createClinicalFollowUp(
      VISIT_ID,
      { dueAt: "2026-05-30T10:00:00.000Z", reason: "Контроль" },
      DOCTOR,
    ),
    /Visit was not found/i,
  );
});
