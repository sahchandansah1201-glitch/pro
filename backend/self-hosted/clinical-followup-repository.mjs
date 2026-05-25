// Stage 17A-17Z · Clinical follow-up communication repository.
// SQL stays self-hosted PostgreSQL only and exposes patient-safe DTOs.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sqlLiteral(value) {
  if (value == null) return "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlUuid(value) {
  if (!UUID_PATTERN.test(String(value || ""))) {
    throw new Error("Invalid UUID for clinical follow-up SQL.");
  }
  return `${sqlLiteral(value)}::uuid`;
}

function sqlNullableUuid(value) {
  return value ? sqlUuid(value) : "null";
}

function sqlNullableText(value) {
  return value == null ? "null" : sqlLiteral(value);
}

function sqlNullableTimestamp(value) {
  return value ? sqlTimestamp(value) : "null";
}

function sqlTimestamp(value) {
  return `${sqlLiteral(value)}::timestamptz`;
}

function sqlJson(value) {
  return `${sqlLiteral(JSON.stringify(value && typeof value === "object" && !Array.isArray(value) ? value : {}))}::jsonb`;
}

function sqlTextArray(values) {
  const items = Array.isArray(values) ? values.map(cleanText).filter(Boolean) : [];
  return `array[${items.map(sqlLiteral).join(", ")}]::text[]`;
}

function clampLimit(value, fallback = 50, max = 200) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

function clampOffset(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function cleanText(value) {
  const text = value == null ? null : String(value).trim();
  return text || null;
}

function cleanObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function clinicScopeWhere(alias, { allClinics = false, clinicIds = [] } = {}) {
  if (allClinics) return "true";
  if (!Array.isArray(clinicIds) || clinicIds.length === 0) return "false";
  return `${alias}.clinic_id in (${clinicIds.map(sqlUuid).join(", ")})`;
}

function normalizeMessage(row = {}) {
  return {
    id: String(row.id ?? ""),
    followUpId: String(row.followUpId ?? row.follow_up_id ?? ""),
    senderRole: String(row.senderRole ?? row.sender_role ?? ""),
    direction: String(row.direction ?? ""),
    channel: String(row.channel ?? "portal"),
    deliveryState: String(row.deliveryState ?? row.delivery_state ?? "local_only"),
    patientVisible: Boolean(row.patientVisible ?? row.patient_visible ?? true),
    body: cleanText(row.body),
    createdAt: cleanText(row.createdAt ?? row.created_at),
  };
}

export function normalizeClinicalFollowUp(row = {}) {
  const latestMessage = row.latestMessage && typeof row.latestMessage === "object"
    ? normalizeMessage(row.latestMessage)
    : null;
  return {
    id: String(row.id ?? ""),
    clinicId: String(row.clinicId ?? row.clinic_id ?? ""),
    patientId: String(row.patientId ?? row.patient_id ?? ""),
    visitId: cleanText(row.visitId ?? row.visit_id),
    dueAt: cleanText(row.dueAt ?? row.due_at),
    status: String(row.status ?? "planned"),
    priority: String(row.priority ?? "normal"),
    reason: cleanText(row.reason),
    patientSummary: cleanText(row.patientSummary ?? row.patient_summary),
    internalNote: cleanText(row.internalNote ?? row.internal_note),
    triageState: String(row.triageState ?? row.triage_state ?? "new"),
    escalationLevel: String(row.escalationLevel ?? row.escalation_level ?? "none"),
    slaDueAt: cleanText(row.slaDueAt ?? row.sla_due_at),
    deliveryState: String(row.deliveryState ?? row.delivery_state ?? "not_required"),
    deliveryAttempts: Number(row.deliveryAttempts ?? row.delivery_attempts ?? 0),
    lastDeliveryAttemptAt: cleanText(row.lastDeliveryAttemptAt ?? row.last_delivery_attempt_at),
    deliveryEvidence: cleanObject(row.deliveryEvidence ?? row.delivery_evidence),
    operationsNote: cleanText(row.operationsNote ?? row.operations_note),
    resolutionOutcome: cleanText(row.resolutionOutcome ?? row.resolution_outcome) || "not_reviewed",
    qualityReviewState: cleanText(row.qualityReviewState ?? row.quality_review_state) || "pending",
    qualityReviewNote: cleanText(row.qualityReviewNote ?? row.quality_review_note),
    qualityReviewedAt: cleanText(row.qualityReviewedAt ?? row.quality_reviewed_at),
    retentionReviewState: cleanText(row.retentionReviewState ?? row.retention_review_state) || "not_due",
    retentionReviewNote: cleanText(row.retentionReviewNote ?? row.retention_review_note),
    retentionReviewedAt: cleanText(row.retentionReviewedAt ?? row.retention_reviewed_at),
    clinicReviewState: cleanText(row.clinicReviewState ?? row.clinic_review_state) || "not_scheduled",
    clinicReviewNote: cleanText(row.clinicReviewNote ?? row.clinic_review_note),
    clinicReviewedAt: cleanText(row.clinicReviewedAt ?? row.clinic_reviewed_at),
    sopValidationState: cleanText(row.sopValidationState ?? row.sop_validation_state) || "not_required",
    sopPolicyVersion: cleanText(row.sopPolicyVersion ?? row.sop_policy_version),
    sopPolicyTemplateId: cleanText(row.sopPolicyTemplateId ?? row.sop_policy_template_id),
    sopPolicyTemplateCode: cleanText(row.sopPolicyTemplateCode ?? row.sop_policy_template_code),
    sopPolicyDriftState: cleanText(row.sopPolicyDriftState ?? row.sop_policy_drift_state) || "not_checked",
    sopPolicyDriftReason: cleanText(row.sopPolicyDriftReason ?? row.sop_policy_drift_reason),
    sopPolicyAppliedAt: cleanText(row.sopPolicyAppliedAt ?? row.sop_policy_applied_at),
    sopPolicyDriftReviewedAt: cleanText(row.sopPolicyDriftReviewedAt ?? row.sop_policy_drift_reviewed_at),
    sopPolicyExceptionState: cleanText(row.sopPolicyExceptionState ?? row.sop_policy_exception_state) || "none",
    sopPolicyExceptionReason: cleanText(row.sopPolicyExceptionReason ?? row.sop_policy_exception_reason),
    sopPolicyExceptionResolution: cleanText(row.sopPolicyExceptionResolution ?? row.sop_policy_exception_resolution),
    sopPolicyExceptionClosedAt: cleanText(row.sopPolicyExceptionClosedAt ?? row.sop_policy_exception_closed_at),
    sopPolicyAuditState: cleanText(row.sopPolicyAuditState ?? row.sop_policy_audit_state) || "not_started",
    sopPolicyAuditNote: cleanText(row.sopPolicyAuditNote ?? row.sop_policy_audit_note),
    sopPolicyAuditReviewedAt: cleanText(row.sopPolicyAuditReviewedAt ?? row.sop_policy_audit_reviewed_at),
    sopPolicyGovernanceState: cleanText(row.sopPolicyGovernanceState ?? row.sop_policy_governance_state) || "not_started",
    sopPolicyGovernanceNote: cleanText(row.sopPolicyGovernanceNote ?? row.sop_policy_governance_note),
    sopPolicyGovernanceReviewedAt: cleanText(row.sopPolicyGovernanceReviewedAt ?? row.sop_policy_governance_reviewed_at),
    sopPolicyGovernanceClosureState: cleanText(row.sopPolicyGovernanceClosureState ?? row.sop_policy_governance_closure_state) || "not_started",
    sopPolicyGovernanceClosureNote: cleanText(row.sopPolicyGovernanceClosureNote ?? row.sop_policy_governance_closure_note),
    sopPolicyGovernanceClosedAt: cleanText(row.sopPolicyGovernanceClosedAt ?? row.sop_policy_governance_closed_at),
    sopPolicyGovernanceEvidenceState: cleanText(row.sopPolicyGovernanceEvidenceState ?? row.sop_policy_governance_evidence_state) || "not_started",
    sopPolicyGovernanceEvidenceNote: cleanText(row.sopPolicyGovernanceEvidenceNote ?? row.sop_policy_governance_evidence_note),
    sopPolicyGovernanceEvidenceReviewedAt: cleanText(row.sopPolicyGovernanceEvidenceReviewedAt ?? row.sop_policy_governance_evidence_reviewed_at),
    sopPolicyGovernanceEvidenceReconciliationState: cleanText(row.sopPolicyGovernanceEvidenceReconciliationState ?? row.sop_policy_governance_evidence_reconciliation_state) || "not_started",
    sopPolicyGovernanceEvidenceReconciliationNote: cleanText(row.sopPolicyGovernanceEvidenceReconciliationNote ?? row.sop_policy_governance_evidence_reconciliation_note),
    sopPolicyGovernanceEvidenceReconciledAt: cleanText(row.sopPolicyGovernanceEvidenceReconciledAt ?? row.sop_policy_governance_evidence_reconciled_at),
    sopPolicyGovernanceEvidenceReconciliationClosureState: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureState ?? row.sop_policy_governance_evidence_reconciliation_closure_state) || "not_started",
    sopPolicyGovernanceEvidenceReconciliationClosureNote: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureNote ?? row.sop_policy_governance_evidence_reconciliation_closure_note),
    sopPolicyGovernanceEvidenceReconciliationClosedAt: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosedAt ?? row.sop_policy_governance_evidence_reconciliation_closed_at),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptState ?? row.sop_policy_governance_evidence_reconciliation_closure_receipt_state) || "not_started",
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote ?? row.sop_policy_governance_evidence_reconciliation_closure_receipt_note),
    sopPolicyGovernanceEvidenceReconciliationClosureReceivedAt: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceivedAt ?? row.sop_policy_governance_evidence_reconciliation_closure_received_at),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState ?? row.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state) || "not_started",
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote ?? row.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_note),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiedAt: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiedAt ?? row.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readied_at),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState ?? row.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state) || "not_started",
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote ?? row.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_note),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosedAt: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosedAt ?? row.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closed_at),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState ?? row.stage34_archive_closure_receipt_state) || "not_started",
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote ?? row.stage34_archive_closure_receipt_note),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceivedAt: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceivedAt ?? row.stage34_archive_closure_received_at),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState ?? row.stage35_archive_receipt_handoff_state) || "not_started",
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote ?? row.stage35_archive_receipt_handoff_note),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandedOffAt: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandedOffAt ?? row.stage35_archive_receipt_handed_off_at),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState ?? row.stage36_archive_handoff_receipt_state) || "not_started",
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote ?? row.stage36_archive_handoff_receipt_note),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceivedAt: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceivedAt ?? row.stage36_archive_handoff_received_at),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState ?? row.stage37_archive_handoff_receipt_reconciliation_state) || "not_started",
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote ?? row.stage37_archive_handoff_receipt_reconciliation_note),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciledAt: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciledAt ?? row.stage37_archive_handoff_receipt_reconciled_at),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState ?? row.stage38_archive_handoff_receipt_reconciliation_closure_state) || "not_started",
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote ?? row.stage38_archive_handoff_receipt_reconciliation_closure_note),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosedAt: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosedAt ?? row.stage38_archive_handoff_receipt_reconciliation_closed_at),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState ?? row.stage39_archive_handoff_receipt_reconciliation_closure_receipt_state) || "not_started",
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote ?? row.stage39_archive_handoff_receipt_reconciliation_closure_receipt_note),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceivedAt: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceivedAt ?? row.stage39_archive_handoff_receipt_reconciliation_closure_received_at),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState ?? row.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state) || "not_started",
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote ?? row.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_note),
    sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiedAt: cleanText(row.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiedAt ?? row.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_readied_at),
    sopExceptionReason: cleanText(row.sopExceptionReason ?? row.sop_exception_reason),
    sopValidatedAt: cleanText(row.sopValidatedAt ?? row.sop_validated_at),
    resolvedAt: cleanText(row.resolvedAt ?? row.resolved_at),
    lastMessageAt: cleanText(row.lastMessageAt ?? row.last_message_at),
    completedAt: cleanText(row.completedAt ?? row.completed_at),
    cancelledAt: cleanText(row.cancelledAt ?? row.cancelled_at),
    createdAt: cleanText(row.createdAt ?? row.created_at),
    updatedAt: cleanText(row.updatedAt ?? row.updated_at),
    patient: {
      id: String(row.patientId ?? row.patient_id ?? ""),
      code: cleanText(row.patientCode ?? row.patient_code),
      fullName: cleanText(row.patientFullName ?? row.patient_full_name),
    },
    visit: {
      id: cleanText(row.visitId ?? row.visit_id),
      startedAt: cleanText(row.visitStartedAt ?? row.visit_started_at),
      status: cleanText(row.visitStatus ?? row.visit_status),
    },
    latestMessage,
    messageCount: Number(row.messageCount ?? row.message_count ?? 0),
  };
}

export function normalizePatientFollowUp(row = {}) {
  const item = normalizeClinicalFollowUp(row);
  return {
    id: item.id,
    visitId: item.visitId,
    dueAt: item.dueAt,
    status: item.status,
    priority: item.priority,
    reason: item.reason,
    patientSummary: item.patientSummary,
    lastMessageAt: item.lastMessageAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    latestMessage: item.latestMessage,
    messageCount: item.messageCount,
  };
}

export function normalizeClinicalFollowUpSopPolicyTemplate(row = {}) {
  return {
    id: String(row.id ?? ""),
    clinicId: String(row.clinicId ?? row.clinic_id ?? ""),
    code: cleanText(row.code) || "",
    title: cleanText(row.title) || "",
    version: cleanText(row.version) || "",
    description: cleanText(row.description),
    appliesTo: cleanObject(row.appliesTo ?? row.applies_to),
    requiredValidationStates: Array.isArray(row.requiredValidationStates)
      ? row.requiredValidationStates.map(String)
      : Array.isArray(row.required_validation_states)
        ? row.required_validation_states.map(String)
        : [],
    defaultValidationState: cleanText(row.defaultValidationState ?? row.default_validation_state) || "required",
    exceptionAllowed: Boolean(row.exceptionAllowed ?? row.exception_allowed ?? true),
    active: Boolean(row.active ?? true),
    createdAt: cleanText(row.createdAt ?? row.created_at),
    updatedAt: cleanText(row.updatedAt ?? row.updated_at),
  };
}

export function normalizeClinicalFollowUpParams(params = new URLSearchParams()) {
  return {
    limit: clampLimit(params.get("limit")),
    offset: clampOffset(params.get("offset")),
    status: cleanText(params.get("status")),
    patientId: cleanText(params.get("patientId")),
    visitId: cleanText(params.get("visitId")),
  };
}

export function normalizeClinicalFollowUpOperationsParams(params = new URLSearchParams()) {
  return {
    limit: clampLimit(params.get("limit")),
    offset: clampOffset(params.get("offset")),
    triageState: cleanText(params.get("triageState")),
    escalationLevel: cleanText(params.get("escalationLevel")),
    deliveryState: cleanText(params.get("deliveryState")),
    patientId: cleanText(params.get("patientId")),
    visitId: cleanText(params.get("visitId")),
    overdueOnly: params.get("overdueOnly") === "true",
    now: cleanText(params.get("now")),
  };
}

export function normalizeClinicalFollowUpSopPolicyTemplateParams(params = new URLSearchParams()) {
  return {
    limit: clampLimit(params.get("limit"), 25, 100),
    offset: clampOffset(params.get("offset")),
    activeOnly: params.get("activeOnly") === "true",
  };
}

function followUpSelect({ patientSafe = false } = {}) {
  const internalNote = patientSafe ? "null as \"internalNote\"" : "f.internal_note as \"internalNote\"";
  return `
    f.id,
    f.clinic_id as "clinicId",
    f.patient_id as "patientId",
    f.visit_id as "visitId",
    f.due_at as "dueAt",
    f.status,
    f.priority,
    f.reason,
    f.patient_summary as "patientSummary",
    ${internalNote},
    f.triage_state as "triageState",
    f.escalation_level as "escalationLevel",
    f.sla_due_at as "slaDueAt",
    f.delivery_state as "deliveryState",
    f.delivery_attempts as "deliveryAttempts",
    f.last_delivery_attempt_at as "lastDeliveryAttemptAt",
    f.delivery_evidence as "deliveryEvidence",
    f.operations_note as "operationsNote",
    coalesce(f.resolution_outcome, 'not_reviewed') as "resolutionOutcome",
    coalesce(f.quality_review_state, 'pending') as "qualityReviewState",
    f.quality_review_note as "qualityReviewNote",
    f.quality_reviewed_at as "qualityReviewedAt",
    coalesce(f.retention_review_state, 'not_due') as "retentionReviewState",
    f.retention_review_note as "retentionReviewNote",
    f.retention_reviewed_at as "retentionReviewedAt",
    coalesce(f.clinic_review_state, 'not_scheduled') as "clinicReviewState",
    f.clinic_review_note as "clinicReviewNote",
    f.clinic_reviewed_at as "clinicReviewedAt",
    coalesce(f.sop_validation_state, 'not_required') as "sopValidationState",
    f.sop_policy_version as "sopPolicyVersion",
    f.sop_policy_template_id as "sopPolicyTemplateId",
    f.sop_policy_template_code as "sopPolicyTemplateCode",
    coalesce(f.sop_policy_drift_state, 'not_checked') as "sopPolicyDriftState",
    f.sop_policy_drift_reason as "sopPolicyDriftReason",
    f.sop_policy_applied_at as "sopPolicyAppliedAt",
    f.sop_policy_drift_reviewed_at as "sopPolicyDriftReviewedAt",
    coalesce(f.sop_policy_exception_state, 'none') as "sopPolicyExceptionState",
    f.sop_policy_exception_reason as "sopPolicyExceptionReason",
    f.sop_policy_exception_resolution as "sopPolicyExceptionResolution",
    f.sop_policy_exception_closed_at as "sopPolicyExceptionClosedAt",
    coalesce(f.sop_policy_audit_state, 'not_started') as "sopPolicyAuditState",
    f.sop_policy_audit_note as "sopPolicyAuditNote",
    f.sop_policy_audit_reviewed_at as "sopPolicyAuditReviewedAt",
    coalesce(f.sop_policy_governance_state, 'not_started') as "sopPolicyGovernanceState",
    f.sop_policy_governance_note as "sopPolicyGovernanceNote",
    f.sop_policy_governance_reviewed_at as "sopPolicyGovernanceReviewedAt",
    coalesce(f.sop_policy_governance_closure_state, 'not_started') as "sopPolicyGovernanceClosureState",
    f.sop_policy_governance_closure_note as "sopPolicyGovernanceClosureNote",
    f.sop_policy_governance_closed_at as "sopPolicyGovernanceClosedAt",
    coalesce(f.sop_policy_governance_evidence_state, 'not_started') as "sopPolicyGovernanceEvidenceState",
    f.sop_policy_governance_evidence_note as "sopPolicyGovernanceEvidenceNote",
    f.sop_policy_governance_evidence_reviewed_at as "sopPolicyGovernanceEvidenceReviewedAt",
    coalesce(f.sop_policy_governance_evidence_reconciliation_state, 'not_started') as "sopPolicyGovernanceEvidenceReconciliationState",
    f.sop_policy_governance_evidence_reconciliation_note as "sopPolicyGovernanceEvidenceReconciliationNote",
    f.sop_policy_governance_evidence_reconciled_at as "sopPolicyGovernanceEvidenceReconciledAt",
    coalesce(f.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started') as "sopPolicyGovernanceEvidenceReconciliationClosureState",
    f.sop_policy_governance_evidence_reconciliation_closure_note as "sopPolicyGovernanceEvidenceReconciliationClosureNote",
    f.sop_policy_governance_evidence_reconciliation_closed_at as "sopPolicyGovernanceEvidenceReconciliationClosedAt",
    coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started') as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptState",
    f.sop_policy_governance_evidence_reconciliation_closure_receipt_note as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote",
    f.sop_policy_governance_evidence_reconciliation_closure_received_at as "sopPolicyGovernanceEvidenceReconciliationClosureReceivedAt",
    coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started') as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState",
    f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_note as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote",
    f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readied_at as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiedAt",
    coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started') as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState",
    f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_note as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote",
    f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closed_at as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosedAt",
    coalesce(f.stage34_archive_closure_receipt_state, 'not_started') as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState",
    f.stage34_archive_closure_receipt_note as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote",
    f.stage34_archive_closure_received_at as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceivedAt",
    coalesce(f.stage35_archive_receipt_handoff_state, 'not_started') as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState",
    f.stage35_archive_receipt_handoff_note as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote",
    f.stage35_archive_receipt_handed_off_at as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandedOffAt",
    coalesce(f.stage36_archive_handoff_receipt_state, 'not_started') as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState",
    f.stage36_archive_handoff_receipt_note as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote",
    f.stage36_archive_handoff_received_at as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceivedAt",
    coalesce(f.stage37_archive_handoff_receipt_reconciliation_state, 'not_started') as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState",
    f.stage37_archive_handoff_receipt_reconciliation_note as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote",
    f.stage37_archive_handoff_receipt_reconciled_at as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciledAt",
    coalesce(f.stage38_archive_handoff_receipt_reconciliation_closure_state, 'not_started') as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState",
    f.stage38_archive_handoff_receipt_reconciliation_closure_note as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote",
    f.stage38_archive_handoff_receipt_reconciliation_closed_at as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosedAt",
    coalesce(f.stage39_archive_handoff_receipt_reconciliation_closure_receipt_state, 'not_started') as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState",
    f.stage39_archive_handoff_receipt_reconciliation_closure_receipt_note as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote",
    f.stage39_archive_handoff_receipt_reconciliation_closure_received_at as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceivedAt",
    coalesce(f.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state, 'not_started') as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState",
    f.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_note as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote",
    f.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_readied_at as "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiedAt",
    f.sop_exception_reason as "sopExceptionReason",
    f.sop_validated_at as "sopValidatedAt",
    f.resolved_at as "resolvedAt",
    f.last_message_at as "lastMessageAt",
    f.completed_at as "completedAt",
    f.cancelled_at as "cancelledAt",
    f.created_at as "createdAt",
    f.updated_at as "updatedAt",
    p.code as "patientCode",
    p.full_name as "patientFullName",
    v.started_at as "visitStartedAt",
    v.status as "visitStatus",
    (
      select count(*)::int
      from clinical_follow_up_messages m
      where m.follow_up_id = f.id
        ${patientSafe ? "and m.patient_visible is true" : ""}
    ) as "messageCount",
    (
      select jsonb_build_object(
        'id', m.id,
        'followUpId', m.follow_up_id,
        'senderRole', m.sender_role,
        'direction', m.direction,
        'channel', m.channel,
        'deliveryState', m.delivery_state,
        'patientVisible', m.patient_visible,
        'body', m.body,
        'createdAt', m.created_at
      )
      from clinical_follow_up_messages m
      where m.follow_up_id = f.id
        ${patientSafe ? "and m.patient_visible is true" : ""}
      order by m.created_at desc
      limit 1
    ) as "latestMessage"
  `;
}

export function buildListClinicalFollowUpsSql({
  limit = 50,
  offset = 0,
  status = null,
  patientId = null,
  visitId = null,
  allClinics = false,
  clinicIds = [],
} = {}) {
  const filters = [
    clinicScopeWhere("f", { allClinics, clinicIds }),
    status ? `f.status = ${sqlLiteral(status)}` : "true",
    patientId ? `f.patient_id = ${sqlUuid(patientId)}` : "true",
    visitId ? `f.visit_id = ${sqlUuid(visitId)}` : "true",
  ].join("\n    and ");
  return `
    select ${followUpSelect()}
    from clinical_follow_up_tasks f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
    where ${filters}
    order by f.due_at asc, f.created_at desc
    limit ${clampLimit(limit)}
    offset ${clampOffset(offset)}
  `;
}

export function buildCreateClinicalFollowUpSql({
  visitId,
  createdByUserId,
  dueAt,
  reason,
  patientSummary = null,
  internalNote = null,
  priority = "normal",
  assignedUserId = null,
  allClinics = false,
  clinicIds = [],
}) {
  return `
    with scoped_visit as (
      select v.id as visit_id, v.clinic_id, v.patient_id
      from visits v
      where v.id = ${sqlUuid(visitId)}
        and ${clinicScopeWhere("v", { allClinics, clinicIds })}
    ), inserted as (
      insert into clinical_follow_up_tasks (
        clinic_id,
        patient_id,
        visit_id,
        created_by_user_id,
        assigned_user_id,
        due_at,
        status,
        priority,
        reason,
        patient_summary,
        internal_note
      )
      select
        clinic_id,
        patient_id,
        visit_id,
        ${sqlUuid(createdByUserId)},
        ${sqlNullableUuid(assignedUserId)},
        ${sqlTimestamp(dueAt)},
        'planned',
        ${sqlLiteral(priority)},
        ${sqlLiteral(reason)},
        ${sqlNullableText(patientSummary)},
        ${sqlNullableText(internalNote)}
      from scoped_visit
      returning *
    )
    select ${followUpSelect()}
    from inserted f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildUpdateClinicalFollowUpSql({
  followUpId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const updates = [];
  if (changes.dueAt !== undefined) updates.push(`due_at = ${sqlTimestamp(changes.dueAt)}`);
  if (changes.status !== undefined) updates.push(`status = ${sqlLiteral(changes.status)}`);
  if (changes.priority !== undefined) updates.push(`priority = ${sqlLiteral(changes.priority)}`);
  if (changes.reason !== undefined) updates.push(`reason = ${sqlLiteral(changes.reason)}`);
  if (changes.patientSummary !== undefined) updates.push(`patient_summary = ${sqlNullableText(changes.patientSummary)}`);
  if (changes.internalNote !== undefined) updates.push(`internal_note = ${sqlNullableText(changes.internalNote)}`);
  if (changes.status === "completed") updates.push("completed_at = now()");
  if (changes.status === "cancelled") updates.push("cancelled_at = now()");
  if (updates.length === 0) updates.push("updated_at = now()");

  return `
    with updated as (
      update clinical_follow_up_tasks f
      set ${updates.join(",\n          ")}
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      returning *
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildCreateClinicalFollowUpMessageSql({
  followUpId,
  senderUserId,
  senderRole = "doctor",
  direction = "clinic_to_patient",
  channel = "portal",
  deliveryState = "local_only",
  patientVisible = true,
  body,
  allClinics = false,
  clinicIds = [],
}) {
  return `
    with scoped_follow_up as (
      select *
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
    ), inserted as (
      insert into clinical_follow_up_messages (
        follow_up_id,
        clinic_id,
        patient_id,
        visit_id,
        sender_user_id,
        sender_role,
        direction,
        channel,
        delivery_state,
        patient_visible,
        body
      )
      select
        id,
        clinic_id,
        patient_id,
        visit_id,
        ${sqlUuid(senderUserId)},
        ${sqlLiteral(senderRole)},
        ${sqlLiteral(direction)},
        ${sqlLiteral(channel)},
        ${sqlLiteral(deliveryState)},
        ${patientVisible ? "true" : "false"},
        ${sqlLiteral(body)}
      from scoped_follow_up
      returning *
    ), touched as (
      update clinical_follow_up_tasks f
      set last_message_at = (select created_at from inserted),
          status = case when f.status = 'planned' then 'sent' else f.status end
      where f.id = ${sqlUuid(followUpId)}
      returning f.*
    )
    select
      i.id,
      i.follow_up_id as "followUpId",
      i.sender_role as "senderRole",
      i.direction,
      i.channel,
      i.delivery_state as "deliveryState",
      i.patient_visible as "patientVisible",
      i.body,
      i.created_at as "createdAt"
    from inserted i
  `;
}

export function buildListPatientFollowUpsSql({ userId } = {}) {
  return `
    select ${followUpSelect({ patientSafe: true })}
    from clinical_follow_up_tasks f
    join patient_user_links pul on pul.patient_id = f.patient_id
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
    where pul.user_id = ${sqlUuid(userId)}
      and f.status <> 'cancelled'
    order by f.due_at asc, f.created_at desc
    limit 100
  `;
}

export function buildCreatePatientFollowUpMessageSql({
  userId,
  followUpId,
  body,
}) {
  return `
    with scoped_follow_up as (
      select f.*
      from clinical_follow_up_tasks f
      join patient_user_links pul on pul.patient_id = f.patient_id
      where pul.user_id = ${sqlUuid(userId)}
        and f.id = ${sqlUuid(followUpId)}
        and f.status <> 'cancelled'
    ), inserted as (
      insert into clinical_follow_up_messages (
        follow_up_id,
        clinic_id,
        patient_id,
        visit_id,
        sender_user_id,
        sender_role,
        direction,
        channel,
        delivery_state,
        patient_visible,
        body
      )
      select
        id,
        clinic_id,
        patient_id,
        visit_id,
        ${sqlUuid(userId)},
        'patient',
        'patient_to_clinic',
        'portal',
        'local_only',
        true,
        ${sqlLiteral(body)}
      from scoped_follow_up
      returning *
    ), touched as (
      update clinical_follow_up_tasks f
      set last_message_at = (select created_at from inserted),
          status = case when f.status in ('planned', 'sent') then 'acknowledged' else f.status end
      where f.id = ${sqlUuid(followUpId)}
      returning f.*
    )
    select
      i.id,
      i.follow_up_id as "followUpId",
      i.sender_role as "senderRole",
      i.direction,
      i.channel,
      i.delivery_state as "deliveryState",
      i.patient_visible as "patientVisible",
      i.body,
      i.created_at as "createdAt"
    from inserted i
  `;
}

export function buildListClinicalFollowUpOperationsSql({
  limit = 50,
  offset = 0,
  triageState = null,
  escalationLevel = null,
  deliveryState = null,
  patientId = null,
  visitId = null,
  overdueOnly = false,
  now = null,
  allClinics = false,
  clinicIds = [],
} = {}) {
  const nowExpression = now ? sqlTimestamp(now) : "now()";
  const filters = [
    clinicScopeWhere("f", { allClinics, clinicIds }),
    "f.status not in ('completed', 'cancelled')",
    triageState ? `f.triage_state = ${sqlLiteral(triageState)}` : "true",
    escalationLevel ? `f.escalation_level = ${sqlLiteral(escalationLevel)}` : "true",
    deliveryState ? `f.delivery_state = ${sqlLiteral(deliveryState)}` : "true",
    patientId ? `f.patient_id = ${sqlUuid(patientId)}` : "true",
    visitId ? `f.visit_id = ${sqlUuid(visitId)}` : "true",
    overdueOnly ? `coalesce(f.sla_due_at, f.due_at) < ${nowExpression}` : "true",
  ].join("\n    and ");
  return `
    select ${followUpSelect()}
    from clinical_follow_up_tasks f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
    where ${filters}
    order by
      case when coalesce(f.sla_due_at, f.due_at) < ${nowExpression} then 0 else 1 end,
      coalesce(f.sla_due_at, f.due_at) asc,
      f.priority desc,
      f.created_at desc
    limit ${clampLimit(limit)}
    offset ${clampOffset(offset)}
  `;
}

export function buildClinicalFollowUpOperationsSummarySql({
  now = null,
  allClinics = false,
  clinicIds = [],
} = {}) {
  const nowExpression = now ? sqlTimestamp(now) : "now()";
  return `
    select
      count(*)::int as "totalOpen",
      count(*) filter (where coalesce(f.sla_due_at, f.due_at) < ${nowExpression})::int as overdue,
      count(*) filter (where f.triage_state = 'waiting_patient')::int as "waitingPatient",
      count(*) filter (where f.triage_state = 'escalated' or f.escalation_level <> 'none')::int as escalated,
      count(*) filter (where f.delivery_state = 'failed')::int as "deliveryFailed",
      count(*) filter (where f.delivery_state = 'pending')::int as "deliveryPending"
    from clinical_follow_up_tasks f
    where ${clinicScopeWhere("f", { allClinics, clinicIds })}
      and f.status not in ('completed', 'cancelled')
  `;
}

export function buildClinicalFollowUpOutcomeQualitySummarySql({
  now = null,
  allClinics = false,
  clinicIds = [],
} = {}) {
  const nowExpression = now ? sqlTimestamp(now) : "now()";
  return `
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where f.status = 'completed' or f.triage_state = 'resolved')::int as "closedFollowUps",
      count(*) filter (where f.status not in ('completed', 'cancelled') and coalesce(f.sla_due_at, f.due_at) < ${nowExpression})::int as "openOverdue",
      count(*) filter (where f.status not in ('completed', 'cancelled') and f.escalation_level <> 'none')::int as "openEscalated",
      count(*) filter (where f.status in ('completed', 'cancelled') and coalesce(f.delivery_evidence, '{}'::jsonb) <> '{}'::jsonb)::int as "closedWithEvidence",
      count(*) filter (where f.status in ('completed', 'cancelled') and coalesce(f.delivery_evidence, '{}'::jsonb) = '{}'::jsonb)::int as "closedMissingEvidence",
      count(*) filter (where coalesce(f.quality_review_state, 'pending') = 'reviewed')::int as "qualityReviewed",
      count(*) filter (where coalesce(f.quality_review_state, 'pending') = 'pending')::int as "qualityPending",
      count(*) filter (where coalesce(f.quality_review_state, 'pending') = 'needs_attention')::int as "qualityNeedsAttention",
      count(*) filter (where coalesce(f.resolution_outcome, 'not_reviewed') = 'patient_reached')::int as "patientReached",
      count(*) filter (where coalesce(f.resolution_outcome, 'not_reviewed') = 'clinical_escalation')::int as "clinicalEscalations",
      count(*) filter (where f.delivery_state = 'failed')::int as "deliveryFailures"
    from clinical_follow_up_tasks f
    where ${clinicScopeWhere("f", { allClinics, clinicIds })}
  `;
}

export function buildClinicalFollowUpClinicReviewSummarySql({
  now = null,
  allClinics = false,
  clinicIds = [],
} = {}) {
  const nowExpression = now ? sqlTimestamp(now) : "now()";
  const retentionDue = `(
    coalesce(f.retention_review_state, 'not_due') = 'due'
    or (
      f.status in ('completed', 'cancelled')
      and coalesce(f.retention_review_state, 'not_due') not in ('reviewed', 'archived')
      and coalesce(f.completed_at, f.cancelled_at, f.updated_at) < ${nowExpression} - interval '30 days'
    )
  )`;
  return `
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where ${retentionDue})::int as "retentionDue",
      count(*) filter (where coalesce(f.retention_review_state, 'not_due') = 'reviewed')::int as "retentionReviewed",
      count(*) filter (where coalesce(f.retention_review_state, 'not_due') = 'archived')::int as "retentionArchived",
      count(*) filter (where coalesce(f.clinic_review_state, 'not_scheduled') = 'scheduled')::int as "clinicReviewScheduled",
      count(*) filter (where coalesce(f.clinic_review_state, 'not_scheduled') = 'completed')::int as "clinicReviewCompleted",
      count(*) filter (where coalesce(f.clinic_review_state, 'not_scheduled') = 'needs_policy_review')::int as "clinicNeedsPolicyReview",
      count(*) filter (where coalesce(f.quality_review_state, 'pending') = 'needs_attention')::int as "qualityNeedsAttention",
      count(*) filter (where f.status in ('completed', 'cancelled') and coalesce(f.delivery_evidence, '{}'::jsonb) = '{}'::jsonb)::int as "closedMissingEvidence",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_retention_review_events e
        where e.follow_up_id = f.id
      ))::int as "localReviewEvents"
    from clinical_follow_up_tasks f
    where ${clinicScopeWhere("f", { allClinics, clinicIds })}
  `;
}

export function buildClinicalFollowUpSopValidationSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const sopRequired = `(
    coalesce(f.sop_validation_state, 'not_required') = 'required'
    or coalesce(f.clinic_review_state, 'not_scheduled') = 'needs_policy_review'
    or coalesce(f.quality_review_state, 'pending') = 'needs_attention'
    or f.escalation_level <> 'none'
  )`;
  return `
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where ${sopRequired})::int as "sopRequired",
      count(*) filter (where coalesce(f.sop_validation_state, 'not_required') = 'validated')::int as "sopValidated",
      count(*) filter (where coalesce(f.sop_validation_state, 'not_required') = 'exception')::int as "sopExceptions",
      count(*) filter (where coalesce(f.sop_validation_state, 'not_required') = 'blocked')::int as "sopBlocked",
      count(*) filter (where coalesce(f.clinic_review_state, 'not_scheduled') = 'needs_policy_review')::int as "clinicNeedsPolicyReview",
      count(*) filter (where coalesce(f.quality_review_state, 'pending') = 'needs_attention')::int as "qualityNeedsAttention",
      count(*) filter (where f.status not in ('completed', 'cancelled') and f.escalation_level <> 'none')::int as "openEscalated",
      count(*) filter (where f.status in ('completed', 'cancelled') and coalesce(f.delivery_evidence, '{}'::jsonb) = '{}'::jsonb)::int as "closedMissingEvidence",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_sop_validation_events e
        where e.follow_up_id = f.id
      ))::int as "localSopEvents"
    from clinical_follow_up_tasks f
    where ${clinicScopeWhere("f", { allClinics, clinicIds })}
  `;
}

export function buildClinicalFollowUpSopPolicyTemplateSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  return `
    select
      count(*)::int as "totalTemplates",
      count(*) filter (where t.active is true)::int as "activeTemplates",
      count(*) filter (where t.active is false)::int as "inactiveTemplates",
      count(*) filter (where t.exception_allowed is true)::int as "exceptionsAllowed",
      count(*) filter (where t.default_validation_state = 'required')::int as "requiredByDefault",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_sop_policy_template_events e
        where e.template_id = t.id
      ))::int as "localPolicyEvents"
    from clinical_follow_up_sop_policy_templates t
    where ${clinicScopeWhere("t", { allClinics, clinicIds })}
  `;
}

export function buildListClinicalFollowUpSopPolicyTemplatesSql({
  limit = 25,
  offset = 0,
  activeOnly = false,
  allClinics = false,
  clinicIds = [],
} = {}) {
  const filters = [clinicScopeWhere("t", { allClinics, clinicIds })];
  if (activeOnly) filters.push("t.active is true");
  return `
    select
      t.id,
      t.clinic_id as "clinicId",
      t.code,
      t.title,
      t.version,
      t.description,
      t.applies_to as "appliesTo",
      t.required_validation_states as "requiredValidationStates",
      t.default_validation_state as "defaultValidationState",
      t.exception_allowed as "exceptionAllowed",
      t.active,
      t.created_at as "createdAt",
      t.updated_at as "updatedAt"
    from clinical_follow_up_sop_policy_templates t
    where ${filters.join("\n      and ")}
    order by t.active desc, t.updated_at desc, t.title asc
    limit ${clampLimit(limit, 25, 100)}
    offset ${clampOffset(offset)}
  `;
}

export function buildCreateClinicalFollowUpSopPolicyTemplateSql({
  clinicId,
  actorUserId,
  payload,
  allClinics = false,
  clinicIds = [],
}) {
  return `
    with scoped_clinic as (
      select c.id
      from clinics c
      where c.id = ${sqlUuid(clinicId)}
        and ${clinicScopeWhere("c", { allClinics, clinicIds })}
    ), inserted as (
      insert into clinical_follow_up_sop_policy_templates (
        clinic_id,
        code,
        title,
        version,
        description,
        applies_to,
        required_validation_states,
        default_validation_state,
        exception_allowed,
        active,
        created_by_user_id,
        updated_by_user_id
      )
      select
        id,
        ${sqlLiteral(payload.code)},
        ${sqlLiteral(payload.title)},
        ${sqlLiteral(payload.version)},
        ${sqlNullableText(payload.description)},
        ${sqlJson(payload.appliesTo)},
        ${sqlTextArray(payload.requiredValidationStates)},
        ${sqlLiteral(payload.defaultValidationState)},
        ${payload.exceptionAllowed ? "true" : "false"},
        ${payload.active ? "true" : "false"},
        ${sqlUuid(actorUserId)},
        ${sqlUuid(actorUserId)}
      from scoped_clinic
      returning *
    ), event as (
      insert into clinical_follow_up_sop_policy_template_events (
        template_id,
        clinic_id,
        actor_user_id,
        event_type,
        next_state,
        note
      )
      select
        id,
        clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_template.create',
        jsonb_build_object(
          'code', code,
          'version', version,
          'defaultValidationState', default_validation_state,
          'active', active
        ),
        title
      from inserted
      returning id
    )
    select
      id,
      clinic_id as "clinicId",
      code,
      title,
      version,
      description,
      applies_to as "appliesTo",
      required_validation_states as "requiredValidationStates",
      default_validation_state as "defaultValidationState",
      exception_allowed as "exceptionAllowed",
      active,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from inserted
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyTemplateSql({
  templateId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const updates = [];
  if (changes.code !== undefined) updates.push(`code = ${sqlLiteral(changes.code)}`);
  if (changes.title !== undefined) updates.push(`title = ${sqlLiteral(changes.title)}`);
  if (changes.version !== undefined) updates.push(`version = ${sqlLiteral(changes.version)}`);
  if (changes.description !== undefined) updates.push(`description = ${sqlNullableText(changes.description)}`);
  if (changes.appliesTo !== undefined) updates.push(`applies_to = ${sqlJson(changes.appliesTo)}`);
  if (changes.requiredValidationStates !== undefined) updates.push(`required_validation_states = ${sqlTextArray(changes.requiredValidationStates)}`);
  if (changes.defaultValidationState !== undefined) updates.push(`default_validation_state = ${sqlLiteral(changes.defaultValidationState)}`);
  if (changes.exceptionAllowed !== undefined) updates.push(`exception_allowed = ${changes.exceptionAllowed ? "true" : "false"}`);
  if (changes.active !== undefined) updates.push(`active = ${changes.active ? "true" : "false"}`);
  updates.push(`updated_by_user_id = ${sqlUuid(actorUserId)}`);
  updates.push("updated_at = now()");

  return `
    with previous as (
      select t.*
      from clinical_follow_up_sop_policy_templates t
      where t.id = ${sqlUuid(templateId)}
        and ${clinicScopeWhere("t", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_sop_policy_templates t
      set ${updates.join(",\n          ")}
      from previous p
      where t.id = p.id
      returning t.*,
        p.code as previous_code,
        p.version as previous_version,
        p.default_validation_state as previous_default_validation_state,
        p.active as previous_active
    ), event as (
      insert into clinical_follow_up_sop_policy_template_events (
        template_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        note
      )
      select
        id,
        clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_template.update',
        jsonb_build_object(
          'code', previous_code,
          'version', previous_version,
          'defaultValidationState', previous_default_validation_state,
          'active', previous_active
        ),
        jsonb_build_object(
          'code', code,
          'version', version,
          'defaultValidationState', default_validation_state,
          'active', active
        ),
        title
      from updated
      returning id
    )
    select
      id,
      clinic_id as "clinicId",
      code,
      title,
      version,
      description,
      applies_to as "appliesTo",
      required_validation_states as "requiredValidationStates",
      default_validation_state as "defaultValidationState",
      exception_allowed as "exceptionAllowed",
      active,
      created_at as "createdAt",
      updated_at as "updatedAt"
    from updated
  `;
}

export function buildClinicalFollowUpSopPolicyApplicationSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const scopedFollowUps = clinicScopeWhere("f", { allClinics, clinicIds });
  const scopedTemplates = clinicScopeWhere("t", { allClinics, clinicIds });
  return `
    with scoped_followups as (
      select *
      from clinical_follow_up_tasks f
      where ${scopedFollowUps}
    ), active_templates as (
      select *
      from clinical_follow_up_sop_policy_templates t
      where ${scopedTemplates}
        and t.active is true
    )
    select
      (select count(*)::int from scoped_followups) as "totalFollowUps",
      (select count(*)::int from active_templates) as "activeTemplates",
      count(*) filter (where coalesce(f.sop_policy_template_id, null) is not null)::int as "appliedTemplates",
      count(*) filter (where coalesce(f.sop_policy_drift_state, 'not_checked') = 'not_checked')::int as "notChecked",
      count(*) filter (where coalesce(f.sop_policy_drift_state, 'not_checked') = 'in_sync')::int as "inSync",
      count(*) filter (where coalesce(f.sop_policy_drift_state, 'not_checked') = 'drifted')::int as drifted,
      count(*) filter (where coalesce(f.sop_policy_drift_state, 'not_checked') = 'missing_template')::int as "missingTemplate",
      count(*) filter (where coalesce(f.sop_policy_drift_state, 'not_checked') = 'review_required')::int as "reviewRequired",
      count(*) filter (where coalesce(f.sop_validation_state, 'not_required') in ('required', 'blocked') and f.sop_policy_version is null)::int as "needsPolicyApplication",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_sop_policy_application_events e
        where e.follow_up_id = f.id
      ))::int as "localApplicationEvents"
    from scoped_followups f
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyApplicationSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const hasTemplate = changes.sopPolicyTemplateId !== undefined;
  const templateId = changes.sopPolicyTemplateId || null;
  const nextVersion = hasTemplate
    ? "coalesce((select version from selected_template), p.sop_policy_version)"
    : changes.sopPolicyVersion !== undefined
      ? sqlNullableText(changes.sopPolicyVersion)
      : "p.sop_policy_version";
  const nextCode = hasTemplate
    ? "coalesce((select code from selected_template), p.sop_policy_template_code)"
    : changes.sopPolicyTemplateCode !== undefined
      ? sqlNullableText(changes.sopPolicyTemplateCode)
      : "p.sop_policy_template_code";
  const nextValidationState = hasTemplate
    ? "coalesce((select default_validation_state from selected_template), p.sop_validation_state)"
    : changes.sopValidationState !== undefined
      ? sqlLiteral(changes.sopValidationState)
      : "p.sop_validation_state";
  const nextDriftState = changes.sopPolicyDriftState !== undefined
    ? sqlLiteral(changes.sopPolicyDriftState)
    : hasTemplate
      ? "'in_sync'"
      : "p.sop_policy_drift_state";
  const nextReason = changes.sopPolicyDriftReason !== undefined
    ? sqlNullableText(changes.sopPolicyDriftReason)
    : hasTemplate
      ? sqlNullableText("Applied active local SOP policy template.")
      : "p.sop_policy_drift_reason";
  const applicationTouched = hasTemplate || changes.sopPolicyVersion !== undefined || changes.sopPolicyTemplateCode !== undefined || changes.sopValidationState !== undefined;
  const driftTouched = changes.sopPolicyDriftState !== undefined || changes.sopPolicyDriftReason !== undefined;
  const templateGate = hasTemplate ? "and exists (select 1 from selected_template)" : "";

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), selected_template as (
      select t.*
      from clinical_follow_up_sop_policy_templates t
      join previous p on p.clinic_id = t.clinic_id
      where ${hasTemplate ? `t.id = ${sqlUuid(templateId)}` : "false"}
        and t.active is true
    ), updated as (
      update clinical_follow_up_tasks f
      set
          sop_policy_template_id = ${hasTemplate ? "coalesce((select id from selected_template), p.sop_policy_template_id)" : "p.sop_policy_template_id"},
          sop_policy_template_code = ${nextCode},
          sop_policy_version = ${nextVersion},
          sop_validation_state = ${nextValidationState},
          sop_policy_drift_state = ${nextDriftState},
          sop_policy_drift_reason = ${nextReason},
          sop_policy_applied_by_user_id = ${applicationTouched ? sqlUuid(actorUserId) : "p.sop_policy_applied_by_user_id"},
          sop_policy_applied_at = ${applicationTouched ? "now()" : "p.sop_policy_applied_at"},
          sop_policy_drift_reviewed_by_user_id = ${driftTouched ? sqlUuid(actorUserId) : "p.sop_policy_drift_reviewed_by_user_id"},
          sop_policy_drift_reviewed_at = ${driftTouched ? "now()" : "p.sop_policy_drift_reviewed_at"},
          updated_at = now()
      from previous p
      where f.id = p.id
        ${templateGate}
      returning f.*,
        p.sop_policy_template_id as previous_sop_policy_template_id,
        p.sop_policy_template_code as previous_sop_policy_template_code,
        p.sop_policy_version as previous_sop_policy_version,
        p.sop_validation_state as previous_sop_validation_state,
        p.sop_policy_drift_state as previous_sop_policy_drift_state,
        p.sop_policy_drift_reason as previous_sop_policy_drift_reason
    ), event as (
      insert into clinical_follow_up_sop_policy_application_events (
        follow_up_id,
        template_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        sop_policy_version,
        drift_state,
        note
      )
      select
        u.id,
        u.sop_policy_template_id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_application.update',
        jsonb_build_object(
          'sopPolicyTemplateId', previous_sop_policy_template_id,
          'sopPolicyTemplateCode', previous_sop_policy_template_code,
          'sopPolicyVersion', previous_sop_policy_version,
          'sopValidationState', coalesce(previous_sop_validation_state, 'not_required'),
          'sopPolicyDriftState', coalesce(previous_sop_policy_drift_state, 'not_checked'),
          'sopPolicyDriftReason', previous_sop_policy_drift_reason
        ),
        jsonb_build_object(
          'sopPolicyTemplateId', u.sop_policy_template_id,
          'sopPolicyTemplateCode', u.sop_policy_template_code,
          'sopPolicyVersion', u.sop_policy_version,
          'sopValidationState', u.sop_validation_state,
          'sopPolicyDriftState', u.sop_policy_drift_state,
          'sopPolicyDriftReason', u.sop_policy_drift_reason
        ),
        u.sop_policy_version,
        u.sop_policy_drift_state,
        ${sqlNullableText(changes.sopPolicyDriftReason || changes.sopPolicyVersion || changes.sopValidationState || (hasTemplate ? "Applied active local SOP policy template." : changes.sopPolicyDriftState))}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildClinicalFollowUpSopPolicyExceptionClosureSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const scopedFollowUps = clinicScopeWhere("f", { allClinics, clinicIds });
  return `
    with scoped_followups as (
      select *
      from clinical_follow_up_tasks f
      where ${scopedFollowUps}
    )
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where coalesce(f.sop_policy_exception_state, 'none') = 'open')::int as "openExceptions",
      count(*) filter (where coalesce(f.sop_policy_exception_state, 'none') in ('accepted', 'rejected', 'closed'))::int as "closedExceptions",
      count(*) filter (where coalesce(f.sop_policy_exception_state, 'none') = 'accepted')::int as "acceptedExceptions",
      count(*) filter (where coalesce(f.sop_policy_exception_state, 'none') = 'rejected')::int as "rejectedExceptions",
      count(*) filter (where coalesce(f.sop_policy_drift_state, 'not_checked') in ('drifted', 'missing_template', 'review_required') and coalesce(f.sop_policy_exception_state, 'none') not in ('accepted', 'rejected', 'closed'))::int as "unresolvedDrift",
      count(*) filter (where coalesce(f.sop_validation_state, 'not_required') = 'exception' and coalesce(f.sop_policy_exception_state, 'none') not in ('accepted', 'rejected', 'closed'))::int as "unclosedValidationExceptions",
      count(*) filter (where f.sop_policy_exception_closed_at is not null)::int as "closedWithLocalResolution",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_sop_policy_exception_events e
        where e.follow_up_id = f.id
      ))::int as "localExceptionEvents"
    from scoped_followups f
  `;
}

export function buildClinicalFollowUpSopPolicyAuditRollupSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const scopedFollowUps = clinicScopeWhere("f", { allClinics, clinicIds });
  const auditReady = `(
    coalesce(f.sop_policy_drift_state, 'not_checked') = 'in_sync'
    or coalesce(f.sop_policy_exception_state, 'none') in ('accepted', 'rejected', 'closed')
  )`;
  return `
    with scoped_followups as (
      select *
      from clinical_follow_up_tasks f
      where ${scopedFollowUps}
    )
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where ${auditReady})::int as "auditReady",
      count(*) filter (where ${auditReady} and coalesce(f.sop_policy_audit_state, 'not_started') in ('not_started', 'needs_followup'))::int as "needsAuditReview",
      count(*) filter (where coalesce(f.sop_policy_audit_state, 'not_started') = 'reviewed')::int as "reviewedAudits",
      count(*) filter (where coalesce(f.sop_policy_audit_state, 'not_started') = 'needs_followup')::int as "needsFollowUp",
      count(*) filter (where coalesce(f.sop_policy_drift_state, 'not_checked') in ('drifted', 'missing_template', 'review_required'))::int as "unresolvedPolicyDrift",
      count(*) filter (where coalesce(f.sop_policy_exception_state, 'none') = 'open')::int as "openExceptions",
      count(*) filter (where coalesce(f.sop_policy_template_id, null) is null and coalesce(f.sop_validation_state, 'not_required') in ('required', 'blocked'))::int as "missingPolicyTemplate",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_sop_policy_audit_events e
        where e.follow_up_id = f.id
      ))::int as "localPolicyAuditEvents"
    from scoped_followups f
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyAuditRollupSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const nextState = changes.sopPolicyAuditState !== undefined
    ? sqlLiteral(changes.sopPolicyAuditState)
    : "p.sop_policy_audit_state";
  const nextNote = changes.sopPolicyAuditNote !== undefined
    ? sqlNullableText(changes.sopPolicyAuditNote)
    : "p.sop_policy_audit_note";
  const reviewedState = ["ready", "reviewed", "needs_followup"].includes(changes.sopPolicyAuditState);

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set
          sop_policy_audit_state = ${nextState},
          sop_policy_audit_note = ${nextNote},
          sop_policy_audit_reviewed_by_user_id = ${reviewedState ? sqlUuid(actorUserId) : "p.sop_policy_audit_reviewed_by_user_id"},
          sop_policy_audit_reviewed_at = ${reviewedState ? "now()" : "p.sop_policy_audit_reviewed_at"},
          updated_at = now()
      from previous p
      where f.id = p.id
      returning f.*,
        p.sop_policy_audit_state as previous_sop_policy_audit_state,
        p.sop_policy_audit_note as previous_sop_policy_audit_note,
        p.sop_policy_drift_state as previous_sop_policy_drift_state,
        p.sop_policy_exception_state as previous_sop_policy_exception_state,
        p.sop_validation_state as previous_sop_validation_state
    ), event as (
      insert into clinical_follow_up_sop_policy_audit_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        audit_state,
        drift_state,
        exception_state,
        validation_state,
        note
      )
      select
        u.id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_audit_rollup.update',
        jsonb_build_object(
          'sopPolicyAuditState', coalesce(previous_sop_policy_audit_state, 'not_started'),
          'sopPolicyAuditNote', previous_sop_policy_audit_note,
          'sopPolicyDriftState', coalesce(previous_sop_policy_drift_state, 'not_checked'),
          'sopPolicyExceptionState', coalesce(previous_sop_policy_exception_state, 'none'),
          'sopValidationState', coalesce(previous_sop_validation_state, 'not_required')
        ),
        jsonb_build_object(
          'sopPolicyAuditState', coalesce(u.sop_policy_audit_state, 'not_started'),
          'sopPolicyAuditNote', u.sop_policy_audit_note,
          'sopPolicyDriftState', coalesce(u.sop_policy_drift_state, 'not_checked'),
          'sopPolicyExceptionState', coalesce(u.sop_policy_exception_state, 'none'),
          'sopValidationState', coalesce(u.sop_validation_state, 'not_required')
        ),
        coalesce(u.sop_policy_audit_state, 'not_started'),
        coalesce(u.sop_policy_drift_state, 'not_checked'),
        coalesce(u.sop_policy_exception_state, 'none'),
        coalesce(u.sop_validation_state, 'not_required'),
        ${sqlNullableText(changes.sopPolicyAuditNote || changes.sopPolicyAuditState)}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildClinicalFollowUpSopPolicyGovernanceReadinessSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const scopedFollowUps = clinicScopeWhere("f", { allClinics, clinicIds });
  const governanceReady = `(
    coalesce(f.sop_policy_audit_state, 'not_started') = 'reviewed'
    and (
      coalesce(f.sop_policy_drift_state, 'not_checked') = 'in_sync'
      or coalesce(f.sop_policy_exception_state, 'none') in ('accepted', 'rejected', 'closed')
    )
  )`;
  return `
    with scoped_followups as (
      select *
      from clinical_follow_up_tasks f
      where ${scopedFollowUps}
    )
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where ${governanceReady})::int as "governanceReady",
      count(*) filter (where ${governanceReady} and coalesce(f.sop_policy_governance_state, 'not_started') in ('not_started', 'needs_followup'))::int as "needsGovernanceReview",
      count(*) filter (where coalesce(f.sop_policy_governance_state, 'not_started') = 'reviewed')::int as "reviewedGovernance",
      count(*) filter (where coalesce(f.sop_policy_governance_state, 'not_started') = 'needs_followup')::int as "governanceNeedsFollowUp",
      count(*) filter (where coalesce(f.sop_policy_audit_state, 'not_started') = 'reviewed')::int as "reviewedPolicyAudits",
      count(*) filter (where coalesce(f.sop_policy_drift_state, 'not_checked') in ('drifted', 'missing_template', 'review_required'))::int as "unresolvedPolicyDrift",
      count(*) filter (where coalesce(f.sop_policy_exception_state, 'none') = 'open')::int as "openExceptions",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_sop_policy_governance_events e
        where e.follow_up_id = f.id
      ))::int as "localGovernanceEvents"
    from scoped_followups f
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyGovernanceReadinessSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const nextState = changes.sopPolicyGovernanceState !== undefined
    ? sqlLiteral(changes.sopPolicyGovernanceState)
    : "p.sop_policy_governance_state";
  const nextNote = changes.sopPolicyGovernanceNote !== undefined
    ? sqlNullableText(changes.sopPolicyGovernanceNote)
    : "p.sop_policy_governance_note";
  const reviewedState = ["ready", "reviewed", "needs_followup"].includes(changes.sopPolicyGovernanceState);

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set
          sop_policy_governance_state = ${nextState},
          sop_policy_governance_note = ${nextNote},
          sop_policy_governance_reviewed_by_user_id = ${reviewedState ? sqlUuid(actorUserId) : "p.sop_policy_governance_reviewed_by_user_id"},
          sop_policy_governance_reviewed_at = ${reviewedState ? "now()" : "p.sop_policy_governance_reviewed_at"},
          updated_at = now()
      from previous p
      where f.id = p.id
      returning f.*,
        p.sop_policy_governance_state as previous_sop_policy_governance_state,
        p.sop_policy_governance_note as previous_sop_policy_governance_note,
        p.sop_policy_audit_state as previous_sop_policy_audit_state,
        p.sop_policy_drift_state as previous_sop_policy_drift_state,
        p.sop_policy_exception_state as previous_sop_policy_exception_state,
        p.sop_validation_state as previous_sop_validation_state
    ), event as (
      insert into clinical_follow_up_sop_policy_governance_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        governance_state,
        audit_state,
        drift_state,
        exception_state,
        validation_state,
        note
      )
      select
        u.id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_governance_readiness.update',
        jsonb_build_object(
          'sopPolicyGovernanceState', coalesce(previous_sop_policy_governance_state, 'not_started'),
          'sopPolicyGovernanceNote', previous_sop_policy_governance_note,
          'sopPolicyAuditState', coalesce(previous_sop_policy_audit_state, 'not_started'),
          'sopPolicyDriftState', coalesce(previous_sop_policy_drift_state, 'not_checked'),
          'sopPolicyExceptionState', coalesce(previous_sop_policy_exception_state, 'none'),
          'sopValidationState', coalesce(previous_sop_validation_state, 'not_required')
        ),
        jsonb_build_object(
          'sopPolicyGovernanceState', coalesce(u.sop_policy_governance_state, 'not_started'),
          'sopPolicyGovernanceNote', u.sop_policy_governance_note,
          'sopPolicyAuditState', coalesce(u.sop_policy_audit_state, 'not_started'),
          'sopPolicyDriftState', coalesce(u.sop_policy_drift_state, 'not_checked'),
          'sopPolicyExceptionState', coalesce(u.sop_policy_exception_state, 'none'),
          'sopValidationState', coalesce(u.sop_validation_state, 'not_required')
        ),
        coalesce(u.sop_policy_governance_state, 'not_started'),
        coalesce(u.sop_policy_audit_state, 'not_started'),
        coalesce(u.sop_policy_drift_state, 'not_checked'),
        coalesce(u.sop_policy_exception_state, 'none'),
        coalesce(u.sop_validation_state, 'not_required'),
        ${sqlNullableText(changes.sopPolicyGovernanceNote || changes.sopPolicyGovernanceState)}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildClinicalFollowUpSopPolicyGovernanceClosureSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const scopedFollowUps = clinicScopeWhere("f", { allClinics, clinicIds });
  const closureReady = `(
    coalesce(f.sop_policy_governance_state, 'not_started') = 'reviewed'
    and coalesce(f.sop_policy_audit_state, 'not_started') = 'reviewed'
    and coalesce(f.sop_policy_drift_state, 'not_checked') = 'in_sync'
    and coalesce(f.sop_policy_exception_state, 'none') in ('none', 'accepted', 'rejected', 'closed')
  )`;
  return `
    with scoped_followups as (
      select *
      from clinical_follow_up_tasks f
      where ${scopedFollowUps}
    )
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where ${closureReady})::int as "closureReady",
      count(*) filter (where ${closureReady} and coalesce(f.sop_policy_governance_closure_state, 'not_started') in ('not_started', 'needs_followup'))::int as "needsClosureReview",
      count(*) filter (where coalesce(f.sop_policy_governance_closure_state, 'not_started') = 'closed')::int as "closedGovernanceReviews",
      count(*) filter (where coalesce(f.sop_policy_governance_closure_state, 'not_started') = 'needs_followup')::int as "closureNeedsFollowUp",
      count(*) filter (where coalesce(f.sop_policy_governance_state, 'not_started') = 'reviewed')::int as "reviewedGovernance",
      count(*) filter (where coalesce(f.sop_policy_drift_state, 'not_checked') in ('drifted', 'missing_template', 'review_required'))::int as "unresolvedPolicyDrift",
      count(*) filter (where coalesce(f.sop_policy_exception_state, 'none') = 'open')::int as "openExceptions",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_sop_policy_governance_closure_events e
        where e.follow_up_id = f.id
      ))::int as "localGovernanceClosureEvents"
    from scoped_followups f
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyGovernanceClosureSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const nextState = changes.sopPolicyGovernanceClosureState !== undefined
    ? sqlLiteral(changes.sopPolicyGovernanceClosureState)
    : "p.sop_policy_governance_closure_state";
  const nextNote = changes.sopPolicyGovernanceClosureNote !== undefined
    ? sqlNullableText(changes.sopPolicyGovernanceClosureNote)
    : "p.sop_policy_governance_closure_note";
  const closedState = ["ready", "closed", "needs_followup"].includes(changes.sopPolicyGovernanceClosureState);

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set
          sop_policy_governance_closure_state = ${nextState},
          sop_policy_governance_closure_note = ${nextNote},
          sop_policy_governance_closed_by_user_id = ${closedState ? sqlUuid(actorUserId) : "p.sop_policy_governance_closed_by_user_id"},
          sop_policy_governance_closed_at = ${closedState ? "now()" : "p.sop_policy_governance_closed_at"},
          updated_at = now()
      from previous p
      where f.id = p.id
      returning f.*,
        p.sop_policy_governance_closure_state as previous_sop_policy_governance_closure_state,
        p.sop_policy_governance_closure_note as previous_sop_policy_governance_closure_note,
        p.sop_policy_governance_state as previous_sop_policy_governance_state,
        p.sop_policy_audit_state as previous_sop_policy_audit_state,
        p.sop_policy_drift_state as previous_sop_policy_drift_state,
        p.sop_policy_exception_state as previous_sop_policy_exception_state,
        p.sop_validation_state as previous_sop_validation_state
    ), event as (
      insert into clinical_follow_up_sop_policy_governance_closure_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        closure_state,
        governance_state,
        audit_state,
        drift_state,
        exception_state,
        validation_state,
        note
      )
      select
        u.id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_governance_closure.update',
        jsonb_build_object(
          'sopPolicyGovernanceClosureState', coalesce(previous_sop_policy_governance_closure_state, 'not_started'),
          'sopPolicyGovernanceClosureNote', previous_sop_policy_governance_closure_note,
          'sopPolicyGovernanceState', coalesce(previous_sop_policy_governance_state, 'not_started'),
          'sopPolicyAuditState', coalesce(previous_sop_policy_audit_state, 'not_started'),
          'sopPolicyDriftState', coalesce(previous_sop_policy_drift_state, 'not_checked'),
          'sopPolicyExceptionState', coalesce(previous_sop_policy_exception_state, 'none'),
          'sopValidationState', coalesce(previous_sop_validation_state, 'not_required')
        ),
        jsonb_build_object(
          'sopPolicyGovernanceClosureState', coalesce(u.sop_policy_governance_closure_state, 'not_started'),
          'sopPolicyGovernanceClosureNote', u.sop_policy_governance_closure_note,
          'sopPolicyGovernanceState', coalesce(u.sop_policy_governance_state, 'not_started'),
          'sopPolicyAuditState', coalesce(u.sop_policy_audit_state, 'not_started'),
          'sopPolicyDriftState', coalesce(u.sop_policy_drift_state, 'not_checked'),
          'sopPolicyExceptionState', coalesce(u.sop_policy_exception_state, 'none'),
          'sopValidationState', coalesce(u.sop_validation_state, 'not_required')
        ),
        coalesce(u.sop_policy_governance_closure_state, 'not_started'),
        coalesce(u.sop_policy_governance_state, 'not_started'),
        coalesce(u.sop_policy_audit_state, 'not_started'),
        coalesce(u.sop_policy_drift_state, 'not_checked'),
        coalesce(u.sop_policy_exception_state, 'none'),
        coalesce(u.sop_validation_state, 'not_required'),
        ${sqlNullableText(changes.sopPolicyGovernanceClosureNote || changes.sopPolicyGovernanceClosureState)}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildClinicalFollowUpSopPolicyGovernanceEvidenceSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const scopedFollowUps = clinicScopeWhere("f", { allClinics, clinicIds });
  const evidenceReady = `(
    coalesce(f.sop_policy_governance_closure_state, 'not_started') = 'closed'
    and coalesce(f.sop_policy_governance_state, 'not_started') = 'reviewed'
    and coalesce(f.sop_policy_audit_state, 'not_started') = 'reviewed'
    and coalesce(f.sop_policy_drift_state, 'not_checked') = 'in_sync'
    and coalesce(f.sop_policy_exception_state, 'none') in ('none', 'accepted', 'rejected', 'closed')
  )`;
  return `
    with scoped_followups as (
      select *
      from clinical_follow_up_tasks f
      where ${scopedFollowUps}
    )
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where ${evidenceReady})::int as "evidenceReady",
      count(*) filter (where ${evidenceReady} and coalesce(f.sop_policy_governance_evidence_state, 'not_started') in ('not_started', 'needs_followup'))::int as "needsEvidenceReview",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_state, 'not_started') = 'exported')::int as "exportedGovernanceEvidence",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_state, 'not_started') = 'needs_followup')::int as "evidenceNeedsFollowUp",
      count(*) filter (where coalesce(f.sop_policy_governance_closure_state, 'not_started') = 'closed')::int as "closedGovernanceReviews",
      count(*) filter (where coalesce(f.sop_policy_drift_state, 'not_checked') in ('drifted', 'missing_template', 'review_required'))::int as "unresolvedPolicyDrift",
      count(*) filter (where coalesce(f.sop_policy_exception_state, 'none') = 'open')::int as "openExceptions",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_sop_policy_governance_evidence_events e
        where e.follow_up_id = f.id
      ))::int as "localGovernanceEvidenceEvents"
    from scoped_followups f
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const nextState = changes.sopPolicyGovernanceEvidenceState !== undefined
    ? sqlLiteral(changes.sopPolicyGovernanceEvidenceState)
    : "p.sop_policy_governance_evidence_state";
  const nextNote = changes.sopPolicyGovernanceEvidenceNote !== undefined
    ? sqlNullableText(changes.sopPolicyGovernanceEvidenceNote)
    : "p.sop_policy_governance_evidence_note";
  const reviewState = ["ready", "exported", "needs_followup"].includes(changes.sopPolicyGovernanceEvidenceState);

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set
          sop_policy_governance_evidence_state = ${nextState},
          sop_policy_governance_evidence_note = ${nextNote},
          sop_policy_governance_evidence_reviewed_by_user_id = ${reviewState ? sqlUuid(actorUserId) : "p.sop_policy_governance_evidence_reviewed_by_user_id"},
          sop_policy_governance_evidence_reviewed_at = ${reviewState ? "now()" : "p.sop_policy_governance_evidence_reviewed_at"},
          updated_at = now()
      from previous p
      where f.id = p.id
      returning f.*,
        p.sop_policy_governance_evidence_state as previous_sop_policy_governance_evidence_state,
        p.sop_policy_governance_evidence_note as previous_sop_policy_governance_evidence_note,
        p.sop_policy_governance_closure_state as previous_sop_policy_governance_closure_state,
        p.sop_policy_governance_state as previous_sop_policy_governance_state,
        p.sop_policy_audit_state as previous_sop_policy_audit_state,
        p.sop_policy_drift_state as previous_sop_policy_drift_state,
        p.sop_policy_exception_state as previous_sop_policy_exception_state,
        p.sop_validation_state as previous_sop_validation_state
    ), event as (
      insert into clinical_follow_up_sop_policy_governance_evidence_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        evidence_state,
        closure_state,
        governance_state,
        audit_state,
        drift_state,
        exception_state,
        validation_state,
        note
      )
      select
        u.id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_governance_evidence.update',
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceState', coalesce(previous_sop_policy_governance_evidence_state, 'not_started'),
          'sopPolicyGovernanceEvidenceNote', previous_sop_policy_governance_evidence_note,
          'sopPolicyGovernanceClosureState', coalesce(previous_sop_policy_governance_closure_state, 'not_started'),
          'sopPolicyGovernanceState', coalesce(previous_sop_policy_governance_state, 'not_started'),
          'sopPolicyAuditState', coalesce(previous_sop_policy_audit_state, 'not_started'),
          'sopPolicyDriftState', coalesce(previous_sop_policy_drift_state, 'not_checked'),
          'sopPolicyExceptionState', coalesce(previous_sop_policy_exception_state, 'none'),
          'sopValidationState', coalesce(previous_sop_validation_state, 'not_required')
        ),
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceState', coalesce(u.sop_policy_governance_evidence_state, 'not_started'),
          'sopPolicyGovernanceEvidenceNote', u.sop_policy_governance_evidence_note,
          'sopPolicyGovernanceClosureState', coalesce(u.sop_policy_governance_closure_state, 'not_started'),
          'sopPolicyGovernanceState', coalesce(u.sop_policy_governance_state, 'not_started'),
          'sopPolicyAuditState', coalesce(u.sop_policy_audit_state, 'not_started'),
          'sopPolicyDriftState', coalesce(u.sop_policy_drift_state, 'not_checked'),
          'sopPolicyExceptionState', coalesce(u.sop_policy_exception_state, 'none'),
          'sopValidationState', coalesce(u.sop_validation_state, 'not_required')
        ),
        coalesce(u.sop_policy_governance_evidence_state, 'not_started'),
        coalesce(u.sop_policy_governance_closure_state, 'not_started'),
        coalesce(u.sop_policy_governance_state, 'not_started'),
        coalesce(u.sop_policy_audit_state, 'not_started'),
        coalesce(u.sop_policy_drift_state, 'not_checked'),
        coalesce(u.sop_policy_exception_state, 'none'),
        coalesce(u.sop_validation_state, 'not_required'),
        ${sqlNullableText(changes.sopPolicyGovernanceEvidenceNote || changes.sopPolicyGovernanceEvidenceState)}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const scopedFollowUps = clinicScopeWhere("f", { allClinics, clinicIds });
  const reconciliationReady = `(
    coalesce(f.sop_policy_governance_evidence_state, 'not_started') = 'exported'
    and coalesce(f.sop_policy_governance_closure_state, 'not_started') = 'closed'
    and coalesce(f.sop_policy_governance_state, 'not_started') = 'reviewed'
    and coalesce(f.sop_policy_audit_state, 'not_started') = 'reviewed'
  )`;
  return `
    with scoped_followups as (
      select *
      from clinical_follow_up_tasks f
      where ${scopedFollowUps}
    )
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where ${reconciliationReady})::int as "reconciliationReady",
      count(*) filter (where ${reconciliationReady} and coalesce(f.sop_policy_governance_evidence_reconciliation_state, 'not_started') in ('not_started', 'mismatch', 'needs_followup'))::int as "needsReconciliation",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_state, 'not_started') = 'reconciled')::int as "reconciledGovernanceEvidence",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_state, 'not_started') = 'mismatch')::int as "evidenceMismatches",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_state, 'not_started') = 'needs_followup')::int as "reconciliationNeedsFollowUp",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_state, 'not_started') = 'exported')::int as "exportedGovernanceEvidence",
      count(*) filter (where coalesce(f.sop_policy_governance_closure_state, 'not_started') = 'closed')::int as "closedGovernanceReviews",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_sop_policy_governance_evidence_reconciliation_events e
        where e.follow_up_id = f.id
      ))::int as "localGovernanceEvidenceReconciliationEvents"
    from scoped_followups f
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const nextState = changes.sopPolicyGovernanceEvidenceReconciliationState !== undefined
    ? sqlLiteral(changes.sopPolicyGovernanceEvidenceReconciliationState)
    : "p.sop_policy_governance_evidence_reconciliation_state";
  const nextNote = changes.sopPolicyGovernanceEvidenceReconciliationNote !== undefined
    ? sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationNote)
    : "p.sop_policy_governance_evidence_reconciliation_note";
  const reconciliationState = ["ready", "reconciled", "mismatch", "needs_followup"].includes(
    changes.sopPolicyGovernanceEvidenceReconciliationState,
  );

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set
          sop_policy_governance_evidence_reconciliation_state = ${nextState},
          sop_policy_governance_evidence_reconciliation_note = ${nextNote},
          sop_policy_governance_evidence_reconciled_by_user_id = ${reconciliationState ? sqlUuid(actorUserId) : "p.sop_policy_governance_evidence_reconciled_by_user_id"},
          sop_policy_governance_evidence_reconciled_at = ${reconciliationState ? "now()" : "p.sop_policy_governance_evidence_reconciled_at"},
          updated_at = now()
      from previous p
      where f.id = p.id
      returning f.*,
        p.sop_policy_governance_evidence_reconciliation_state as previous_sop_policy_governance_evidence_reconciliation_state,
        p.sop_policy_governance_evidence_reconciliation_note as previous_sop_policy_governance_evidence_reconciliation_note,
        p.sop_policy_governance_evidence_state as previous_sop_policy_governance_evidence_state,
        p.sop_policy_governance_closure_state as previous_sop_policy_governance_closure_state,
        p.sop_policy_governance_state as previous_sop_policy_governance_state,
        p.sop_policy_audit_state as previous_sop_policy_audit_state
    ), event as (
      insert into clinical_follow_up_sop_policy_governance_evidence_reconciliation_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        reconciliation_state,
        evidence_state,
        closure_state,
        governance_state,
        audit_state,
        note
      )
      select
        u.id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_governance_evidence_reconciliation.update',
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationState', coalesce(previous_sop_policy_governance_evidence_reconciliation_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationNote', previous_sop_policy_governance_evidence_reconciliation_note,
          'sopPolicyGovernanceEvidenceState', coalesce(previous_sop_policy_governance_evidence_state, 'not_started'),
          'sopPolicyGovernanceClosureState', coalesce(previous_sop_policy_governance_closure_state, 'not_started'),
          'sopPolicyGovernanceState', coalesce(previous_sop_policy_governance_state, 'not_started'),
          'sopPolicyAuditState', coalesce(previous_sop_policy_audit_state, 'not_started')
        ),
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationState', coalesce(u.sop_policy_governance_evidence_reconciliation_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationNote', u.sop_policy_governance_evidence_reconciliation_note,
          'sopPolicyGovernanceEvidenceState', coalesce(u.sop_policy_governance_evidence_state, 'not_started'),
          'sopPolicyGovernanceClosureState', coalesce(u.sop_policy_governance_closure_state, 'not_started'),
          'sopPolicyGovernanceState', coalesce(u.sop_policy_governance_state, 'not_started'),
          'sopPolicyAuditState', coalesce(u.sop_policy_audit_state, 'not_started')
        ),
        coalesce(u.sop_policy_governance_evidence_reconciliation_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_state, 'not_started'),
        coalesce(u.sop_policy_governance_closure_state, 'not_started'),
        coalesce(u.sop_policy_governance_state, 'not_started'),
        coalesce(u.sop_policy_audit_state, 'not_started'),
        ${sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationNote || changes.sopPolicyGovernanceEvidenceReconciliationState)}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const scopedFollowUps = clinicScopeWhere("f", { allClinics, clinicIds });
  const closureReady = `(
    coalesce(f.sop_policy_governance_evidence_reconciliation_state, 'not_started') = 'reconciled'
    and coalesce(f.sop_policy_governance_evidence_state, 'not_started') = 'exported'
    and coalesce(f.sop_policy_governance_closure_state, 'not_started') = 'closed'
  )`;
  return `
    with scoped_followups as (
      select *
      from clinical_follow_up_tasks f
      where ${scopedFollowUps}
    )
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where ${closureReady})::int as "reconciliationClosureReady",
      count(*) filter (where ${closureReady} and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started') in ('not_started', 'ready', 'needs_rework'))::int as "needsReconciliationClosure",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started') = 'closed')::int as "closedReconciliationEvidence",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started') = 'closure_exception')::int as "reconciliationClosureExceptions",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started') = 'needs_rework')::int as "reconciliationClosureNeedsRework",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_state, 'not_started') = 'reconciled')::int as "reconciledGovernanceEvidence",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_state, 'not_started') = 'mismatch')::int as "openReconciliationMismatches",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_events e
        where e.follow_up_id = f.id
      ))::int as "localGovernanceEvidenceReconciliationClosureEvents"
    from scoped_followups f
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const nextState = changes.sopPolicyGovernanceEvidenceReconciliationClosureState !== undefined
    ? sqlLiteral(changes.sopPolicyGovernanceEvidenceReconciliationClosureState)
    : "p.sop_policy_governance_evidence_reconciliation_closure_state";
  const nextNote = changes.sopPolicyGovernanceEvidenceReconciliationClosureNote !== undefined
    ? sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureNote)
    : "p.sop_policy_governance_evidence_reconciliation_closure_note";
  const closureState = ["ready", "closed", "closure_exception", "needs_rework"].includes(
    changes.sopPolicyGovernanceEvidenceReconciliationClosureState,
  );

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set
          sop_policy_governance_evidence_reconciliation_closure_state = ${nextState},
          sop_policy_governance_evidence_reconciliation_closure_note = ${nextNote},
          sop_policy_governance_evidence_reconciliation_closed_by_user_id = ${closureState ? sqlUuid(actorUserId) : "p.sop_policy_governance_evidence_reconciliation_closed_by_user_id"},
          sop_policy_governance_evidence_reconciliation_closed_at = ${closureState ? "now()" : "p.sop_policy_governance_evidence_reconciliation_closed_at"},
          updated_at = now()
      from previous p
      where f.id = p.id
      returning f.*,
        p.sop_policy_governance_evidence_reconciliation_closure_state as previous_sop_policy_governance_evidence_reconciliation_closure_state,
        p.sop_policy_governance_evidence_reconciliation_closure_note as previous_sop_policy_governance_evidence_reconciliation_closure_note,
        p.sop_policy_governance_evidence_reconciliation_state as previous_sop_policy_governance_evidence_reconciliation_state,
        p.sop_policy_governance_evidence_state as previous_sop_policy_governance_evidence_state,
        p.sop_policy_governance_closure_state as previous_sop_policy_governance_closure_state
    ), event as (
      insert into clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        reconciliation_closure_state,
        reconciliation_state,
        evidence_state,
        governance_closure_state,
        note
      )
      select
        u.id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_governance_evidence_reconciliation_closure.update',
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureNote', previous_sop_policy_governance_evidence_reconciliation_closure_note,
          'sopPolicyGovernanceEvidenceReconciliationState', coalesce(previous_sop_policy_governance_evidence_reconciliation_state, 'not_started'),
          'sopPolicyGovernanceEvidenceState', coalesce(previous_sop_policy_governance_evidence_state, 'not_started'),
          'sopPolicyGovernanceClosureState', coalesce(previous_sop_policy_governance_closure_state, 'not_started')
        ),
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureNote', u.sop_policy_governance_evidence_reconciliation_closure_note,
          'sopPolicyGovernanceEvidenceReconciliationState', coalesce(u.sop_policy_governance_evidence_reconciliation_state, 'not_started'),
          'sopPolicyGovernanceEvidenceState', coalesce(u.sop_policy_governance_evidence_state, 'not_started'),
          'sopPolicyGovernanceClosureState', coalesce(u.sop_policy_governance_closure_state, 'not_started')
        ),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_state, 'not_started'),
        coalesce(u.sop_policy_governance_closure_state, 'not_started'),
        ${sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureNote || changes.sopPolicyGovernanceEvidenceReconciliationClosureState)}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const scopedFollowUps = clinicScopeWhere("f", { allClinics, clinicIds });
  const receiptReady = `(
    coalesce(f.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started') = 'closed'
    and coalesce(f.sop_policy_governance_evidence_reconciliation_state, 'not_started') = 'reconciled'
    and coalesce(f.sop_policy_governance_evidence_state, 'not_started') = 'exported'
  )`;
  return `
    with scoped_followups as (
      select *
      from clinical_follow_up_tasks f
      where ${scopedFollowUps}
    )
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where ${receiptReady})::int as "closureReceiptReady",
      count(*) filter (where ${receiptReady} and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started') in ('not_started', 'ready', 'needs_rework'))::int as "needsClosureReceipt",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started') = 'received')::int as "receivedClosureReceipts",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started') = 'receipt_exception')::int as "closureReceiptExceptions",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started') = 'needs_rework')::int as "closureReceiptNeedsRework",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started') = 'closed')::int as "closedReconciliationEvidence",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_state, 'not_started') = 'reconciled')::int as "reconciledGovernanceEvidence",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_events e
        where e.follow_up_id = f.id
      ))::int as "localGovernanceEvidenceReconciliationClosureReceiptEvents"
    from scoped_followups f
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const nextState = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptState !== undefined
    ? sqlLiteral(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptState)
    : "p.sop_policy_governance_evidence_reconciliation_closure_receipt_state";
  const nextNote = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote !== undefined
    ? sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote)
    : "p.sop_policy_governance_evidence_reconciliation_closure_receipt_note";
  const receiptState = ["ready", "received", "receipt_exception", "needs_rework"].includes(
    changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptState,
  );

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set
          sop_policy_governance_evidence_reconciliation_closure_receipt_state = ${nextState},
          sop_policy_governance_evidence_reconciliation_closure_receipt_note = ${nextNote},
          sop_policy_governance_evidence_reconciliation_closure_received_by_user_id = ${receiptState ? sqlUuid(actorUserId) : "p.sop_policy_governance_evidence_reconciliation_closure_received_by_user_id"},
          sop_policy_governance_evidence_reconciliation_closure_received_at = ${receiptState ? "now()" : "p.sop_policy_governance_evidence_reconciliation_closure_received_at"},
          updated_at = now()
      from previous p
      where f.id = p.id
      returning f.*,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_note as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_note,
        p.sop_policy_governance_evidence_reconciliation_closure_state as previous_sop_policy_governance_evidence_reconciliation_closure_state,
        p.sop_policy_governance_evidence_reconciliation_state as previous_sop_policy_governance_evidence_reconciliation_state,
        p.sop_policy_governance_evidence_state as previous_sop_policy_governance_evidence_state
    ), event as (
      insert into clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        closure_receipt_state,
        reconciliation_closure_state,
        reconciliation_state,
        evidence_state,
        note
      )
      select
        u.id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_governance_evidence_reconciliation_closure_receipt.update',
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote', previous_sop_policy_governance_evidence_reconciliation_closure_receipt_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationState', coalesce(previous_sop_policy_governance_evidence_reconciliation_state, 'not_started'),
          'sopPolicyGovernanceEvidenceState', coalesce(previous_sop_policy_governance_evidence_state, 'not_started')
        ),
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote', u.sop_policy_governance_evidence_reconciliation_closure_receipt_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationState', coalesce(u.sop_policy_governance_evidence_reconciliation_state, 'not_started'),
          'sopPolicyGovernanceEvidenceState', coalesce(u.sop_policy_governance_evidence_state, 'not_started')
        ),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_state, 'not_started'),
        ${sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote || changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptState)}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const scopedFollowUps = clinicScopeWhere("f", { allClinics, clinicIds });
  const archiveReadinessReady = `(
    coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started') = 'received'
    and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started') = 'closed'
    and coalesce(f.sop_policy_governance_evidence_reconciliation_state, 'not_started') = 'reconciled'
  )`;
  return `
    with scoped_followups as (
      select *
      from clinical_follow_up_tasks f
      where ${scopedFollowUps}
    )
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where ${archiveReadinessReady})::int as "archiveReadinessReady",
      count(*) filter (where ${archiveReadinessReady} and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started') in ('not_started', 'ready', 'needs_rework'))::int as "needsArchiveReadiness",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started') = 'archived')::int as "archivedLocal",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started') = 'archive_exception')::int as "archiveReadinessExceptions",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started') = 'needs_rework')::int as "archiveReadinessNeedsRework",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started') = 'received')::int as "receivedClosureReceipts",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started') = 'closed')::int as "closedReconciliationEvidence",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_events e
        where e.follow_up_id = f.id
      ))::int as "localGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessEvents"
    from scoped_followups f
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const nextState = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState !== undefined
    ? sqlLiteral(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState)
    : "p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state";
  const nextNote = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote !== undefined
    ? sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote)
    : "p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_note";
  const archiveReadiedState = ["ready", "archived", "archive_exception", "needs_rework"].includes(
    changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState,
  );

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set
          sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state = ${nextState},
          sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_note = ${nextNote},
          sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readied_by_user_id = ${archiveReadiedState ? sqlUuid(actorUserId) : "p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readied_by_user_id"},
          sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readied_at = ${archiveReadiedState ? "now()" : "p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readied_at"},
          updated_at = now()
      from previous p
      where f.id = p.id
      returning f.*,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_note as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_note,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_state,
        p.sop_policy_governance_evidence_reconciliation_closure_state as previous_sop_policy_governance_evidence_reconciliation_closure_state,
        p.sop_policy_governance_evidence_reconciliation_state as previous_sop_policy_governance_evidence_reconciliation_state
    ), event as (
      insert into clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        archive_readiness_state,
        closure_receipt_state,
        reconciliation_closure_state,
        reconciliation_state,
        note
      )
      select
        u.id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness.update',
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote', previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationState', coalesce(previous_sop_policy_governance_evidence_reconciliation_state, 'not_started')
        ),
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote', u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationState', coalesce(u.sop_policy_governance_evidence_reconciliation_state, 'not_started')
        ),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_state, 'not_started'),
        ${sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote || changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState)}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const scopedFollowUps = clinicScopeWhere("f", { allClinics, clinicIds });
  const archiveClosureReady = `(
    coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started') in ('ready', 'archived')
    and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started') = 'received'
    and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started') = 'closed'
  )`;
  return `
    with scoped_followups as (
      select *
      from clinical_follow_up_tasks f
      where ${scopedFollowUps}
    )
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where ${archiveClosureReady})::int as "archiveClosureReady",
      count(*) filter (where ${archiveClosureReady} and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started') in ('not_started', 'ready', 'needs_rework'))::int as "needsArchiveClosure",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started') = 'closed')::int as "closedLocalArchives",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started') = 'closure_exception')::int as "archiveClosureExceptions",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started') = 'needs_rework')::int as "archiveClosureNeedsRework",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started') in ('ready', 'archived'))::int as "archiveReadinessMarked",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started') = 'received')::int as "receivedClosureReceipts",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_events e
        where e.follow_up_id = f.id
      ))::int as "localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureEvents"
    from scoped_followups f
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const nextState = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState !== undefined
    ? sqlLiteral(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState)
    : "p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state";
  const nextNote = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote !== undefined
    ? sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote)
    : "p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_note";
  const archiveClosedState = ["ready", "closed", "closure_exception", "needs_rework"].includes(
    changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState,
  );

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set
          sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state = ${nextState},
          sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_note = ${nextNote},
          sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closed_by_user_id = ${archiveClosedState ? sqlUuid(actorUserId) : "p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closed_by_user_id"},
          sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closed_at = ${archiveClosedState ? "now()" : "p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closed_at"},
          updated_at = now()
      from previous p
      where f.id = p.id
      returning f.*,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_note as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_note,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_state,
        p.sop_policy_governance_evidence_reconciliation_closure_state as previous_sop_policy_governance_evidence_reconciliation_closure_state,
        p.sop_policy_governance_evidence_reconciliation_state as previous_sop_policy_governance_evidence_reconciliation_state
    ), event as (
      insert into clinical_follow_up_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        archive_closure_state,
        archive_readiness_state,
        closure_receipt_state,
        reconciliation_closure_state,
        reconciliation_state,
        note
      )
      select
        u.id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure.update',
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote', previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationState', coalesce(previous_sop_policy_governance_evidence_reconciliation_state, 'not_started')
        ),
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote', u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationState', coalesce(u.sop_policy_governance_evidence_reconciliation_state, 'not_started')
        ),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_state, 'not_started'),
        ${sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote || changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState)}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const scopedFollowUps = clinicScopeWhere("f", { allClinics, clinicIds });
  const archiveClosureReceiptReady = `(
    coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started') = 'closed'
    and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started') in ('ready', 'archived')
    and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started') = 'received'
  )`;
  return `
    with scoped_followups as (
      select *
      from clinical_follow_up_tasks f
      where ${scopedFollowUps}
    )
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where ${archiveClosureReceiptReady})::int as "archiveClosureReceiptReady",
      count(*) filter (where ${archiveClosureReceiptReady} and coalesce(f.stage34_archive_closure_receipt_state, 'not_started') in ('not_started', 'ready', 'needs_rework'))::int as "needsArchiveClosureReceipt",
      count(*) filter (where coalesce(f.stage34_archive_closure_receipt_state, 'not_started') = 'received')::int as "receivedArchiveClosureReceipts",
      count(*) filter (where coalesce(f.stage34_archive_closure_receipt_state, 'not_started') = 'receipt_exception')::int as "archiveClosureReceiptExceptions",
      count(*) filter (where coalesce(f.stage34_archive_closure_receipt_state, 'not_started') = 'needs_rework')::int as "archiveClosureReceiptNeedsRework",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started') = 'closed')::int as "closedLocalArchives",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started') in ('ready', 'archived'))::int as "archiveReadinessMarked",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_stage34_archive_closure_receipt_events e
        where e.follow_up_id = f.id
      ))::int as "localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptEvents"
    from scoped_followups f
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const nextState = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState !== undefined
    ? sqlLiteral(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState)
    : "p.stage34_archive_closure_receipt_state";
  const nextNote = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote !== undefined
    ? sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote)
    : "p.stage34_archive_closure_receipt_note";
  const receiptState = ["ready", "received", "receipt_exception", "needs_rework"].includes(
    changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState,
  );

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set
          stage34_archive_closure_receipt_state = ${nextState},
          stage34_archive_closure_receipt_note = ${nextNote},
          stage34_archive_closure_received_by_user_id = ${receiptState ? sqlUuid(actorUserId) : "p.stage34_archive_closure_received_by_user_id"},
          stage34_archive_closure_received_at = ${receiptState ? "now()" : "p.stage34_archive_closure_received_at"},
          updated_at = now()
      from previous p
      where f.id = p.id
      returning f.*,
        p.stage34_archive_closure_receipt_state as previous_stage34_archive_closure_receipt_state,
        p.stage34_archive_closure_receipt_note as previous_stage34_archive_closure_receipt_note,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_state,
        p.sop_policy_governance_evidence_reconciliation_closure_state as previous_sop_policy_governance_evidence_reconciliation_closure_state
    ), event as (
      insert into clinical_follow_up_stage34_archive_closure_receipt_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        archive_closure_receipt_state,
        archive_closure_state,
        archive_readiness_state,
        closure_receipt_state,
        reconciliation_closure_state,
        note
      )
      select
        u.id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt.update',
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState', coalesce(previous_stage34_archive_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote', previous_stage34_archive_closure_receipt_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_state, 'not_started')
        ),
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState', coalesce(u.stage34_archive_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote', u.stage34_archive_closure_receipt_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started')
        ),
        coalesce(u.stage34_archive_closure_receipt_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_state, 'not_started'),
        ${sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote || changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState)}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const scopedFollowUps = clinicScopeWhere("f", { allClinics, clinicIds });
  const archiveClosureReceiptHandoffReady = `(
    coalesce(f.stage34_archive_closure_receipt_state, 'not_started') = 'received'
    and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started') = 'closed'
    and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started') in ('ready', 'archived')
  )`;
  return `
    with scoped_followups as (
      select *
      from clinical_follow_up_tasks f
      where ${scopedFollowUps}
    )
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where ${archiveClosureReceiptHandoffReady})::int as "archiveClosureReceiptHandoffReady",
      count(*) filter (where ${archiveClosureReceiptHandoffReady} and coalesce(f.stage35_archive_receipt_handoff_state, 'not_started') in ('not_started', 'ready', 'needs_rework'))::int as "needsArchiveClosureReceiptHandoff",
      count(*) filter (where coalesce(f.stage35_archive_receipt_handoff_state, 'not_started') = 'handed_off')::int as "handedOffArchiveClosureReceipts",
      count(*) filter (where coalesce(f.stage35_archive_receipt_handoff_state, 'not_started') = 'handoff_exception')::int as "archiveClosureReceiptHandoffExceptions",
      count(*) filter (where coalesce(f.stage35_archive_receipt_handoff_state, 'not_started') = 'needs_rework')::int as "archiveClosureReceiptHandoffNeedsRework",
      count(*) filter (where coalesce(f.stage34_archive_closure_receipt_state, 'not_started') = 'received')::int as "receivedArchiveClosureReceipts",
      count(*) filter (where coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started') = 'closed')::int as "closedLocalArchives",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_stage35_archive_receipt_handoff_events e
        where e.follow_up_id = f.id
      ))::int as "localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffEvents"
    from scoped_followups f
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const nextState = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState !== undefined
    ? sqlLiteral(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState)
    : "p.stage35_archive_receipt_handoff_state";
  const nextNote = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote !== undefined
    ? sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote)
    : "p.stage35_archive_receipt_handoff_note";
  const handoffState = ["ready", "handed_off", "handoff_exception", "needs_rework"].includes(
    changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState,
  );

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set
          stage35_archive_receipt_handoff_state = ${nextState},
          stage35_archive_receipt_handoff_note = ${nextNote},
          stage35_archive_receipt_handed_off_by_user_id = ${handoffState ? sqlUuid(actorUserId) : "p.stage35_archive_receipt_handed_off_by_user_id"},
          stage35_archive_receipt_handed_off_at = ${handoffState ? "now()" : "p.stage35_archive_receipt_handed_off_at"},
          updated_at = now()
      from previous p
      where f.id = p.id
      returning f.*,
        p.stage35_archive_receipt_handoff_state as previous_stage35_archive_receipt_handoff_state,
        p.stage35_archive_receipt_handoff_note as previous_stage35_archive_receipt_handoff_note,
        p.stage34_archive_closure_receipt_state as previous_stage34_archive_closure_receipt_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_state
    ), event as (
      insert into clinical_follow_up_stage35_archive_receipt_handoff_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        archive_receipt_handoff_state,
        archive_closure_receipt_state,
        archive_closure_state,
        archive_readiness_state,
        closure_receipt_state,
        note
      )
      select
        u.id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff.update',
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState', coalesce(previous_stage35_archive_receipt_handoff_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote', previous_stage35_archive_receipt_handoff_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState', coalesce(previous_stage34_archive_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started')
        ),
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState', coalesce(u.stage35_archive_receipt_handoff_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote', u.stage35_archive_receipt_handoff_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState', coalesce(u.stage34_archive_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started')
        ),
        coalesce(u.stage35_archive_receipt_handoff_state, 'not_started'),
        coalesce(u.stage34_archive_closure_receipt_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_state, 'not_started'),
        ${sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote || changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState)}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const scopedFollowUps = clinicScopeWhere("f", { allClinics, clinicIds });
  const archiveClosureReceiptHandoffReceiptReady = `(
    coalesce(f.stage35_archive_receipt_handoff_state, 'not_started') = 'handed_off'
    and coalesce(f.stage34_archive_closure_receipt_state, 'not_started') = 'received'
    and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started') = 'closed'
    and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started') in ('ready', 'archived')
  )`;
  return `
    with scoped_followups as (
      select *
      from clinical_follow_up_tasks f
      where ${scopedFollowUps}
    )
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where ${archiveClosureReceiptHandoffReceiptReady})::int as "archiveClosureReceiptHandoffReceiptReady",
      count(*) filter (where ${archiveClosureReceiptHandoffReceiptReady} and coalesce(f.stage36_archive_handoff_receipt_state, 'not_started') in ('not_started', 'ready', 'needs_rework'))::int as "needsArchiveClosureReceiptHandoffReceipt",
      count(*) filter (where coalesce(f.stage36_archive_handoff_receipt_state, 'not_started') = 'received')::int as "receivedArchiveClosureReceiptHandoffReceipts",
      count(*) filter (where coalesce(f.stage36_archive_handoff_receipt_state, 'not_started') = 'receipt_exception')::int as "archiveClosureReceiptHandoffReceiptExceptions",
      count(*) filter (where coalesce(f.stage36_archive_handoff_receipt_state, 'not_started') = 'needs_rework')::int as "archiveClosureReceiptHandoffReceiptNeedsRework",
      count(*) filter (where coalesce(f.stage35_archive_receipt_handoff_state, 'not_started') = 'handed_off')::int as "handedOffArchiveClosureReceipts",
      count(*) filter (where coalesce(f.stage34_archive_closure_receipt_state, 'not_started') = 'received')::int as "receivedArchiveClosureReceipts",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_stage36_archive_handoff_receipt_events e
        where e.follow_up_id = f.id
      ))::int as "localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptEvents"
    from scoped_followups f
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const nextState = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState !== undefined
    ? sqlLiteral(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState)
    : "p.stage36_archive_handoff_receipt_state";
  const nextNote = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote !== undefined
    ? sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote)
    : "p.stage36_archive_handoff_receipt_note";
  const receiptState = ["ready", "received", "receipt_exception", "needs_rework"].includes(
    changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState,
  );

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set
          stage36_archive_handoff_receipt_state = ${nextState},
          stage36_archive_handoff_receipt_note = ${nextNote},
          stage36_archive_handoff_received_by_user_id = ${receiptState ? sqlUuid(actorUserId) : "p.stage36_archive_handoff_received_by_user_id"},
          stage36_archive_handoff_received_at = ${receiptState ? "now()" : "p.stage36_archive_handoff_received_at"},
          updated_at = now()
      from previous p
      where f.id = p.id
      returning f.*,
        p.stage36_archive_handoff_receipt_state as previous_stage36_archive_handoff_receipt_state,
        p.stage36_archive_handoff_receipt_note as previous_stage36_archive_handoff_receipt_note,
        p.stage35_archive_receipt_handoff_state as previous_stage35_archive_receipt_handoff_state,
        p.stage34_archive_closure_receipt_state as previous_stage34_archive_closure_receipt_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state
    ), event as (
      insert into clinical_follow_up_stage36_archive_handoff_receipt_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        archive_handoff_receipt_state,
        archive_receipt_handoff_state,
        archive_closure_receipt_state,
        archive_closure_state,
        archive_readiness_state,
        note
      )
      select
        u.id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt.update',
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState', coalesce(previous_stage36_archive_handoff_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote', previous_stage36_archive_handoff_receipt_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState', coalesce(previous_stage35_archive_receipt_handoff_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState', coalesce(previous_stage34_archive_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started')
        ),
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState', coalesce(u.stage36_archive_handoff_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote', u.stage36_archive_handoff_receipt_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState', coalesce(u.stage35_archive_receipt_handoff_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState', coalesce(u.stage34_archive_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started')
        ),
        coalesce(u.stage36_archive_handoff_receipt_state, 'not_started'),
        coalesce(u.stage35_archive_receipt_handoff_state, 'not_started'),
        coalesce(u.stage34_archive_closure_receipt_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
        ${sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote || changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState)}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const scopedFollowUps = clinicScopeWhere("f", { allClinics, clinicIds });
  const archiveClosureReceiptHandoffReceiptReconciliationReady = `(
    coalesce(f.stage36_archive_handoff_receipt_state, 'not_started') = 'received'
    and coalesce(f.stage35_archive_receipt_handoff_state, 'not_started') = 'handed_off'
    and coalesce(f.stage34_archive_closure_receipt_state, 'not_started') = 'received'
    and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started') = 'closed'
    and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started') in ('ready', 'archived')
  )`;
  return `
    with scoped_followups as (
      select *
      from clinical_follow_up_tasks f
      where ${scopedFollowUps}
    )
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where ${archiveClosureReceiptHandoffReceiptReconciliationReady})::int as "archiveClosureReceiptHandoffReceiptReconciliationReady",
      count(*) filter (where ${archiveClosureReceiptHandoffReceiptReconciliationReady} and coalesce(f.stage37_archive_handoff_receipt_reconciliation_state, 'not_started') in ('not_started', 'ready', 'needs_rework'))::int as "needsArchiveClosureReceiptHandoffReceiptReconciliation",
      count(*) filter (where coalesce(f.stage37_archive_handoff_receipt_reconciliation_state, 'not_started') = 'reconciled')::int as "reconciledArchiveClosureReceiptHandoffReceipts",
      count(*) filter (where coalesce(f.stage37_archive_handoff_receipt_reconciliation_state, 'not_started') = 'reconciliation_exception')::int as "archiveClosureReceiptHandoffReceiptReconciliationExceptions",
      count(*) filter (where coalesce(f.stage37_archive_handoff_receipt_reconciliation_state, 'not_started') = 'needs_rework')::int as "archiveClosureReceiptHandoffReceiptReconciliationNeedsRework",
      count(*) filter (where coalesce(f.stage36_archive_handoff_receipt_state, 'not_started') = 'received')::int as "receivedArchiveClosureReceiptHandoffReceipts",
      count(*) filter (where coalesce(f.stage35_archive_receipt_handoff_state, 'not_started') = 'handed_off')::int as "handedOffArchiveClosureReceipts",
      count(*) filter (where coalesce(f.stage34_archive_closure_receipt_state, 'not_started') = 'received')::int as "receivedArchiveClosureReceipts",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_stage37_archive_handoff_receipt_reconciliation_events e
        where e.follow_up_id = f.id
      ))::int as "localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationEvents"
    from scoped_followups f
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const nextState = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState !== undefined
    ? sqlLiteral(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState)
    : "p.stage37_archive_handoff_receipt_reconciliation_state";
  const nextNote = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote !== undefined
    ? sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote)
    : "p.stage37_archive_handoff_receipt_reconciliation_note";
  const reconciliationState = ["ready", "reconciled", "reconciliation_exception", "needs_rework"].includes(
    changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState,
  );

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set
          stage37_archive_handoff_receipt_reconciliation_state = ${nextState},
          stage37_archive_handoff_receipt_reconciliation_note = ${nextNote},
          stage37_archive_handoff_receipt_reconciled_by_user_id = ${reconciliationState ? sqlUuid(actorUserId) : "p.stage37_archive_handoff_receipt_reconciled_by_user_id"},
          stage37_archive_handoff_receipt_reconciled_at = ${reconciliationState ? "now()" : "p.stage37_archive_handoff_receipt_reconciled_at"},
          updated_at = now()
      from previous p
      where f.id = p.id
      returning f.*,
        p.stage37_archive_handoff_receipt_reconciliation_state as previous_stage37_archive_handoff_receipt_reconciliation_state,
        p.stage37_archive_handoff_receipt_reconciliation_note as previous_stage37_archive_handoff_receipt_reconciliation_note,
        p.stage36_archive_handoff_receipt_state as previous_stage36_archive_handoff_receipt_state,
        p.stage35_archive_receipt_handoff_state as previous_stage35_archive_receipt_handoff_state,
        p.stage34_archive_closure_receipt_state as previous_stage34_archive_closure_receipt_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state
    ), event as (
      insert into clinical_follow_up_stage37_archive_handoff_receipt_reconciliation_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        archive_handoff_receipt_reconciliation_state,
        archive_handoff_receipt_state,
        archive_receipt_handoff_state,
        archive_closure_receipt_state,
        archive_closure_state,
        archive_readiness_state,
        note
      )
      select
        u.id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation.update',
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState', coalesce(previous_stage37_archive_handoff_receipt_reconciliation_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote', previous_stage37_archive_handoff_receipt_reconciliation_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState', coalesce(previous_stage36_archive_handoff_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState', coalesce(previous_stage35_archive_receipt_handoff_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState', coalesce(previous_stage34_archive_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started')
        ),
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState', coalesce(u.stage37_archive_handoff_receipt_reconciliation_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote', u.stage37_archive_handoff_receipt_reconciliation_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState', coalesce(u.stage36_archive_handoff_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState', coalesce(u.stage35_archive_receipt_handoff_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState', coalesce(u.stage34_archive_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started')
        ),
        coalesce(u.stage37_archive_handoff_receipt_reconciliation_state, 'not_started'),
        coalesce(u.stage36_archive_handoff_receipt_state, 'not_started'),
        coalesce(u.stage35_archive_receipt_handoff_state, 'not_started'),
        coalesce(u.stage34_archive_closure_receipt_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
        ${sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote || changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState)}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const scopedFollowUps = clinicScopeWhere("f", { allClinics, clinicIds });
  const archiveClosureReceiptHandoffReceiptReconciliationClosureReady = `(
    coalesce(f.stage37_archive_handoff_receipt_reconciliation_state, 'not_started') = 'reconciled'
    and coalesce(f.stage36_archive_handoff_receipt_state, 'not_started') = 'received'
    and coalesce(f.stage35_archive_receipt_handoff_state, 'not_started') = 'handed_off'
    and coalesce(f.stage34_archive_closure_receipt_state, 'not_started') = 'received'
    and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started') = 'closed'
    and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started') in ('ready', 'archived')
  )`;
  return `
    with scoped_followups as (
      select *
      from clinical_follow_up_tasks f
      where ${scopedFollowUps}
    )
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where ${archiveClosureReceiptHandoffReceiptReconciliationClosureReady})::int as "archiveClosureReceiptHandoffReceiptReconciliationClosureReady",
      count(*) filter (where ${archiveClosureReceiptHandoffReceiptReconciliationClosureReady} and coalesce(f.stage38_archive_handoff_receipt_reconciliation_closure_state, 'not_started') in ('not_started', 'ready', 'needs_rework'))::int as "needsArchiveClosureReceiptHandoffReceiptReconciliationClosure",
      count(*) filter (where coalesce(f.stage38_archive_handoff_receipt_reconciliation_closure_state, 'not_started') = 'closed')::int as "closedArchiveClosureReceiptHandoffReceiptReconciliations",
      count(*) filter (where coalesce(f.stage38_archive_handoff_receipt_reconciliation_closure_state, 'not_started') = 'closure_exception')::int as "archiveClosureReceiptHandoffReceiptReconciliationClosureExceptions",
      count(*) filter (where coalesce(f.stage38_archive_handoff_receipt_reconciliation_closure_state, 'not_started') = 'needs_rework')::int as "archiveClosureReceiptHandoffReceiptReconciliationClosureNeedsRework",
      count(*) filter (where coalesce(f.stage37_archive_handoff_receipt_reconciliation_state, 'not_started') = 'reconciled')::int as "reconciledArchiveClosureReceiptHandoffReceipts",
      count(*) filter (where coalesce(f.stage36_archive_handoff_receipt_state, 'not_started') = 'received')::int as "receivedArchiveClosureReceiptHandoffReceipts",
      count(*) filter (where coalesce(f.stage35_archive_receipt_handoff_state, 'not_started') = 'handed_off')::int as "handedOffArchiveClosureReceipts",
      count(*) filter (where coalesce(f.stage34_archive_closure_receipt_state, 'not_started') = 'received')::int as "receivedArchiveClosureReceipts",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_stage38_archive_handoff_receipt_reconciliation_closure_events e
        where e.follow_up_id = f.id
      ))::int as "localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureEvents"
    from scoped_followups f
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const nextState = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState !== undefined
    ? sqlLiteral(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState)
    : "p.stage38_archive_handoff_receipt_reconciliation_closure_state";
  const nextNote = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote !== undefined
    ? sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote)
    : "p.stage38_archive_handoff_receipt_reconciliation_closure_note";
  const reconciliationClosureState = ["ready", "closed", "closure_exception", "needs_rework"].includes(
    changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState,
  );

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set
          stage38_archive_handoff_receipt_reconciliation_closure_state = ${nextState},
          stage38_archive_handoff_receipt_reconciliation_closure_note = ${nextNote},
          stage38_archive_handoff_receipt_reconciliation_closed_by_user_id = ${reconciliationClosureState ? sqlUuid(actorUserId) : "p.stage38_archive_handoff_receipt_reconciliation_closed_by_user_id"},
          stage38_archive_handoff_receipt_reconciliation_closed_at = ${reconciliationClosureState ? "now()" : "p.stage38_archive_handoff_receipt_reconciliation_closed_at"},
          updated_at = now()
      from previous p
      where f.id = p.id
      returning f.*,
        p.stage38_archive_handoff_receipt_reconciliation_closure_state as previous_stage38_archive_handoff_receipt_reconciliation_closure_state,
        p.stage38_archive_handoff_receipt_reconciliation_closure_note as previous_stage38_archive_handoff_receipt_reconciliation_closure_note,
        p.stage37_archive_handoff_receipt_reconciliation_state as previous_stage37_archive_handoff_receipt_reconciliation_state,
        p.stage36_archive_handoff_receipt_state as previous_stage36_archive_handoff_receipt_state,
        p.stage35_archive_receipt_handoff_state as previous_stage35_archive_receipt_handoff_state,
        p.stage34_archive_closure_receipt_state as previous_stage34_archive_closure_receipt_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state
    ), event as (
      insert into clinical_follow_up_stage38_archive_handoff_receipt_reconciliation_closure_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        archive_handoff_receipt_reconciliation_closure_state,
        archive_handoff_receipt_reconciliation_state,
        archive_handoff_receipt_state,
        archive_receipt_handoff_state,
        archive_closure_receipt_state,
        archive_closure_state,
        archive_readiness_state,
        note
      )
      select
        u.id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure.update',
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState', coalesce(previous_stage38_archive_handoff_receipt_reconciliation_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote', previous_stage38_archive_handoff_receipt_reconciliation_closure_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState', coalesce(previous_stage37_archive_handoff_receipt_reconciliation_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState', coalesce(previous_stage36_archive_handoff_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState', coalesce(previous_stage35_archive_receipt_handoff_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState', coalesce(previous_stage34_archive_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started')
        ),
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState', coalesce(u.stage38_archive_handoff_receipt_reconciliation_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote', u.stage38_archive_handoff_receipt_reconciliation_closure_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState', coalesce(u.stage37_archive_handoff_receipt_reconciliation_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState', coalesce(u.stage36_archive_handoff_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState', coalesce(u.stage35_archive_receipt_handoff_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState', coalesce(u.stage34_archive_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started')
        ),
        coalesce(u.stage38_archive_handoff_receipt_reconciliation_closure_state, 'not_started'),
        coalesce(u.stage37_archive_handoff_receipt_reconciliation_state, 'not_started'),
        coalesce(u.stage36_archive_handoff_receipt_state, 'not_started'),
        coalesce(u.stage35_archive_receipt_handoff_state, 'not_started'),
        coalesce(u.stage34_archive_closure_receipt_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
        ${sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote || changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState)}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const scopedFollowUps = clinicScopeWhere("f", { allClinics, clinicIds });
  const archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptReady = [
    "(",
    "coalesce(f.stage38_archive_handoff_receipt_reconciliation_closure_state, 'not_started') = 'closed'",
    "and coalesce(f.stage37_archive_handoff_receipt_reconciliation_state, 'not_started') = 'reconciled'",
    "and coalesce(f.stage36_archive_handoff_receipt_state, 'not_started') = 'received'",
    "and coalesce(f.stage35_archive_receipt_handoff_state, 'not_started') = 'handed_off'",
    "and coalesce(f.stage34_archive_closure_receipt_state, 'not_started') = 'received'",
    "and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started') = 'closed'",
    "and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started') in ('ready', 'archived')",
    ")",
  ].join("\n");
  return `
    with scoped_followups as (
      select *
      from clinical_follow_up_tasks f
      where ${scopedFollowUps}
    )
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where ${archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptReady})::int as "archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptReady",
      count(*) filter (where ${archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptReady} and coalesce(f.stage39_archive_handoff_receipt_reconciliation_closure_receipt_state, 'not_started') in ('not_started', 'ready', 'needs_rework'))::int as "needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt",
      count(*) filter (where coalesce(f.stage39_archive_handoff_receipt_reconciliation_closure_receipt_state, 'not_started') = 'received')::int as "receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts",
      count(*) filter (where coalesce(f.stage39_archive_handoff_receipt_reconciliation_closure_receipt_state, 'not_started') = 'receipt_exception')::int as "archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptExceptions",
      count(*) filter (where coalesce(f.stage39_archive_handoff_receipt_reconciliation_closure_receipt_state, 'not_started') = 'needs_rework')::int as "archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNeedsRework",
      count(*) filter (where coalesce(f.stage38_archive_handoff_receipt_reconciliation_closure_state, 'not_started') = 'closed')::int as "closedArchiveClosureReceiptHandoffReceiptReconciliations",
      count(*) filter (where coalesce(f.stage37_archive_handoff_receipt_reconciliation_state, 'not_started') = 'reconciled')::int as "reconciledArchiveClosureReceiptHandoffReceipts",
      count(*) filter (where coalesce(f.stage36_archive_handoff_receipt_state, 'not_started') = 'received')::int as "receivedArchiveClosureReceiptHandoffReceipts",
      count(*) filter (where coalesce(f.stage35_archive_receipt_handoff_state, 'not_started') = 'handed_off')::int as "handedOffArchiveClosureReceipts",
      count(*) filter (where coalesce(f.stage34_archive_closure_receipt_state, 'not_started') = 'received')::int as "receivedArchiveClosureReceipts",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_stage39_archive_handoff_receipt_reconciliation_closure_receipt_events e
        where e.follow_up_id = f.id
      ))::int as "localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptEvents"
    from scoped_followups f
  `;
}

export function buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummarySql({
  allClinics = false,
  clinicIds = [],
} = {}) {
  const scopedFollowUps = clinicScopeWhere("f", { allClinics, clinicIds });
  const archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessReady = [
    "(",
    "coalesce(f.stage39_archive_handoff_receipt_reconciliation_closure_receipt_state, 'not_started') = 'received'",
    "and coalesce(f.stage38_archive_handoff_receipt_reconciliation_closure_state, 'not_started') = 'closed'",
    "and coalesce(f.stage37_archive_handoff_receipt_reconciliation_state, 'not_started') = 'reconciled'",
    "and coalesce(f.stage36_archive_handoff_receipt_state, 'not_started') = 'received'",
    "and coalesce(f.stage35_archive_receipt_handoff_state, 'not_started') = 'handed_off'",
    "and coalesce(f.stage34_archive_closure_receipt_state, 'not_started') = 'received'",
    "and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started') = 'closed'",
    "and coalesce(f.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started') in ('ready', 'archived')",
    ")",
  ].join("\n");
  return `
    with scoped_followups as (
      select *
      from clinical_follow_up_tasks f
      where ${scopedFollowUps}
    )
    select
      count(*)::int as "totalFollowUps",
      count(*) filter (where ${archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessReady})::int as "archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessReady",
      count(*) filter (where ${archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessReady} and coalesce(f.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state, 'not_started') in ('not_started', 'ready', 'needs_rework'))::int as "needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness",
      count(*) filter (where coalesce(f.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state, 'not_started') = 'archived')::int as "archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts",
      count(*) filter (where coalesce(f.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state, 'not_started') = 'archive_exception')::int as "archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessExceptions",
      count(*) filter (where coalesce(f.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state, 'not_started') = 'needs_rework')::int as "archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNeedsRework",
      count(*) filter (where coalesce(f.stage39_archive_handoff_receipt_reconciliation_closure_receipt_state, 'not_started') = 'received')::int as "receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts",
      count(*) filter (where coalesce(f.stage38_archive_handoff_receipt_reconciliation_closure_state, 'not_started') = 'closed')::int as "closedArchiveClosureReceiptHandoffReceiptReconciliations",
      count(*) filter (where coalesce(f.stage37_archive_handoff_receipt_reconciliation_state, 'not_started') = 'reconciled')::int as "reconciledArchiveClosureReceiptHandoffReceipts",
      count(*) filter (where coalesce(f.stage36_archive_handoff_receipt_state, 'not_started') = 'received')::int as "receivedArchiveClosureReceiptHandoffReceipts",
      count(*) filter (where coalesce(f.stage35_archive_receipt_handoff_state, 'not_started') = 'handed_off')::int as "handedOffArchiveClosureReceipts",
      count(*) filter (where coalesce(f.stage34_archive_closure_receipt_state, 'not_started') = 'received')::int as "receivedArchiveClosureReceipts",
      count(*) filter (where exists (
        select 1
        from clinical_follow_up_stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_events e
        where e.follow_up_id = f.id
      ))::int as "localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessEvents"
    from scoped_followups f
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const nextState = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState !== undefined
    ? sqlLiteral(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState)
    : "p.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state";
  const nextNote = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote !== undefined
    ? sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote)
    : "p.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_note";
  const archiveReadinessState = ["ready", "archived", "archive_exception", "needs_rework"].includes(
    changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState,
  );

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set
          stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state = ${nextState},
          stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_note = ${nextNote},
          stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_readied_by_user_id = ${archiveReadinessState ? sqlUuid(actorUserId) : "p.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_readied_by_user_id"},
          stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_readied_at = ${archiveReadinessState ? "now()" : "p.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_readied_at"},
          updated_at = now()
      from previous p
      where f.id = p.id
      returning f.*,
        p.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state as previous_stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state,
        p.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_note as previous_stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_note,
        p.stage39_archive_handoff_receipt_reconciliation_closure_receipt_state as previous_stage39_archive_handoff_receipt_reconciliation_closure_receipt_state,
        p.stage38_archive_handoff_receipt_reconciliation_closure_state as previous_stage38_archive_handoff_receipt_reconciliation_closure_state,
        p.stage37_archive_handoff_receipt_reconciliation_state as previous_stage37_archive_handoff_receipt_reconciliation_state,
        p.stage36_archive_handoff_receipt_state as previous_stage36_archive_handoff_receipt_state,
        p.stage35_archive_receipt_handoff_state as previous_stage35_archive_receipt_handoff_state,
        p.stage34_archive_closure_receipt_state as previous_stage34_archive_closure_receipt_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state
    ), event as (
      insert into clinical_follow_up_stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state,
        archive_handoff_receipt_reconciliation_closure_receipt_state,
        archive_handoff_receipt_reconciliation_closure_state,
        archive_handoff_receipt_reconciliation_state,
        archive_handoff_receipt_state,
        archive_receipt_handoff_state,
        archive_closure_receipt_state,
        archive_closure_state,
        archive_readiness_state,
        note
      )
      select
        u.id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness.update',
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState', coalesce(previous_stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote', previous_stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState', coalesce(previous_stage39_archive_handoff_receipt_reconciliation_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState', coalesce(previous_stage38_archive_handoff_receipt_reconciliation_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState', coalesce(previous_stage37_archive_handoff_receipt_reconciliation_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState', coalesce(previous_stage36_archive_handoff_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState', coalesce(previous_stage35_archive_receipt_handoff_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState', coalesce(previous_stage34_archive_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started')
        ),
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState', coalesce(u.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote', u.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState', coalesce(u.stage39_archive_handoff_receipt_reconciliation_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState', coalesce(u.stage38_archive_handoff_receipt_reconciliation_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState', coalesce(u.stage37_archive_handoff_receipt_reconciliation_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState', coalesce(u.stage36_archive_handoff_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState', coalesce(u.stage35_archive_receipt_handoff_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState', coalesce(u.stage34_archive_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started')
        ),
        coalesce(u.stage40_archive_handoff_receipt_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
        coalesce(u.stage39_archive_handoff_receipt_reconciliation_closure_receipt_state, 'not_started'),
        coalesce(u.stage38_archive_handoff_receipt_reconciliation_closure_state, 'not_started'),
        coalesce(u.stage37_archive_handoff_receipt_reconciliation_state, 'not_started'),
        coalesce(u.stage36_archive_handoff_receipt_state, 'not_started'),
        coalesce(u.stage35_archive_receipt_handoff_state, 'not_started'),
        coalesce(u.stage34_archive_closure_receipt_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
        ${sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote || changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState)}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const nextState = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState !== undefined
    ? sqlLiteral(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState)
    : "p.stage39_archive_handoff_receipt_reconciliation_closure_receipt_state";
  const nextNote = changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote !== undefined
    ? sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote)
    : "p.stage39_archive_handoff_receipt_reconciliation_closure_receipt_note";
  const receiptState = ["ready", "received", "receipt_exception", "needs_rework"].includes(
    changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState,
  );

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set
          stage39_archive_handoff_receipt_reconciliation_closure_receipt_state = ${nextState},
          stage39_archive_handoff_receipt_reconciliation_closure_receipt_note = ${nextNote},
          stage39_archive_handoff_receipt_reconciliation_closure_received_by_user_id = ${receiptState ? sqlUuid(actorUserId) : "p.stage39_archive_handoff_receipt_reconciliation_closure_received_by_user_id"},
          stage39_archive_handoff_receipt_reconciliation_closure_received_at = ${receiptState ? "now()" : "p.stage39_archive_handoff_receipt_reconciliation_closure_received_at"},
          updated_at = now()
      from previous p
      where f.id = p.id
      returning f.*,
        p.stage39_archive_handoff_receipt_reconciliation_closure_receipt_state as previous_stage39_archive_handoff_receipt_reconciliation_closure_receipt_state,
        p.stage39_archive_handoff_receipt_reconciliation_closure_receipt_note as previous_stage39_archive_handoff_receipt_reconciliation_closure_receipt_note,
        p.stage38_archive_handoff_receipt_reconciliation_closure_state as previous_stage38_archive_handoff_receipt_reconciliation_closure_state,
        p.stage37_archive_handoff_receipt_reconciliation_state as previous_stage37_archive_handoff_receipt_reconciliation_state,
        p.stage36_archive_handoff_receipt_state as previous_stage36_archive_handoff_receipt_state,
        p.stage35_archive_receipt_handoff_state as previous_stage35_archive_receipt_handoff_state,
        p.stage34_archive_closure_receipt_state as previous_stage34_archive_closure_receipt_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state,
        p.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state as previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state
    ), event as (
      insert into clinical_follow_up_stage39_archive_handoff_receipt_reconciliation_closure_receipt_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        archive_handoff_receipt_reconciliation_closure_receipt_state,
        archive_handoff_receipt_reconciliation_closure_state,
        archive_handoff_receipt_reconciliation_state,
        archive_handoff_receipt_state,
        archive_receipt_handoff_state,
        archive_closure_receipt_state,
        archive_closure_state,
        archive_readiness_state,
        note
      )
      select
        u.id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt.update',
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState', coalesce(previous_stage39_archive_handoff_receipt_reconciliation_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote', previous_stage39_archive_handoff_receipt_reconciliation_closure_receipt_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState', coalesce(previous_stage38_archive_handoff_receipt_reconciliation_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState', coalesce(previous_stage37_archive_handoff_receipt_reconciliation_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState', coalesce(previous_stage36_archive_handoff_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState', coalesce(previous_stage35_archive_receipt_handoff_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState', coalesce(previous_stage34_archive_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState', coalesce(previous_sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started')
        ),
        jsonb_build_object(
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState', coalesce(u.stage39_archive_handoff_receipt_reconciliation_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote', u.stage39_archive_handoff_receipt_reconciliation_closure_receipt_note,
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState', coalesce(u.stage38_archive_handoff_receipt_reconciliation_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState', coalesce(u.stage37_archive_handoff_receipt_reconciliation_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState', coalesce(u.stage36_archive_handoff_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState', coalesce(u.stage35_archive_receipt_handoff_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState', coalesce(u.stage34_archive_closure_receipt_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
          'sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState', coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started')
        ),
        coalesce(u.stage39_archive_handoff_receipt_reconciliation_closure_receipt_state, 'not_started'),
        coalesce(u.stage38_archive_handoff_receipt_reconciliation_closure_state, 'not_started'),
        coalesce(u.stage37_archive_handoff_receipt_reconciliation_state, 'not_started'),
        coalesce(u.stage36_archive_handoff_receipt_state, 'not_started'),
        coalesce(u.stage35_archive_receipt_handoff_state, 'not_started'),
        coalesce(u.stage34_archive_closure_receipt_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_state, 'not_started'),
        coalesce(u.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness_state, 'not_started'),
        ${sqlNullableText(changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote || changes.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState)}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildUpdateClinicalFollowUpSopPolicyExceptionClosureSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const nextState = changes.sopPolicyExceptionState !== undefined
    ? sqlLiteral(changes.sopPolicyExceptionState)
    : "p.sop_policy_exception_state";
  const nextReason = changes.sopPolicyExceptionReason !== undefined
    ? sqlNullableText(changes.sopPolicyExceptionReason)
    : "p.sop_policy_exception_reason";
  const nextResolution = changes.sopPolicyExceptionResolution !== undefined
    ? sqlNullableText(changes.sopPolicyExceptionResolution)
    : "p.sop_policy_exception_resolution";
  const closingState = ["accepted", "rejected", "closed"].includes(changes.sopPolicyExceptionState);
  const reopeningState = changes.sopPolicyExceptionState === "open" || changes.sopPolicyExceptionState === "none";

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set
          sop_policy_exception_state = ${nextState},
          sop_policy_exception_reason = ${nextReason},
          sop_policy_exception_resolution = ${nextResolution},
          sop_policy_exception_closed_by_user_id = ${closingState ? sqlUuid(actorUserId) : reopeningState ? "null" : "p.sop_policy_exception_closed_by_user_id"},
          sop_policy_exception_closed_at = ${closingState ? "now()" : reopeningState ? "null" : "p.sop_policy_exception_closed_at"},
          updated_at = now()
      from previous p
      where f.id = p.id
      returning f.*,
        p.sop_policy_exception_state as previous_sop_policy_exception_state,
        p.sop_policy_exception_reason as previous_sop_policy_exception_reason,
        p.sop_policy_exception_resolution as previous_sop_policy_exception_resolution,
        p.sop_policy_exception_closed_at as previous_sop_policy_exception_closed_at,
        p.sop_policy_drift_state as previous_sop_policy_drift_state,
        p.sop_validation_state as previous_sop_validation_state
    ), event as (
      insert into clinical_follow_up_sop_policy_exception_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        exception_state,
        drift_state,
        validation_state,
        note
      )
      select
        u.id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_policy_exception_closure.update',
        jsonb_build_object(
          'sopPolicyExceptionState', coalesce(previous_sop_policy_exception_state, 'none'),
          'sopPolicyExceptionReason', previous_sop_policy_exception_reason,
          'sopPolicyExceptionResolution', previous_sop_policy_exception_resolution,
          'sopPolicyExceptionClosedAt', previous_sop_policy_exception_closed_at,
          'sopPolicyDriftState', coalesce(previous_sop_policy_drift_state, 'not_checked'),
          'sopValidationState', coalesce(previous_sop_validation_state, 'not_required')
        ),
        jsonb_build_object(
          'sopPolicyExceptionState', coalesce(u.sop_policy_exception_state, 'none'),
          'sopPolicyExceptionReason', u.sop_policy_exception_reason,
          'sopPolicyExceptionResolution', u.sop_policy_exception_resolution,
          'sopPolicyExceptionClosedAt', u.sop_policy_exception_closed_at,
          'sopPolicyDriftState', coalesce(u.sop_policy_drift_state, 'not_checked'),
          'sopValidationState', coalesce(u.sop_validation_state, 'not_required')
        ),
        coalesce(u.sop_policy_exception_state, 'none'),
        coalesce(u.sop_policy_drift_state, 'not_checked'),
        coalesce(u.sop_validation_state, 'not_required'),
        ${sqlNullableText(changes.sopPolicyExceptionResolution || changes.sopPolicyExceptionReason || changes.sopPolicyExceptionState)}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildUpdateClinicalFollowUpOperationsSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const updates = [];
  if (changes.triageState !== undefined) updates.push(`triage_state = ${sqlLiteral(changes.triageState)}`);
  if (changes.escalationLevel !== undefined) updates.push(`escalation_level = ${sqlLiteral(changes.escalationLevel)}`);
  if (changes.slaDueAt !== undefined) updates.push(`sla_due_at = ${sqlNullableTimestamp(changes.slaDueAt)}`);
  if (changes.deliveryState !== undefined) updates.push(`delivery_state = ${sqlLiteral(changes.deliveryState)}`);
  if (changes.deliveryEvidence !== undefined) updates.push(`delivery_evidence = ${sqlJson(changes.deliveryEvidence)}`);
  if (changes.operationsNote !== undefined) updates.push(`operations_note = ${sqlNullableText(changes.operationsNote)}`);
  if (changes.deliveryState !== undefined) {
    updates.push("delivery_attempts = delivery_attempts + 1");
    updates.push("last_delivery_attempt_at = now()");
  }
  if (changes.triageState === "resolved") {
    updates.push(`resolved_by_user_id = ${sqlUuid(actorUserId)}`);
    updates.push("resolved_at = now()");
    updates.push("status = case when status in ('planned', 'in_progress', 'sent', 'acknowledged') then 'completed' else status end");
    updates.push("completed_at = coalesce(completed_at, now())");
  }
  updates.push("updated_at = now()");

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set ${updates.join(",\n          ")}
      from previous p
      where f.id = p.id
      returning f.*, p.triage_state as previous_triage_state, p.escalation_level as previous_escalation_level, p.delivery_state as previous_delivery_state
    ), event as (
      insert into clinical_follow_up_operations_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        note
      )
      select
        id,
        clinic_id,
        ${sqlUuid(actorUserId)},
        'operations.update',
        jsonb_build_object(
          'triageState', previous_triage_state,
          'escalationLevel', previous_escalation_level,
          'deliveryState', previous_delivery_state
        ),
        jsonb_build_object(
          'triageState', triage_state,
          'escalationLevel', escalation_level,
          'deliveryState', delivery_state
        ),
        ${sqlNullableText(changes.operationsNote)}
      from updated
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildUpdateClinicalFollowUpQualitySql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const updates = [];
  if (changes.resolutionOutcome !== undefined) {
    updates.push(`resolution_outcome = ${sqlLiteral(changes.resolutionOutcome)}`);
  }
  if (changes.qualityReviewState !== undefined) {
    updates.push(`quality_review_state = ${sqlLiteral(changes.qualityReviewState)}`);
  }
  if (changes.qualityReviewNote !== undefined) {
    updates.push(`quality_review_note = ${sqlNullableText(changes.qualityReviewNote)}`);
  }
  updates.push(`quality_reviewed_by_user_id = ${sqlUuid(actorUserId)}`);
  updates.push("quality_reviewed_at = now()");
  updates.push("updated_at = now()");

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set ${updates.join(",\n          ")}
      from previous p
      where f.id = p.id
      returning f.*,
        p.resolution_outcome as previous_resolution_outcome,
        p.quality_review_state as previous_quality_review_state
    ), event as (
      insert into clinical_follow_up_quality_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        note
      )
      select
        id,
        clinic_id,
        ${sqlUuid(actorUserId)},
        'quality.update',
        jsonb_build_object(
          'resolutionOutcome', coalesce(previous_resolution_outcome, 'not_reviewed'),
          'qualityReviewState', coalesce(previous_quality_review_state, 'pending')
        ),
        jsonb_build_object(
          'resolutionOutcome', coalesce(resolution_outcome, 'not_reviewed'),
          'qualityReviewState', coalesce(quality_review_state, 'pending')
        ),
        ${sqlNullableText(changes.qualityReviewNote)}
      from updated
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildUpdateClinicalFollowUpClinicReviewSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const updates = [];
  const updatesRetentionReview = changes.retentionReviewState !== undefined || changes.retentionReviewNote !== undefined;
  const updatesClinicReview = changes.clinicReviewState !== undefined || changes.clinicReviewNote !== undefined;
  if (changes.retentionReviewState !== undefined) {
    updates.push(`retention_review_state = ${sqlLiteral(changes.retentionReviewState)}`);
  }
  if (changes.retentionReviewNote !== undefined) {
    updates.push(`retention_review_note = ${sqlNullableText(changes.retentionReviewNote)}`);
  }
  if (updatesRetentionReview) {
    updates.push(`retention_reviewed_by_user_id = ${sqlUuid(actorUserId)}`);
    updates.push("retention_reviewed_at = now()");
  }
  if (changes.clinicReviewState !== undefined) {
    updates.push(`clinic_review_state = ${sqlLiteral(changes.clinicReviewState)}`);
  }
  if (changes.clinicReviewNote !== undefined) {
    updates.push(`clinic_review_note = ${sqlNullableText(changes.clinicReviewNote)}`);
  }
  if (updatesClinicReview) {
    updates.push(`clinic_reviewed_by_user_id = ${sqlUuid(actorUserId)}`);
    updates.push("clinic_reviewed_at = now()");
  }
  updates.push("updated_at = now()");

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set ${updates.join(",\n          ")}
      from previous p
      where f.id = p.id
      returning f.*,
        p.retention_review_state as previous_retention_review_state,
        p.clinic_review_state as previous_clinic_review_state
    ), event as (
      insert into clinical_follow_up_retention_review_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        note
      )
      select
        id,
        clinic_id,
        ${sqlUuid(actorUserId)},
        'clinic_review.update',
        jsonb_build_object(
          'retentionReviewState', coalesce(previous_retention_review_state, 'not_due'),
          'clinicReviewState', coalesce(previous_clinic_review_state, 'not_scheduled')
        ),
        jsonb_build_object(
          'retentionReviewState', coalesce(retention_review_state, 'not_due'),
          'clinicReviewState', coalesce(clinic_review_state, 'not_scheduled')
        ),
        ${sqlNullableText(changes.clinicReviewNote ?? changes.retentionReviewNote)}
      from updated
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function buildUpdateClinicalFollowUpSopValidationSql({
  followUpId,
  actorUserId,
  changes,
  allClinics = false,
  clinicIds = [],
}) {
  const updates = [];
  if (changes.sopValidationState !== undefined) updates.push(`sop_validation_state = ${sqlLiteral(changes.sopValidationState)}`);
  if (changes.sopPolicyVersion !== undefined) updates.push(`sop_policy_version = ${sqlNullableText(changes.sopPolicyVersion)}`);
  if (changes.sopExceptionReason !== undefined) updates.push(`sop_exception_reason = ${sqlNullableText(changes.sopExceptionReason)}`);
  if (Object.keys(changes).length > 0) {
    updates.push(`sop_validated_by_user_id = ${sqlUuid(actorUserId)}`);
    updates.push("sop_validated_at = now()");
  }
  updates.push("updated_at = now()");

  return `
    with previous as (
      select f.*
      from clinical_follow_up_tasks f
      where f.id = ${sqlUuid(followUpId)}
        and ${clinicScopeWhere("f", { allClinics, clinicIds })}
      for update
    ), updated as (
      update clinical_follow_up_tasks f
      set ${updates.join(",\n          ")}
      from previous p
      where f.id = p.id
      returning f.*,
        p.sop_validation_state as previous_sop_validation_state,
        p.sop_policy_version as previous_sop_policy_version,
        p.sop_exception_reason as previous_sop_exception_reason
    ), event as (
      insert into clinical_follow_up_sop_validation_events (
        follow_up_id,
        clinic_id,
        actor_user_id,
        event_type,
        previous_state,
        next_state,
        sop_policy_version,
        exception_reason,
        note
      )
      select
        u.id,
        u.clinic_id,
        ${sqlUuid(actorUserId)},
        'sop_validation.update',
        jsonb_build_object(
          'sopValidationState', coalesce(previous_sop_validation_state, 'not_required'),
          'sopPolicyVersion', previous_sop_policy_version,
          'sopExceptionReason', previous_sop_exception_reason
        ),
        jsonb_build_object(
          'sopValidationState', u.sop_validation_state,
          'sopPolicyVersion', u.sop_policy_version,
          'sopExceptionReason', u.sop_exception_reason
        ),
        ${sqlNullableText(changes.sopPolicyVersion)},
        ${sqlNullableText(changes.sopExceptionReason)},
        ${sqlNullableText(changes.sopExceptionReason || changes.sopPolicyVersion || changes.sopValidationState)}
      from updated u
      returning id
    )
    select ${followUpSelect()}
    from updated f
    join patients p on p.id = f.patient_id
    left join visits v on v.id = f.visit_id
  `;
}

export function createClinicalFollowUpRepository(dbClient) {
  return {
    async listClinicalFollowUps(params) {
      const rows = await dbClient.queryJson(buildListClinicalFollowUpsSql(params));
      return {
        items: rows.map(normalizeClinicalFollowUp).filter((item) => item.id),
        limit: clampLimit(params?.limit),
        offset: clampOffset(params?.offset),
        source: "postgres",
      };
    },
    async createClinicalFollowUp(params) {
      const rows = await dbClient.queryJson(buildCreateClinicalFollowUpSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUp(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async createClinicalFollowUpMessage(params) {
      const rows = await dbClient.queryJson(buildCreateClinicalFollowUpMessageSql(params));
      return rows[0] ? normalizeMessage(rows[0]) : null;
    },
    async listPatientFollowUps(params) {
      const rows = await dbClient.queryJson(buildListPatientFollowUpsSql(params));
      return {
        items: rows.map(normalizePatientFollowUp).filter((item) => item.id),
        source: "postgres",
      };
    },
    async createPatientFollowUpMessage(params) {
      const rows = await dbClient.queryJson(buildCreatePatientFollowUpMessageSql(params));
      return rows[0] ? normalizeMessage(rows[0]) : null;
    },
    async listClinicalFollowUpOperations(params) {
      const rows = await dbClient.queryJson(buildListClinicalFollowUpOperationsSql(params));
      return {
        items: rows.map(normalizeClinicalFollowUp).filter((item) => item.id),
        limit: clampLimit(params?.limit),
        offset: clampOffset(params?.offset),
        source: "postgres",
      };
    },
    async getClinicalFollowUpOperationsSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpOperationsSummarySql(params));
      const row = rows[0] || {};
      return {
        totalOpen: Number(row.totalOpen ?? row.total_open ?? 0),
        overdue: Number(row.overdue ?? 0),
        waitingPatient: Number(row.waitingPatient ?? row.waiting_patient ?? 0),
        escalated: Number(row.escalated ?? 0),
        deliveryFailed: Number(row.deliveryFailed ?? row.delivery_failed ?? 0),
        deliveryPending: Number(row.deliveryPending ?? row.delivery_pending ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpOutcomeQualitySummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpOutcomeQualitySummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        closedFollowUps: Number(row.closedFollowUps ?? row.closed_follow_ups ?? 0),
        openOverdue: Number(row.openOverdue ?? row.open_overdue ?? 0),
        openEscalated: Number(row.openEscalated ?? row.open_escalated ?? 0),
        closedWithEvidence: Number(row.closedWithEvidence ?? row.closed_with_evidence ?? 0),
        closedMissingEvidence: Number(row.closedMissingEvidence ?? row.closed_missing_evidence ?? 0),
        qualityReviewed: Number(row.qualityReviewed ?? row.quality_reviewed ?? 0),
        qualityPending: Number(row.qualityPending ?? row.quality_pending ?? 0),
        qualityNeedsAttention: Number(row.qualityNeedsAttention ?? row.quality_needs_attention ?? 0),
        patientReached: Number(row.patientReached ?? row.patient_reached ?? 0),
        clinicalEscalations: Number(row.clinicalEscalations ?? row.clinical_escalations ?? 0),
        deliveryFailures: Number(row.deliveryFailures ?? row.delivery_failures ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpClinicReviewSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpClinicReviewSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        retentionDue: Number(row.retentionDue ?? row.retention_due ?? 0),
        retentionReviewed: Number(row.retentionReviewed ?? row.retention_reviewed ?? 0),
        retentionArchived: Number(row.retentionArchived ?? row.retention_archived ?? 0),
        clinicReviewScheduled: Number(row.clinicReviewScheduled ?? row.clinic_review_scheduled ?? 0),
        clinicReviewCompleted: Number(row.clinicReviewCompleted ?? row.clinic_review_completed ?? 0),
        clinicNeedsPolicyReview: Number(row.clinicNeedsPolicyReview ?? row.clinic_needs_policy_review ?? 0),
        qualityNeedsAttention: Number(row.qualityNeedsAttention ?? row.quality_needs_attention ?? 0),
        closedMissingEvidence: Number(row.closedMissingEvidence ?? row.closed_missing_evidence ?? 0),
        localReviewEvents: Number(row.localReviewEvents ?? row.local_review_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopValidationSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopValidationSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        sopRequired: Number(row.sopRequired ?? row.sop_required ?? 0),
        sopValidated: Number(row.sopValidated ?? row.sop_validated ?? 0),
        sopExceptions: Number(row.sopExceptions ?? row.sop_exceptions ?? 0),
        sopBlocked: Number(row.sopBlocked ?? row.sop_blocked ?? 0),
        clinicNeedsPolicyReview: Number(row.clinicNeedsPolicyReview ?? row.clinic_needs_policy_review ?? 0),
        qualityNeedsAttention: Number(row.qualityNeedsAttention ?? row.quality_needs_attention ?? 0),
        openEscalated: Number(row.openEscalated ?? row.open_escalated ?? 0),
        closedMissingEvidence: Number(row.closedMissingEvidence ?? row.closed_missing_evidence ?? 0),
        localSopEvents: Number(row.localSopEvents ?? row.local_sop_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyTemplateSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyTemplateSummarySql(params));
      const row = rows[0] || {};
      return {
        totalTemplates: Number(row.totalTemplates ?? row.total_templates ?? 0),
        activeTemplates: Number(row.activeTemplates ?? row.active_templates ?? 0),
        inactiveTemplates: Number(row.inactiveTemplates ?? row.inactive_templates ?? 0),
        exceptionsAllowed: Number(row.exceptionsAllowed ?? row.exceptions_allowed ?? 0),
        requiredByDefault: Number(row.requiredByDefault ?? row.required_by_default ?? 0),
        localPolicyEvents: Number(row.localPolicyEvents ?? row.local_policy_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyApplicationSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyApplicationSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        activeTemplates: Number(row.activeTemplates ?? row.active_templates ?? 0),
        appliedTemplates: Number(row.appliedTemplates ?? row.applied_templates ?? 0),
        notChecked: Number(row.notChecked ?? row.not_checked ?? 0),
        inSync: Number(row.inSync ?? row.in_sync ?? 0),
        drifted: Number(row.drifted ?? 0),
        missingTemplate: Number(row.missingTemplate ?? row.missing_template ?? 0),
        reviewRequired: Number(row.reviewRequired ?? row.review_required ?? 0),
        needsPolicyApplication: Number(row.needsPolicyApplication ?? row.needs_policy_application ?? 0),
        localApplicationEvents: Number(row.localApplicationEvents ?? row.local_application_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyExceptionClosureSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyExceptionClosureSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        openExceptions: Number(row.openExceptions ?? row.open_exceptions ?? 0),
        closedExceptions: Number(row.closedExceptions ?? row.closed_exceptions ?? 0),
        acceptedExceptions: Number(row.acceptedExceptions ?? row.accepted_exceptions ?? 0),
        rejectedExceptions: Number(row.rejectedExceptions ?? row.rejected_exceptions ?? 0),
        unresolvedDrift: Number(row.unresolvedDrift ?? row.unresolved_drift ?? 0),
        unclosedValidationExceptions: Number(row.unclosedValidationExceptions ?? row.unclosed_validation_exceptions ?? 0),
        closedWithLocalResolution: Number(row.closedWithLocalResolution ?? row.closed_with_local_resolution ?? 0),
        localExceptionEvents: Number(row.localExceptionEvents ?? row.local_exception_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyAuditRollupSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyAuditRollupSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        auditReady: Number(row.auditReady ?? row.audit_ready ?? 0),
        needsAuditReview: Number(row.needsAuditReview ?? row.needs_audit_review ?? 0),
        reviewedAudits: Number(row.reviewedAudits ?? row.reviewed_audits ?? 0),
        needsFollowUp: Number(row.needsFollowUp ?? row.needs_follow_up ?? 0),
        unresolvedPolicyDrift: Number(row.unresolvedPolicyDrift ?? row.unresolved_policy_drift ?? 0),
        openExceptions: Number(row.openExceptions ?? row.open_exceptions ?? 0),
        missingPolicyTemplate: Number(row.missingPolicyTemplate ?? row.missing_policy_template ?? 0),
        localPolicyAuditEvents: Number(row.localPolicyAuditEvents ?? row.local_policy_audit_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyGovernanceReadinessSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyGovernanceReadinessSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        governanceReady: Number(row.governanceReady ?? row.governance_ready ?? 0),
        needsGovernanceReview: Number(row.needsGovernanceReview ?? row.needs_governance_review ?? 0),
        reviewedGovernance: Number(row.reviewedGovernance ?? row.reviewed_governance ?? 0),
        governanceNeedsFollowUp: Number(row.governanceNeedsFollowUp ?? row.governance_needs_follow_up ?? 0),
        reviewedPolicyAudits: Number(row.reviewedPolicyAudits ?? row.reviewed_policy_audits ?? 0),
        unresolvedPolicyDrift: Number(row.unresolvedPolicyDrift ?? row.unresolved_policy_drift ?? 0),
        openExceptions: Number(row.openExceptions ?? row.open_exceptions ?? 0),
        localGovernanceEvents: Number(row.localGovernanceEvents ?? row.local_governance_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyGovernanceClosureSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyGovernanceClosureSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        closureReady: Number(row.closureReady ?? row.closure_ready ?? 0),
        needsClosureReview: Number(row.needsClosureReview ?? row.needs_closure_review ?? 0),
        closedGovernanceReviews: Number(row.closedGovernanceReviews ?? row.closed_governance_reviews ?? 0),
        closureNeedsFollowUp: Number(row.closureNeedsFollowUp ?? row.closure_needs_follow_up ?? 0),
        reviewedGovernance: Number(row.reviewedGovernance ?? row.reviewed_governance ?? 0),
        unresolvedPolicyDrift: Number(row.unresolvedPolicyDrift ?? row.unresolved_policy_drift ?? 0),
        openExceptions: Number(row.openExceptions ?? row.open_exceptions ?? 0),
        localGovernanceClosureEvents: Number(row.localGovernanceClosureEvents ?? row.local_governance_closure_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyGovernanceEvidenceSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyGovernanceEvidenceSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        evidenceReady: Number(row.evidenceReady ?? row.evidence_ready ?? 0),
        needsEvidenceReview: Number(row.needsEvidenceReview ?? row.needs_evidence_review ?? 0),
        exportedGovernanceEvidence: Number(row.exportedGovernanceEvidence ?? row.exported_governance_evidence ?? 0),
        evidenceNeedsFollowUp: Number(row.evidenceNeedsFollowUp ?? row.evidence_needs_follow_up ?? 0),
        closedGovernanceReviews: Number(row.closedGovernanceReviews ?? row.closed_governance_reviews ?? 0),
        unresolvedPolicyDrift: Number(row.unresolvedPolicyDrift ?? row.unresolved_policy_drift ?? 0),
        openExceptions: Number(row.openExceptions ?? row.open_exceptions ?? 0),
        localGovernanceEvidenceEvents: Number(row.localGovernanceEvidenceEvents ?? row.local_governance_evidence_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        reconciliationReady: Number(row.reconciliationReady ?? row.reconciliation_ready ?? 0),
        needsReconciliation: Number(row.needsReconciliation ?? row.needs_reconciliation ?? 0),
        reconciledGovernanceEvidence: Number(row.reconciledGovernanceEvidence ?? row.reconciled_governance_evidence ?? 0),
        evidenceMismatches: Number(row.evidenceMismatches ?? row.evidence_mismatches ?? 0),
        reconciliationNeedsFollowUp: Number(row.reconciliationNeedsFollowUp ?? row.reconciliation_needs_follow_up ?? 0),
        exportedGovernanceEvidence: Number(row.exportedGovernanceEvidence ?? row.exported_governance_evidence ?? 0),
        closedGovernanceReviews: Number(row.closedGovernanceReviews ?? row.closed_governance_reviews ?? 0),
        localGovernanceEvidenceReconciliationEvents: Number(row.localGovernanceEvidenceReconciliationEvents ?? row.local_governance_evidence_reconciliation_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        reconciliationClosureReady: Number(row.reconciliationClosureReady ?? row.reconciliation_closure_ready ?? 0),
        needsReconciliationClosure: Number(row.needsReconciliationClosure ?? row.needs_reconciliation_closure ?? 0),
        closedReconciliationEvidence: Number(row.closedReconciliationEvidence ?? row.closed_reconciliation_evidence ?? 0),
        reconciliationClosureExceptions: Number(row.reconciliationClosureExceptions ?? row.reconciliation_closure_exceptions ?? 0),
        reconciliationClosureNeedsRework: Number(row.reconciliationClosureNeedsRework ?? row.reconciliation_closure_needs_rework ?? 0),
        reconciledGovernanceEvidence: Number(row.reconciledGovernanceEvidence ?? row.reconciled_governance_evidence ?? 0),
        openReconciliationMismatches: Number(row.openReconciliationMismatches ?? row.open_reconciliation_mismatches ?? 0),
        localGovernanceEvidenceReconciliationClosureEvents: Number(row.localGovernanceEvidenceReconciliationClosureEvents ?? row.local_governance_evidence_reconciliation_closure_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        closureReceiptReady: Number(row.closureReceiptReady ?? row.closure_receipt_ready ?? 0),
        needsClosureReceipt: Number(row.needsClosureReceipt ?? row.needs_closure_receipt ?? 0),
        receivedClosureReceipts: Number(row.receivedClosureReceipts ?? row.received_closure_receipts ?? 0),
        closureReceiptExceptions: Number(row.closureReceiptExceptions ?? row.closure_receipt_exceptions ?? 0),
        closureReceiptNeedsRework: Number(row.closureReceiptNeedsRework ?? row.closure_receipt_needs_rework ?? 0),
        closedReconciliationEvidence: Number(row.closedReconciliationEvidence ?? row.closed_reconciliation_evidence ?? 0),
        reconciledGovernanceEvidence: Number(row.reconciledGovernanceEvidence ?? row.reconciled_governance_evidence ?? 0),
        localGovernanceEvidenceReconciliationClosureReceiptEvents: Number(row.localGovernanceEvidenceReconciliationClosureReceiptEvents ?? row.local_governance_evidence_reconciliation_closure_receipt_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        archiveReadinessReady: Number(row.archiveReadinessReady ?? row.archive_readiness_ready ?? 0),
        needsArchiveReadiness: Number(row.needsArchiveReadiness ?? row.needs_archive_readiness ?? 0),
        archivedLocal: Number(row.archivedLocal ?? row.archived_local ?? 0),
        archiveReadinessExceptions: Number(row.archiveReadinessExceptions ?? row.archive_readiness_exceptions ?? 0),
        archiveReadinessNeedsRework: Number(row.archiveReadinessNeedsRework ?? row.archive_readiness_needs_rework ?? 0),
        receivedClosureReceipts: Number(row.receivedClosureReceipts ?? row.received_closure_receipts ?? 0),
        closedReconciliationEvidence: Number(row.closedReconciliationEvidence ?? row.closed_reconciliation_evidence ?? 0),
        localGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessEvents: Number(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessEvents ?? row.local_governance_evidence_reconciliation_closure_receipt_archive_readiness_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        archiveClosureReady: Number(row.archiveClosureReady ?? row.archive_closure_ready ?? 0),
        needsArchiveClosure: Number(row.needsArchiveClosure ?? row.needs_archive_closure ?? 0),
        closedLocalArchives: Number(row.closedLocalArchives ?? row.closed_local_archives ?? 0),
        archiveClosureExceptions: Number(row.archiveClosureExceptions ?? row.archive_closure_exceptions ?? 0),
        archiveClosureNeedsRework: Number(row.archiveClosureNeedsRework ?? row.archive_closure_needs_rework ?? 0),
        archiveReadinessMarked: Number(row.archiveReadinessMarked ?? row.archive_readiness_marked ?? 0),
        receivedClosureReceipts: Number(row.receivedClosureReceipts ?? row.received_closure_receipts ?? 0),
        localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureEvents: Number(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureEvents ?? row.local_governance_evidence_reconciliation_closure_receipt_archive_closure_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        archiveClosureReceiptReady: Number(row.archiveClosureReceiptReady ?? row.archive_closure_receipt_ready ?? 0),
        needsArchiveClosureReceipt: Number(row.needsArchiveClosureReceipt ?? row.needs_archive_closure_receipt ?? 0),
        receivedArchiveClosureReceipts: Number(row.receivedArchiveClosureReceipts ?? row.received_archive_closure_receipts ?? 0),
        archiveClosureReceiptExceptions: Number(row.archiveClosureReceiptExceptions ?? row.archive_closure_receipt_exceptions ?? 0),
        archiveClosureReceiptNeedsRework: Number(row.archiveClosureReceiptNeedsRework ?? row.archive_closure_receipt_needs_rework ?? 0),
        closedLocalArchives: Number(row.closedLocalArchives ?? row.closed_local_archives ?? 0),
        archiveReadinessMarked: Number(row.archiveReadinessMarked ?? row.archive_readiness_marked ?? 0),
        localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptEvents: Number(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptEvents ?? row.local_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        archiveClosureReceiptHandoffReady: Number(row.archiveClosureReceiptHandoffReady ?? row.archive_closure_receipt_handoff_ready ?? 0),
        needsArchiveClosureReceiptHandoff: Number(row.needsArchiveClosureReceiptHandoff ?? row.needs_archive_closure_receipt_handoff ?? 0),
        handedOffArchiveClosureReceipts: Number(row.handedOffArchiveClosureReceipts ?? row.handed_off_archive_closure_receipts ?? 0),
        archiveClosureReceiptHandoffExceptions: Number(row.archiveClosureReceiptHandoffExceptions ?? row.archive_closure_receipt_handoff_exceptions ?? 0),
        archiveClosureReceiptHandoffNeedsRework: Number(row.archiveClosureReceiptHandoffNeedsRework ?? row.archive_closure_receipt_handoff_needs_rework ?? 0),
        receivedArchiveClosureReceipts: Number(row.receivedArchiveClosureReceipts ?? row.received_archive_closure_receipts ?? 0),
        closedLocalArchives: Number(row.closedLocalArchives ?? row.closed_local_archives ?? 0),
        localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffEvents: Number(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffEvents ?? row.local_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        archiveClosureReceiptHandoffReceiptReady: Number(row.archiveClosureReceiptHandoffReceiptReady ?? row.archive_closure_receipt_handoff_receipt_ready ?? 0),
        needsArchiveClosureReceiptHandoffReceipt: Number(row.needsArchiveClosureReceiptHandoffReceipt ?? row.needs_archive_closure_receipt_handoff_receipt ?? 0),
        receivedArchiveClosureReceiptHandoffReceipts: Number(row.receivedArchiveClosureReceiptHandoffReceipts ?? row.received_archive_closure_receipt_handoff_receipts ?? 0),
        archiveClosureReceiptHandoffReceiptExceptions: Number(row.archiveClosureReceiptHandoffReceiptExceptions ?? row.archive_closure_receipt_handoff_receipt_exceptions ?? 0),
        archiveClosureReceiptHandoffReceiptNeedsRework: Number(row.archiveClosureReceiptHandoffReceiptNeedsRework ?? row.archive_closure_receipt_handoff_receipt_needs_rework ?? 0),
        handedOffArchiveClosureReceipts: Number(row.handedOffArchiveClosureReceipts ?? row.handed_off_archive_closure_receipts ?? 0),
        receivedArchiveClosureReceipts: Number(row.receivedArchiveClosureReceipts ?? row.received_archive_closure_receipts ?? 0),
        localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptEvents: Number(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptEvents ?? row.local_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        archiveClosureReceiptHandoffReceiptReconciliationReady: Number(row.archiveClosureReceiptHandoffReceiptReconciliationReady ?? row.archive_closure_receipt_handoff_receipt_reconciliation_ready ?? 0),
        needsArchiveClosureReceiptHandoffReceiptReconciliation: Number(row.needsArchiveClosureReceiptHandoffReceiptReconciliation ?? row.needs_archive_closure_receipt_handoff_receipt_reconciliation ?? 0),
        reconciledArchiveClosureReceiptHandoffReceipts: Number(row.reconciledArchiveClosureReceiptHandoffReceipts ?? row.reconciled_archive_closure_receipt_handoff_receipts ?? 0),
        archiveClosureReceiptHandoffReceiptReconciliationExceptions: Number(row.archiveClosureReceiptHandoffReceiptReconciliationExceptions ?? row.archive_closure_receipt_handoff_receipt_reconciliation_exceptions ?? 0),
        archiveClosureReceiptHandoffReceiptReconciliationNeedsRework: Number(row.archiveClosureReceiptHandoffReceiptReconciliationNeedsRework ?? row.archive_closure_receipt_handoff_receipt_reconciliation_needs_rework ?? 0),
        receivedArchiveClosureReceiptHandoffReceipts: Number(row.receivedArchiveClosureReceiptHandoffReceipts ?? row.received_archive_closure_receipt_handoff_receipts ?? 0),
        handedOffArchiveClosureReceipts: Number(row.handedOffArchiveClosureReceipts ?? row.handed_off_archive_closure_receipts ?? 0),
        receivedArchiveClosureReceipts: Number(row.receivedArchiveClosureReceipts ?? row.received_archive_closure_receipts ?? 0),
        localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationEvents: Number(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationEvents ?? row.local_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptReady: Number(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptReady ?? row.archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_ready ?? 0),
        needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt: Number(row.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt ?? row.needs_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt ?? 0),
        receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: Number(row.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts ?? row.received_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipts ?? 0),
        archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptExceptions: Number(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptExceptions ?? row.archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_exceptions ?? 0),
        archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNeedsRework: Number(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNeedsRework ?? row.archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_needs_rework ?? 0),
        closedArchiveClosureReceiptHandoffReceiptReconciliations: Number(row.closedArchiveClosureReceiptHandoffReceiptReconciliations ?? row.closed_archive_closure_receipt_handoff_receipt_reconciliations ?? 0),
        reconciledArchiveClosureReceiptHandoffReceipts: Number(row.reconciledArchiveClosureReceiptHandoffReceipts ?? row.reconciled_archive_closure_receipt_handoff_receipts ?? 0),
        receivedArchiveClosureReceiptHandoffReceipts: Number(row.receivedArchiveClosureReceiptHandoffReceipts ?? row.received_archive_closure_receipt_handoff_receipts ?? 0),
        handedOffArchiveClosureReceipts: Number(row.handedOffArchiveClosureReceipts ?? row.handed_off_archive_closure_receipts ?? 0),
        receivedArchiveClosureReceipts: Number(row.receivedArchiveClosureReceipts ?? row.received_archive_closure_receipts ?? 0),
        localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptEvents: Number(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptEvents ?? row.local_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessReady: Number(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessReady ?? row.archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_ready ?? 0),
        needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness: Number(row.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness ?? row.needs_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness ?? 0),
        archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: Number(row.archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts ?? row.archived_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipts ?? 0),
        archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessExceptions: Number(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessExceptions ?? row.archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_exceptions ?? 0),
        archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNeedsRework: Number(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNeedsRework ?? row.archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_needs_rework ?? 0),
        receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: Number(row.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts ?? row.received_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipts ?? 0),
        closedArchiveClosureReceiptHandoffReceiptReconciliations: Number(row.closedArchiveClosureReceiptHandoffReceiptReconciliations ?? row.closed_archive_closure_receipt_handoff_receipt_reconciliations ?? 0),
        reconciledArchiveClosureReceiptHandoffReceipts: Number(row.reconciledArchiveClosureReceiptHandoffReceipts ?? row.reconciled_archive_closure_receipt_handoff_receipts ?? 0),
        receivedArchiveClosureReceiptHandoffReceipts: Number(row.receivedArchiveClosureReceiptHandoffReceipts ?? row.received_archive_closure_receipt_handoff_receipts ?? 0),
        handedOffArchiveClosureReceipts: Number(row.handedOffArchiveClosureReceipts ?? row.handed_off_archive_closure_receipts ?? 0),
        receivedArchiveClosureReceipts: Number(row.receivedArchiveClosureReceipts ?? row.received_archive_closure_receipts ?? 0),
        localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessEvents: Number(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessEvents ?? row.local_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_events ?? 0),
        source: "postgres",
      };
    },
    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary(params) {
      const rows = await dbClient.queryJson(buildClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummarySql(params));
      const row = rows[0] || {};
      return {
        totalFollowUps: Number(row.totalFollowUps ?? row.total_follow_ups ?? 0),
        archiveClosureReceiptHandoffReceiptReconciliationClosureReady: Number(row.archiveClosureReceiptHandoffReceiptReconciliationClosureReady ?? row.archive_closure_receipt_handoff_receipt_reconciliation_closure_ready ?? 0),
        needsArchiveClosureReceiptHandoffReceiptReconciliationClosure: Number(row.needsArchiveClosureReceiptHandoffReceiptReconciliationClosure ?? row.needs_archive_closure_receipt_handoff_receipt_reconciliation_closure ?? 0),
        closedArchiveClosureReceiptHandoffReceiptReconciliations: Number(row.closedArchiveClosureReceiptHandoffReceiptReconciliations ?? row.closed_archive_closure_receipt_handoff_receipt_reconciliations ?? 0),
        archiveClosureReceiptHandoffReceiptReconciliationClosureExceptions: Number(row.archiveClosureReceiptHandoffReceiptReconciliationClosureExceptions ?? row.archive_closure_receipt_handoff_receipt_reconciliation_closure_exceptions ?? 0),
        archiveClosureReceiptHandoffReceiptReconciliationClosureNeedsRework: Number(row.archiveClosureReceiptHandoffReceiptReconciliationClosureNeedsRework ?? row.archive_closure_receipt_handoff_receipt_reconciliation_closure_needs_rework ?? 0),
        reconciledArchiveClosureReceiptHandoffReceipts: Number(row.reconciledArchiveClosureReceiptHandoffReceipts ?? row.reconciled_archive_closure_receipt_handoff_receipts ?? 0),
        receivedArchiveClosureReceiptHandoffReceipts: Number(row.receivedArchiveClosureReceiptHandoffReceipts ?? row.received_archive_closure_receipt_handoff_receipts ?? 0),
        handedOffArchiveClosureReceipts: Number(row.handedOffArchiveClosureReceipts ?? row.handed_off_archive_closure_receipts ?? 0),
        receivedArchiveClosureReceipts: Number(row.receivedArchiveClosureReceipts ?? row.received_archive_closure_receipts ?? 0),
        localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureEvents: Number(row.localGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureEvents ?? row.local_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_events ?? 0),
        source: "postgres",
      };
    },
    async listClinicalFollowUpSopPolicyTemplates(params) {
      const rows = await dbClient.queryJson(buildListClinicalFollowUpSopPolicyTemplatesSql(params));
      return {
        items: rows.map(normalizeClinicalFollowUpSopPolicyTemplate).filter((item) => item.id),
        limit: clampLimit(params?.limit, 25, 100),
        offset: clampOffset(params?.offset),
        source: "postgres",
      };
    },
    async createClinicalFollowUpSopPolicyTemplate(params) {
      const rows = await dbClient.queryJson(buildCreateClinicalFollowUpSopPolicyTemplateSql(params));
      return rows[0] ? normalizeClinicalFollowUpSopPolicyTemplate(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyTemplate(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyTemplateSql(params));
      return rows[0] ? normalizeClinicalFollowUpSopPolicyTemplate(rows[0]) : null;
    },
    async updateClinicalFollowUpOperations(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpOperationsSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpQuality(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpQualitySql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpClinicReview(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpClinicReviewSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopValidation(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopValidationSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyApplication(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyApplicationSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyExceptionClosure(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyExceptionClosureSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyAuditRollup(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyAuditRollupSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyGovernanceReadiness(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyGovernanceReadinessSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyGovernanceClosure(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyGovernanceClosureSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyGovernanceEvidence(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliation(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosure(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness(params) {
      const rows = await dbClient.queryJson(buildUpdateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSql(params));
      return rows[0] ? normalizeClinicalFollowUp(rows[0]) : null;
    },
  };
}
