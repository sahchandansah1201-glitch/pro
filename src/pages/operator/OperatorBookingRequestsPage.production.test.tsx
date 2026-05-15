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
  preferredFrom: "2026-05-16T09:30:00.000Z",
  preferredTo: "2026-05-16T10:30:00.000Z",
  reason: "Плановый контроль",
  status: "requested",
  assignedVisitId: null,
  reviewedByUserId: null,
  reviewedAt: null,
  clinicNote: null,
  createdAt: "2026-05-15T09:00:00.000Z",
  updatedAt: "2026-05-15T09:00:00.000Z",
  patient: { id: "patient-1", fullName: "Live Booking Patient", code: "DP-LIVE-BOOK" },
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
      if (href.endsWith("/api/v1/clinic/booking-requests/request-live-1") && init?.method === "PATCH") {
        const payload = JSON.parse(String(init.body ?? "{}")) as { status?: string; clinicNote?: string };
        return json({ item: { ...request, status: payload.status || "reviewing", clinicNote: payload.clinicNote || null } });
      }
      return json({ items: [request], count: 1, limit: 25, offset: 0, filters: { status: "all", search: null } });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    expect(await screen.findByText("Production booking requests")).toBeInTheDocument();
    expect(screen.getByText("Live Booking Patient · DP-LIVE-BOOK")).toBeInTheDocument();
    expect(screen.getByText(/self-hosted backend \/api\/v1\/clinic\/booking-requests/i)).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "Открыть заявку на запись request-live-1" }));
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
            assignedVisitId: null,
          }),
        }),
      );
    });
    expect(await screen.findByText(/Запрос request-live-1: статус В работе/i)).toBeInTheDocument();
  });
});
