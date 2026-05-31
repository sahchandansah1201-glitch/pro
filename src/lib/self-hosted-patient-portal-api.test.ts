import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSelfHostedPatientPortalBookingRequest,
  fetchSelfHostedPatientPortal,
  fetchSelfHostedPatientPortalReport,
  updateSelfHostedPatientPortalReminderPreferences,
  toSelfHostedPatientPortalOverview,
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
