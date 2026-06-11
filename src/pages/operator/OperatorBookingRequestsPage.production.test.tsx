import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import OperatorBookingRequestsPage from "@/pages/operator/OperatorBookingRequestsPage";

vi.mock("@/lib/app-mode", () => ({
  isProductionAppMode: () => true,
}));

vi.mock("@/lib/self-hosted-api-session", () => ({
  isSelfHostedApiConfigured: (session: { status: string; apiToken: string | null }) =>
    session.status === "configured" && Boolean(session.apiToken),
  useSelfHostedApiSession: () => ({
    apiBaseUrl: "https://clinic.local",
    apiToken: "stage5p-token",
    status: "configured",
    user: {
      id: "operator-1",
      displayName: "Ольга Оператор",
      roles: ["operator"],
    },
  }),
}));

const request = {
  id: "request-live-1",
  clinicId: "clinic-1",
  patientId: "patient-1",
  requestedByUserId: "patient-user-1",
  preferredFrom: "2026-06-16T09:30:00.000Z",
  preferredTo: "2026-06-16T10:30:00.000Z",
  reason: "Плановый контроль",
  status: "requested",
  assignedVisitId: null,
  reviewedByUserId: null,
  reviewedAt: null,
  clinicNote: null,
  createdAt: "2026-05-15T09:00:00.000Z",
  updatedAt: "2026-05-15T09:00:00.000Z",
  patient: { id: "patient-1", fullName: "Иван Пациент", code: "DP-LIVE-BOOK" },
  clinic: { id: "clinic-1", slug: "derma-pro", name: "Дерма-Про" },
  assignedVisit: null,
};

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

function renderPage() {
  return render(
    <MemoryRouter>
      <OperatorBookingRequestsPage />
    </MemoryRouter>,
  );
}

describe("OperatorBookingRequestsPage · Stage 5P production booking intake", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads clinic booking requests from self-hosted backend and updates status", async () => {
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/v1/integrations/booking-imports?limit=5")) {
        return json({
          items: [{
            id: "batch-live-1",
            sourceSystem: "clinic_crm",
            status: "completed",
            itemCount: 2,
            acceptedBookingCount: 1,
            acceptedSlotCount: 1,
            rejectedCount: 0,
            duplicateCount: 0,
            hardeningVersion: "stage5t",
          }],
          count: 1,
          limit: 5,
          offset: 0,
          filters: { sourceSystem: "all" },
        });
      }
      if (href.endsWith("/api/v1/integrations/booking-imports/status")) {
        return json({
          item: {
            sourceSystem: "all",
            recentBatchCount: 1,
            rejectedLast24h: 0,
            duplicateLast24h: 0,
            latestImportAt: "2026-05-15T10:00:00.000Z",
            openBookingRequestCount: 1,
            availableSlotCount: 1,
            storedRawPayload: false,
            runtimeCallsExternalSystems: false,
            hardeningVersion: "stage5t",
            latestBySource: [],
          },
        });
      }
      if (href.endsWith("/api/v1/clinic/available-slots?status=available&limit=5")) {
        return json({
          items: [{
            id: "slot-live-1",
            sourceSystem: "clinic_crm",
            externalSlotId: "crm-slot-1",
            startedAt: "2026-06-16T10:00:00.000Z",
            durationMinutes: 30,
            status: "available",
            doctor: { displayName: "Доктор Иванова" },
          }],
          count: 1,
          limit: 5,
          offset: 0,
          filters: { sourceSystem: "all", status: "available" },
        });
      }
      if (href.endsWith("/api/v1/clinic/booking-requests/request-live-1") && init?.method === "PATCH") {
        const payload = JSON.parse(String(init.body ?? "{}")) as { status?: string; clinicNote?: string };
        return json({ item: { ...request, status: payload.status || "reviewing", clinicNote: payload.clinicNote || null } });
      }
      if (href.endsWith("/api/v1/clinic/booking-requests/request-live-1/book-from-slot") && init?.method === "POST") {
        return json({
          item: {
            ...request,
            status: "booked",
            assignedVisitId: "visit-live-1",
            assignedVisit: {
              id: "visit-live-1",
              startedAt: "2026-06-16T10:00:00.000Z",
              status: "draft",
            },
          },
        });
      }
      return json({ items: [request], count: 1, limit: 25, offset: 0, filters: { status: "all", search: null } });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    expect(await screen.findByText("Очередь заявок на запись")).toBeInTheDocument();
    expect(await screen.findByText("Готовность свободных окон")).toBeInTheDocument();
    expect(screen.getByText(/Готово — Можно подтверждать записи через локальное свободное окно/i)).toBeInTheDocument();
    expect(screen.getByText(/Свободные окна проверяются по локальному расписанию/i)).toBeInTheDocument();
    expect(screen.getByText("Конфликтов синхронизации не найдено.")).toBeInTheDocument();
    expect(await screen.findByText("Входящие источники записи")).toBeInTheDocument();
    expect(screen.getByText(/Система клиники · готово/i)).toBeInTheDocument();
    expect(screen.getByText(/Защита импорта включена/i)).toBeInTheDocument();
    expect(screen.getByText(/внешние вызовы выключены/i)).toBeInTheDocument();
    expect(screen.getByText("Дубликаты 24ч")).toBeInTheDocument();
    expect(await screen.findByText("Свободные окна клиники")).toBeInTheDocument();
    expect(screen.getByText(/Доктор Иванова · Система клиники/i)).toBeInTheDocument();
    expect(screen.getByText("Иван Пациент · DP-LIVE-BOOK")).toBeInTheDocument();
    expect(screen.getByText("Данные загружены из системы клиники.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Демо-режим");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/clinic/booking-requests?limit=25",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer stage5p-token",
        },
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "Открыть заявку на запись: Иван Пациент" }));
    fireEvent.change(screen.getByLabelText("Заметка клиники по заявке"), {
      target: { value: "Позвонить пациенту" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://clinic.local/api/v1/clinic/booking-requests/request-live-1",
        expect.objectContaining({
          method: "PATCH",
          headers: expect.objectContaining({
            Authorization: "Bearer stage5p-token",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            status: "reviewing",
            clinicNote: "Позвонить пациенту",
          }),
        }),
      );
    });
    expect(await screen.findByText(/Заявка: статус В работе/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Свободное окно для записи"), {
      target: { value: "slot-live-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить запись" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://clinic.local/api/v1/clinic/booking-requests/request-live-1/book-from-slot",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer stage5p-token",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({
            slotId: "slot-live-1",
            clinicNote: "Позвонить пациенту",
          }),
        }),
      );
    });
    expect(await screen.findByText("Заявка записана на визит.")).toBeInTheDocument();
  });
});
