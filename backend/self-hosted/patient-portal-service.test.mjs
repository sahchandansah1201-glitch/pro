import assert from "node:assert/strict";
import { test } from "node:test";

import { createPatientPortalService } from "./patient-portal-service.mjs";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const VISIT_ID = "33333333-3333-4333-8333-333333333333";

function createService(overrides = {}) {
  const auditEvents = [];
  const service = createPatientPortalService({
    patientPortalRepository: {
      async getOverview({ userId }) {
        return overrides.overview || {
          patient: { id: "p-1", clinic: { id: "c-1" } },
          reports: [],
          reminders: [],
          userId,
        };
      },
      async getReport({ reportId }) {
        return overrides.report === null
          ? null
          : overrides.report || {
              id: reportId,
              visitId: "v-1",
              patientSafeText: "Отчёт для пациента",
              clinic: { id: "c-1" },
            };
      },
      async getPhotoProtocol({ visitId }) {
        return overrides.photoProtocol === null
          ? null
          : overrides.photoProtocol || {
              id: "ppr-1",
              visitId,
              reportId: REPORT_ID,
              status: "prepared",
              selectedPhotoCount: 2,
              counts: {
                selectedPhotos: 2,
                overviewPhotos: 1,
                dermoscopyPhotos: 1,
                reportAttachments: 0,
              },
              clinic: { id: "c-1" },
              deliveryBoundary: {
                patientDeliveryAllowed: false,
              },
              photos: [{ sequence: 1, kind: "overview_photo", previewAvailable: false }],
            };
      },
      async createBookingRequest() {
        return overrides.bookingRequest === null
          ? null
          : overrides.bookingRequest || {
              id: "br-1",
              status: "requested",
              preferredFrom: "2026-06-15T10:00:00.000Z",
              reason: "Плановый контроль",
              clinic: { id: "c-1" },
            };
      },
      async updateReminderPreferences() {
        return overrides.reminderPreferences === null
          ? null
          : overrides.reminderPreferences || {
              appointmentRemindersEnabled: false,
              reportNotificationsEnabled: true,
              preferredChannel: "phone",
            };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
      },
    },
  });
  return { service, auditEvents };
}

test("Stage 5N service allows patient role and audits overview/report reads", async () => {
  const { service, auditEvents } = createService();
  const authContext = { userId: USER_ID, roles: ["patient"] };

  const overview = await service.getOverview(authContext, { correlationId: "corr-1" });
  const report = await service.getReport(REPORT_ID, authContext, { correlationId: "corr-2" });
  const photoProtocol = await service.getPhotoProtocol(VISIT_ID, authContext, { correlationId: "corr-5" });

  assert.equal(overview.scope.userId, USER_ID);
  assert.equal(report.report.patientSafeText, "Отчёт для пациента");
  assert.equal(photoProtocol.photoProtocol.deliveryBoundary.patientDeliveryAllowed, false);
  assert.deepEqual(auditEvents.map((event) => event.action), [
    "patient_portal.overview.read",
    "patient_portal.report.read",
    "patient_portal.photo_protocol.read",
  ]);
});

test("Stage 5O service allows patient-owned booking requests and reminder preferences", async () => {
  const { service, auditEvents } = createService();
  const authContext = { userId: USER_ID, roles: ["patient"] };

  const booking = await service.createBookingRequest(
    {
      preferredFrom: "2026-06-15T10:00:00.000Z",
      reason: "Плановый контроль",
    },
    authContext,
    { correlationId: "corr-3" },
  );
  const preferences = await service.updateReminderPreferences(
    {
      appointmentRemindersEnabled: false,
      reportNotificationsEnabled: true,
      preferredChannel: "phone",
    },
    authContext,
    { correlationId: "corr-4" },
  );

  assert.equal(booking.bookingRequest.status, "requested");
  assert.equal(preferences.reminderPreferences.preferredChannel, "phone");
  assert.deepEqual(auditEvents.map((event) => event.action), [
    "patient_portal.booking_request.create",
    "patient_portal.reminder_preferences.update",
  ]);
});

test("Stage 5O service validates booking requests and reminder preferences", async () => {
  const { service } = createService();
  const authContext = { userId: USER_ID, roles: ["patient"] };

  await assert.rejects(
    () => service.createBookingRequest({ preferredFrom: "bad", reason: "" }, authContext),
    (error) => error.publicCode === "validation_error" && error.publicStatus === 422,
  );
  await assert.rejects(
    () => service.updateReminderPreferences({ preferredChannel: "sms" }, authContext),
    (error) => error.publicCode === "validation_error" && error.publicStatus === 422,
  );
});

test("Stage 5N service denies non-patient roles", async () => {
  const { service } = createService();
  await assert.rejects(
    () => service.getOverview({ userId: USER_ID, roles: ["doctor"] }),
    /access/,
  );
});

test("Stage 5N service validates report id and maps missing report to public 404", async () => {
  const { service } = createService({ report: null });
  const authContext = { userId: USER_ID, roles: ["patient"] };

  await assert.rejects(
    () => service.getReport("bad-id", authContext),
    (error) => error.publicCode === "invalid_uuid" && error.publicStatus === 400,
  );
  await assert.rejects(
    () => service.getReport(REPORT_ID, authContext),
    (error) => error.publicCode === "not_found" && error.publicStatus === 404,
  );
});

test("Stage 5N service validates photo protocol visit id and maps missing protocol to public 404", async () => {
  const { service } = createService({ photoProtocol: null });
  const authContext = { userId: USER_ID, roles: ["patient"] };

  await assert.rejects(
    () => service.getPhotoProtocol("bad-id", authContext),
    (error) => error.publicCode === "invalid_uuid" && error.publicStatus === 400,
  );
  await assert.rejects(
    () => service.getPhotoProtocol(VISIT_ID, authContext),
    (error) => error.publicCode === "not_found" && error.publicStatus === 404,
  );
});
