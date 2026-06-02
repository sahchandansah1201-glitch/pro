import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPatientPortalOverviewSql,
  buildPatientPortalHistorySql,
  buildPatientPortalPhotoProtocolSql,
  buildExchangePatientPortalPhotoProtocolAccessSql,
  buildEndPatientPortalPhotoProtocolAccessSessionSql,
  buildPatientPortalReportSql,
  buildCreatePatientPortalBookingRequestSql,
  buildUpdatePatientPortalReminderPreferencesSql,
  createPatientPortalRepository,
  normalizePatientPortalHistory,
  normalizePatientPortalOverview,
  normalizePatientPortalPhotoProtocol,
  normalizePatientPortalPhotoProtocolAccessExchange,
  normalizePatientPortalPhotoProtocolAccessSessionEnd,
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
  assert.match(photoProtocolSql, /patientFileProxyEnabled/);
  assert.match(photoProtocolSql, /patientCopyApproved/);
  assert.match(photoProtocolSql, /retentionPolicyApproved/);
  assert.match(photoProtocolSql, /patientDeliveryAllowed/);
  assert.match(photoProtocolSql, /previewAvailable/);
  assert.match(photoProtocolSql, /auditTrail/);
  assert.doesNotMatch(photoProtocolSql, /object_bucket|object_key|checksum_sha256|signed_url|access_token|physician_text|revoke_reason/i);
});

test("Stage 5N SQL exchanges a credential hash for a metadata-only session boundary", () => {
  const exchangeSql = buildExchangePatientPortalPhotoProtocolAccessSql({
    userId: USER_ID,
    visitId: VISIT_ID,
    credentialHash: "abc123credentialhashabc123credentialhash",
    sessionHash: "def456sessionhashdef456sessionhash",
    sessionFingerprint: "session-fp-001",
    sessionExpiresAt: "2026-06-01T12:30:00.000Z",
  });

  assert.match(exchangeSql, /patient_user_links/);
  assert.match(exchangeSql, /patient_photo_protocol_access_credentials/);
  assert.match(exchangeSql, /patient_photo_protocol_access_sessions/);
  assert.match(exchangeSql, /credential_hash/);
  assert.match(exchangeSql, /session_hash/);
  assert.match(exchangeSql, /on conflict \(release_id, patient_user_id, session_kind\)/);
  assert.match(exchangeSql, /photo_protocol_access_credential_invalid/);
  assert.match(exchangeSql, /session_boundary_ready/);
  assert.match(exchangeSql, /rawCredentialExposed/);
  assert.match(exchangeSql, /rawSessionIdExposed/);
  assert.match(exchangeSql, /sessionHashExposed/);
  assert.match(exchangeSql, /credentialFingerprintExposed/);
  assert.doesNotMatch(exchangeSql, /plainCredential|credentialPlaintext|credentialValue|sessionToken|signed_url|storage_object_path|object_bucket|object_key|physician_text/i);
});

test("Stage 5N SQL ends active photo access sessions without exposing session material", () => {
  const endSql = buildEndPatientPortalPhotoProtocolAccessSessionSql({
    userId: USER_ID,
    visitId: VISIT_ID,
    sessionHash: "def456sessionhashdef456sessionhash",
  });

  assert.match(endSql, /patient_user_links/);
  assert.match(endSql, /patient_photo_protocol_access_sessions/);
  assert.match(endSql, /patient_end_access_session/);
  assert.match(endSql, /status = 'revoked'/);
  assert.match(endSql, /revoked_at = now\(\)/);
  assert.match(endSql, /session_kind = 'patient_photo_protocol_access'/);
  assert.match(endSql, /photo_protocol_access_session_ended/);
  assert.match(endSql, /photo_protocol_access_no_active_session/);
  assert.match(endSql, /rawSessionIdExposed/);
  assert.match(endSql, /sessionHashExposed/);
  assert.match(endSql, /sessionFingerprintExposed/);
  assert.doesNotMatch(endSql, /raw_session_id|sessionToken|signed_url|storage_object_path|object_bucket|object_key|physician_text/i);
});

test("Stage 5N normalizer exposes session-end boundary metadata only", () => {
  const sessionEnd = normalizePatientPortalPhotoProtocolAccessSessionEnd({
    visitId: VISIT_ID,
    status: "ended",
    accessStatus: "photo_protocol_access_session_ended",
    sessionEnded: true,
    sessionHash: "hidden",
    sessionBoundary: {
      sessionEstablished: true,
      rawSessionIdExposed: true,
      sessionHashExposed: true,
      sessionFingerprintExposed: true,
      signedUrlsIssued: true,
      storagePathsExposed: true,
    },
  });

  assert.equal(sessionEnd.status, "ended");
  assert.equal(sessionEnd.sessionEnded, true);
  assert.equal(sessionEnd.sessionBoundary.sessionEstablished, false);
  assert.equal(sessionEnd.sessionBoundary.rawSessionIdExposed, false);
  assert.equal(sessionEnd.sessionBoundary.sessionHashExposed, false);
  assert.equal(sessionEnd.sessionBoundary.sessionFingerprintExposed, false);
  assert.equal(sessionEnd.sessionBoundary.signedUrlsIssued, false);
  assert.equal(sessionEnd.sessionBoundary.storagePathsExposed, false);
  assert.equal("sessionHash" in sessionEnd, false);
});

test("Stage 5N SQL scopes patient-safe history reads and policy counters", () => {
  const historySql = buildPatientPortalHistorySql({ userId: USER_ID });

  assert.match(historySql, /patient_user_links/);
  assert.match(historySql, /lesion_history/);
  assert.match(historySql, /visit_timeline/);
  assert.match(historySql, /compare_stats/);
  assert.match(historySql, /patient_photo_protocol_releases/);
  assert.match(historySql, /retentionPolicyApproved/);
  assert.match(historySql, /prepared_access_windows/);
  assert.match(historySql, /comparisonOperations/);
  assert.match(historySql, /sessionLifecycle/);
  assert.match(historySql, /longitudinalBoundary/);
  assert.doesNotMatch(historySql, /physician_text|object_bucket|object_key|checksum_sha256|signed_url|access_token|revoke_reason/i);
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
    deliveryBoundary: {
      fileProxyReady: true,
      requiresRetentionPolicy: false,
      requiresApprovedPatientCopy: false,
    },
    availabilityMessages: [
      "Открытие фото выполняется только через защищённый backend-контур.",
    ],
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
  assert.equal(photoProtocol.deliveryBoundary.fileProxyReady, true);
  assert.equal(photoProtocol.deliveryBoundary.requiresRetentionPolicy, false);
  assert.equal(photoProtocol.deliveryBoundary.requiresApprovedPatientCopy, false);
  assert.equal(photoProtocol.availabilityMessages[0], "Открытие фото выполняется только через защищённый backend-контур.");
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

  const history = normalizePatientPortalHistory({
    clinic: { id: "c-1", name: "Клиника" },
    lesions: [{
      id: "lesion-1",
      title: "Очаг A",
      status: "active",
      snapshotCount: 2,
      comparableSnapshotCount: 2,
      nextStep: "Покажите серию врачу на контрольном визите.",
      comparisonState: "Есть серия снимков для врачебного сравнения.",
      physicianText: "hidden",
    }],
    timeline: [{
      id: "visit-1",
      visitStatus: "closed",
      summary: "Безопасный итог",
      diagnosis: "hidden",
    }],
    retentionGovernance: {
      releasesTotal: 2,
      retentionApproved: 1,
      patientCopyApproved: 1,
      fileProxyEnabled: 1,
      expiresConfigured: 1,
      policyReady: 1,
    },
    comparisonOperations: {
      lesionsTotal: 3,
      readyForDoctorReview: 2,
      requiresNextCapture: 1,
      visitsWithComparableSeries: 2,
      comparableCoveragePercent: 67,
      doctorReviewRequired: false,
    },
    sessionLifecycle: {
      preparedAccessWindows: 2,
      revokedAccessWindows: 1,
      activeAccessWindows: 1,
      expiringIn24h: 1,
      expiredAccessWindows: 0,
      missingExpiry: 0,
      identityCheckEnabled: 2,
      policyReadyAccessWindows: 2,
      temporaryCredentialsExposed: true,
      qrSessionExposed: true,
      rawTokensExposed: true,
    },
    longitudinalBoundary: {
      comparisonRequiresDoctorReview: true,
      diagnosisExposed: true,
      rawFilesExposed: true,
      doctorOnlyTextExposed: true,
    },
  });
  assert.equal(history.lesions[0].stateLabel, "Врачебная проверка");
  assert.equal(history.timeline[0].stateLabel, "Завершён");
  assert.equal(history.retentionGovernance.status, "policy_in_progress");
  assert.equal(history.comparisonOperations.status, "partial_ready");
  assert.equal(history.comparisonOperations.doctorReviewRequired, true);
  assert.equal(history.sessionLifecycle.status, "governance_ready");
  assert.equal(history.sessionLifecycle.sessionBoundary.rawTokensExposed, false);
  assert.equal(history.longitudinalBoundary.clinicalDecisionExposed, false);
  assert.equal("physicianText" in history.lesions[0], false);
});

test("Stage 5N normalizer exposes credential exchange boundaries without secrets", () => {
  const exchange = normalizePatientPortalPhotoProtocolAccessExchange({
    visitId: VISIT_ID,
    status: "confirmed",
    accessStatus: "session_boundary_ready",
    sessionExpiresAt: "2026-06-01T12:30:00.000Z",
    credentialHash: "hidden",
    credentialFingerprint: "hidden",
    sessionHash: "hidden",
    sessionFingerprint: "hidden",
    sessionBoundary: {
      sessionEstablished: true,
      rawCredentialExposed: true,
      credentialHashExposed: true,
      credentialFingerprintExposed: true,
      rawSessionIdExposed: true,
      sessionHashExposed: true,
      sessionFingerprintExposed: true,
      signedUrlsIssued: true,
      storagePathsExposed: true,
      doctorOnlyTextExposed: true,
    },
  });

  assert.equal(exchange.status, "confirmed");
  assert.equal(exchange.accessStatus, "session_boundary_ready");
  assert.equal(exchange.sessionBoundary.sessionEstablished, true);
  assert.equal(exchange.sessionBoundary.rawCredentialExposed, false);
  assert.equal(exchange.sessionBoundary.credentialHashExposed, false);
  assert.equal(exchange.sessionBoundary.credentialFingerprintExposed, false);
  assert.equal(exchange.sessionBoundary.rawSessionIdExposed, false);
  assert.equal(exchange.sessionBoundary.sessionHashExposed, false);
  assert.equal(exchange.sessionBoundary.sessionFingerprintExposed, false);
  assert.equal(exchange.sessionBoundary.signedUrlsIssued, false);
  assert.equal(exchange.sessionBoundary.storagePathsExposed, false);
  assert.equal(exchange.sessionBoundary.doctorOnlyTextExposed, false);
  assert.equal("credentialHash" in exchange, false);
  assert.equal("sessionHash" in exchange, false);
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
      if (sql.includes("longitudinalBoundary")) {
        return [{
          clinic: { id: "c-1", name: "Клиника" },
          lesions: [{ id: "lesion-1", title: "Очаг A", status: "active" }],
          timeline: [{ id: VISIT_ID, visitStatus: "closed" }],
          retentionGovernance: {
            releasesTotal: 1,
            retentionApproved: 1,
            patientCopyApproved: 1,
            fileProxyEnabled: 1,
            expiresConfigured: 1,
            policyReady: 1,
          },
          comparisonOperations: {
            lesionsTotal: 1,
            readyForDoctorReview: 0,
            requiresNextCapture: 1,
            visitsWithComparableSeries: 0,
            comparableCoveragePercent: 0,
          },
          sessionLifecycle: {
            preparedAccessWindows: 1,
            revokedAccessWindows: 0,
            activeAccessWindows: 1,
            expiringIn24h: 0,
            expiredAccessWindows: 0,
            missingExpiry: 0,
            identityCheckEnabled: 1,
            policyReadyAccessWindows: 1,
          },
          longitudinalBoundary: {
            comparisonRequiresDoctorReview: true,
            diagnosisExposed: false,
            rawFilesExposed: false,
            doctorOnlyTextExposed: false,
          },
        }];
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
  const history = await repository.getHistory({ userId: USER_ID });
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
  assert.equal(history.retentionGovernance.releasesTotal, 1);
  assert.equal(history.comparisonOperations.status, "needs_capture");
  assert.equal(history.sessionLifecycle.status, "governance_ready");
  assert.equal(booking.id, "br-1");
  assert.equal(preferences.preferredChannel, "phone");
  assert.equal(calls.length, 6);
});
