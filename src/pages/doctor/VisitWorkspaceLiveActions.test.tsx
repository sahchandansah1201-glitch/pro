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
      if (url.endsWith("/api/v1/clinical/follow-ups/operations/summary")) {
        return jsonResponse({ totalOpen: 1, overdue: 0, waitingPatient: 0, escalated: 0, deliveryFailed: 0, deliveryPending: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/outcomes/summary")) {
        return jsonResponse({ totalFollowUps: 2, closedFollowUps: 1, closedWithEvidence: 1, closedMissingEvidence: 0, qualityPending: 1, qualityNeedsAttention: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/clinic-review/summary")) {
        return jsonResponse({ totalFollowUps: 2, retentionDue: 1, retentionReviewed: 0, retentionArchived: 0, clinicReviewScheduled: 0, clinicReviewCompleted: 0, clinicNeedsPolicyReview: 0, localReviewEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-validation/summary")) {
        return jsonResponse({ totalFollowUps: 2, sopRequired: 1, sopValidated: 0, sopExceptions: 0, sopBlocked: 0, clinicNeedsPolicyReview: 0, qualityNeedsAttention: 0, openEscalated: 0, closedMissingEvidence: 0, localSopEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/operations?")) {
        return new Response(JSON.stringify({ items: [{
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "sent",
          priority: "normal",
          triageState: "new",
          escalationLevel: "none",
          deliveryState: "not_required",
          resolutionOutcome: "not_reviewed",
          qualityReviewState: "pending",
          retentionReviewState: "due",
          clinicReviewState: "not_scheduled",
          sopValidationState: "required",
          sopPolicyVersion: "clinic-local-v1",
        }] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
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
    expect(fetchSpy).toHaveBeenCalledTimes(15);
  });

  it("updates the operational follow-up queue from the live panel", async () => {
    configureSession();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.endsWith("/api/v1/clinical/follow-ups/operations/summary")) {
        return jsonResponse({ totalOpen: 1, overdue: 1, waitingPatient: 0, escalated: 1, deliveryFailed: 1, deliveryPending: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/outcomes/summary")) {
        return jsonResponse({ totalFollowUps: 2, closedFollowUps: 1, closedWithEvidence: 0, closedMissingEvidence: 1, qualityPending: 1, qualityNeedsAttention: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/clinic-review/summary")) {
        return jsonResponse({ totalFollowUps: 2, retentionDue: 1, retentionReviewed: 0, retentionArchived: 0, clinicReviewScheduled: 1, clinicReviewCompleted: 0, clinicNeedsPolicyReview: 1, localReviewEvents: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-validation/summary")) {
        return jsonResponse({ totalFollowUps: 2, sopRequired: 1, sopValidated: 0, sopExceptions: 0, sopBlocked: 0, clinicNeedsPolicyReview: 1, qualityNeedsAttention: 1, openEscalated: 1, closedMissingEvidence: 1, localSopEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/operations?")) {
        return new Response(JSON.stringify({ items: [{
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "sent",
          priority: "urgent",
          triageState: "escalated",
          escalationLevel: "clinic_admin",
          deliveryState: "failed",
          resolutionOutcome: "clinical_escalation",
          qualityReviewState: "needs_attention",
          retentionReviewState: "due",
          clinicReviewState: "needs_policy_review",
          sopValidationState: "required",
          sopPolicyVersion: null,
        }] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/operations") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          triageState: "resolved",
          escalationLevel: "none",
          deliveryState: "delivered",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/quality") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          resolutionOutcome: "patient_reached",
          qualityReviewState: "reviewed",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/clinic-review") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          retentionReviewState: "reviewed",
          clinicReviewState: "completed",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-validation") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyVersion: "clinic-local-v1",
        });
      }
      return jsonResponse({ id: "ok" });
    });

    render(<VisitWorkspaceLiveActions visit={visit} lesions={lesions} />);
    await waitFor(() => expect(screen.getByRole("region", { name: "Операционный контроль follow-up" })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("Контроль после визита")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    await waitFor(() => expect(screen.getByText("Follow-up закрыт в операционной очереди.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "QA reviewed" }));
    await waitFor(() => expect(screen.getByText("Follow-up отмечен как QA reviewed.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Clinic review done" }));
    await waitFor(() => expect(screen.getByText("Clinic review по follow-up завершён локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "SOP validated" }));
    await waitFor(() => expect(screen.getByText("SOP validation по follow-up подтверждён локально.")).toBeInTheDocument());

    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/operations`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/quality`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/clinic-review`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-validation`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
  });

  it("shows validation status returned by backend", async () => {
    configureSession();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/v1/clinical/follow-ups/operations")) {
        return jsonResponse({ totalOpen: 0, overdue: 0, waitingPatient: 0, escalated: 0, deliveryFailed: 0, deliveryPending: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/outcomes")) {
        return jsonResponse({ totalFollowUps: 0, qualityPending: 0, qualityNeedsAttention: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/clinic-review")) {
        return jsonResponse({ totalFollowUps: 0, retentionDue: 0, clinicNeedsPolicyReview: 0, localReviewEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-validation")) {
        return jsonResponse({ totalFollowUps: 0, sopRequired: 0, sopValidated: 0, localSopEvents: 0 });
      }
      return new Response(
        JSON.stringify({
          error: {
            code: "validation_error",
            message: "Request payload failed validation.",
            details: [{ field: "label", message: "required" }],
          },
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    });

    render(<VisitWorkspaceLiveActions visit={visit} lesions={lesions} />);
    fireEvent.click(screen.getByRole("button", { name: "Создать очаг" }));

    await waitFor(() => {
      expect(screen.getByText("Проверьте поля: backend вернул ошибку валидации.")).toBeInTheDocument();
    });
  });
});
