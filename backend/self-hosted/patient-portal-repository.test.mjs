import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPatientPortalOverviewSql,
  buildPatientPortalReportSql,
  buildCreatePatientPortalBookingRequestSql,
  buildUpdatePatientPortalReminderPreferencesSql,
  createPatientPortalRepository,
  normalizePatientPortalOverview,
  normalizePatientPortalReport,
} from "./patient-portal-repository.mjs";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";

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
      return [{ patient: { id: "p-1" }, reports: [] }];
    },
  });

  const overview = await repository.getOverview({ userId: USER_ID });
  const report = await repository.getReport({ userId: USER_ID, reportId: REPORT_ID });
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
  assert.equal(booking.id, "br-1");
  assert.equal(preferences.preferredChannel, "phone");
  assert.equal(calls.length, 4);
});
