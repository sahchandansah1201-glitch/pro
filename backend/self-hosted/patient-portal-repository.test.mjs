import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPatientPortalOverviewSql,
  buildPatientPortalPhotoProtocolSql,
  buildPatientPortalReportSql,
  buildCreatePatientPortalBookingRequestSql,
  buildUpdatePatientPortalReminderPreferencesSql,
  createPatientPortalRepository,
  normalizePatientPortalOverview,
  normalizePatientPortalPhotoProtocol,
  normalizePatientPortalReport,
} from "./patient-portal-repository.mjs";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const VISIT_ID = "33333333-3333-4333-8333-333333333333";

test("Stage 5N SQL scopes patient portal reads through patient_user_links and safe report text", () => {
  const overviewSql = buildPatientPortalOverviewSql({ userId: USER_ID });
  const reportSql = buildPatientPortalReportSql({ userId: USER_ID, reportId: REPORT_ID });

  assert.match(overviewSql, /patient_user_links/);
  assert.match(overviewSql, /patient_safe_text/);
  assert.doesNotMatch(overviewSql, /physician_text/);
  assert.match(reportSql, /pul\.user_id/);
  assert.match(reportSql, /r\.patient_safe_text/);
  assert.doesNotMatch(reportSql, /physician_text/);
});

test("Stage 5N SQL scopes patient photo protocol reads and excludes protected asset fields", () => {
  const photoProtocolSql = buildPatientPortalPhotoProtocolSql({ userId: USER_ID, visitId: VISIT_ID });

  assert.match(photoProtocolSql, /patient_user_links/);
  assert.match(photoProtocolSql, /patient_photo_protocol_releases/);
  assert.match(photoProtocolSql, /clinical_assets/);
  assert.match(photoProtocolSql, /patientDeliveryAllowed/);
  assert.match(photoProtocolSql, /previewAvailable/);
  assert.match(photoProtocolSql, /auditTrail/);
  assert.doesNotMatch(photoProtocolSql, /object_bucket|object_key|checksum_sha256|signed_url|access_token|physician_text|revoke_reason/i);
});

test("Stage 5O SQL writes booking requests and reminder preferences through patient_user_links", () => {
  const bookingSql = buildCreatePatientPortalBookingRequestSql({
    userId: USER_ID,
    preferredFrom: "2026-06-15T10:00:00.000Z",
    preferredTo: "2026-06-15T12:00:00.000Z",
    reason: "Плановый контроль",
  });
  const preferencesSql = buildUpdatePatientPortalReminderPreferencesSql({
    userId: USER_ID,
    appointmentRemindersEnabled: false,
    reportNotificationsEnabled: true,
    preferredChannel: "phone",
  });

  assert.match(bookingSql, /insert into patient_portal_booking_requests/i);
  assert.match(bookingSql, /patient_user_links/);
  assert.match(bookingSql, /requested_by_user_id/);
  assert.doesNotMatch(bookingSql, /physician_text|storage_object_path|signed_url/i);
  assert.match(preferencesSql, /insert into patient_portal_reminder_preferences/i);
  assert.match(preferencesSql, /on conflict \(user_id\) do update/i);
  assert.match(preferencesSql, /preferred_channel/);
  assert.doesNotMatch(preferencesSql, /physician_text|storage_object_path|signed_url/i);
});

test("Stage 5N normalizers expose patient-safe portal DTOs only", () => {
  const overview = normalizePatientPortalOverview({
    patient: {
      id: "p-1",
      fullName: "Пациент",
      clinic: { id: "c-1", name: "Клиника" },
    },
    nextAppointment: { id: "v-1", startedAt: "2026-06-01T10:00:00Z" },
    reports: [
      {
        id: "r-1",
        patientSafeText: "Текст для пациента",
        physicianText: "Скрытый врачебный текст",
      },
    ],
    reminders: [{ id: "rem-1", title: "Приём" }],
    reminderPreferences: {
      appointmentRemindersEnabled: false,
      reportNotificationsEnabled: true,
      preferredChannel: "phone",
    },
    bookingRequests: [{ id: "br-1", status: "requested", reason: "Плановый контроль" }],
  });

  assert.equal(overview.patient.fullName, "Пациент");
  assert.equal(overview.nextAppointment.id, "v-1");
  assert.equal(overview.reports[0].patientSafeText, "Текст для пациента");
  assert.equal("physicianText" in overview.reports[0], false);
  assert.equal(overview.reminders[0].title, "Приём");
  assert.equal(overview.reminderPreferences.preferredChannel, "phone");
  assert.equal(overview.reminderPreferences.appointmentRemindersEnabled, false);
  assert.equal(overview.bookingRequests[0].status, "requested");

  const report = normalizePatientPortalReport({
    id: "r-2",
    patientSafeText: "Безопасное заключение",
    physicianText: "Не отдавать",
  });
  assert.equal(report.patientSafeText, "Безопасное заключение");
  assert.equal("physicianText" in report, false);

  const photoProtocol = normalizePatientPortalPhotoProtocol({
    id: "ppr-1",
    visitId: VISIT_ID,
    reportId: REPORT_ID,
    status: "prepared",
    selectedPhotoCount: 2,
    overviewPhotoCount: 1,
    dermoscopyPhotoCount: 1,
    reportAttachmentCount: 0,
    expiresAt: "2026-06-20T10:00:00.000Z",
    revokedAt: "2026-06-18T10:00:00.000Z",
    patientDeliveryAllowed: true,
    rawFilesExposed: true,
    signedUrlsIssued: true,
    objectBucket: "hidden",
    objectKey: "hidden",
    physicianText: "Не отдавать",
    revokeReason: "Внутренняя причина не для пациента",
    auditTrail: [
      {
        kind: "prepared",
        label: "Фото-протокол подготовлен клиникой",
        occurredAt: "2026-06-01T10:00:00.000Z",
        rawPayload: "hidden",
        correlationId: "hidden",
      },
      {
        kind: "revoked",
        label: "Доступ отозван клиникой",
        occurredAt: "2026-06-18T10:00:00.000Z",
        revokeReason: "hidden",
      },
    ],
    photos: [
      {
        sequence: 1,
        kind: "dermoscopy",
        contentType: "image/jpeg",
        capturedAt: "2026-06-01T10:00:00.000Z",
        lesionLabel: "Очаг A",
        bodyZone: "спина",
        objectKey: "hidden",
        signedUrl: "hidden",
      },
    ],
  });
  assert.equal(photoProtocol.status, "prepared");
  assert.equal(photoProtocol.deliveryBoundary.patientDeliveryAllowed, false);
  assert.equal(photoProtocol.deliveryBoundary.signedUrlsIssued, false);
  assert.equal(photoProtocol.auditTrail.length, 2);
  assert.equal(photoProtocol.auditTrail[1].label, "Доступ отозван клиникой");
  assert.equal("rawPayload" in photoProtocol.auditTrail[0], false);
  assert.equal("correlationId" in photoProtocol.auditTrail[0], false);
  assert.equal("revokeReason" in photoProtocol.auditTrail[1], false);
  assert.equal(photoProtocol.photos[0].previewAvailable, false);
  assert.equal(photoProtocol.photos[0].lesionLabel, "Очаг A");
  assert.equal("objectKey" in photoProtocol.photos[0], false);
  assert.equal("signedUrl" in photoProtocol.photos[0], false);
  assert.equal("physicianText" in photoProtocol, false);
});

test("Stage 5N repository reads overview and report through db client", async () => {
  const calls = [];
  const repository = createPatientPortalRepository({
    async queryJson(sql) {
      calls.push(sql);
      if (/insert into patient_portal_booking_requests/i.test(sql)) {
        return [{ id: "br-1", status: "requested", reason: "Плановый контроль" }];
      }
      if (/insert into patient_portal_reminder_preferences/i.test(sql)) {
        return [{ appointmentRemindersEnabled: false, reportNotificationsEnabled: true, preferredChannel: "phone" }];
      }
      if (sql.includes("r.id =")) {
        return [{ id: REPORT_ID, patientSafeText: "Отчёт" }];
      }
      if (sql.includes("patient_photo_protocol_releases")) {
        return [{
          id: "ppr-1",
          visitId: VISIT_ID,
          reportId: REPORT_ID,
          status: "prepared",
          selectedPhotoCount: 2,
          overviewPhotoCount: 1,
          dermoscopyPhotoCount: 1,
          reportAttachmentCount: 0,
          photos: [{ sequence: 1, kind: "overview_photo", contentType: "image/jpeg" }],
        }];
      }
      return [{ patient: { id: "p-1" }, reports: [] }];
    },
  });

  const overview = await repository.getOverview({ userId: USER_ID });
  const report = await repository.getReport({ userId: USER_ID, reportId: REPORT_ID });
  const photoProtocol = await repository.getPhotoProtocol({ userId: USER_ID, visitId: VISIT_ID });
  const booking = await repository.createBookingRequest({
    userId: USER_ID,
    preferredFrom: "2026-06-15T10:00:00.000Z",
    reason: "Плановый контроль",
  });
  const preferences = await repository.updateReminderPreferences({
    userId: USER_ID,
    appointmentRemindersEnabled: false,
    reportNotificationsEnabled: true,
    preferredChannel: "phone",
  });

  assert.equal(overview.patient.id, "p-1");
  assert.equal(report.id, REPORT_ID);
  assert.equal(photoProtocol.visitId, VISIT_ID);
  assert.equal(photoProtocol.deliveryBoundary.patientDeliveryAllowed, false);
  assert.equal(booking.id, "br-1");
  assert.equal(preferences.preferredChannel, "phone");
  assert.equal(calls.length, 5);
});
