import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PrivatePracticePage from "./PrivatePracticePage";
import { canRoleAccess } from "@/lib/access";
import { ROLE_BY_ID } from "@/lib/roles";

const mocks = vi.hoisted(() => ({
  productionMode: false,
  getDashboard: vi.fn(),
  listLeads: vi.fn(),
  createLead: vi.fn(),
}));

vi.mock("@/lib/app-mode", () => ({
  isProductionAppMode: () => mocks.productionMode,
}));

vi.mock("@/lib/self-hosted-api-session", () => ({
  isSelfHostedApiConfigured: () => true,
  useSelfHostedApiSession: () => ({
    apiBaseUrl: "https://clinic.local",
    apiToken: "token-private",
    status: "configured",
    user: {
      id: "owner-1",
      displayName: "Морозов Дмитрий Игоревич",
      roles: ["clinic_admin", "private_doctor"],
    },
  }),
}));

vi.mock("@/lib/self-hosted-dashboard-api", () => ({
  getSelfHostedDoctorDashboard: mocks.getDashboard,
}));

vi.mock("@/lib/self-hosted-leads-appointments-api", () => ({
  createSelfHostedLead: mocks.createLead,
  listSelfHostedLeadsAppointments: mocks.listLeads,
}));

function dashboardFixture() {
  return {
    kpis: {
      visitsToday: 1,
      activeVisits: 2,
      awaitingConclusion: 1,
      patientsInScope: 5,
      assetsNeedReview: 1,
      devicesTotal: 1,
      devicesActive30d: 1,
    },
    upcoming: [
      {
        id: "visit-1",
        patientId: "patient-1",
        patientFullName: "Пациент кабинета",
        patientCode: "DP-HIDDEN-1",
        clinicId: "clinic-1",
        clinicName: "Кабинет Морозова",
        status: "in_progress",
        startedAt: "2026-06-28T09:00:00.000Z",
        signedAt: null,
        chiefComplaint: "Контроль",
      },
    ],
    awaitingConclusions: [],
    recentPatients: [],
    assetIssues: [
      {
        id: "asset-1",
        visitId: "visit-1",
        patientId: "patient-1",
        patientFullName: "Пациент кабинета",
        kind: "dermoscopy",
        contentType: "image/jpeg",
        byteSize: 1200,
        capturedAt: "2026-06-28T09:10:00.000Z",
        issue: "checksum_missing",
      },
    ],
    devices: [
      {
        id: "device-1",
        model: "РДС 3",
        serial: "SERIAL-HIDDEN",
        status: "active",
        lastSeenAt: "2026-06-28T09:15:00.000Z",
      },
    ],
  };
}

function leadsFixture() {
  return {
    kpis: {
      leadsTotal: 1,
      newLeads: 1,
      qualifiedLeads: 0,
      bookedLeads: 0,
      plannedAppointments: 1,
      completedAppointments: 0,
    },
    leads: [
      {
        id: "lead-1",
        clinicId: "clinic-1",
        patientId: null,
        source: "operator",
        status: "new",
        safeSummary: "Первичная заявка",
        createdAt: "2026-06-28T10:00:00.000Z",
        updatedAt: "2026-06-28T10:00:00.000Z",
        patient: { id: null, fullName: null, code: null },
        clinic: { id: "clinic-1", slug: "private", name: "Кабинет Морозова" },
      },
    ],
    appointments: [],
    filters: {
      leadStatus: "all",
      appointmentStatus: "all",
      dateFrom: null,
      dateTo: null,
      search: null,
    },
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PrivatePracticePage />
    </MemoryRouter>,
  );
}

describe("PrivatePracticePage · private doctor practice center", () => {
  beforeEach(() => {
    mocks.productionMode = false;
    mocks.getDashboard.mockReset();
    mocks.listLeads.mockReset();
    mocks.createLead.mockReset();
    mocks.getDashboard.mockResolvedValue({ ok: true, value: dashboardFixture(), error: null });
    mocks.listLeads.mockResolvedValue({ ok: true, value: leadsFixture(), error: null });
    mocks.createLead.mockResolvedValue({
      ok: true,
      value: {
        id: "lead-created",
        safeSummary: "Новая заявка частного кабинета",
        status: "new",
        source: "operator",
        patient: { id: null, fullName: null, code: null },
        clinic: { id: "clinic-1", slug: "private", name: "Кабинет Морозова" },
      },
      error: null,
    });
  });

  it("keeps the demo practice surface only in demo mode", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Центр частной практики" })).toBeInTheDocument();
    expect(screen.getByText(/Учебный режим: показаны рабочие очереди частного врача/i)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Рабочий день" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Очередь частной практики" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Финансы и оплата" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Заявки на запись" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Качество фото" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Готовность кабинета" })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Открыть рабочее место врача" })).toHaveAttribute(
      "href",
      "/cockpit",
    );
    expect(screen.getByRole("link", { name: "Перейти к съёмке" })).toHaveAttribute(
      "href",
      "/capture",
    );
    expect(screen.getByRole("link", { name: "Открыть отчёты" })).toHaveAttribute(
      "href",
      "/reports",
    );
    expect(screen.getByRole("link", { name: "Настроить услуги" })).toHaveAttribute(
      "href",
      "/admin/services",
    );
  });

  it("renders the production private practice from working APIs and creates an intake request", async () => {
    mocks.productionMode = true;

    renderPage();

    expect(await screen.findByRole("heading", { name: "Центр частной практики" })).toBeInTheDocument();
    expect(await screen.findByText("Источник данных: система клиники.")).toBeInTheDocument();
    expect(screen.getByText(/Морозов Дмитрий Игоревич · Кабинет Морозова/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Сводка частной практики" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Очередь частной практики" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Заявки на запись" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Готовность кабинета" })).toBeInTheDocument();

    expect(document.body.textContent).not.toMatch(
      /Учебный режим|учебн|демо|mock|backend|self-hosted|PostgreSQL|system_admin|storagePath|signedUrl|accessToken|qrToken|sessionId|credential|DP-HIDDEN|SERIAL-HIDDEN/i,
    );

    fireEvent.change(screen.getByLabelText("Краткое описание заявки"), {
      target: { value: "Новая заявка частного кабинета" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Добавить заявку" }));

    await waitFor(() =>
      expect(mocks.createLead).toHaveBeenCalledWith({
        apiBaseUrl: "https://clinic.local",
        apiToken: "token-private",
        payload: {
          source: "operator",
          safeSummary: "Новая заявка частного кабинета",
        },
      }),
    );
    expect(await screen.findByText(/Заявка создана в системе клиники/)).toBeInTheDocument();
  });

  it("is routed only to private doctors", () => {
    expect(canRoleAccess("private_doctor", "/practice")).toBe(true);
    expect(canRoleAccess("doctor", "/practice")).toBe(false);
    expect(canRoleAccess("clinic_admin", "/practice")).toBe(false);
    expect(ROLE_BY_ID.private_doctor.home).toBe("/practice");
  });
});
