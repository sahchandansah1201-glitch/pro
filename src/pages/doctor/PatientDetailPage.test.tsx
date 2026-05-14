import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import {
  SELF_HOSTED_API_BASE_URL_KEY,
  SELF_HOSTED_API_TOKEN_KEY,
} from "@/lib/self-hosted-api-session";

import PatientDetailPage from "./PatientDetailPage";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/patients/:id" element={<PatientDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

function configureProductionSession() {
  vi.stubEnv("VITE_APP_MODE", "production");
  window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:8080");
  window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "local-jwt");
}

describe("PatientDetailPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("keeps the demo patient detail available outside production mode", () => {
    renderAt("/patients/p-001");

    expect(screen.getByRole("heading", { name: "Иванова Наталья Олеговна" })).toBeInTheDocument();
    expect(screen.getAllByText(/DP-2026-0001/).length).toBeGreaterThan(0);
  });

  it("loads production patient detail and visits from self-hosted backend without demo lookup", async () => {
    configureProductionSession();
    const fetchMock = vi.fn((url: RequestInfo | URL, _init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/v1/patients/live-patient")) {
        return Promise.resolve(
          jsonResponse({
            item: {
              id: "live-patient",
              code: "DP-live-001",
              fullName: "Петрова Анна Live",
              birthDate: "1990-01-02",
              sex: "female",
              phototype: "III",
              imagingConsent: true,
            },
          }),
        );
      }
      if (href.endsWith("/api/v1/patients/live-patient/visits")) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: "live-visit",
                clinicId: "clinic-1",
                patientId: "live-patient",
                doctorUserId: "doctor-1",
                status: "in_progress",
                startedAt: "2026-05-12T09:00:00.000Z",
                signedAt: null,
                chiefComplaint: "контроль live",
                createdAt: "2026-05-12T08:00:00.000Z",
                updatedAt: "2026-05-12T09:00:00.000Z",
              },
            ],
          }),
        );
      }
      return Promise.resolve(jsonResponse({ items: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAt("/patients/live-patient");

    expect(await screen.findByRole("heading", { name: "Петрова Анна Live" })).toBeInTheDocument();
    expect(screen.getByText(/Источник данных: self-hosted backend/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Визиты \(1\)/ })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    for (const [, init] of fetchMock.mock.calls) {
      expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer local-jwt" });
    }
  });

  it("does not fall back to mock patient data when production backend returns an error", async () => {
    configureProductionSession();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: { code: "forbidden", message: "forbidden" }, correlationId: "cid" },
          { status: 403 },
        ),
      ),
    );

    renderAt("/patients/p-001");

    expect(await screen.findByRole("heading", { name: "Карточка пациента недоступна" })).toBeInTheDocument();
    expect(screen.getByText(/Недостаточно прав/)).toBeInTheDocument();
    expect(screen.queryByText("Иванова Наталья Олеговна")).not.toBeInTheDocument();
    expect(screen.queryByText(/карточка пациента отсутствует в демо-данных/i)).not.toBeInTheDocument();
  });
});
