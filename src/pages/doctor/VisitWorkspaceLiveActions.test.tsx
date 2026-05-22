import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SELF_HOSTED_API_BASE_URL_KEY,
  SELF_HOSTED_API_TOKEN_KEY,
  SELF_HOSTED_API_USER_KEY,
} from "@/lib/self-hosted-api-session";
import type { Lesion, Visit } from "@/lib/domain";
import { VisitWorkspaceLiveActions } from "./VisitWorkspaceLiveActions";

const BASE = "http://localhost:3001";
const TOKEN = "header.payload.signature";
const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const LESION_ID = "10000000-0000-4000-8000-000000000401";

const visit: Visit = {
  id: VISIT_ID,
  patientId: "p-1",
  doctorId: "u-1",
  assistantId: null,
  clinicId: "c-1",
  status: "in_progress",
  startedAt: "2026-05-13T09:00:00.000Z",
  closedAt: null,
  complaint: "Контроль динамики",
};

const lesions: Lesion[] = [
  {
    id: LESION_ID,
    patientId: "p-1",
    bodyZone: "спина",
    mapPoint: { view: "back", x: 0.5, y: 0.4 },
    label: "L1",
    firstSeenAt: "2026-05-13T09:00:00.000Z",
    status: "active",
  },
];

function configureSession() {
  window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, BASE);
  window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, TOKEN);
  window.localStorage.setItem(
    SELF_HOSTED_API_USER_KEY,
    JSON.stringify({ id: "u", displayName: "Doc", roles: ["doctor"] }),
  );
}

function jsonResponse(item: unknown, status = 200): Response {
  return new Response(JSON.stringify({ item }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("VisitWorkspaceLiveActions", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("stays hidden in demo mode", () => {
    render(<VisitWorkspaceLiveActions visit={visit} lesions={lesions} />);
    expect(screen.queryByRole("region", { name: "Self-hosted запись визита" })).not.toBeInTheDocument();
  });

  it("saves visit, creates lesion, archives lesion, and saves report with bearer token", async () => {
    configureSession();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith(`/api/v1/visits/${VISIT_ID}`) && init?.method === "PATCH") {
        return jsonResponse({ id: VISIT_ID, status: "in_progress", chiefComplaint: "Контроль динамики" });
      }
      if (url.endsWith(`/api/v1/visits/${VISIT_ID}/lesions`) && init?.method === "POST") {
        return jsonResponse({ id: "new-lesion", label: "Новый очаг", status: "active" }, 201);
      }
      if (url.endsWith(`/api/v1/lesions/${LESION_ID}`) && init?.method === "DELETE") {
        return jsonResponse({ id: LESION_ID, label: "L1", status: "archived" });
      }
      if (url.endsWith(`/api/v1/visits/${VISIT_ID}/report`) && init?.method === "PATCH") {
        return jsonResponse({ id: "report-1", visitId: VISIT_ID, status: "draft", patientSafeText: "Контроль у врача." });
      }
      if (url.endsWith(`/api/v1/visits/${VISIT_ID}/follow-ups`) && init?.method === "POST") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          dueAt: "2026-06-01T10:00:00.000Z",
          status: "planned",
          priority: "normal",
          reason: "Контроль после визита",
        }, 201);
      }
      return jsonResponse({ id: LESION_ID, label: "L2", status: "active" });
    });

    render(<VisitWorkspaceLiveActions visit={visit} lesions={lesions} />);

    fireEvent.click(screen.getByRole("button", { name: "Сохранить визит" }));
    await waitFor(() => expect(screen.getByText("Визит сохранён в self-hosted backend.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Создать очаг" }));
    await waitFor(() => expect(screen.getByText(/создан в self-hosted backend/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Архивировать" }));
    await waitFor(() => expect(screen.getByText(/архивирован в self-hosted backend/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Patient-safe текст"), {
      target: { value: "Контроль у врача." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить отчёт" }));
    await waitFor(() => expect(screen.getByText("Отчёт визита сохранён в self-hosted backend.")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Дата и время контроля"), {
      target: { value: "2026-06-01T10:00" },
    });
    fireEvent.change(screen.getByLabelText("Текст для пациента"), {
      target: { value: "Напомним о контрольном осмотре." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать контроль" }));
    await waitFor(() => expect(screen.getByText("Контрольный контакт создан в self-hosted backend.")).toBeInTheDocument());

    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/visits/${VISIT_ID}`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/visits/${VISIT_ID}/follow-ups`,
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });

  it("shows validation status returned by backend", async () => {
    configureSession();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "validation_error",
            message: "Request payload failed validation.",
            details: [{ field: "label", message: "required" }],
          },
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(<VisitWorkspaceLiveActions visit={visit} lesions={lesions} />);
    fireEvent.click(screen.getByRole("button", { name: "Создать очаг" }));

    await waitFor(() => {
      expect(screen.getByText("Проверьте поля: backend вернул ошибку валидации.")).toBeInTheDocument();
    });
  });
});
