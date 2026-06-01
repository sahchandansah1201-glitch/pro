import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSelfHostedPatientPortalBookingRequest,
  fetchSelfHostedPatientPortal,
  fetchSelfHostedPatientPortalHistory,
  fetchSelfHostedPatientPortalPhotoProtocolPhoto,
  fetchSelfHostedPatientPortalPhotoProtocol,
  fetchSelfHostedPatientPortalReport,
  exchangeSelfHostedPatientPortalPhotoProtocolAccess,
  updateSelfHostedPatientPortalReminderPreferences,
  toSelfHostedPatientPortalHistory,
  toSelfHostedPatientPortalOverview,
  toSelfHostedPatientPortalPhotoProtocol,
  toSelfHostedPatientPortalPhotoProtocolAccessExchange,
  toSelfHostedPatientPortalReport,
} from "./self-hosted-patient-portal-api";

describe("self-hosted-patient-portal-api", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes patient portal data without physician-only fields", () => {
    const overview = toSelfHostedPatientPortalOverview({
      patient: { id: "p-1", fullName: "Пациент", clinic: { name: "Клиника" } },
      nextAppointment: { id: "v-1", startedAt: "2026-06-01T10:00:00Z" },
      reports: [{ id: "r-1", patientSafeText: "Текст", physicianText: "Скрыто" }],
      reminders: [{ id: "rem-1", title: "Приём" }],
      reminderPreferences: {
        appointmentRemindersEnabled: false,
        reportNotificationsEnabled: true,
        preferredChannel: "phone",
      },
      bookingRequests: [{ id: "br-1", status: "requested", reason: "Плановый контроль" }],
    });
    expect(overview.patient.fullName).toBe("Пациент");
    expect(overview.nextAppointment?.id).toBe("v-1");
    expect(overview.reports[0].patientSafeText).toBe("Текст");
    expect(overview.reports[0]).not.toHaveProperty("physicianText");
    expect(overview.reminders[0].title).toBe("Приём");
    expect(overview.reminderPreferences.preferredChannel).toBe("phone");
    expect(overview.bookingRequests[0].status).toBe("requested");

    const report = toSelfHostedPatientPortalReport({
      id: "r-2",
      patientSafeText: "Безопасно",
      physicianText: "Не выводить",
      token: "raw-token",
      sharedLink: "hidden-link",
      accessExpiresAt: "2026-06-20T10:00:00.000Z",
    });
    expect(report.patientSafeText).toBe("Безопасно");
    expect(report.accessExpiresAt).toBe("2026-06-20T10:00:00.000Z");
    expect(report).not.toHaveProperty("physicianText");
    expect(report).not.toHaveProperty("token");
    expect(report).not.toHaveProperty("sharedLink");

    const photoProtocol = toSelfHostedPatientPortalPhotoProtocol({
      id: "ppr-1",
      visitId: "v-1",
      reportId: "r-1",
      status: "prepared",
      selectedPhotoCount: 2,
      patientDeliveryAllowed: true,
      rawFilesExposed: true,
      signedUrlsIssued: true,
      storagePathsExposed: true,
      tokensExposed: true,
      physicianText: "Не выводить",
      revokedAt: "2026-06-18T10:00:00.000Z",
      revokeReason: "Внутренняя причина не для пациента",
      deliveryBoundary: {
        fileProxyReady: true,
        requiresRetentionPolicy: false,
        requiresApprovedPatientCopy: false,
      },
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
          objectBucket: "hidden",
          objectKey: "hidden",
          signedUrl: "hidden",
          accessToken: "hidden",
          checksumSha256: "hidden",
        },
      ],
    });
    expect(photoProtocol.deliveryBoundary.patientDeliveryAllowed).toBe(false);
    expect(photoProtocol.deliveryBoundary.signedUrlsIssued).toBe(false);
    expect(photoProtocol.deliveryBoundary.fileProxyReady).toBe(true);
    expect(photoProtocol.deliveryBoundary.requiresRetentionPolicy).toBe(false);
    expect(photoProtocol.deliveryBoundary.requiresApprovedPatientCopy).toBe(false);
    expect(photoProtocol.auditTrail).toHaveLength(2);
    expect(photoProtocol.auditTrail[1].label).toBe("Доступ отозван клиникой");
    expect(photoProtocol.auditTrail[0]).not.toHaveProperty("rawPayload");
    expect(photoProtocol.auditTrail[0]).not.toHaveProperty("correlationId");
    expect(photoProtocol.auditTrail[1]).not.toHaveProperty("revokeReason");
    expect(photoProtocol.photos[0].previewAvailable).toBe(false);
    expect(photoProtocol.photos[0].lesionLabel).toBe("Очаг A");
    expect(photoProtocol.photos[0]).not.toHaveProperty("objectKey");
    expect(photoProtocol.photos[0]).not.toHaveProperty("signedUrl");
    expect(photoProtocol).not.toHaveProperty("physicianText");

    const exchange = toSelfHostedPatientPortalPhotoProtocolAccessExchange({
      visitId: "v-1",
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
    expect(exchange.accessStatus).toBe("session_boundary_ready");
    expect(exchange.sessionBoundary.sessionEstablished).toBe(true);
    expect(exchange.sessionBoundary.rawCredentialExposed).toBe(false);
    expect(exchange.sessionBoundary.credentialHashExposed).toBe(false);
    expect(exchange.sessionBoundary.credentialFingerprintExposed).toBe(false);
    expect(exchange.sessionBoundary.rawSessionIdExposed).toBe(false);
    expect(exchange.sessionBoundary.sessionHashExposed).toBe(false);
    expect(exchange.sessionBoundary.sessionFingerprintExposed).toBe(false);
    expect(exchange.sessionBoundary.signedUrlsIssued).toBe(false);
    expect(exchange.sessionBoundary.storagePathsExposed).toBe(false);
    expect(exchange).not.toHaveProperty("credentialHash");
    expect(exchange).not.toHaveProperty("sessionHash");

    const history = toSelfHostedPatientPortalHistory({
      clinic: { id: "c-1", name: "Клиника" },
      lesions: [{
        id: "lesion-1",
        title: "Очаг A",
        status: "active",
        snapshotCount: 2,
        comparableSnapshotCount: 2,
        diagnosis: "hidden",
      }],
      timeline: [{
        id: "visit-1",
        visitStatus: "closed",
        summary: "Безопасный итог",
        physicianText: "hidden",
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
        lesionsTotal: 2,
        readyForDoctorReview: 1,
        requiresNextCapture: 1,
        visitsWithComparableSeries: 1,
        comparableCoveragePercent: 50,
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
    });
    expect(history.lesions[0].stateLabel).toBe("Врачебная проверка");
    expect(history.timeline[0].stateLabel).toBe("Завершён");
    expect(history.retentionGovernance.status).toBe("policy_in_progress");
    expect(history.comparisonOperations.status).toBe("partial_ready");
    expect(history.comparisonOperations.doctorReviewRequired).toBe(true);
    expect(history.sessionLifecycle.status).toBe("governance_ready");
    expect(history.sessionLifecycle.sessionBoundary.rawTokensExposed).toBe(false);
    expect(history.longitudinalBoundary.comparisonRequiresDoctorReview).toBe(true);
    expect(history.lesions[0]).not.toHaveProperty("diagnosis");
    expect(history.timeline[0]).not.toHaveProperty("physicianText");
  });

  it("fetches portal overview with bearer token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          portal: {
            patient: { id: "p-1", fullName: "Пациент" },
            reports: [],
            reminders: [],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await fetchSelfHostedPatientPortal({
      apiBaseUrl: "https://clinic.local",
      apiToken: "token-1",
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://clinic.local/api/v1/me/portal", {
      method: "GET",
      headers: { Accept: "application/json", Authorization: "Bearer token-1" },
    });
  });

  it("fetches one patient-safe report and maps http errors", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ item: { id: "r-1", patientSafeText: "Отчёт" } }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ).mockResolvedValueOnce(
      new Response(
        JSON.stringify({ error: { code: "not_found", message: "Not found" } }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      ),
    );

    const ok = await fetchSelfHostedPatientPortalReport({
      apiBaseUrl: "https://clinic.local/",
      apiToken: "token-1",
      reportId: "r-1",
    });
    expect(ok.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://clinic.local/api/v1/me/reports/r-1", expect.any(Object));

    const fail = await fetchSelfHostedPatientPortalReport({
      apiBaseUrl: "https://clinic.local",
      apiToken: "token-1",
      reportId: "r-404",
    });
    expect(fail.ok).toBe(false);
    expect(fail.error.code).toBe("not_found");
  });

  it("fetches one patient photo protocol without protected file fields", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          item: {
            id: "ppr-1",
            visitId: "v-1",
            status: "prepared",
            selectedPhotoCount: 1,
            deliveryBoundary: {
              patientDeliveryAllowed: false,
              rawFilesExposed: false,
              signedUrlsIssued: false,
            },
            photos: [{ sequence: 1, kind: "overview_photo", contentType: "image/jpeg" }],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await fetchSelfHostedPatientPortalPhotoProtocol({
      apiBaseUrl: "https://clinic.local/",
      apiToken: "token-1",
      visitId: "v-1",
    });

    expect(result.ok).toBe(true);
    expect(result.value.deliveryBoundary.patientDeliveryAllowed).toBe(false);
    expect(result.value.photos[0].previewAvailable).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/me/photo-protocols/v-1",
      expect.objectContaining({
        method: "GET",
        headers: { Accept: "application/json", Authorization: "Bearer token-1" },
      }),
    );
  });

  it("fetches patient-safe history with policy governance counters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          history: {
            clinic: { id: "c-1", name: "Клиника" },
            lesions: [{ id: "lesion-1", title: "Очаг A", status: "active" }],
            timeline: [{ id: "visit-1", visitStatus: "closed", summary: "Безопасный итог" }],
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
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await fetchSelfHostedPatientPortalHistory({
      apiBaseUrl: "https://clinic.local/",
      apiToken: "token-1",
    });

    expect(result.ok).toBe(true);
    expect(result.value.lesions[0].title).toBe("Очаг A");
    expect(result.value.retentionGovernance.status).toBe("policy_ready");
    expect(result.value.comparisonOperations.status).toBe("needs_capture");
    expect(result.value.sessionLifecycle.status).toBe("governance_ready");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/me/history",
      expect.objectContaining({
        method: "GET",
        headers: { Accept: "application/json", Authorization: "Bearer token-1" },
      }),
    );
  });

  it("fetches one patient photo protocol image through the backend proxy", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("patient-photo", {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Disposition": "inline; filename=\"photo-protocol-1.jpg\"",
        },
      }),
    );

    const result = await fetchSelfHostedPatientPortalPhotoProtocolPhoto({
      apiBaseUrl: "https://clinic.local/",
      apiToken: "token-1",
      visitId: "visit-1",
      sequence: 1,
    });

    expect(result.ok).toBe(true);
    expect(result.value.contentType).toBe("image/jpeg");
    expect(result.value.fileName).toBe("photo-protocol-1.jpg");
    expect(result.value.blob).toBeInstanceOf(Blob);
    expect(result.value.blob.size).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/me/photo-protocols/visit-1/photos/1/download",
      {
        method: "GET",
        headers: { Accept: "image/*", Authorization: "Bearer token-1" },
        credentials: "include",
      },
    );
  });

  it("maps backend proxy deny codes to patient-safe messages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "photo_protocol_session_required", message: "hidden" } }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await fetchSelfHostedPatientPortalPhotoProtocolPhoto({
      apiBaseUrl: "https://clinic.local/",
      apiToken: "token-1",
      visitId: "visit-1",
      sequence: 1,
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("photo_protocol_session_required");
    expect(result.error.message).toBe("Подтвердите доступ к фото-протоколу.");
  });

  it("exchanges a patient photo protocol access credential without exposing secrets", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          item: {
            visitId: "visit-1",
            status: "confirmed",
            accessStatus: "session_boundary_ready",
            sessionExpiresAt: "2026-06-01T12:30:00.000Z",
            credentialHash: "hidden",
            sessionHash: "hidden",
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
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await exchangeSelfHostedPatientPortalPhotoProtocolAccess({
      apiBaseUrl: "https://clinic.local/",
      apiToken: "token-1",
      visitId: "visit-1",
      payload: { credential: "patient one-time credential" },
    });

    expect(result.ok).toBe(true);
    expect(result.value.accessStatus).toBe("session_boundary_ready");
    expect(result.value.sessionBoundary.rawCredentialExposed).toBe(false);
    expect(result.value.sessionBoundary.sessionHashExposed).toBe(false);
    expect(result.value).not.toHaveProperty("credentialHash");
    expect(result.value).not.toHaveProperty("sessionHash");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/me/photo-protocols/visit-1/access/exchange",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: "Bearer token-1",
        },
        body: JSON.stringify({ credential: "patient one-time credential" }),
        credentials: "include",
      },
    );
  });

  it("maps credential exchange deny codes to patient-safe messages", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "photo_protocol_access_credential_invalid", message: "hidden" } }),
        { status: 403, headers: { "Content-Type": "application/json" } },
      ),
    );

    const result = await exchangeSelfHostedPatientPortalPhotoProtocolAccess({
      apiBaseUrl: "https://clinic.local/",
      apiToken: "token-1",
      visitId: "visit-1",
      payload: { credential: "wrong credential" },
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("photo_protocol_access_credential_invalid");
    expect(result.error.message).toBe("Доступ не подтверждён.");
  });

  it("creates booking requests and updates reminder preferences with bearer token", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ item: { id: "br-1", status: "requested", reason: "Плановый контроль" } }),
        { status: 201, headers: { "Content-Type": "application/json" } },
      ),
    ).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          item: {
            appointmentRemindersEnabled: false,
            reportNotificationsEnabled: true,
            preferredChannel: "none",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const booking = await createSelfHostedPatientPortalBookingRequest({
      apiBaseUrl: "https://clinic.local",
      apiToken: "token-1",
      payload: {
        preferredFrom: "2026-06-15T10:00:00.000Z",
        reason: "Плановый контроль",
      },
    });
    const preferences = await updateSelfHostedPatientPortalReminderPreferences({
      apiBaseUrl: "https://clinic.local",
      apiToken: "token-1",
      payload: {
        appointmentRemindersEnabled: false,
        reportNotificationsEnabled: true,
        preferredChannel: "none",
      },
    });

    expect(booking.ok).toBe(true);
    expect(booking.value.status).toBe("requested");
    expect(preferences.ok).toBe(true);
    expect(preferences.value.preferredChannel).toBe("none");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://clinic.local/api/v1/me/booking-requests",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token-1" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://clinic.local/api/v1/me/reminder-preferences",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: "Bearer token-1" }),
      }),
    );
  });
});
