import assert from "node:assert/strict";
import { test } from "node:test";

import { createPatientPortalService } from "./patient-portal-service.mjs";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "22222222-2222-4222-8222-222222222222";
const VISIT_ID = "33333333-3333-4333-8333-333333333333";

function createService(overrides = {}) {
  const auditEvents = [];
  const exchangeCalls = [];
  const endSessionCalls = [];
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
      async getHistory() {
        return overrides.history || {
          clinic: { id: "c-1" },
          lesions: [{ id: "lesion-1" }],
          timeline: [{ id: "visit-1" }],
          retentionGovernance: {
            releasesTotal: 1,
            policyReady: 0,
          },
          comparisonOperations: {
            lesionsTotal: 1,
            readyForDoctorReview: 0,
            requiresNextCapture: 1,
            visitsWithComparableSeries: 0,
            comparableCoveragePercent: 0,
            status: "needs_capture",
            doctorReviewRequired: true,
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
            status: "governance_ready",
            sessionBoundary: {
              temporaryCredentialsExposed: false,
              qrSessionExposed: false,
              rawTokensExposed: false,
            },
          },
        };
      },
      async exchangePhotoProtocolAccess(input) {
        exchangeCalls.push(input);
        return overrides.exchangeResult || {
          id: "ppr-1",
          visitId: input.visitId,
          status: "confirmed",
          accessStatus: "session_boundary_ready",
          sessionExpiresAt: input.sessionExpiresAt,
          clinic: { id: "c-1" },
          sessionBoundary: {
            sessionEstablished: true,
            rawCredentialExposed: false,
            credentialHashExposed: false,
            credentialFingerprintExposed: false,
            rawSessionIdExposed: false,
            sessionHashExposed: false,
            sessionFingerprintExposed: false,
            qrTokenExposed: false,
            signedUrlsIssued: false,
            storagePathsExposed: false,
            doctorOnlyTextExposed: false,
          },
        };
      },
      async endPhotoProtocolAccessSession(input) {
        endSessionCalls.push(input);
        return overrides.sessionEndResult || {
          visitId: input.visitId,
          status: input.sessionHash ? "ended" : "no_active_session",
          accessStatus: input.sessionHash
            ? "photo_protocol_access_session_ended"
            : "photo_protocol_access_no_active_session",
          sessionEnded: Boolean(input.sessionHash),
          clinic: { id: "c-1" },
          sessionBoundary: {
            sessionEstablished: false,
            rawSessionIdExposed: false,
            sessionHashExposed: false,
            sessionFingerprintExposed: false,
            qrTokenExposed: false,
            signedUrlsIssued: false,
            storagePathsExposed: false,
            doctorOnlyTextExposed: false,
          },
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
    credentialPepper: overrides.credentialPepper ?? "test-credential-pepper",
    sessionPepper: overrides.sessionPepper ?? "test-session-pepper",
    randomBytesImpl: overrides.randomBytesImpl || (() => Buffer.from("0123456789abcdef0123456789abcdef")),
    now: overrides.now || (() => new Date("2026-06-01T12:00:00.000Z")),
    sessionTtlMinutes: 30,
  });
  return { service, auditEvents, exchangeCalls, endSessionCalls };
}

test("Stage 5N service allows patient role and audits overview/report reads", async () => {
  const { service, auditEvents } = createService();
  const authContext = { userId: USER_ID, roles: ["patient"] };

  const overview = await service.getOverview(authContext, { correlationId: "corr-1" });
  const report = await service.getReport(REPORT_ID, authContext, { correlationId: "corr-2" });
  const photoProtocol = await service.getPhotoProtocol(VISIT_ID, authContext, { correlationId: "corr-5" });
  const history = await service.getHistory(authContext, { correlationId: "corr-6" });

  assert.equal(overview.scope.userId, USER_ID);
  assert.equal(report.report.patientSafeText, "Отчёт для пациента");
  assert.equal(photoProtocol.photoProtocol.deliveryBoundary.patientDeliveryAllowed, false);
  assert.equal(history.history.retentionGovernance.releasesTotal, 1);
  assert.equal(history.history.comparisonOperations.status, "needs_capture");
  assert.equal(history.history.sessionLifecycle.status, "governance_ready");
  assert.equal(auditEvents[3].metadata.readyForDoctorReview, 0);
  assert.equal(auditEvents[3].metadata.activeAccessWindows, 1);
  assert.equal(auditEvents[3].metadata.sessionLifecycleStatus, "governance_ready");
  assert.deepEqual(auditEvents.map((event) => event.action), [
    "patient_portal.overview.read",
    "patient_portal.report.read",
    "patient_portal.photo_protocol.read",
    "patient_portal.history.read",
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

test("Stage 5N service exchanges access credential without auditing or returning secrets", async () => {
  const { service, auditEvents, exchangeCalls } = createService();
  const authContext = { userId: USER_ID, roles: ["patient"] };

  const result = await service.exchangePhotoProtocolAccess(
    VISIT_ID,
    { credential: "patient one-time credential" },
    authContext,
    { correlationId: "corr-exchange-1" },
  );

  assert.equal(result.exchange.status, "confirmed");
  assert.equal(result.exchange.accessStatus, "session_boundary_ready");
  assert.equal(result.exchange.sessionBoundary.rawCredentialExposed, false);
  assert.equal(result.exchange.sessionBoundary.sessionHashExposed, false);
  assert.equal(result.exchange.sessionBoundary.sessionEstablished, true);
  assert.equal(result.sessionCookie.name, "sd_photo_protocol_session");
  assert.equal(result.sessionCookie.path, `/api/v1/me/photo-protocols/${VISIT_ID}`);
  assert.equal(result.sessionCookie.maxAgeSeconds, 1800);
  assert.equal(result.sessionCookie.httpOnly, true);
  assert.equal(result.sessionCookie.secure, true);
  assert.equal(result.sessionCookie.sameSite, "Strict");
  assert.equal(result.sessionCookie.value.length, 64);
  assert.equal(exchangeCalls.length, 1);
  assert.equal(exchangeCalls[0].credentialHash.length, 64);
  assert.equal(exchangeCalls[0].sessionHash.length, 64);
  assert.equal(exchangeCalls[0].sessionFingerprint.length, 16);
  assert.notEqual(exchangeCalls[0].credentialHash, "patient one-time credential");
  assert.equal("credential" in exchangeCalls[0], false);
  assert.equal("sessionSecret" in exchangeCalls[0], false);
  assert.deepEqual(auditEvents.map((event) => event.action), [
    "patient_portal.photo_protocol.access.exchange",
  ]);
  assert.equal(auditEvents[0].metadata.rawCredentialExposed, false);
  assert.equal(auditEvents[0].metadata.sessionHashExposed, false);
  assert.doesNotMatch(JSON.stringify(result.exchange), new RegExp(result.sessionCookie.value, "i"));
  assert.doesNotMatch(JSON.stringify(auditEvents[0]), /patient one-time credential|0123456789abcdef|credential_hash|session_hash/i);
  assert.doesNotMatch(JSON.stringify(auditEvents[0]), new RegExp(result.sessionCookie.value, "i"));
});

test("Stage 5N service denies invalid credential with safe audit metadata", async () => {
  const { service, auditEvents } = createService({
    exchangeResult: {
      id: "ppr-1",
      visitId: VISIT_ID,
      status: "denied",
      accessStatus: "photo_protocol_access_credential_invalid",
      deniedReason: "photo_protocol_access_credential_invalid",
      clinic: { id: "c-1" },
      sessionBoundary: {
        sessionEstablished: false,
        rawCredentialExposed: false,
        credentialHashExposed: false,
        credentialFingerprintExposed: false,
        rawSessionIdExposed: false,
        sessionHashExposed: false,
        sessionFingerprintExposed: false,
      },
    },
  });
  const authContext = { userId: USER_ID, roles: ["patient"] };

  await assert.rejects(
    () => service.exchangePhotoProtocolAccess(
      VISIT_ID,
      { credential: "wrong credential" },
      authContext,
      { correlationId: "corr-exchange-2" },
    ),
    (error) => error.publicCode === "photo_protocol_access_credential_invalid" && error.publicStatus === 403,
  );
  assert.deepEqual(auditEvents.map((event) => event.action), [
    "patient_portal.photo_protocol.access.exchange_denied",
  ]);
  assert.equal(auditEvents[0].metadata.reason, "photo_protocol_access_credential_invalid");
  assert.doesNotMatch(JSON.stringify(auditEvents[0]), /wrong credential|credential_hash|session_hash|sessionSecret/i);
});

test("Stage 5N service requires configured credential and session peppers", async () => {
  const { service } = createService({ credentialPepper: "", sessionPepper: "" });
  const authContext = { userId: USER_ID, roles: ["patient"] };

  await assert.rejects(
    () => service.exchangePhotoProtocolAccess(VISIT_ID, { credential: "patient one-time credential" }, authContext),
    (error) => error.publicCode === "photo_protocol_access_not_configured" && error.publicStatus === 503,
  );
});

test("Stage 5N service ends photo access session with safe audit and clear cookie", async () => {
  const { service, auditEvents, endSessionCalls } = createService();
  const authContext = { userId: USER_ID, roles: ["patient"] };
  const sessionCookieValue = "a".repeat(64);

  const result = await service.endPhotoProtocolAccessSession(
    VISIT_ID,
    authContext,
    { correlationId: "corr-session-end-1", sessionCookieValue },
  );

  assert.equal(result.sessionEnd.status, "ended");
  assert.equal(result.sessionEnd.sessionBoundary.sessionEstablished, false);
  assert.equal(result.sessionCookie.name, "sd_photo_protocol_session");
  assert.equal(result.sessionCookie.path, `/api/v1/me/photo-protocols/${VISIT_ID}`);
  assert.equal(result.sessionCookie.maxAgeSeconds, 0);
  assert.equal(result.sessionCookie.httpOnly, true);
  assert.equal(result.sessionCookie.secure, true);
  assert.equal(endSessionCalls.length, 1);
  assert.equal(endSessionCalls[0].sessionHash.length, 64);
  assert.notEqual(endSessionCalls[0].sessionHash, sessionCookieValue);
  assert.equal("sessionCookieValue" in endSessionCalls[0], false);
  assert.deepEqual(auditEvents.map((event) => event.action), [
    "patient_portal.photo_protocol.access.session_end",
  ]);
  assert.equal(auditEvents[0].metadata.sessionEnded, true);
  assert.equal(auditEvents[0].metadata.rawSessionIdExposed, false);
  assert.equal(auditEvents[0].metadata.sessionHashExposed, false);
  assert.doesNotMatch(JSON.stringify(result.sessionEnd), new RegExp(sessionCookieValue, "i"));
  assert.doesNotMatch(JSON.stringify(auditEvents[0]), new RegExp(sessionCookieValue, "i"));
  assert.doesNotMatch(JSON.stringify(auditEvents[0]), /session_hash|session_fingerprint|signed_url|storage_object_path/i);
});

test("Stage 5N service clears photo access cookie even when no active session is matched", async () => {
  const { service, auditEvents, endSessionCalls } = createService();
  const authContext = { userId: USER_ID, roles: ["patient"] };

  const result = await service.endPhotoProtocolAccessSession(
    VISIT_ID,
    authContext,
    { correlationId: "corr-session-end-2", sessionCookieValue: "" },
  );

  assert.equal(result.sessionEnd.status, "no_active_session");
  assert.equal(result.sessionEnd.sessionEnded, false);
  assert.equal(result.sessionCookie.maxAgeSeconds, 0);
  assert.equal(endSessionCalls[0].sessionHash, "");
  assert.equal(auditEvents[0].metadata.cookiePresented, false);
  assert.equal(auditEvents[0].metadata.sessionEnded, false);
});
