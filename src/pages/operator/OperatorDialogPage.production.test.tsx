import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import OperatorDialogPage from "@/pages/operator/OperatorDialogPage";

vi.mock("@/lib/app-mode", () => ({
  isProductionAppMode: () => true,
}));

vi.mock("@/lib/self-hosted-api-session", () => ({
  isSelfHostedApiConfigured: (session: { status: string; apiToken: string | null }) =>
    session.status === "configured" && Boolean(session.apiToken),
  useSelfHostedApiSession: () => ({
    apiBaseUrl: "https://clinic.local",
    apiToken: "operator-live-token",
    status: "configured",
    user: {
      id: "operator-1",
      displayName: "Ольга Оператор",
      roles: ["operator"],
    },
  }),
}));

const bookingRequest = {
  id: "10000000-0000-4000-8000-000000000501",
  clinicId: "clinic-1",
  patientId: "patient-1",
  requestedByUserId: "patient-user-1",
  preferredFrom: "2026-07-11T09:30:00.000Z",
  preferredTo: "2026-07-11T10:30:00.000Z",
  reason: "Плановый осмотр",
  status: "requested",
  assignedVisitId: null,
  reviewedByUserId: null,
  reviewedAt: null,
  clinicNote: null,
  createdAt: "2026-07-10T09:00:00.000Z",
  updatedAt: "2026-07-10T09:00:00.000Z",
  patient: { id: "patient-1", fullName: "Иван Пациент", code: "DP-PRIVATE-001" },
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
    <MemoryRouter initialEntries={[`/operator/dialogs/${bookingRequest.id}`]}>
      <Routes>
        <Route path="/operator/dialogs/:id" element={<OperatorDialogPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("OperatorDialogPage · production booking request card", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads a real request, validates the note, and persists operator work", async () => {
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith(`/api/v1/clinic/booking-requests/${bookingRequest.id}`) && init?.method === "PATCH") {
        const payload = JSON.parse(String(init.body ?? "{}")) as { status?: string; clinicNote?: string };
        return json({
          item: {
            ...bookingRequest,
            status: payload.status ?? "reviewing",
            clinicNote: payload.clinicNote ?? null,
          },
        });
      }
      return json({ item: bookingRequest });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Карточка обращения" })).toBeInTheDocument();
    expect(screen.getByText("Иван Пациент")).toBeInTheDocument();
    expect(screen.getByText("Плановый осмотр")).toBeInTheDocument();
    expect(screen.getByText("Данные обращения загружены из системы клиники.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("DP-PRIVATE-001");
    expect(document.body).not.toHaveTextContent(bookingRequest.id);

    fireEvent.click(screen.getByRole("button", { name: "Сохранить заметку" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Введите заметку клиники.");
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("Заметка клиники по обращению"), {
      target: { value: "Пациенту нужно уточнить удобное время." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить заметку" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(1);
    });
    expect(await screen.findByText("Заметка сохранена. Обращение взято в работу.")).toBeInTheDocument();
    expect(screen.getAllByText("В работе").length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://clinic.local/api/v1/clinic/booking-requests/${bookingRequest.id}`,
      {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer operator-live-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "reviewing",
          clinicNote: "Пациенту нужно уточнить удобное время.",
        }),
      },
    );
  });
});
