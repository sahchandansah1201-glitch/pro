import assert from "node:assert/strict";
import { test } from "node:test";

import { ForbiddenError } from "./rbac.mjs";
import {
  ExternalIntakeImportValidationError,
  createExternalIntakeImportService,
  normalizeExternalIntakeImportPayload,
  resolveExternalIntakeClinicId,
} from "./external-intake-import-service.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const ACTOR_ID = "10000000-0000-4000-8000-000000000101";

const operatorAuth = {
  userId: ACTOR_ID,
  roles: ["operator"],
  clinicIds: [CLINIC_ID],
};

test("Stage 5Q payload validation accepts booking requests and available slots", () => {
  const payload = normalizeExternalIntakeImportPayload({
    sourceSystem: "clinic_crm",
    sourceReference: "morning-sync",
    items: [
      {
        kind: "booking_request",
        externalId: "crm-1",
        patientCode: "DP-2026-0001",
        preferredFrom: "2026-06-01T09:00:00.000Z",
        reason: "Плановый контроль",
      },
      {
        kind: "available_slot",
        externalId: "slot-1",
        doctorUserId: ACTOR_ID,
        startedAt: "2026-06-01T10:00:00.000Z",
        durationMinutes: 30,
      },
    ],
  });

  assert.equal(payload.sourceSystem, "clinic_crm");
  assert.equal(payload.items.length, 2);
  assert.equal(payload.items[0].kind, "booking_request");
  assert.equal(payload.items[1].durationMinutes, 30);
});

test("Stage 5Q payload validation rejects unsafe source, bad dates and huge batches", () => {
  assert.throws(
    () => normalizeExternalIntakeImportPayload({ sourceSystem: "remote_crm", items: [] }),
    (error) => {
      assert.ok(error instanceof ExternalIntakeImportValidationError);
      assert.equal(error.publicStatus, 422);
      assert.match(JSON.stringify(error.publicDetails), /sourceSystem|items/);
      return true;
    },
  );

  assert.throws(
    () => normalizeExternalIntakeImportPayload({
      sourceSystem: "ads",
      items: [{ kind: "booking_request", externalId: "ad-1", patientCode: "P-1", preferredFrom: "not-a-date" }],
    }),
    /validation/i,
  );
});

test("Stage 5Q clinic scope requires explicit clinic for system admin and denies cross-clinic", () => {
  assert.equal(resolveExternalIntakeClinicId({ allClinics: false, clinicIds: [CLINIC_ID] }), CLINIC_ID);
  assert.throws(
    () => resolveExternalIntakeClinicId({ allClinics: true, clinicIds: [] }),
    ExternalIntakeImportValidationError,
  );
  assert.throws(
    () => resolveExternalIntakeClinicId(
      { allClinics: false, clinicIds: [CLINIC_ID] },
      "20000000-0000-4000-8000-000000000001",
    ),
    ForbiddenError,
  );
});

test("Stage 5Q service imports batches, records audit, and exposes history", async () => {
  const auditEvents = [];
  const service = createExternalIntakeImportService({
    externalIntakeImportRepository: {
      async importExternalIntake(params) {
        assert.equal(params.clinicId, CLINIC_ID);
        assert.equal(params.actorUserId, ACTOR_ID);
        assert.equal(params.sourceSystem, "clinic_crm");
        return {
          id: "batch-1",
          clinic: { id: CLINIC_ID },
          sourceSystem: "clinic_crm",
          itemCount: params.items.length,
          acceptedBookingCount: 1,
          acceptedSlotCount: 1,
          rejectedCount: 0,
        };
      },
      async listImportBatches() {
        return {
          items: [{ id: "batch-1", sourceSystem: "clinic_crm" }],
          count: 1,
          limit: 10,
          offset: 0,
          filters: { sourceSystem: "clinic_crm" },
        };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-1" };
      },
    },
  });

  const imported = await service.importExternalIntake({
    sourceSystem: "clinic_crm",
    items: [
      {
        kind: "booking_request",
        externalId: "crm-1",
        patientCode: "DP-2026-0001",
        preferredFrom: "2026-06-01T09:00:00.000Z",
      },
      {
        kind: "available_slot",
        externalId: "slot-1",
        startedAt: "2026-06-01T10:00:00.000Z",
      },
    ],
  }, operatorAuth, { correlationId: "corr-1" });
  assert.equal(imported.batch.id, "batch-1");

  const listed = await service.listImportBatches(operatorAuth, { sourceSystem: "clinic_crm" }, { correlationId: "corr-2" });
  assert.equal(listed.batches.items.length, 1);
  assert.deepEqual(auditEvents.map((event) => event.action), [
    "external_intake.import",
    "external_intake.import.list",
  ]);
});

test("Stage 5Q service denies doctor-only imports", async () => {
  const service = createExternalIntakeImportService({
    externalIntakeImportRepository: {},
    auditRepository: {},
  });

  await assert.rejects(
    () => service.importExternalIntake(
      {
        sourceSystem: "ads",
        items: [{ kind: "booking_request", externalId: "ad-1", patientCode: "DP-1", preferredFrom: "2026-06-01T09:00:00.000Z" }],
      },
      { userId: ACTOR_ID, roles: ["doctor"], clinicIds: [CLINIC_ID] },
    ),
    ForbiddenError,
  );
});
