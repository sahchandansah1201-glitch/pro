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
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-templates/summary")) {
        return jsonResponse({ totalTemplates: 1, activeTemplates: 1, inactiveTemplates: 0, exceptionsAllowed: 1, requiredByDefault: 1, localPolicyEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-application/summary")) {
        return jsonResponse({ totalFollowUps: 2, activeTemplates: 1, appliedTemplates: 1, notChecked: 0, inSync: 1, reviewRequired: 0, needsPolicyApplication: 0, localApplicationEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-exceptions/summary")) {
        return jsonResponse({ totalFollowUps: 2, openExceptions: 0, closedExceptions: 1, acceptedExceptions: 1, rejectedExceptions: 0, unresolvedDrift: 0, unclosedValidationExceptions: 0, closedWithLocalResolution: 1, localExceptionEvents: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-audit/summary")) {
        return jsonResponse({ totalFollowUps: 2, auditReady: 1, needsAuditReview: 0, reviewedAudits: 1, needsFollowUp: 0, unresolvedPolicyDrift: 0, openExceptions: 0, missingPolicyTemplate: 0, localPolicyAuditEvents: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance/summary")) {
        return jsonResponse({ totalFollowUps: 2, governanceReady: 1, needsGovernanceReview: 0, reviewedGovernance: 1, governanceNeedsFollowUp: 0, reviewedPolicyAudits: 1, unresolvedPolicyDrift: 0, openExceptions: 0, localGovernanceEvents: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-closure/summary")) {
        return jsonResponse({ totalFollowUps: 2, closureReady: 1, needsClosureReview: 0, closedGovernanceReviews: 1, closureNeedsFollowUp: 0, reviewedGovernance: 1, unresolvedPolicyDrift: 0, openExceptions: 0, localGovernanceClosureEvents: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence/summary")) {
        return jsonResponse({ totalFollowUps: 2, evidenceReady: 1, needsEvidenceReview: 0, exportedGovernanceEvidence: 1, evidenceNeedsFollowUp: 0, closedGovernanceReviews: 1, unresolvedPolicyDrift: 0, openExceptions: 0, localGovernanceEvidenceEvents: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation/summary")) {
        return jsonResponse({ totalFollowUps: 2, reconciliationReady: 1, needsReconciliation: 0, reconciledGovernanceEvidence: 1, evidenceMismatches: 0, reconciliationNeedsFollowUp: 0, exportedGovernanceEvidence: 1, closedGovernanceReviews: 1, localGovernanceEvidenceReconciliationEvents: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure/summary")) {
        return jsonResponse({ totalFollowUps: 2, reconciliationClosureReady: 1, needsReconciliationClosure: 0, closedReconciliationEvidence: 1, reconciliationClosureExceptions: 0, reconciliationClosureNeedsRework: 0, reconciledGovernanceEvidence: 1, openReconciliationMismatches: 0, localGovernanceEvidenceReconciliationClosureEvents: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt/summary")) {
        return jsonResponse({ totalFollowUps: 2, closureReceiptReady: 1, needsClosureReceipt: 0, receivedClosureReceipts: 1, closureReceiptExceptions: 0, closureReceiptNeedsRework: 0, closedReconciliationEvidence: 1, reconciledGovernanceEvidence: 1, localGovernanceEvidenceReconciliationClosureReceiptEvents: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveReadinessReady: 1, needsArchiveReadiness: 0, archivedLocal: 0, archiveReadinessExceptions: 0, archiveReadinessNeedsRework: 0, receivedClosureReceipts: 1, closedReconciliationEvidence: 1, localGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessEvents: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveClosureReady: 1, needsArchiveClosure: 0, closedLocalArchives: 1, archiveClosureExceptions: 0, archiveClosureNeedsRework: 0, archiveReadinessMarked: 1, receivedClosureReceipts: 1, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureEvents: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveClosureReceiptReady: 1, needsArchiveClosureReceipt: 0, receivedArchiveClosureReceipts: 1, archiveClosureReceiptExceptions: 0, archiveClosureReceiptNeedsRework: 0, closedLocalArchives: 1, archiveReadinessMarked: 1, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptEvents: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveClosureReceiptHandoffReady: 1, needsArchiveClosureReceiptHandoff: 0, handedOffArchiveClosureReceipts: 1, archiveClosureReceiptHandoffExceptions: 0, archiveClosureReceiptHandoffNeedsRework: 0, receivedArchiveClosureReceipts: 1, closedLocalArchives: 1, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffEvents: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveClosureReceiptHandoffReceiptReady: 1, needsArchiveClosureReceiptHandoffReceipt: 0, receivedArchiveClosureReceiptHandoffReceipts: 1, archiveClosureReceiptHandoffReceiptExceptions: 0, archiveClosureReceiptHandoffReceiptNeedsRework: 0, handedOffArchiveClosureReceipts: 1, receivedArchiveClosureReceipts: 1, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptEvents: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveClosureReceiptHandoffReceiptReconciliationReady: 1, needsArchiveClosureReceiptHandoffReceiptReconciliation: 0, reconciledArchiveClosureReceiptHandoffReceipts: 1, archiveClosureReceiptHandoffReceiptReconciliationExceptions: 0, archiveClosureReceiptHandoffReceiptReconciliationNeedsRework: 0, receivedArchiveClosureReceiptHandoffReceipts: 1, handedOffArchiveClosureReceipts: 1, receivedArchiveClosureReceipts: 1, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationEvents: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveClosureReceiptHandoffReceiptReconciliationClosureReady: 1, needsArchiveClosureReceiptHandoffReceiptReconciliationClosure: 0, closedArchiveClosureReceiptHandoffReceiptReconciliations: 1, archiveClosureReceiptHandoffReceiptReconciliationClosureExceptions: 0, archiveClosureReceiptHandoffReceiptReconciliationClosureNeedsRework: 0, reconciledArchiveClosureReceiptHandoffReceipts: 1, receivedArchiveClosureReceiptHandoffReceipts: 1, handedOffArchiveClosureReceipts: 1, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureEvents: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptReady: 1, needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt: 0, receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 1, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptExceptions: 0, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNeedsRework: 0, closedArchiveClosureReceiptHandoffReceiptReconciliations: 1, reconciledArchiveClosureReceiptHandoffReceipts: 1, receivedArchiveClosureReceiptHandoffReceipts: 1, handedOffArchiveClosureReceipts: 1, receivedArchiveClosureReceipts: 1, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptEvents: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessReady: 1, needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness: 0, archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 1, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessExceptions: 0, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNeedsRework: 0, receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 1, closedArchiveClosureReceiptHandoffReceiptReconciliations: 1, reconciledArchiveClosureReceiptHandoffReceipts: 1, receivedArchiveClosureReceiptHandoffReceipts: 1, handedOffArchiveClosureReceipts: 1, receivedArchiveClosureReceipts: 1, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessEvents: 1 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptReady: 1, needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipt: 0, receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipts: 1, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptExceptions: 0, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptNeedsRework: 0, closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosures: 1, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptEvents: 1 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-templates?")) {
        return new Response(JSON.stringify({ items: [{
          id: "template-1",
          code: "followup-standard",
          title: "Follow-up standard SOP",
          version: "clinic-local-v2",
          requiredValidationStates: ["required", "blocked"],
          defaultValidationState: "required",
          active: true,
        }] }), { status: 200, headers: { "Content-Type": "application/json" } });
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
          sopPolicyTemplateCode: "followup-standard",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyExceptionResolution: "Local exception closed.",
          sopPolicyAuditState: "reviewed",
          sopPolicyAuditNote: "Local SOP policy audit reviewed.",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceNote: "Local SOP policy governance reviewed.",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceClosureNote: "Local SOP policy governance closure completed.",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceNote: "Local SOP policy governance evidence export marked.",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationNote: "Local SOP policy governance evidence reconciled.",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureNote: "Local SOP policy governance evidence reconciliation closed.",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt recorded.",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote: "Local SOP policy governance evidence reconciliation closure receipt archive readiness marked.",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote: "Local SOP policy governance evidence reconciliation closure receipt archive closed.",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt recorded.",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff completed.",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt recorded.",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote: null,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote: null,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote: null,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote: null,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote: null,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote: null,
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
    expect(fetchSpy).toHaveBeenCalledTimes(69);
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
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-templates/summary")) {
        return jsonResponse({ totalTemplates: 1, activeTemplates: 1, inactiveTemplates: 0, exceptionsAllowed: 1, requiredByDefault: 1, localPolicyEvents: 2 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-application/summary")) {
        return jsonResponse({ totalFollowUps: 2, activeTemplates: 1, appliedTemplates: 0, notChecked: 1, inSync: 0, reviewRequired: 1, needsPolicyApplication: 1, localApplicationEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-exceptions/summary")) {
        return jsonResponse({ totalFollowUps: 2, openExceptions: 1, closedExceptions: 0, acceptedExceptions: 0, rejectedExceptions: 0, unresolvedDrift: 1, unclosedValidationExceptions: 1, closedWithLocalResolution: 0, localExceptionEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-audit/summary")) {
        return jsonResponse({ totalFollowUps: 2, auditReady: 1, needsAuditReview: 1, reviewedAudits: 0, needsFollowUp: 0, unresolvedPolicyDrift: 1, openExceptions: 1, missingPolicyTemplate: 1, localPolicyAuditEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance/summary")) {
        return jsonResponse({ totalFollowUps: 2, governanceReady: 0, needsGovernanceReview: 2, reviewedGovernance: 0, governanceNeedsFollowUp: 0, reviewedPolicyAudits: 0, unresolvedPolicyDrift: 1, openExceptions: 1, localGovernanceEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-closure/summary")) {
        return jsonResponse({ totalFollowUps: 2, closureReady: 0, needsClosureReview: 2, closedGovernanceReviews: 0, closureNeedsFollowUp: 0, reviewedGovernance: 0, unresolvedPolicyDrift: 1, openExceptions: 1, localGovernanceClosureEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence/summary")) {
        return jsonResponse({ totalFollowUps: 2, evidenceReady: 0, needsEvidenceReview: 2, exportedGovernanceEvidence: 0, evidenceNeedsFollowUp: 0, closedGovernanceReviews: 0, unresolvedPolicyDrift: 1, openExceptions: 1, localGovernanceEvidenceEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation/summary")) {
        return jsonResponse({ totalFollowUps: 2, reconciliationReady: 0, needsReconciliation: 2, reconciledGovernanceEvidence: 0, evidenceMismatches: 0, reconciliationNeedsFollowUp: 0, exportedGovernanceEvidence: 0, closedGovernanceReviews: 0, localGovernanceEvidenceReconciliationEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure/summary")) {
        return jsonResponse({ totalFollowUps: 2, reconciliationClosureReady: 0, needsReconciliationClosure: 2, closedReconciliationEvidence: 0, reconciliationClosureExceptions: 0, reconciliationClosureNeedsRework: 0, reconciledGovernanceEvidence: 0, openReconciliationMismatches: 0, localGovernanceEvidenceReconciliationClosureEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt/summary")) {
        return jsonResponse({ totalFollowUps: 2, closureReceiptReady: 0, needsClosureReceipt: 2, receivedClosureReceipts: 0, closureReceiptExceptions: 0, closureReceiptNeedsRework: 0, closedReconciliationEvidence: 0, reconciledGovernanceEvidence: 0, localGovernanceEvidenceReconciliationClosureReceiptEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveReadinessReady: 0, needsArchiveReadiness: 2, archivedLocal: 0, archiveReadinessExceptions: 0, archiveReadinessNeedsRework: 0, receivedClosureReceipts: 0, closedReconciliationEvidence: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveClosureReady: 0, needsArchiveClosure: 2, closedLocalArchives: 0, archiveClosureExceptions: 0, archiveClosureNeedsRework: 0, archiveReadinessMarked: 0, receivedClosureReceipts: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveClosureReceiptReady: 0, needsArchiveClosureReceipt: 2, receivedArchiveClosureReceipts: 0, archiveClosureReceiptExceptions: 0, archiveClosureReceiptNeedsRework: 0, closedLocalArchives: 0, archiveReadinessMarked: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveClosureReceiptHandoffReady: 0, needsArchiveClosureReceiptHandoff: 2, handedOffArchiveClosureReceipts: 0, archiveClosureReceiptHandoffExceptions: 0, archiveClosureReceiptHandoffNeedsRework: 0, receivedArchiveClosureReceipts: 0, closedLocalArchives: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveClosureReceiptHandoffReceiptReady: 0, needsArchiveClosureReceiptHandoffReceipt: 2, receivedArchiveClosureReceiptHandoffReceipts: 0, archiveClosureReceiptHandoffReceiptExceptions: 0, archiveClosureReceiptHandoffReceiptNeedsRework: 0, handedOffArchiveClosureReceipts: 0, receivedArchiveClosureReceipts: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveClosureReceiptHandoffReceiptReconciliationReady: 0, needsArchiveClosureReceiptHandoffReceiptReconciliation: 2, reconciledArchiveClosureReceiptHandoffReceipts: 0, archiveClosureReceiptHandoffReceiptReconciliationExceptions: 0, archiveClosureReceiptHandoffReceiptReconciliationNeedsRework: 0, receivedArchiveClosureReceiptHandoffReceipts: 0, handedOffArchiveClosureReceipts: 0, receivedArchiveClosureReceipts: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveClosureReceiptHandoffReceiptReconciliationClosureReady: 0, needsArchiveClosureReceiptHandoffReceiptReconciliationClosure: 2, closedArchiveClosureReceiptHandoffReceiptReconciliations: 0, archiveClosureReceiptHandoffReceiptReconciliationClosureExceptions: 0, archiveClosureReceiptHandoffReceiptReconciliationClosureNeedsRework: 0, reconciledArchiveClosureReceiptHandoffReceipts: 0, receivedArchiveClosureReceiptHandoffReceipts: 0, handedOffArchiveClosureReceipts: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptReady: 0, needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt: 2, receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 0, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptExceptions: 0, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNeedsRework: 0, closedArchiveClosureReceiptHandoffReceiptReconciliations: 0, reconciledArchiveClosureReceiptHandoffReceipts: 0, receivedArchiveClosureReceiptHandoffReceipts: 0, handedOffArchiveClosureReceipts: 0, receivedArchiveClosureReceipts: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessReady: 0, needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness: 2, archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 0, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessExceptions: 0, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNeedsRework: 0, receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 0, closedArchiveClosureReceiptHandoffReceiptReconciliations: 0, reconciledArchiveClosureReceiptHandoffReceipts: 0, receivedArchiveClosureReceiptHandoffReceipts: 0, handedOffArchiveClosureReceipts: 0, receivedArchiveClosureReceipts: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessEvents: 0 });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt/summary")) {
        return jsonResponse({ totalFollowUps: 2, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptReady: 0, needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipt: 2, receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceipts: 0, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptExceptions: 0, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptNeedsRework: 0, closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosures: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-templates?")) {
        return new Response(JSON.stringify({ items: [{
          id: "template-1",
          code: "followup-standard",
          title: "Follow-up standard SOP",
          version: "clinic-local-v2",
          requiredValidationStates: ["required", "blocked"],
          defaultValidationState: "required",
          active: true,
        }] }), { status: 200, headers: { "Content-Type": "application/json" } });
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
          sopPolicyTemplateCode: null,
          sopPolicyDriftState: "review_required",
          sopPolicyExceptionState: "open",
          sopPolicyExceptionReason: "Clinic-specific policy exception opened.",
          sopPolicyAuditState: "not_started",
          sopPolicyGovernanceState: "not_started",
          sopPolicyGovernanceNote: null,
          sopPolicyGovernanceClosureState: "not_started",
          sopPolicyGovernanceClosureNote: null,
          sopPolicyGovernanceEvidenceState: "not_started",
          sopPolicyGovernanceEvidenceNote: null,
          sopPolicyGovernanceEvidenceReconciliationState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationNote: null,
          sopPolicyGovernanceEvidenceReconciliationClosureState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureNote: null,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote: null,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote: null,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote: null,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote: null,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote: null,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote: null,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote: null,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote: null,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote: null,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote: null,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote: null,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState: "not_started",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote: null,
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
          sopPolicyVersion: "clinic-local-v2",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-application") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "required",
          sopPolicyVersion: "clinic-local-v2",
          sopPolicyTemplateId: "template-1",
          sopPolicyTemplateCode: "followup-standard",
          sopPolicyDriftState: "in_sync",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-exception") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "exception",
          sopPolicyDriftState: "review_required",
          sopPolicyExceptionState: "accepted",
          sopPolicyExceptionReason: "Clinic-specific policy exception opened.",
          sopPolicyExceptionResolution: "Local exception accepted and closed for clinic policy review.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-audit") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyAuditNote: "Local SOP policy audit reviewed.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceNote: "Local SOP policy governance reviewed.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-closure") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceClosureNote: "Local SOP policy governance closure completed.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceNote: "Local SOP policy governance evidence export marked.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationNote: "Local SOP policy governance evidence reconciled.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureNote: "Local SOP policy governance evidence reconciliation closed.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt recorded.",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote: "Local SOP policy governance evidence reconciliation closure receipt archive readiness marked.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote: "Local SOP policy governance evidence reconciliation closure receipt archive readiness marked.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote: "Local SOP policy governance evidence reconciliation closure receipt archive closed.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt recorded.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff completed from workspace.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt recorded from workspace.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation recorded from workspace.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure recorded from workspace.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt recorded from workspace.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState: "archived",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness archived from workspace.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState: "archived",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure closed from workspace.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState: "archived",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt received from workspace.",
        });
      }
      if (url.endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt") && init?.method === "PATCH") {
        return jsonResponse({
          id: "follow-up-1",
          visitId: VISIT_ID,
          reason: "Контроль после визита",
          status: "completed",
          priority: "urgent",
          sopValidationState: "validated",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceClosureState: "closed",
          sopPolicyGovernanceEvidenceState: "exported",
          sopPolicyGovernanceEvidenceReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: "ready",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: "handed_off",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: "reconciled",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState: "archived",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: "closed",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptState: "received",
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptNote: "Local SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation closure receipt received from workspace.",
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

    fireEvent.click(screen.getByRole("button", { name: "Apply policy" }));
    await waitFor(() => expect(screen.getByText("SOP policy template применён к follow-up локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Close exception" }));
    await waitFor(() => expect(screen.getByText("SOP policy exception закрыт локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Audit reviewed" }));
    await waitFor(() => expect(screen.getByText("SOP policy audit отмечен как reviewed локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Governance reviewed" }));
    await waitFor(() => expect(screen.getByText("SOP policy governance review отмечен как reviewed локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Close governance" }));
    await waitFor(() => expect(screen.getByText("SOP policy governance closure закрыт локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Export evidence" }));
    await waitFor(() => expect(screen.getByText("SOP policy governance evidence отмечен как exported локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Reconcile evidence" }));
    await waitFor(() => expect(screen.getByText("SOP policy governance evidence reconciliation отмечен как reconciled локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Close recon" }));
    await waitFor(() => expect(screen.getByText("SOP policy governance evidence reconciliation закрыт локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Receive receipt" }));
    await waitFor(() => expect(screen.getByText("SOP policy governance evidence reconciliation closure receipt принят локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Archive ready" }));
    await waitFor(() => expect(screen.getByText("SOP policy governance evidence reconciliation closure receipt archive readiness отмечен локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Close archive" }));
    await waitFor(() => expect(screen.getByText("SOP policy governance evidence reconciliation closure receipt archive closure закрыт локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Receive archive receipt" }));
    await waitFor(() => expect(screen.getByText("SOP policy governance evidence reconciliation closure receipt archive closure receipt получен локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Handoff archive receipt" }));
    await waitFor(() => expect(screen.getByText("SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff выполнен локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Receive handoff receipt" }));
    await waitFor(() => expect(screen.getByText("SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt получен локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Reconcile handoff receipt" }));
    await waitFor(() => expect(screen.getByText("SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation выполнен локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Close receipt recon" }));
    await waitFor(() => expect(screen.getByText("SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure закрыт локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Receive recon closure" }));
    await waitFor(() => expect(screen.getByText("SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt получен локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Archive recon receipt" }));
    await waitFor(() => expect(screen.getByText("SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness archived локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Close recon receipt archive" }));
    await waitFor(() => expect(screen.getByText("SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure закрыт локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Receive recon archive closure" }));
    await waitFor(() => expect(screen.getByText("SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt получен локально.")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Receive recon archive handoff receipt reconciliation closure receipt" }));
    await waitFor(() => expect(screen.getByText("SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt reconciliation closure receipt получен локально.")).toBeInTheDocument());

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
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-application`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-exception`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-audit`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-closure`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `${BASE}/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    const sopValidationCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-validation"));
    expect(JSON.parse(String(sopValidationCall?.[1]?.body)).sopPolicyVersion).toBe("clinic-local-v2");
    const sopPolicyApplicationCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-application"));
    expect(JSON.parse(String(sopPolicyApplicationCall?.[1]?.body)).sopPolicyTemplateId).toBe("template-1");
    const sopPolicyExceptionCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-exception"));
    expect(JSON.parse(String(sopPolicyExceptionCall?.[1]?.body)).sopPolicyExceptionState).toBe("accepted");
    const sopPolicyAuditCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-audit"));
    expect(JSON.parse(String(sopPolicyAuditCall?.[1]?.body)).sopPolicyAuditState).toBe("reviewed");
    const sopPolicyGovernanceCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance"));
    expect(JSON.parse(String(sopPolicyGovernanceCall?.[1]?.body)).sopPolicyGovernanceState).toBe("reviewed");
    const sopPolicyGovernanceClosureCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-closure"));
    expect(JSON.parse(String(sopPolicyGovernanceClosureCall?.[1]?.body)).sopPolicyGovernanceClosureState).toBe("closed");
    const sopPolicyGovernanceEvidenceCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence"));
    expect(JSON.parse(String(sopPolicyGovernanceEvidenceCall?.[1]?.body)).sopPolicyGovernanceEvidenceState).toBe("exported");
    const sopPolicyGovernanceEvidenceReconciliationCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation"));
    expect(JSON.parse(String(sopPolicyGovernanceEvidenceReconciliationCall?.[1]?.body)).sopPolicyGovernanceEvidenceReconciliationState).toBe("reconciled");
    const sopPolicyGovernanceEvidenceReconciliationClosureCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure"));
    expect(JSON.parse(String(sopPolicyGovernanceEvidenceReconciliationClosureCall?.[1]?.body)).sopPolicyGovernanceEvidenceReconciliationClosureState).toBe("closed");
    const sopPolicyGovernanceEvidenceReconciliationClosureReceiptCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt"));
    expect(JSON.parse(String(sopPolicyGovernanceEvidenceReconciliationClosureReceiptCall?.[1]?.body)).sopPolicyGovernanceEvidenceReconciliationClosureReceiptState).toBe("received");
    const sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness"));
    expect(JSON.parse(String(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessCall?.[1]?.body)).sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState).toBe("ready");
    const sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure"));
    expect(JSON.parse(String(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureCall?.[1]?.body)).sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState).toBe("closed");
    const sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt"));
    expect(JSON.parse(String(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptCall?.[1]?.body)).sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState).toBe("received");
    const sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff"));
    expect(JSON.parse(String(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffCall?.[1]?.body)).sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState).toBe("handed_off");
    const sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt"));
    expect(JSON.parse(String(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptCall?.[1]?.body)).sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState).toBe("received");
    const sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation"));
    expect(JSON.parse(String(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationCall?.[1]?.body)).sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState).toBe("reconciled");
    const sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure"));
    expect(JSON.parse(String(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureCall?.[1]?.body)).sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState).toBe("closed");
    const sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt"));
    expect(JSON.parse(String(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptCall?.[1]?.body)).sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState).toBe("received");
    const sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness"));
    expect(JSON.parse(String(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessCall?.[1]?.body)).sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState).toBe("archived");
    const sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure"));
    expect(JSON.parse(String(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureCall?.[1]?.body)).sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState).toBe("closed");
    const sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt"));
    expect(JSON.parse(String(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptCall?.[1]?.body)).sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState).toBe("received");
    const sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptCall = fetchSpy.mock.calls.find(([url]) => String(url).endsWith("/api/v1/clinical/follow-ups/follow-up-1/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness-closure-receipt-handoff-receipt-reconciliation-closure-receipt"));
    expect(JSON.parse(String(sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptCall?.[1]?.body)).sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReconciliationClosureReceiptState).toBe("received");
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
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-application")) {
        return jsonResponse({ totalFollowUps: 0, activeTemplates: 0, appliedTemplates: 0, reviewRequired: 0, needsPolicyApplication: 0, localApplicationEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-exceptions")) {
        return jsonResponse({ totalFollowUps: 0, openExceptions: 0, closedExceptions: 0, unresolvedDrift: 0, localExceptionEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-audit")) {
        return jsonResponse({ totalFollowUps: 0, auditReady: 0, needsAuditReview: 0, reviewedAudits: 0, localPolicyAuditEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-readiness")) {
        return jsonResponse({ totalFollowUps: 0, archiveReadinessReady: 0, needsArchiveReadiness: 0, archivedLocal: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt-archive-readiness")) {
        return jsonResponse({ totalFollowUps: 0, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessReady: 0, needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness: 0, archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure-receipt")) {
        return jsonResponse({ totalFollowUps: 0, archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptReady: 0, needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt: 0, receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation-closure")) {
        return jsonResponse({ totalFollowUps: 0, archiveClosureReceiptHandoffReceiptReconciliationClosureReady: 0, needsArchiveClosureReceiptHandoffReceiptReconciliationClosure: 0, closedArchiveClosureReceiptHandoffReceiptReconciliations: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt-reconciliation")) {
        return jsonResponse({ totalFollowUps: 0, archiveClosureReceiptHandoffReceiptReconciliationReady: 0, needsArchiveClosureReceiptHandoffReceiptReconciliation: 0, reconciledArchiveClosureReceiptHandoffReceipts: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff-receipt")) {
        return jsonResponse({ totalFollowUps: 0, archiveClosureReceiptHandoffReceiptReady: 0, needsArchiveClosureReceiptHandoffReceipt: 0, receivedArchiveClosureReceiptHandoffReceipts: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt-handoff")) {
        return jsonResponse({ totalFollowUps: 0, archiveClosureReceiptHandoffReady: 0, needsArchiveClosureReceiptHandoff: 0, handedOffArchiveClosureReceipts: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure-receipt")) {
        return jsonResponse({ totalFollowUps: 0, archiveClosureReceiptReady: 0, needsArchiveClosureReceipt: 0, receivedArchiveClosureReceipts: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt-archive-closure")) {
        return jsonResponse({ totalFollowUps: 0, archiveClosureReady: 0, needsArchiveClosure: 0, closedLocalArchives: 0, localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure-receipt")) {
        return jsonResponse({ totalFollowUps: 0, closureReceiptReady: 0, needsClosureReceipt: 0, receivedClosureReceipts: 0, localGovernanceEvidenceReconciliationClosureReceiptEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation-closure")) {
        return jsonResponse({ totalFollowUps: 0, reconciliationClosureReady: 0, needsReconciliationClosure: 0, closedReconciliationEvidence: 0, localGovernanceEvidenceReconciliationClosureEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-governance-evidence-reconciliation")) {
        return jsonResponse({ totalFollowUps: 0, reconciliationReady: 0, needsReconciliation: 0, reconciledGovernanceEvidence: 0, localGovernanceEvidenceReconciliationEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-governance-evidence")) {
        return jsonResponse({ totalFollowUps: 0, evidenceReady: 0, needsEvidenceReview: 0, exportedGovernanceEvidence: 0, localGovernanceEvidenceEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-governance-closure")) {
        return jsonResponse({ totalFollowUps: 0, closureReady: 0, needsClosureReview: 0, closedGovernanceReviews: 0, localGovernanceClosureEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-governance")) {
        return jsonResponse({ totalFollowUps: 0, governanceReady: 0, needsGovernanceReview: 0, reviewedGovernance: 0, localGovernanceEvents: 0 });
      }
      if (url.includes("/api/v1/clinical/follow-ups/sop-policy-templates")) {
        return url.includes("summary")
          ? jsonResponse({ totalTemplates: 0, activeTemplates: 0, localPolicyEvents: 0 })
          : new Response(JSON.stringify({ items: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
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
