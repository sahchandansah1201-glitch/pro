import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSelfHostedPatientPortalBookingRequest,
  fetchSelfHostedPatientPortal,
  fetchSelfHostedPatientPortalPhotoProtocolPhoto,
  fetchSelfHostedPatientPortalPhotoProtocol,
  fetchSelfHostedPatientPortalReport,
  updateSelfHostedPatientPortalReminderPreferences,
  toSelfHostedPatientPortalOverview,
  toSelfHostedPatientPortalPhotoProtocol,
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
      },
    );
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
