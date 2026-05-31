import assert from "node:assert/strict";
import { test } from "node:test";

import { ForbiddenError } from "./rbac.mjs";
import { createPatientPhotoProtocolReleaseService } from "./patient-photo-protocol-release-service.mjs";

const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000101";

const doctorAuth = {
  userId: USER_ID,
  roles: ["doctor"],
  clinicIds: [CLINIC_ID],
};

function release(overrides = {}) {
  return {
    id: "20000000-0000-4000-8000-000000000001",
    clinicId: CLINIC_ID,
    patientId: "10000000-0000-4000-8000-000000000201",
    visitId: VISIT_ID,
    status: "prepared",
    selectedPhotoCount: 2,
    blockers: ["self_hosted_photo_delivery_contract_missing"],
    deliveryBoundary: { patientDeliveryAllowed: false },
    ...overrides,
  };
}

test("Batch R service prepares release ledger and writes aggregate audit metadata", async () => {
  const auditEvents = [];
  const service = createPatientPhotoProtocolReleaseService({
    patientPhotoProtocolReleaseRepository: {
      async prepareRelease() {
        return release();
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-1" };
      },
    },
  });
  const result = await service.prepareRelease(
    VISIT_ID,
    { expiresAt: "2026-06-07T10:00:00.000Z" },
    doctorAuth,
    { correlationId: "corr-r" },
  );
  assert.equal(result.release.status, "prepared");
  assert.equal(result.release.deliveryBoundary.patientDeliveryAllowed, false);
  assert.equal(auditEvents[0].action, "patient_photo_protocol.release.prepare");
  assert.deepEqual(auditEvents[0].metadata, {
    visitId: VISIT_ID,
    status: "prepared",
    selectedPhotoCount: 2,
    blockerCount: 1,
    patientDeliveryAllowed: false,
  });
});

test("Batch R service revokes release ledger and requires doctor write scope", async () => {
  const auditEvents = [];
  const service = createPatientPhotoProtocolReleaseService({
    patientPhotoProtocolReleaseRepository: {
      async revokeRelease() {
        return release({ status: "revoked", revokeReason: "Пациент попросил закрыть доступ" });
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-2" };
      },
    },
  });
  const result = await service.revokeRelease(
    VISIT_ID,
    { reason: "Пациент попросил закрыть доступ" },
    doctorAuth,
    { correlationId: "corr-revoke" },
  );
  assert.equal(result.release.status, "revoked");
  assert.equal(auditEvents[0].action, "patient_photo_protocol.release.revoke");
  assert.equal(auditEvents[0].metadata.reasonPresent, true);

  await assert.rejects(
    () => service.revokeRelease(VISIT_ID, { reason: "x" }, { userId: USER_ID, roles: ["operator"], clinicIds: [CLINIC_ID] }),
    ForbiddenError,
  );
});
