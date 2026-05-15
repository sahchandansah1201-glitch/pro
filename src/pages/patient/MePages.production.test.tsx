import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MeHomePage from "./MeHomePage";
import MeReportPage from "./MeReportPage";
import MeReportsPage from "./MeReportsPage";
import MeBookingPage from "./MeBookingPage";
import MeRemindersPage from "./MeRemindersPage";

vi.mock("@/lib/app-mode", () => ({
  isProductionAppMode: () => true,
}));

vi.mock("@/lib/self-hosted-api-session", () => ({
  useSelfHostedApiSession: () => ({
    apiBaseUrl: "https://clinic.local",
    apiToken: "patient-token",
    status: "configured",
    user: { id: "patient-user", displayName: "Пациент", roles: ["patient"] },
  }),
}));

const portal = {
  portal: {
    patient: {
      id: "patient-live-1",
      code: "DP-LIVE",
      fullName: "Пациент Production",
      clinic: { id: "clinic-1", name: "Live Clinic" },
    },
    nextAppointment: {
      id: "visit-live-1",
      visitId: "visit-live-1",
      status: "planned",
      startedAt: "2026-06-01T10:00:00.000Z",
      clinic: { id: "clinic-1", name: "Live Clinic" },
    },
    reports: [{
      id: "report-live-1",
      visitId: "visit-live-1",
      status: "signed",
      visitDate: "2026-05-20T10:00:00.000Z",
      signedAt: "2026-05-20T11:00:00.000Z",
      summary: "Пациентское заключение",
      patientSafeText: "Текст для пациента без врачебных внутренних данных.",
      physicianText: "Скрытый врачебный текст",
      clinic: { id: "clinic-1", name: "Live Clinic" },
      doctor: { id: "doctor-1", displayName: "Доктор" },
    }],
    reminders: [{ id: "rem-1", source: "appointment", title: "Ближайший приём", dueAt: "2026-06-01T10:00:00.000Z" }],
  },
};

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  }));
}

function mockFetch() {
  const fetchMock = vi.fn((url: string | URL | Request) => {
    const href = String(url);
    if (href.endsWith("/api/v1/me/portal")) return response(portal);
    if (href.endsWith("/api/v1/me/reports/report-live-1")) {
      return response({
        item: {
          ...portal.portal.reports[0],
          physicianText: "Скрытый врачебный текст",
        },
      });
    }
    return response({ error: { code: "not_found", message: "Not found" } }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/me" element={<MeHomePage />} />
        <Route path="/me/reports" element={<MeReportsPage />} />
        <Route path="/me/reports/:id" element={<MeReportPage />} />
        <Route path="/me/booking" element={<MeBookingPage />} />
        <Route path="/me/reminders" element={<MeRemindersPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Patient portal · Stage 5N production", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads /me from self-hosted patient portal without demo copy", async () => {
    const fetchMock = mockFetch();
    renderRoute("/me");

    expect(await screen.findByText(/Production portal подключён/i)).toBeInTheDocument();
    expect(screen.getByText(/Пациент Production/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Демо-режим");
    expect(document.body).not.toHaveTextContent("Скрытый врачебный текст");
    expect(fetchMock).toHaveBeenCalledWith("https://clinic.local/api/v1/me/portal", {
      method: "GET",
      headers: { Accept: "application/json", Authorization: "Bearer patient-token" },
    });
  });

  it("renders reports list and one report through patient-safe endpoints", async () => {
    mockFetch();
    const list = renderRoute("/me/reports");
    expect(await screen.findByText("Пациентское заключение")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Скрытый врачебный текст");
    list.unmount();

    renderRoute("/me/reports/report-live-1");
    expect(await screen.findByText("Заключение для пациента")).toBeInTheDocument();
    expect(screen.getByText(/Текст для пациента/)).toBeInTheDocument();
    await waitFor(() => expect(document.body).not.toHaveTextContent("Скрытый врачебный текст"));
  });

  it("shows production booking and reminders as read-only backend state", async () => {
    mockFetch();
    const booking = renderRoute("/me/booking");
    expect(await screen.findByText("Самозапись пациента")).toBeInTheDocument();
    expect(screen.getByText(/отдельным write-контрактом/i)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Подтвердить (демо)");
    booking.unmount();

    renderRoute("/me/reminders");
    expect(await screen.findByText("Ближайший приём")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Отметить выполнено");
  });
});
