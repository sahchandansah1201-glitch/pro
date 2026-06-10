import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import DeskPage from "@/pages/doctor/DeskPage";

vi.mock("@/lib/app-mode", () => ({
  isProductionAppMode: () => true,
}));

vi.mock("@/lib/self-hosted-api-session", () => ({
  isSelfHostedApiConfigured: () => true,
  useSelfHostedApiSession: () => ({
    apiBaseUrl: "https://clinic.local",
    apiToken: "token-5i",
    status: "configured",
    user: { id: "u-1", displayName: "Ирина Соколова", roles: ["doctor"] },
  }),
}));

describe("DeskPage · Stage 5I production dashboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads production dashboard from self-hosted backend without mock fallback", async () => {
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/api/v1/leads") && init?.method === "POST") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              stage: "5L",
              item: {
                id: "lead-created-1",
                source: "operator",
                status: "new",
                safeSummary: "Новый лид self-hosted",
              },
            }),
            { status: 201, headers: { "content-type": "application/json" } },
          ),
        );
      }

      if (
        url.endsWith("/api/v1/leads/lead-live-1") &&
        init?.method === "PATCH"
      ) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              stage: "5L",
              item: {
                id: "lead-live-1",
                source: "site",
                status: "qualified",
                safeSummary: "Live lead from site",
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      }

      if (
        url.endsWith("/api/v1/leads/lead-live-1/book-appointment") &&
        init?.method === "POST"
      ) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              stage: "5L",
              item: {
                id: "lead-live-1",
                source: "site",
                status: "booked",
                safeSummary: "Live lead from site",
              },
              appointment: {
                id: "visit-booked-1",
                visitId: "visit-booked-1",
                status: "planned",
              },
            }),
            { status: 201, headers: { "content-type": "application/json" } },
          ),
        );
      }

      if (url.endsWith("/api/v1/leads/appointments?limit=5")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              stage: "5K",
              source: "postgres",
              kpis: {
                leadsTotal: 2,
                newLeads: 1,
                qualifiedLeads: 1,
                bookedLeads: 0,
                plannedAppointments: 3,
                completedAppointments: 1,
              },
              leads: [
                {
                  id: "lead-live-1",
                  source: "site",
                  status: "new",
                  safeSummary: "Live lead from site",
                  createdAt: "2026-05-15T08:00:00.000Z",
                  clinic: { name: "Live Clinic" },
                  patient: {
                    id: "10000000-0000-4000-8000-000000000201",
                    fullName: "Live Patient",
                    code: "DP-LIVE-1",
                  },
                },
              ],
              appointments: [
                {
                  id: "10000000-0000-4000-8000-000000000301",
                  visitId: "10000000-0000-4000-8000-000000000301",
                  patientId: "10000000-0000-4000-8000-000000000201",
                  status: "planned",
                  channel: "self_hosted",
                  slotAt: "2026-05-15T09:00:00.000Z",
                  patient: {
                    id: "10000000-0000-4000-8000-000000000201",
                    fullName: "Live Patient",
                    code: "DP-LIVE-1",
                  },
                  clinic: { name: "Live Clinic" },
                },
              ],
              filters: {
                leadStatus: "all",
                appointmentStatus: "all",
                dateFrom: null,
                dateTo: null,
                search: null,
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      }

      return Promise.resolve(
        new Response(
          JSON.stringify({
            stage: "5I",
            source: "postgres",
            dashboard: {
              kpis: {
                visitsToday: 2,
                activeVisits: 3,
                awaitingConclusion: 1,
                patientsInScope: 8,
                assetsNeedReview: 4,
                devicesTotal: 2,
                devicesActive30d: 1,
              },
              upcoming: [
                {
                  id: "10000000-0000-4000-8000-000000000301",
                  patientId: "10000000-0000-4000-8000-000000000201",
                  patientFullName: "Live Patient",
                  patientCode: "DP-LIVE-1",
                  clinicName: "Live Clinic",
                  status: "in_progress",
                  startedAt: "2026-05-15T09:00:00.000Z",
                  chiefComplaint: "Контроль",
                },
              ],
              awaitingConclusions: [],
              recentPatients: [
                {
                  id: "10000000-0000-4000-8000-000000000201",
                  fullName: "Live Patient",
                  code: "DP-LIVE-1",
                  sex: "female",
                  lastVisitAt: "2026-05-15T09:00:00.000Z",
                },
              ],
              assetIssues: [
                {
                  id: "asset-live-1",
                  visitId: "10000000-0000-4000-8000-000000000301",
                  patientId: "10000000-0000-4000-8000-000000000201",
                  patientFullName: "Live Patient",
                  kind: "dermoscopy",
                  issue: "checksum_missing",
                },
              ],
              devices: [
                {
                  id: "d-1",
                  model: "DermLite Live",
                  serial: "DL-LIVE",
                  status: "active",
                },
              ],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <DeskPage />
      </MemoryRouter>,
    );

    expect(await screen.findAllByText("Live Patient")).toHaveLength(5);
    const currentAction = screen.getByRole("region", {
      name: "Что делать сейчас",
    });
    expect(
      within(currentAction).getByText("Следующий шаг: Проверить снимки"),
    ).toBeInTheDocument();
    const currentActionLink = within(currentAction).getByRole("link", {
      name: "Открыть замечания к снимкам",
    });
    expect(currentActionLink).toHaveAttribute("href", "#desk-photo-quality");
    expect(
      screen.getByRole("region", { name: "Сводка рабочего дня" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Сегодня и заключения" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Качество и пациенты" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Практика и оборудование" }),
    ).toBeInTheDocument();
    expect(document.querySelector("#desk-visits")).toBeTruthy();
    expect(document.querySelector("#desk-reports")).toBeTruthy();
    expect(document.querySelector("#desk-photo-quality")).toBeTruthy();
    expect(document.querySelector("#desk-recent-patients")).toBeTruthy();
    expect(document.querySelector("#desk-leads")).toBeTruthy();
    expect(document.querySelector("#desk-devices")).toBeTruthy();
    expect(
      screen.getByText(
        /Источник данных: self-hosted backend \/api\/v1\/doctor\/dashboard/,
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", {
        name: "Квалифицировать лид lead-live-1",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/self-hosted backend \/api\/v1\/leads\/appointments/),
    ).toBeInTheDocument();
    expect(screen.getByText("1/1")).toBeInTheDocument();
    expect(screen.getByText("DermLite Live")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Иванова Наталья Олеговна");
    expect(document.body.textContent).not.toContain("Демо-режим");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/doctor/dashboard",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer token-5i",
        },
      },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/leads/appointments?limit=5",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer token-5i",
        },
      },
    );

    fireEvent.change(screen.getByLabelText("Краткое описание лида"), {
      target: { value: "Новый лид self-hosted" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Добавить лид" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "https://clinic.local/api/v1/leads",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer token-5i",
            "Content-Type": "application/json",
          }),
        }),
      ),
    );
    expect(
      await screen.findByText(/создан в self-hosted backend/i),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Квалифицировать лид lead-live-1" }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "https://clinic.local/api/v1/leads/lead-live-1",
        expect.objectContaining({
          method: "PATCH",
        }),
      ),
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Создать запись из лида lead-live-1",
      }),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "https://clinic.local/api/v1/leads/lead-live-1/book-appointment",
        expect.objectContaining({
          method: "POST",
        }),
      ),
    );
  });
});
