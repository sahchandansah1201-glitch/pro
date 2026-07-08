import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import BotMiniAppBookingPage from "./BotMiniAppBookingPage";

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
      clinic: { id: "clinic-1", slug: "clinic", name: "Клиника Production" },
    },
    nextAppointment: null,
    reports: [],
    reminders: [],
    reminderPreferences: {
      appointmentRemindersEnabled: true,
      reportNotificationsEnabled: true,
      preferredChannel: "email",
    },
    bookingRequests: [{
      id: "booking-live-1",
      status: "requested",
      preferredFrom: "2026-06-15T10:00:00.000Z",
      preferredTo: null,
      reason: "Плановый контроль",
      clinic: { id: "clinic-1", slug: "clinic", name: "Клиника Production" },
      createdAt: "2026-06-01T10:00:00.000Z",
    }],
  },
};

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  }));
}

function renderPage() {
  return render(
    <MemoryRouter>
      <BotMiniAppBookingPage />
    </MemoryRouter>,
  );
}

describe("BotMiniAppBookingPage · production booking", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates a self-hosted patient booking request without demo copy", async () => {
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/v1/me/portal")) return json(portal);
      if (href.endsWith("/api/v1/me/booking-requests") && init?.method === "POST") {
        return json({
          item: {
            id: "booking-live-2",
            status: "requested",
            preferredFrom: "2026-07-18T10:00:00.000Z",
            preferredTo: null,
            reason: "Запись через помощника",
          },
        }, 201);
      }
      return json({ error: { code: "not_found", message: "Not found" } }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    expect(await screen.findByRole("heading", { name: "Помощник записи" })).toBeInTheDocument();
    expect(screen.getByText("Пациент Production")).toBeInTheDocument();
    expect(screen.getByText("Плановый контроль")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Учебн|демо|mock|backend|self-hosted|PostgreSQL|accessToken|sessionId|credential/i);

    fireEvent.change(screen.getByLabelText("Предпочтительное начало записи"), {
      target: { value: "2026-07-18T10:00" },
    });
    fireEvent.change(screen.getByLabelText("Причина запроса на запись"), {
      target: { value: "Запись через помощника" },
    });
    const submit = screen.getByRole("button", { name: "Отправить заявку" });
    expect(submit).toHaveClass("min-h-[44px]");
    fireEvent.click(submit);

    expect(await screen.findByText("Заявка на запись отправлена в клинику.")).toBeInTheDocument();
    expect(await screen.findByText("Запись через помощника")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/me/booking-requests",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
