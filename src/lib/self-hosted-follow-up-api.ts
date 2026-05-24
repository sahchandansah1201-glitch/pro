// Stage 17A-17Z · self-hosted follow-up communication API client.
// Production UI uses only /api/v1/* on the operator-owned backend.

import type { SelfHostedApiError, SelfHostedApiResult } from "@/lib/self-hosted-patient-api";
import { buildSelfHostedApiUrl } from "@/lib/self-hosted-patient-api";

interface BaseArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

export type FollowUpPriority = "low" | "normal" | "high" | "urgent";
export type FollowUpStatus = "planned" | "in_progress" | "sent" | "acknowledged" | "completed" | "cancelled";
export type FollowUpTriageState = "new" | "queued" | "in_review" | "waiting_patient" | "escalated" | "resolved" | "blocked";
export type FollowUpEscalationLevel = "none" | "watch" | "clinic_admin" | "urgent";
export type FollowUpDeliveryState = "not_required" | "pending" | "delivered" | "failed" | "deferred";
export type FollowUpResolutionOutcome =
  | "not_reviewed"
  | "patient_reached"
  | "patient_unreachable"
  | "clinical_escalation"
  | "administrative_close";
export type FollowUpQualityReviewState = "pending" | "reviewed" | "needs_attention";
export type FollowUpRetentionReviewState = "not_due" | "due" | "reviewed" | "archived";
export type FollowUpClinicReviewState = "not_scheduled" | "scheduled" | "completed" | "needs_policy_review";
export type FollowUpSopValidationState = "not_required" | "required" | "validated" | "exception" | "blocked";
export type FollowUpSopPolicyDriftState = "not_checked" | "in_sync" | "drifted" | "missing_template" | "review_required";
export type FollowUpSopPolicyExceptionState = "none" | "open" | "accepted" | "rejected" | "closed";
export type FollowUpSopPolicyAuditState = "not_started" | "ready" | "reviewed" | "needs_followup";
export type FollowUpSopPolicyGovernanceState = "not_started" | "ready" | "reviewed" | "needs_followup";
export type FollowUpSopPolicyGovernanceClosureState = "not_started" | "ready" | "closed" | "needs_followup";

export interface SelfHostedFollowUpMessage {
  id: string;
  followUpId: string;
  senderRole: string;
  direction: string;
  channel: string;
  deliveryState: string;
  patientVisible: boolean;
  body: string | null;
  createdAt: string | null;
}

export interface SelfHostedClinicalFollowUp {
  id: string;
  clinicId?: string | null;
  patientId?: string | null;
  visitId: string | null;
  dueAt: string | null;
  status: FollowUpStatus;
  priority: FollowUpPriority;
  reason: string | null;
  patientSummary: string | null;
  internalNote?: string | null;
  triageState: FollowUpTriageState;
  escalationLevel: FollowUpEscalationLevel;
  slaDueAt: string | null;
  deliveryState: FollowUpDeliveryState;
  deliveryAttempts: number;
  lastDeliveryAttemptAt: string | null;
  deliveryEvidence: Record<string, unknown>;
  operationsNote?: string | null;
  resolutionOutcome: FollowUpResolutionOutcome;
  qualityReviewState: FollowUpQualityReviewState;
  qualityReviewNote?: string | null;
  qualityReviewedAt?: string | null;
  retentionReviewState: FollowUpRetentionReviewState;
  retentionReviewNote?: string | null;
  retentionReviewedAt?: string | null;
  clinicReviewState: FollowUpClinicReviewState;
  clinicReviewNote?: string | null;
  clinicReviewedAt?: string | null;
  sopValidationState: FollowUpSopValidationState;
  sopPolicyVersion?: string | null;
  sopPolicyTemplateId?: string | null;
  sopPolicyTemplateCode?: string | null;
  sopPolicyDriftState: FollowUpSopPolicyDriftState;
  sopPolicyDriftReason?: string | null;
  sopPolicyAppliedAt?: string | null;
  sopPolicyDriftReviewedAt?: string | null;
  sopPolicyExceptionState: FollowUpSopPolicyExceptionState;
  sopPolicyExceptionReason?: string | null;
  sopPolicyExceptionResolution?: string | null;
  sopPolicyExceptionClosedAt?: string | null;
  sopPolicyAuditState: FollowUpSopPolicyAuditState;
  sopPolicyAuditNote?: string | null;
  sopPolicyAuditReviewedAt?: string | null;
  sopPolicyGovernanceState: FollowUpSopPolicyGovernanceState;
  sopPolicyGovernanceNote?: string | null;
  sopPolicyGovernanceReviewedAt?: string | null;
  sopPolicyGovernanceClosureState: FollowUpSopPolicyGovernanceClosureState;
  sopPolicyGovernanceClosureNote?: string | null;
  sopPolicyGovernanceClosedAt?: string | null;
  sopExceptionReason?: string | null;
  sopValidatedAt?: string | null;
  resolvedAt?: string | null;
  lastMessageAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  patient?: {
    id?: string | null;
    code?: string | null;
    fullName?: string | null;
  };
  latestMessage: SelfHostedFollowUpMessage | null;
  messageCount: number;
}

export interface CreateFollowUpPayload {
  dueAt: string;
  reason: string;
  priority?: FollowUpPriority;
  patientSummary?: string | null;
  internalNote?: string | null;
}

export interface UpdateFollowUpPayload {
  dueAt?: string;
  status?: FollowUpStatus;
  priority?: FollowUpPriority;
  reason?: string;
  patientSummary?: string | null;
  internalNote?: string | null;
}

export interface CreateFollowUpMessagePayload {
  body: string;
  patientVisible?: boolean;
}

export interface FollowUpOperationsSummary {
  totalOpen: number;
  overdue: number;
  waitingPatient: number;
  escalated: number;
  deliveryFailed: number;
  deliveryPending: number;
  source?: string;
}

export interface FollowUpOutcomeQualitySummary {
  totalFollowUps: number;
  closedFollowUps: number;
  openOverdue: number;
  openEscalated: number;
  closedWithEvidence: number;
  closedMissingEvidence: number;
  qualityReviewed: number;
  qualityPending: number;
  qualityNeedsAttention: number;
  patientReached: number;
  clinicalEscalations: number;
  deliveryFailures: number;
  source?: string;
}

export interface FollowUpClinicReviewSummary {
  totalFollowUps: number;
  retentionDue: number;
  retentionReviewed: number;
  retentionArchived: number;
  clinicReviewScheduled: number;
  clinicReviewCompleted: number;
  clinicNeedsPolicyReview: number;
  qualityNeedsAttention: number;
  closedMissingEvidence: number;
  localReviewEvents: number;
  source?: string;
}

export interface FollowUpSopValidationSummary {
  totalFollowUps: number;
  sopRequired: number;
  sopValidated: number;
  sopExceptions: number;
  sopBlocked: number;
  clinicNeedsPolicyReview: number;
  qualityNeedsAttention: number;
  openEscalated: number;
  closedMissingEvidence: number;
  localSopEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyTemplateSummary {
  totalTemplates: number;
  activeTemplates: number;
  inactiveTemplates: number;
  exceptionsAllowed: number;
  requiredByDefault: number;
  localPolicyEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyApplicationSummary {
  totalFollowUps: number;
  activeTemplates: number;
  appliedTemplates: number;
  notChecked: number;
  inSync: number;
  drifted: number;
  missingTemplate: number;
  reviewRequired: number;
  needsPolicyApplication: number;
  localApplicationEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyExceptionClosureSummary {
  totalFollowUps: number;
  openExceptions: number;
  closedExceptions: number;
  acceptedExceptions: number;
  rejectedExceptions: number;
  unresolvedDrift: number;
  unclosedValidationExceptions: number;
  closedWithLocalResolution: number;
  localExceptionEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyAuditRollupSummary {
  totalFollowUps: number;
  auditReady: number;
  needsAuditReview: number;
  reviewedAudits: number;
  needsFollowUp: number;
  unresolvedPolicyDrift: number;
  openExceptions: number;
  missingPolicyTemplate: number;
  localPolicyAuditEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceReadinessSummary {
  totalFollowUps: number;
  governanceReady: number;
  needsGovernanceReview: number;
  reviewedGovernance: number;
  governanceNeedsFollowUp: number;
  reviewedPolicyAudits: number;
  unresolvedPolicyDrift: number;
  openExceptions: number;
  localGovernanceEvents: number;
  source?: string;
}

export interface FollowUpSopPolicyGovernanceClosureSummary {
  totalFollowUps: number;
  closureReady: number;
  needsClosureReview: number;
  closedGovernanceReviews: number;
  closureNeedsFollowUp: number;
  reviewedGovernance: number;
  unresolvedPolicyDrift: number;
  openExceptions: number;
  localGovernanceClosureEvents: number;
  source?: string;
}

export interface SelfHostedFollowUpSopPolicyTemplate {
  id: string;
  clinicId: string | null;
  code: string;
  title: string;
  version: string;
  description: string | null;
  appliesTo: Record<string, unknown>;
  requiredValidationStates: FollowUpSopValidationState[];
  defaultValidationState: FollowUpSopValidationState;
  exceptionAllowed: boolean;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UpdateFollowUpOperationsPayload {
  triageState?: FollowUpTriageState;
  escalationLevel?: FollowUpEscalationLevel;
  slaDueAt?: string | null;
  deliveryState?: FollowUpDeliveryState;
  deliveryEvidence?: Record<string, unknown>;
  operationsNote?: string | null;
}

export interface UpdateFollowUpQualityPayload {
  resolutionOutcome?: FollowUpResolutionOutcome;
  qualityReviewState?: FollowUpQualityReviewState;
  qualityReviewNote?: string | null;
}

export interface UpdateFollowUpClinicReviewPayload {
  retentionReviewState?: FollowUpRetentionReviewState;
  retentionReviewNote?: string | null;
  clinicReviewState?: FollowUpClinicReviewState;
  clinicReviewNote?: string | null;
}

export interface UpdateFollowUpSopValidationPayload {
  sopValidationState?: FollowUpSopValidationState;
  sopPolicyVersion?: string | null;
  sopExceptionReason?: string | null;
}

export interface UpdateFollowUpSopPolicyApplicationPayload {
  sopPolicyTemplateId?: string;
  sopPolicyTemplateCode?: string | null;
  sopPolicyVersion?: string | null;
  sopValidationState?: FollowUpSopValidationState;
  sopPolicyDriftState?: FollowUpSopPolicyDriftState;
  sopPolicyDriftReason?: string | null;
}

export interface UpdateFollowUpSopPolicyExceptionClosurePayload {
  sopPolicyExceptionState?: FollowUpSopPolicyExceptionState;
  sopPolicyExceptionReason?: string | null;
  sopPolicyExceptionResolution?: string | null;
}

export interface UpdateFollowUpSopPolicyAuditRollupPayload {
  sopPolicyAuditState?: FollowUpSopPolicyAuditState;
  sopPolicyAuditNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceReadinessPayload {
  sopPolicyGovernanceState?: FollowUpSopPolicyGovernanceState;
  sopPolicyGovernanceNote?: string | null;
}

export interface UpdateFollowUpSopPolicyGovernanceClosurePayload {
  sopPolicyGovernanceClosureState?: FollowUpSopPolicyGovernanceClosureState;
  sopPolicyGovernanceClosureNote?: string | null;
}

export interface CreateFollowUpSopPolicyTemplatePayload {
  clinicId?: string | null;
  code: string;
  title: string;
  version: string;
  description?: string | null;
  appliesTo?: Record<string, unknown>;
  requiredValidationStates?: FollowUpSopValidationState[];
  defaultValidationState?: FollowUpSopValidationState;
  exceptionAllowed?: boolean;
  active?: boolean;
}

export type UpdateFollowUpSopPolicyTemplatePayload = Partial<CreateFollowUpSopPolicyTemplatePayload>;

const NOT_CONFIGURED: SelfHostedApiError = {
  kind: "not_configured",
  code: "not_configured",
  message: "Self-hosted backend-сессия не подключена.",
};

function ok<T>(value: T): SelfHostedApiResult<T> {
  return { ok: true, value, error: null };
}

function fail<T>(error: SelfHostedApiError): SelfHostedApiResult<T> {
  return { ok: false, value: null, error };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function textOrNull(value: unknown): string | null {
  return value == null ? null : String(value);
}

function numberOrZero(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function toStatus(value: unknown): FollowUpStatus {
  const status = String(value ?? "planned");
  return ["planned", "in_progress", "sent", "acknowledged", "completed", "cancelled"].includes(status)
    ? (status as FollowUpStatus)
    : "planned";
}

function toPriority(value: unknown): FollowUpPriority {
  const priority = String(value ?? "normal");
  return ["low", "normal", "high", "urgent"].includes(priority)
    ? (priority as FollowUpPriority)
    : "normal";
}

function toTriageState(value: unknown): FollowUpTriageState {
  const state = String(value ?? "new");
  return ["new", "queued", "in_review", "waiting_patient", "escalated", "resolved", "blocked"].includes(state)
    ? (state as FollowUpTriageState)
    : "new";
}

function toEscalationLevel(value: unknown): FollowUpEscalationLevel {
  const level = String(value ?? "none");
  return ["none", "watch", "clinic_admin", "urgent"].includes(level)
    ? (level as FollowUpEscalationLevel)
    : "none";
}

function toDeliveryState(value: unknown): FollowUpDeliveryState {
  const state = String(value ?? "not_required");
  return ["not_required", "pending", "delivered", "failed", "deferred"].includes(state)
    ? (state as FollowUpDeliveryState)
    : "not_required";
}

function toResolutionOutcome(value: unknown): FollowUpResolutionOutcome {
  const outcome = String(value ?? "not_reviewed");
  return ["not_reviewed", "patient_reached", "patient_unreachable", "clinical_escalation", "administrative_close"].includes(outcome)
    ? (outcome as FollowUpResolutionOutcome)
    : "not_reviewed";
}

function toQualityReviewState(value: unknown): FollowUpQualityReviewState {
  const state = String(value ?? "pending");
  return ["pending", "reviewed", "needs_attention"].includes(state)
    ? (state as FollowUpQualityReviewState)
    : "pending";
}

function toRetentionReviewState(value: unknown): FollowUpRetentionReviewState {
  const state = String(value ?? "not_due");
  return ["not_due", "due", "reviewed", "archived"].includes(state)
    ? (state as FollowUpRetentionReviewState)
    : "not_due";
}

function toClinicReviewState(value: unknown): FollowUpClinicReviewState {
  const state = String(value ?? "not_scheduled");
  return ["not_scheduled", "scheduled", "completed", "needs_policy_review"].includes(state)
    ? (state as FollowUpClinicReviewState)
    : "not_scheduled";
}

function toSopValidationState(value: unknown): FollowUpSopValidationState {
  const state = String(value ?? "not_required");
  return ["not_required", "required", "validated", "exception", "blocked"].includes(state)
    ? (state as FollowUpSopValidationState)
    : "not_required";
}

function toSopPolicyDriftState(value: unknown): FollowUpSopPolicyDriftState {
  const state = String(value ?? "not_checked");
  return ["not_checked", "in_sync", "drifted", "missing_template", "review_required"].includes(state)
    ? (state as FollowUpSopPolicyDriftState)
    : "not_checked";
}

function toSopPolicyExceptionState(value: unknown): FollowUpSopPolicyExceptionState {
  const state = String(value ?? "none");
  return ["none", "open", "accepted", "rejected", "closed"].includes(state)
    ? (state as FollowUpSopPolicyExceptionState)
    : "none";
}

function toSopPolicyAuditState(value: unknown): FollowUpSopPolicyAuditState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "reviewed", "needs_followup"].includes(state)
    ? (state as FollowUpSopPolicyAuditState)
    : "not_started";
}

function toSopPolicyGovernanceState(value: unknown): FollowUpSopPolicyGovernanceState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "reviewed", "needs_followup"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceState)
    : "not_started";
}

function toSopPolicyGovernanceClosureState(value: unknown): FollowUpSopPolicyGovernanceClosureState {
  const state = String(value ?? "not_started");
  return ["not_started", "ready", "closed", "needs_followup"].includes(state)
    ? (state as FollowUpSopPolicyGovernanceClosureState)
    : "not_started";
}

export function toSelfHostedFollowUpMessage(input: unknown): SelfHostedFollowUpMessage {
  const row = isRecord(input) ? input : {};
  return {
    id: String(row.id ?? ""),
    followUpId: String(row.followUpId ?? ""),
    senderRole: String(row.senderRole ?? ""),
    direction: String(row.direction ?? ""),
    channel: String(row.channel ?? "portal"),
    deliveryState: String(row.deliveryState ?? "local_only"),
    patientVisible: Boolean(row.patientVisible ?? true),
    body: textOrNull(row.body),
    createdAt: textOrNull(row.createdAt),
  };
}

export function toSelfHostedClinicalFollowUp(input: unknown): SelfHostedClinicalFollowUp {
  const row = isRecord(input) ? input : {};
  const patient = isRecord(row.patient) ? row.patient : {};
  return {
    id: String(row.id ?? ""),
    clinicId: textOrNull(row.clinicId),
    patientId: textOrNull(row.patientId),
    visitId: textOrNull(row.visitId),
    dueAt: textOrNull(row.dueAt),
    status: toStatus(row.status),
    priority: toPriority(row.priority),
    reason: textOrNull(row.reason),
    patientSummary: textOrNull(row.patientSummary),
    internalNote: textOrNull(row.internalNote),
    triageState: toTriageState(row.triageState),
    escalationLevel: toEscalationLevel(row.escalationLevel),
    slaDueAt: textOrNull(row.slaDueAt),
    deliveryState: toDeliveryState(row.deliveryState),
    deliveryAttempts: Number(row.deliveryAttempts ?? 0),
    lastDeliveryAttemptAt: textOrNull(row.lastDeliveryAttemptAt),
    deliveryEvidence: isRecord(row.deliveryEvidence) ? row.deliveryEvidence : {},
    operationsNote: textOrNull(row.operationsNote),
    resolutionOutcome: toResolutionOutcome(row.resolutionOutcome),
    qualityReviewState: toQualityReviewState(row.qualityReviewState),
    qualityReviewNote: textOrNull(row.qualityReviewNote),
    qualityReviewedAt: textOrNull(row.qualityReviewedAt),
    retentionReviewState: toRetentionReviewState(row.retentionReviewState),
    retentionReviewNote: textOrNull(row.retentionReviewNote),
    retentionReviewedAt: textOrNull(row.retentionReviewedAt),
    clinicReviewState: toClinicReviewState(row.clinicReviewState),
    clinicReviewNote: textOrNull(row.clinicReviewNote),
    clinicReviewedAt: textOrNull(row.clinicReviewedAt),
    sopValidationState: toSopValidationState(row.sopValidationState),
    sopPolicyVersion: textOrNull(row.sopPolicyVersion),
    sopPolicyTemplateId: textOrNull(row.sopPolicyTemplateId),
    sopPolicyTemplateCode: textOrNull(row.sopPolicyTemplateCode),
    sopPolicyDriftState: toSopPolicyDriftState(row.sopPolicyDriftState),
    sopPolicyDriftReason: textOrNull(row.sopPolicyDriftReason),
    sopPolicyAppliedAt: textOrNull(row.sopPolicyAppliedAt),
    sopPolicyDriftReviewedAt: textOrNull(row.sopPolicyDriftReviewedAt),
    sopPolicyExceptionState: toSopPolicyExceptionState(row.sopPolicyExceptionState),
    sopPolicyExceptionReason: textOrNull(row.sopPolicyExceptionReason),
    sopPolicyExceptionResolution: textOrNull(row.sopPolicyExceptionResolution),
    sopPolicyExceptionClosedAt: textOrNull(row.sopPolicyExceptionClosedAt),
    sopPolicyAuditState: toSopPolicyAuditState(row.sopPolicyAuditState),
    sopPolicyAuditNote: textOrNull(row.sopPolicyAuditNote),
    sopPolicyAuditReviewedAt: textOrNull(row.sopPolicyAuditReviewedAt),
    sopPolicyGovernanceState: toSopPolicyGovernanceState(row.sopPolicyGovernanceState),
    sopPolicyGovernanceNote: textOrNull(row.sopPolicyGovernanceNote),
    sopPolicyGovernanceReviewedAt: textOrNull(row.sopPolicyGovernanceReviewedAt),
    sopPolicyGovernanceClosureState: toSopPolicyGovernanceClosureState(row.sopPolicyGovernanceClosureState),
    sopPolicyGovernanceClosureNote: textOrNull(row.sopPolicyGovernanceClosureNote),
    sopPolicyGovernanceClosedAt: textOrNull(row.sopPolicyGovernanceClosedAt),
    sopExceptionReason: textOrNull(row.sopExceptionReason),
    sopValidatedAt: textOrNull(row.sopValidatedAt),
    resolvedAt: textOrNull(row.resolvedAt),
    lastMessageAt: textOrNull(row.lastMessageAt),
    createdAt: textOrNull(row.createdAt),
    updatedAt: textOrNull(row.updatedAt),
    patient: {
      id: textOrNull(patient.id),
      code: textOrNull(patient.code),
      fullName: textOrNull(patient.fullName),
    },
    latestMessage: row.latestMessage ? toSelfHostedFollowUpMessage(row.latestMessage) : null,
    messageCount: Number(row.messageCount ?? 0),
  };
}

export function toFollowUpOperationsSummary(input: unknown): FollowUpOperationsSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalOpen: Number(row.totalOpen ?? 0),
    overdue: Number(row.overdue ?? 0),
    waitingPatient: Number(row.waitingPatient ?? 0),
    escalated: Number(row.escalated ?? 0),
    deliveryFailed: Number(row.deliveryFailed ?? 0),
    deliveryPending: Number(row.deliveryPending ?? 0),
    source: textOrNull(row.source) ?? undefined,
  };
}

export function toFollowUpOutcomeQualitySummary(input: unknown): FollowUpOutcomeQualitySummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: Number(row.totalFollowUps ?? 0),
    closedFollowUps: Number(row.closedFollowUps ?? 0),
    openOverdue: Number(row.openOverdue ?? 0),
    openEscalated: Number(row.openEscalated ?? 0),
    closedWithEvidence: Number(row.closedWithEvidence ?? 0),
    closedMissingEvidence: Number(row.closedMissingEvidence ?? 0),
    qualityReviewed: Number(row.qualityReviewed ?? 0),
    qualityPending: Number(row.qualityPending ?? 0),
    qualityNeedsAttention: Number(row.qualityNeedsAttention ?? 0),
    patientReached: Number(row.patientReached ?? 0),
    clinicalEscalations: Number(row.clinicalEscalations ?? 0),
    deliveryFailures: Number(row.deliveryFailures ?? 0),
    source: textOrNull(row.source) ?? undefined,
  };
}

export function toFollowUpClinicReviewSummary(input: unknown): FollowUpClinicReviewSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: Number(row.totalFollowUps ?? 0),
    retentionDue: Number(row.retentionDue ?? 0),
    retentionReviewed: Number(row.retentionReviewed ?? 0),
    retentionArchived: Number(row.retentionArchived ?? 0),
    clinicReviewScheduled: Number(row.clinicReviewScheduled ?? 0),
    clinicReviewCompleted: Number(row.clinicReviewCompleted ?? 0),
    clinicNeedsPolicyReview: Number(row.clinicNeedsPolicyReview ?? 0),
    qualityNeedsAttention: Number(row.qualityNeedsAttention ?? 0),
    closedMissingEvidence: Number(row.closedMissingEvidence ?? 0),
    localReviewEvents: Number(row.localReviewEvents ?? 0),
    source: textOrNull(row.source) ?? undefined,
  };
}

export function toFollowUpSopValidationSummary(input: unknown): FollowUpSopValidationSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    sopRequired: numberOrZero(row.sopRequired),
    sopValidated: numberOrZero(row.sopValidated),
    sopExceptions: numberOrZero(row.sopExceptions),
    sopBlocked: numberOrZero(row.sopBlocked),
    clinicNeedsPolicyReview: numberOrZero(row.clinicNeedsPolicyReview),
    qualityNeedsAttention: numberOrZero(row.qualityNeedsAttention),
    openEscalated: numberOrZero(row.openEscalated),
    closedMissingEvidence: numberOrZero(row.closedMissingEvidence),
    localSopEvents: numberOrZero(row.localSopEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyTemplateSummary(input: unknown): FollowUpSopPolicyTemplateSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalTemplates: numberOrZero(row.totalTemplates),
    activeTemplates: numberOrZero(row.activeTemplates),
    inactiveTemplates: numberOrZero(row.inactiveTemplates),
    exceptionsAllowed: numberOrZero(row.exceptionsAllowed),
    requiredByDefault: numberOrZero(row.requiredByDefault),
    localPolicyEvents: numberOrZero(row.localPolicyEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyApplicationSummary(input: unknown): FollowUpSopPolicyApplicationSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    activeTemplates: numberOrZero(row.activeTemplates),
    appliedTemplates: numberOrZero(row.appliedTemplates),
    notChecked: numberOrZero(row.notChecked),
    inSync: numberOrZero(row.inSync),
    drifted: numberOrZero(row.drifted),
    missingTemplate: numberOrZero(row.missingTemplate),
    reviewRequired: numberOrZero(row.reviewRequired),
    needsPolicyApplication: numberOrZero(row.needsPolicyApplication),
    localApplicationEvents: numberOrZero(row.localApplicationEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyExceptionClosureSummary(input: unknown): FollowUpSopPolicyExceptionClosureSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    openExceptions: numberOrZero(row.openExceptions),
    closedExceptions: numberOrZero(row.closedExceptions),
    acceptedExceptions: numberOrZero(row.acceptedExceptions),
    rejectedExceptions: numberOrZero(row.rejectedExceptions),
    unresolvedDrift: numberOrZero(row.unresolvedDrift),
    unclosedValidationExceptions: numberOrZero(row.unclosedValidationExceptions),
    closedWithLocalResolution: numberOrZero(row.closedWithLocalResolution),
    localExceptionEvents: numberOrZero(row.localExceptionEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyAuditRollupSummary(input: unknown): FollowUpSopPolicyAuditRollupSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    auditReady: numberOrZero(row.auditReady),
    needsAuditReview: numberOrZero(row.needsAuditReview),
    reviewedAudits: numberOrZero(row.reviewedAudits),
    needsFollowUp: numberOrZero(row.needsFollowUp),
    unresolvedPolicyDrift: numberOrZero(row.unresolvedPolicyDrift),
    openExceptions: numberOrZero(row.openExceptions),
    missingPolicyTemplate: numberOrZero(row.missingPolicyTemplate),
    localPolicyAuditEvents: numberOrZero(row.localPolicyAuditEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceReadinessSummary(input: unknown): FollowUpSopPolicyGovernanceReadinessSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    governanceReady: numberOrZero(row.governanceReady),
    needsGovernanceReview: numberOrZero(row.needsGovernanceReview),
    reviewedGovernance: numberOrZero(row.reviewedGovernance),
    governanceNeedsFollowUp: numberOrZero(row.governanceNeedsFollowUp),
    reviewedPolicyAudits: numberOrZero(row.reviewedPolicyAudits),
    unresolvedPolicyDrift: numberOrZero(row.unresolvedPolicyDrift),
    openExceptions: numberOrZero(row.openExceptions),
    localGovernanceEvents: numberOrZero(row.localGovernanceEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toFollowUpSopPolicyGovernanceClosureSummary(input: unknown): FollowUpSopPolicyGovernanceClosureSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: numberOrZero(row.totalFollowUps),
    closureReady: numberOrZero(row.closureReady),
    needsClosureReview: numberOrZero(row.needsClosureReview),
    closedGovernanceReviews: numberOrZero(row.closedGovernanceReviews),
    closureNeedsFollowUp: numberOrZero(row.closureNeedsFollowUp),
    reviewedGovernance: numberOrZero(row.reviewedGovernance),
    unresolvedPolicyDrift: numberOrZero(row.unresolvedPolicyDrift),
    openExceptions: numberOrZero(row.openExceptions),
    localGovernanceClosureEvents: numberOrZero(row.localGovernanceClosureEvents),
    source: textOrNull(row.source) || undefined,
  };
}

export function toSelfHostedFollowUpSopPolicyTemplate(input: unknown): SelfHostedFollowUpSopPolicyTemplate {
  const row = isRecord(input) ? input : {};
  const states = Array.isArray(row.requiredValidationStates)
    ? row.requiredValidationStates.map(toSopValidationState)
    : [];
  return {
    id: String(row.id ?? ""),
    clinicId: textOrNull(row.clinicId),
    code: String(row.code ?? ""),
    title: String(row.title ?? ""),
    version: String(row.version ?? ""),
    description: textOrNull(row.description),
    appliesTo: isRecord(row.appliesTo) ? row.appliesTo : {},
    requiredValidationStates: states,
    defaultValidationState: toSopValidationState(row.defaultValidationState),
    exceptionAllowed: Boolean(row.exceptionAllowed ?? true),
    active: Boolean(row.active ?? true),
    createdAt: textOrNull(row.createdAt),
    updatedAt: textOrNull(row.updatedAt),
  };
}

function apiErrorFromBody(response: Response, body: unknown): SelfHostedApiError {
  const errorBody =
    isRecord(body) && isRecord(body.error)
      ? body as { error?: Record<string, unknown>; correlationId?: unknown }
      : null;
  const error = errorBody?.error;
  const details = Array.isArray(error?.details)
    ? error.details
        .filter(isRecord)
        .map((item) => ({
          field: String(item.field ?? "body"),
          message: String(item.message ?? "Некорректное значение."),
        }))
    : undefined;
  return {
    kind: response.status === 422 ? "validation" : "http",
    status: response.status,
    code: String(error?.code ?? `http_${response.status}`),
    message: String(error?.message ?? `HTTP ${response.status}`),
    correlationId: errorBody?.correlationId ? String(errorBody.correlationId) : undefined,
    details,
  };
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestJson(
  args: BaseArgs,
  path: string,
  init: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
): Promise<SelfHostedApiResult<unknown>> {
  if (!args.apiToken) return fail(NOT_CONFIGURED);
  const method = init.method ?? "GET";
  let response: Response;
  try {
    response = await fetch(buildSelfHostedApiUrl(args.apiBaseUrl, path), {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${args.apiToken}`,
        ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(init.body ?? {}) }),
    });
  } catch {
    return fail({
      kind: "network",
      code: "network_error",
      message: "Сбой сети при обращении к self-hosted backend.",
    });
  }
  const body = await parseJsonSafe(response);
  if (!response.ok) return fail(apiErrorFromBody(response, body));
  return ok(body);
}

export async function listSelfHostedClinicalFollowUps(
  args: BaseArgs & { status?: string | null; patientId?: string | null; visitId?: string | null },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp[]>> {
  const params = new URLSearchParams();
  if (args.status) params.set("status", args.status);
  if (args.patientId) params.set("patientId", args.patientId);
  if (args.visitId) params.set("visitId", args.visitId);
  const suffix = params.toString() ? `?${params}` : "";
  const response = await requestJson(args, `/api/v1/clinical/follow-ups${suffix}`);
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  const items = Array.isArray(body.items) ? body.items : [];
  return ok(items.map(toSelfHostedClinicalFollowUp).filter((item) => item.id));
}

export async function createSelfHostedVisitFollowUp(
  args: BaseArgs & { visitId: string; payload: CreateFollowUpPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/visits/${encodeURIComponent(args.visitId)}/follow-ups`, {
    method: "POST",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUp(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function createSelfHostedClinicalFollowUpMessage(
  args: BaseArgs & { followUpId: string; payload: CreateFollowUpMessagePayload },
): Promise<SelfHostedApiResult<SelfHostedFollowUpMessage>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/messages`, {
    method: "POST",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedFollowUpMessage(body.item));
}

export async function listSelfHostedClinicalFollowUpOperations(
  args: BaseArgs & {
    triageState?: string | null;
    escalationLevel?: string | null;
    deliveryState?: string | null;
    patientId?: string | null;
    visitId?: string | null;
    overdueOnly?: boolean;
  },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp[]>> {
  const params = new URLSearchParams();
  if (args.triageState) params.set("triageState", args.triageState);
  if (args.escalationLevel) params.set("escalationLevel", args.escalationLevel);
  if (args.deliveryState) params.set("deliveryState", args.deliveryState);
  if (args.patientId) params.set("patientId", args.patientId);
  if (args.visitId) params.set("visitId", args.visitId);
  if (args.overdueOnly) params.set("overdueOnly", "true");
  const suffix = params.toString() ? `?${params}` : "";
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/operations${suffix}`);
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  const items = Array.isArray(body.items) ? body.items : [];
  return ok(items.map(toSelfHostedClinicalFollowUp).filter((item) => item.id));
}

export async function getSelfHostedClinicalFollowUpOperationsSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpOperationsSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/operations/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpOperationsSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpOutcomeQualitySummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpOutcomeQualitySummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/outcomes/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpOutcomeQualitySummary(body.item));
}

export async function getSelfHostedClinicalFollowUpClinicReviewSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpClinicReviewSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/clinic-review/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpClinicReviewSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopValidationSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopValidationSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-validation/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopValidationSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyTemplateSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyTemplateSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-templates/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyTemplateSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyApplicationSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyApplicationSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-application/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyApplicationSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyExceptionClosureSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyExceptionClosureSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-exceptions/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyExceptionClosureSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyAuditRollupSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyAuditRollupSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-audit/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyAuditRollupSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceReadinessSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceReadinessSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceReadinessSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpSopPolicyGovernanceClosureSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpSopPolicyGovernanceClosureSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-governance-closure/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpSopPolicyGovernanceClosureSummary(body.item));
}

export async function listSelfHostedClinicalFollowUpSopPolicyTemplates(
  args: BaseArgs & { activeOnly?: boolean },
): Promise<SelfHostedApiResult<SelfHostedFollowUpSopPolicyTemplate[]>> {
  const params = new URLSearchParams();
  if (args.activeOnly) params.set("activeOnly", "true");
  const suffix = params.toString() ? `?${params}` : "";
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/sop-policy-templates${suffix}`);
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  const items = Array.isArray(body.items) ? body.items : [];
  return ok(items.map(toSelfHostedFollowUpSopPolicyTemplate).filter((item) => item.id));
}

export async function updateSelfHostedClinicalFollowUpOperations(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpOperationsPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/operations`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpQuality(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpQualityPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/quality`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpClinicReview(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpClinicReviewPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/clinic-review`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopValidation(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopValidationPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-validation`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyApplication(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyApplicationPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-application`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyExceptionClosure(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyExceptionClosurePayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-exception`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyAuditRollup(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyAuditRollupPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-audit`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceReadiness(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceReadinessPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyGovernanceClosure(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpSopPolicyGovernanceClosurePayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/sop-policy-governance-closure`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function createSelfHostedClinicalFollowUpSopPolicyTemplate(
  args: BaseArgs & { payload: CreateFollowUpSopPolicyTemplatePayload },
): Promise<SelfHostedApiResult<SelfHostedFollowUpSopPolicyTemplate>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/sop-policy-templates", {
    method: "POST",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedFollowUpSopPolicyTemplate(body.item));
}

export async function updateSelfHostedClinicalFollowUpSopPolicyTemplate(
  args: BaseArgs & { templateId: string; payload: UpdateFollowUpSopPolicyTemplatePayload },
): Promise<SelfHostedApiResult<SelfHostedFollowUpSopPolicyTemplate>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/sop-policy-templates/${encodeURIComponent(args.templateId)}`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedFollowUpSopPolicyTemplate(body.item));
}

export async function listSelfHostedPatientFollowUps(
  args: BaseArgs,
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp[]>> {
  const response = await requestJson(args, "/api/v1/me/follow-ups");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  const items = Array.isArray(body.items) ? body.items : [];
  return ok(items.map(toSelfHostedClinicalFollowUp).filter((item) => item.id));
}

export async function createSelfHostedPatientFollowUpMessage(
  args: BaseArgs & { followUpId: string; payload: CreateFollowUpMessagePayload },
): Promise<SelfHostedApiResult<SelfHostedFollowUpMessage>> {
  const response = await requestJson(args, `/api/v1/me/follow-ups/${encodeURIComponent(args.followUpId)}/messages`, {
    method: "POST",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedFollowUpMessage(body.item));
}
