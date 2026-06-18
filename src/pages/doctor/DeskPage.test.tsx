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
                safeSummary: "Новая заявка из системы клиники",
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
                safeSummary: "Запрос с сайта",
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
                safeSummary: "Запрос с сайта",
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
                  safeSummary: "Запрос с сайта",
                  createdAt: "2026-05-15T08:00:00.000Z",
                  clinic: { name: "Клиника связи" },
                  patient: {
                    id: "10000000-0000-4000-8000-000000000201",
                    fullName: "Пациент клиники",
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
                    fullName: "Пациент клиники",
                    code: "DP-LIVE-1",
                  },
                  clinic: { name: "Клиника связи" },
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
                  patientFullName: "Пациент клиники",
                  patientCode: "DP-LIVE-1",
                  clinicName: "Клиника связи",
                  status: "in_progress",
                  startedAt: "2026-05-15T09:00:00.000Z",
                  chiefComplaint: "Контроль",
                },
              ],
              awaitingConclusions: [],
              recentPatients: [
                {
                  id: "10000000-0000-4000-8000-000000000201",
                  fullName: "Пациент клиники",
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
                  patientFullName: "Пациент клиники",
                  kind: "dermoscopy",
                  issue: "checksum_missing",
                },
              ],
              devices: [
                {
                  id: "d-1",
                  model: "Дерматоскоп рабочий",
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

    expect(await screen.findAllByText("Пациент клиники")).toHaveLength(5);
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
      screen.getAllByText("Источник данных: система клиники.").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      await screen.findByRole("button", {
        name: "Квалифицировать заявку: Запрос с сайта",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Источник данных: система клиники.").length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("1/1")).toBeInTheDocument();
    expect(screen.getByText("Дерматоскоп рабочий")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Иванова Наталья Олеговна");
    expect(document.body.textContent).not.toContain("Демо-режим");
    expect(document.body.textContent).not.toContain("DP-LIVE-1");
    expect(document.body.textContent).not.toContain("DL-LIVE");
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

    fireEvent.change(screen.getByLabelText("Краткое описание заявки"), {
      target: { value: "Новая заявка из системы клиники" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Добавить заявку" }));
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
      await screen.findByText(/создана в системе клиники/i),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Квалифицировать заявку: Запрос с сайта",
      }),
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
        name: "Создать запись из заявки: Запрос с сайта",
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
