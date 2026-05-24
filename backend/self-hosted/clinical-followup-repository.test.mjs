import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCreateClinicalFollowUpMessageSql,
  buildCreateClinicalFollowUpSql,
  buildCreatePatientFollowUpMessageSql,
  buildClinicalFollowUpClinicReviewSummarySql,
  buildClinicalFollowUpOutcomeQualitySummarySql,
  buildClinicalFollowUpOperationsSummarySql,
  buildClinicalFollowUpSopPolicyTemplateSummarySql,
  buildClinicalFollowUpSopPolicyApplicationSummarySql,
  buildClinicalFollowUpSopPolicyAuditRollupSummarySql,
  buildClinicalFollowUpSopPolicyExceptionClosureSummarySql,
  buildClinicalFollowUpSopPolicyGovernanceReadinessSummarySql,
  buildClinicalFollowUpSopValidationSummarySql,
  buildCreateClinicalFollowUpSopPolicyTemplateSql,
  buildListClinicalFollowUpsSql,
  buildListClinicalFollowUpOperationsSql,
  buildListClinicalFollowUpSopPolicyTemplatesSql,
  buildListPatientFollowUpsSql,
  buildUpdateClinicalFollowUpOperationsSql,
  buildUpdateClinicalFollowUpClinicReviewSql,
  buildUpdateClinicalFollowUpQualitySql,
  buildUpdateClinicalFollowUpSopPolicyTemplateSql,
  buildUpdateClinicalFollowUpSopPolicyApplicationSql,
  buildUpdateClinicalFollowUpSopPolicyAuditRollupSql,
  buildUpdateClinicalFollowUpSopPolicyExceptionClosureSql,
  buildUpdateClinicalFollowUpSopPolicyGovernanceReadinessSql,
  buildUpdateClinicalFollowUpSopValidationSql,
  buildUpdateClinicalFollowUpSql,
  createClinicalFollowUpRepository,
  normalizeClinicalFollowUpOperationsParams,
  normalizeClinicalFollowUpParams,
  normalizeClinicalFollowUpSopPolicyTemplateParams,
} from "./clinical-followup-repository.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000101";
const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const FOLLOW_UP_ID = "10000000-0000-4000-8000-000000000701";

test("normalizes list params and builds clinic-scoped follow-up list SQL", () => {
  const params = normalizeClinicalFollowUpParams(new URLSearchParams({
    limit: "999",
    offset: "-4",
    status: "planned",
    patientId: "10000000-0000-4000-8000-000000000201",
  }));
  assert.equal(params.limit, 200);
  assert.equal(params.offset, 0);
  assert.equal(params.status, "planned");

  const sql = buildListClinicalFollowUpsSql({
    ...params,
    clinicIds: [CLINIC_ID],
  });
  assert.match(sql, /from clinical_follow_up_tasks f/);
  assert.match(sql, /join patients p/);
  assert.match(sql, /clinical_follow_up_messages m/);
  assert.match(sql, /f\.clinic_id in \('10000000-0000-4000-8000-000000000001'::uuid\)/);
  assert.match(sql, /f\.status = 'planned'/);
  assert.match(sql, /limit 200/);
  assert.doesNotMatch(sql, /password_hash|object_key|metadata_json|signed_url/i);
});

test("builds create, update, and staff message SQL without physical deletes", () => {
  const createSql = buildCreateClinicalFollowUpSql({
    visitId: VISIT_ID,
    createdByUserId: USER_ID,
    dueAt: "2026-05-30T10:00:00.000Z",
    reason: "Оценить динамику",
    patientSummary: "Пациенту показан контроль.",
    internalNote: "Doctor-only note",
    priority: "high",
    clinicIds: [CLINIC_ID],
  });
  assert.match(createSql, /insert into clinical_follow_up_tasks/);
  assert.match(createSql, /from scoped_visit/);
  assert.match(createSql, /Doctor-only note/);

  const updateSql = buildUpdateClinicalFollowUpSql({
    followUpId: FOLLOW_UP_ID,
    changes: { status: "completed", priority: "normal" },
    clinicIds: [CLINIC_ID],
  });
  assert.match(updateSql, /update clinical_follow_up_tasks f/);
  assert.match(updateSql, /completed_at = now\(\)/);
  assert.doesNotMatch(updateSql, /\bdelete\s+from\b/i);

  const messageSql = buildCreateClinicalFollowUpMessageSql({
    followUpId: FOLLOW_UP_ID,
    senderUserId: USER_ID,
    body: "Контроль назначен.",
    clinicIds: [CLINIC_ID],
  });
  assert.match(messageSql, /insert into clinical_follow_up_messages/);
  assert.match(messageSql, /clinic_to_patient/);
  assert.match(messageSql, /local_only/);
});

test("patient SQL hides internal notes and scopes through patient_user_links", () => {
  const listSql = buildListPatientFollowUpsSql({ userId: USER_ID });
  assert.match(listSql, /join patient_user_links pul/);
  assert.match(listSql, /m\.patient_visible is true/);
  assert.match(listSql, /null as "internalNote"/);
  assert.doesNotMatch(listSql, /f\.internal_note as "internalNote"/);

  const replySql = buildCreatePatientFollowUpMessageSql({
    userId: USER_ID,
    followUpId: FOLLOW_UP_ID,
    body: "Спасибо, вижу контроль.",
  });
  assert.match(replySql, /patient_to_clinic/);
  assert.match(replySql, /join patient_user_links pul/);
  assert.match(replySql, /status = case when f\.status in \('planned', 'sent'\)/);
});

test("repository normalizes staff and patient follow-up DTOs", async () => {
  const calls = [];
  const repository = createClinicalFollowUpRepository({
    async queryJson(sql) {
      calls.push(sql);
      if (/clinical_follow_up_messages/.test(sql) && /insert into/.test(sql)) {
        return [{
          id: "10000000-0000-4000-8000-000000000801",
          followUpId: FOLLOW_UP_ID,
          senderRole: "doctor",
          direction: "clinic_to_patient",
          body: "Message",
          patientVisible: true,
          createdAt: "2026-05-21T10:00:00.000Z",
        }];
      }
      return [{
        id: FOLLOW_UP_ID,
        clinicId: CLINIC_ID,
        patientId: "10000000-0000-4000-8000-000000000201",
        visitId: VISIT_ID,
        dueAt: "2026-05-30T10:00:00.000Z",
        status: "planned",
        priority: "high",
        reason: "Контроль",
        patientSummary: "Портальный текст",
        internalNote: "Doctor-only",
        patientCode: "DP-0001",
        patientFullName: "Иванова Наталья Олеговна",
        messageCount: 1,
        latestMessage: { id: "m1", body: "Latest", senderRole: "doctor" },
      }];
    },
  });

  const staff = await repository.listClinicalFollowUps({ clinicIds: [CLINIC_ID] });
  const patient = await repository.listPatientFollowUps({ userId: USER_ID });
  const message = await repository.createClinicalFollowUpMessage({
    followUpId: FOLLOW_UP_ID,
    senderUserId: USER_ID,
    body: "Message",
    clinicIds: [CLINIC_ID],
  });

  assert.equal(staff.items[0].internalNote, "Doctor-only");
  assert.equal(staff.items[0].patient.fullName, "Иванова Наталья Олеговна");
  assert.equal(patient.items[0].internalNote, undefined);
  assert.equal(patient.items[0].patientSummary, "Портальный текст");
  assert.equal(message.direction, "clinic_to_patient");
  assert.equal(calls.length, 3);
});

test("builds operations queue, summary, and update SQL with append-only events", () => {
  const params = normalizeClinicalFollowUpOperationsParams(new URLSearchParams({
    triageState: "escalated",
    escalationLevel: "clinic_admin",
    deliveryState: "failed",
    overdueOnly: "true",
    now: "2026-05-22T10:00:00.000Z",
    visitId: VISIT_ID,
  }));
  assert.equal(params.triageState, "escalated");
  assert.equal(params.overdueOnly, true);

  const listSql = buildListClinicalFollowUpOperationsSql({
    ...params,
    clinicIds: [CLINIC_ID],
  });
  assert.match(listSql, /f\.triage_state = 'escalated'/);
  assert.match(listSql, /f\.escalation_level = 'clinic_admin'/);
  assert.match(listSql, /f\.delivery_state = 'failed'/);
  assert.match(listSql, /coalesce\(f\.sla_due_at, f\.due_at\) < '2026-05-22T10:00:00.000Z'::timestamptz/);
  assert.match(listSql, /f\.visit_id = '10000000-0000-4000-8000-000000000301'::uuid/);

  const summarySql = buildClinicalFollowUpOperationsSummarySql({
    clinicIds: [CLINIC_ID],
    now: "2026-05-22T10:00:00.000Z",
  });
  assert.match(summarySql, /count\(\*\) filter \(where f\.triage_state = 'waiting_patient'\)::int as "waitingPatient"/);
  assert.match(summarySql, /delivery_state = 'failed'/);

  const updateSql = buildUpdateClinicalFollowUpOperationsSql({
    followUpId: FOLLOW_UP_ID,
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: {
      triageState: "resolved",
      escalationLevel: "none",
      deliveryState: "delivered",
      deliveryEvidence: { channel: "phone", state: "confirmed" },
      operationsNote: "Resolved locally.",
    },
  });
  assert.match(updateSql, /insert into clinical_follow_up_operations_events/);
  assert.match(updateSql, /resolved_by_user_id = '10000000-0000-4000-8000-000000000101'::uuid/);
  assert.match(updateSql, /delivery_attempts = delivery_attempts \+ 1/);
  assert.match(updateSql, /"channel":"phone"/);
  assert.doesNotMatch(updateSql, /\bdelete\s+from\b|signed_url|storage_object_path/i);
});

test("builds outcome quality summary and update SQL with append-only quality events", () => {
  const summarySql = buildClinicalFollowUpOutcomeQualitySummarySql({
    clinicIds: [CLINIC_ID],
    now: "2026-05-22T10:00:00.000Z",
  });
  assert.match(summarySql, /closedWithEvidence/);
  assert.match(summarySql, /qualityNeedsAttention/);
  assert.match(summarySql, /resolution_outcome/);
  assert.match(summarySql, /coalesce\(f\.sla_due_at, f\.due_at\) < '2026-05-22T10:00:00.000Z'::timestamptz/);

  const updateSql = buildUpdateClinicalFollowUpQualitySql({
    followUpId: FOLLOW_UP_ID,
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: {
      resolutionOutcome: "patient_reached",
      qualityReviewState: "reviewed",
      qualityReviewNote: "QA ok.",
    },
  });
  assert.match(updateSql, /update clinical_follow_up_tasks f/);
  assert.match(updateSql, /quality_review_state = 'reviewed'/);
  assert.match(updateSql, /insert into clinical_follow_up_quality_events/);
  assert.match(updateSql, /quality\.update/);
  assert.doesNotMatch(updateSql, /\bdelete\s+from\b|signed_url|storage_object_path/i);
});

test("builds retention and clinic review summary and update SQL with append-only review events", () => {
  const summarySql = buildClinicalFollowUpClinicReviewSummarySql({
    clinicIds: [CLINIC_ID],
    now: "2026-05-22T10:00:00.000Z",
  });
  assert.match(summarySql, /retentionDue/);
  assert.match(summarySql, /clinicNeedsPolicyReview/);
  assert.match(summarySql, /clinical_follow_up_retention_review_events/);
  assert.match(summarySql, /interval '30 days'/);

  const updateSql = buildUpdateClinicalFollowUpClinicReviewSql({
    followUpId: FOLLOW_UP_ID,
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: {
      retentionReviewState: "reviewed",
      retentionReviewNote: "Retention ok.",
      clinicReviewState: "completed",
      clinicReviewNote: "Clinic review complete.",
    },
  });
  assert.match(updateSql, /retention_review_state = 'reviewed'/);
  assert.match(updateSql, /clinic_review_state = 'completed'/);
  assert.match(updateSql, /insert into clinical_follow_up_retention_review_events/);
  assert.match(updateSql, /clinic_review\.update/);
  assert.doesNotMatch(updateSql, /\bdelete\s+from\b|signed_url|storage_object_path/i);
});

test("builds SOP validation summary and update SQL with append-only SOP events", () => {
  const summarySql = buildClinicalFollowUpSopValidationSummarySql({
    clinicIds: [CLINIC_ID],
  });
  assert.match(summarySql, /sopRequired/);
  assert.match(summarySql, /sopValidated/);
  assert.match(summarySql, /clinical_follow_up_sop_validation_events/);
  assert.match(summarySql, /clinic_review_state, 'not_scheduled'\) = 'needs_policy_review'/);

  const updateSql = buildUpdateClinicalFollowUpSopValidationSql({
    followUpId: FOLLOW_UP_ID,
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: {
      sopValidationState: "validated",
      sopPolicyVersion: "clinic-local-v1",
      sopExceptionReason: "Policy exception not needed.",
    },
  });
  assert.match(updateSql, /sop_validation_state = 'validated'/);
  assert.match(updateSql, /sop_policy_version = 'clinic-local-v1'/);
  assert.match(updateSql, /insert into clinical_follow_up_sop_validation_events/);
  assert.match(updateSql, /sop_validation\.update/);
  assert.doesNotMatch(updateSql, /\bdelete\s+from\b|signed_url|storage_object_path/i);
});

test("builds SOP policy template summary, list, create, and update SQL with append-only policy events", () => {
  const params = normalizeClinicalFollowUpSopPolicyTemplateParams(new URLSearchParams({
    activeOnly: "true",
    limit: "500",
    offset: "3",
  }));
  assert.equal(params.activeOnly, true);
  assert.equal(params.limit, 100);
  assert.equal(params.offset, 3);

  const summarySql = buildClinicalFollowUpSopPolicyTemplateSummarySql({
    clinicIds: [CLINIC_ID],
  });
  assert.match(summarySql, /totalTemplates/);
  assert.match(summarySql, /clinical_follow_up_sop_policy_template_events/);

  const listSql = buildListClinicalFollowUpSopPolicyTemplatesSql({
    ...params,
    clinicIds: [CLINIC_ID],
  });
  assert.match(listSql, /from clinical_follow_up_sop_policy_templates t/);
  assert.match(listSql, /t\.active is true/);
  assert.match(listSql, /limit 100/);

  const createSql = buildCreateClinicalFollowUpSopPolicyTemplateSql({
    clinicId: CLINIC_ID,
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    payload: {
      code: "followup-standard",
      title: "Follow-up standard SOP",
      version: "clinic-local-v1",
      description: "Local only.",
      appliesTo: { workspace: "visit-follow-up" },
      requiredValidationStates: ["required", "blocked"],
      defaultValidationState: "required",
      exceptionAllowed: true,
      active: true,
    },
  });
  assert.match(createSql, /insert into clinical_follow_up_sop_policy_templates/);
  assert.match(createSql, /insert into clinical_follow_up_sop_policy_template_events/);
  assert.match(createSql, /sop_policy_template\.create/);
  assert.match(createSql, /array\['required', 'blocked'\]::text\[\]/);

  const updateSql = buildUpdateClinicalFollowUpSopPolicyTemplateSql({
    templateId: "10000000-0000-4000-8000-000000000901",
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: { version: "clinic-local-v2", active: false },
  });
  assert.match(updateSql, /update clinical_follow_up_sop_policy_templates t/);
  assert.match(updateSql, /version = 'clinic-local-v2'/);
  assert.match(updateSql, /active = false/);
  assert.match(updateSql, /sop_policy_template\.update/);
  assert.doesNotMatch(updateSql, /\bdelete\s+from\b|signed_url|storage_object_path/i);
});

test("builds SOP policy application summary and update SQL with append-only drift events", () => {
  const summarySql = buildClinicalFollowUpSopPolicyApplicationSummarySql({
    clinicIds: [CLINIC_ID],
  });
  assert.match(summarySql, /active_templates/);
  assert.match(summarySql, /needsPolicyApplication/);
  assert.match(summarySql, /clinical_follow_up_sop_policy_application_events/);

  const updateSql = buildUpdateClinicalFollowUpSopPolicyApplicationSql({
    followUpId: FOLLOW_UP_ID,
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: {
      sopPolicyTemplateId: "10000000-0000-4000-8000-000000000901",
      sopPolicyDriftState: "in_sync",
    },
  });
  assert.match(updateSql, /selected_template/);
  assert.match(updateSql, /sop_policy_template_id = coalesce/);
  assert.match(updateSql, /sop_policy_drift_state = 'in_sync'/);
  assert.match(updateSql, /insert into clinical_follow_up_sop_policy_application_events/);
  assert.match(updateSql, /sop_policy_application\.update/);
  assert.doesNotMatch(updateSql, /\bdelete\s+from\b|signed_url|storage_object_path|external SOP approval/i);
});

test("builds SOP policy exception closure summary and update SQL with append-only exception events", () => {
  const summarySql = buildClinicalFollowUpSopPolicyExceptionClosureSummarySql({
    clinicIds: [CLINIC_ID],
  });
  assert.match(summarySql, /openExceptions/);
  assert.match(summarySql, /unresolvedDrift/);
  assert.match(summarySql, /clinical_follow_up_sop_policy_exception_events/);

  const updateSql = buildUpdateClinicalFollowUpSopPolicyExceptionClosureSql({
    followUpId: FOLLOW_UP_ID,
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: {
      sopPolicyExceptionState: "accepted",
      sopPolicyExceptionReason: "Local exception accepted.",
      sopPolicyExceptionResolution: "Closed inside clinic policy review.",
    },
  });
  assert.match(updateSql, /sop_policy_exception_state = 'accepted'/);
  assert.match(updateSql, /sop_policy_exception_closed_at = now\(\)/);
  assert.match(updateSql, /insert into clinical_follow_up_sop_policy_exception_events/);
  assert.match(updateSql, /sop_policy_exception_closure\.update/);
  assert.doesNotMatch(updateSql, /\bdelete\s+from\b|signed_url|storage_object_path|external SOP approval/i);
});

test("builds SOP policy audit rollup summary and update SQL with append-only audit events", () => {
  const summarySql = buildClinicalFollowUpSopPolicyAuditRollupSummarySql({
    clinicIds: [CLINIC_ID],
  });
  assert.match(summarySql, /auditReady/);
  assert.match(summarySql, /needsAuditReview/);
  assert.match(summarySql, /clinical_follow_up_sop_policy_audit_events/);

  const updateSql = buildUpdateClinicalFollowUpSopPolicyAuditRollupSql({
    followUpId: FOLLOW_UP_ID,
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: {
      sopPolicyAuditState: "reviewed",
      sopPolicyAuditNote: "Local SOP policy audit reviewed.",
    },
  });
  assert.match(updateSql, /sop_policy_audit_state = 'reviewed'/);
  assert.match(updateSql, /sop_policy_audit_reviewed_at = now\(\)/);
  assert.match(updateSql, /insert into clinical_follow_up_sop_policy_audit_events/);
  assert.match(updateSql, /sop_policy_audit_rollup\.update/);
  assert.doesNotMatch(updateSql, /\bdelete\s+from\b|signed_url|storage_object_path|external SOP approval|medical correctness/i);
});

test("builds SOP policy governance readiness summary and update SQL with append-only governance events", () => {
  const summarySql = buildClinicalFollowUpSopPolicyGovernanceReadinessSummarySql({
    clinicIds: [CLINIC_ID],
  });
  assert.match(summarySql, /governanceReady/);
  assert.match(summarySql, /needsGovernanceReview/);
  assert.match(summarySql, /clinical_follow_up_sop_policy_governance_events/);

  const updateSql = buildUpdateClinicalFollowUpSopPolicyGovernanceReadinessSql({
    followUpId: FOLLOW_UP_ID,
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: {
      sopPolicyGovernanceState: "reviewed",
      sopPolicyGovernanceNote: "Local SOP policy governance reviewed.",
    },
  });
  assert.match(updateSql, /sop_policy_governance_state = 'reviewed'/);
  assert.match(updateSql, /sop_policy_governance_reviewed_at = now\(\)/);
  assert.match(updateSql, /insert into clinical_follow_up_sop_policy_governance_events/);
  assert.match(updateSql, /sop_policy_governance_readiness\.update/);
  assert.doesNotMatch(updateSql, /\bdelete\s+from\b|signed_url|storage_object_path|external SOP approval|medical correctness/i);
});

test("repository normalizes operations queue and summary DTOs", async () => {
  const calls = [];
  const repository = createClinicalFollowUpRepository({
    async queryJson(sql) {
      calls.push(sql);
      if (/totalOpen/.test(sql)) {
        return [{ totalOpen: 3, overdue: 1, waitingPatient: 1, escalated: 1, deliveryFailed: 1, deliveryPending: 0 }];
      }
      if (/sopRequired/.test(sql)) {
        return [{ sopRequired: 1, sopValidated: 1, sopExceptions: 0, sopBlocked: 0, localSopEvents: 2 }];
      }
      if (/totalTemplates/.test(sql)) {
        return [{ totalTemplates: 2, activeTemplates: 1, inactiveTemplates: 1, exceptionsAllowed: 1, requiredByDefault: 1, localPolicyEvents: 3 }];
      }
      if (/active_templates/.test(sql)) {
        return [{ totalFollowUps: 3, activeTemplates: 1, appliedTemplates: 1, notChecked: 1, inSync: 1, drifted: 0, missingTemplate: 0, reviewRequired: 1, needsPolicyApplication: 1, localApplicationEvents: 1 }];
      }
      if (/auditReady/.test(sql)) {
        return [{ totalFollowUps: 3, auditReady: 2, needsAuditReview: 1, reviewedAudits: 1, needsFollowUp: 0, unresolvedPolicyDrift: 1, openExceptions: 1, missingPolicyTemplate: 1, localPolicyAuditEvents: 2 }];
      }
      if (/governanceReady/.test(sql)) {
        return [{ totalFollowUps: 3, governanceReady: 1, needsGovernanceReview: 1, reviewedGovernance: 1, governanceNeedsFollowUp: 0, reviewedPolicyAudits: 1, unresolvedPolicyDrift: 1, openExceptions: 0, localGovernanceEvents: 2 }];
      }
      if (/clinical_follow_up_sop_policy_governance_events/.test(sql)) {
        return [{
          id: FOLLOW_UP_ID,
          clinicId: CLINIC_ID,
          patientId: "10000000-0000-4000-8000-000000000201",
          visitId: VISIT_ID,
          dueAt: "2026-05-30T10:00:00.000Z",
          status: "sent",
          priority: "high",
          reason: "Контроль",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyGovernanceState: "reviewed",
          sopPolicyGovernanceNote: "Local SOP policy governance reviewed.",
        }];
      }
      if (/openExceptions/.test(sql)) {
        return [{ totalFollowUps: 3, openExceptions: 1, closedExceptions: 1, acceptedExceptions: 1, rejectedExceptions: 0, unresolvedDrift: 1, unclosedValidationExceptions: 1, closedWithLocalResolution: 1, localExceptionEvents: 2 }];
      }
      if (/clinical_follow_up_sop_policy_audit_events/.test(sql)) {
        return [{
          id: FOLLOW_UP_ID,
          clinicId: CLINIC_ID,
          patientId: "10000000-0000-4000-8000-000000000201",
          visitId: VISIT_ID,
          dueAt: "2026-05-30T10:00:00.000Z",
          status: "sent",
          priority: "high",
          reason: "Контроль",
          sopValidationState: "validated",
          sopPolicyVersion: "clinic-local-v1",
          sopPolicyDriftState: "in_sync",
          sopPolicyExceptionState: "closed",
          sopPolicyAuditState: "reviewed",
          sopPolicyAuditNote: "Local SOP policy audit reviewed.",
        }];
      }
      if (/clinical_follow_up_sop_policy_exception_events/.test(sql)) {
        return [{
          id: FOLLOW_UP_ID,
          clinicId: CLINIC_ID,
          patientId: "10000000-0000-4000-8000-000000000201",
          visitId: VISIT_ID,
          dueAt: "2026-05-30T10:00:00.000Z",
          status: "sent",
          priority: "high",
          reason: "Контроль",
          sopValidationState: "exception",
          sopPolicyVersion: "clinic-local-v1",
          sopPolicyDriftState: "review_required",
          sopPolicyExceptionState: "accepted",
          sopPolicyExceptionReason: "Local exception accepted.",
          sopPolicyExceptionResolution: "Closed inside clinic policy review.",
        }];
      }
      if (/clinical_follow_up_sop_policy_application_events/.test(sql)) {
        return [{
          id: FOLLOW_UP_ID,
          clinicId: CLINIC_ID,
          patientId: "10000000-0000-4000-8000-000000000201",
          visitId: VISIT_ID,
          dueAt: "2026-05-30T10:00:00.000Z",
          status: "sent",
          priority: "high",
          reason: "Контроль",
          sopValidationState: "required",
          sopPolicyVersion: "clinic-local-v1",
          sopPolicyTemplateId: "10000000-0000-4000-8000-000000000901",
          sopPolicyTemplateCode: "followup-standard",
          sopPolicyDriftState: "in_sync",
        }];
      }
      if (/clinical_follow_up_sop_policy_templates/.test(sql)) {
        return [{
          id: "10000000-0000-4000-8000-000000000901",
          clinicId: CLINIC_ID,
          code: "followup-standard",
          title: "Follow-up standard SOP",
          version: "clinic-local-v1",
          description: "Local only.",
          appliesTo: { workspace: "visit-follow-up" },
          requiredValidationStates: ["required", "blocked"],
          defaultValidationState: "required",
          exceptionAllowed: true,
          active: true,
        }];
      }
      return [{
        id: FOLLOW_UP_ID,
        clinicId: CLINIC_ID,
        patientId: "10000000-0000-4000-8000-000000000201",
        visitId: VISIT_ID,
        dueAt: "2026-05-30T10:00:00.000Z",
        status: "sent",
        priority: "high",
        reason: "Контроль",
        triageState: "escalated",
        escalationLevel: "clinic_admin",
        slaDueAt: "2026-05-22T10:00:00.000Z",
        deliveryState: "failed",
        deliveryAttempts: 2,
        deliveryEvidence: { channel: "portal", state: "failed" },
        operationsNote: "Call patient.",
        resolutionOutcome: "clinical_escalation",
        qualityReviewState: "needs_attention",
        qualityReviewNote: "Review escalation.",
        sopValidationState: "required",
        sopPolicyVersion: "clinic-local-v1",
        sopPolicyTemplateId: "10000000-0000-4000-8000-000000000901",
        sopPolicyTemplateCode: "followup-standard",
        sopPolicyDriftState: "in_sync",
        sopPolicyExceptionState: "open",
        sopPolicyExceptionReason: "Local exception opened.",
      }];
    },
  });

  const queue = await repository.listClinicalFollowUpOperations({ clinicIds: [CLINIC_ID] });
  const summary = await repository.getClinicalFollowUpOperationsSummary({ clinicIds: [CLINIC_ID] });
  const outcomes = await repository.getClinicalFollowUpOutcomeQualitySummary({ clinicIds: [CLINIC_ID] });
  const clinicReview = await repository.getClinicalFollowUpClinicReviewSummary({ clinicIds: [CLINIC_ID] });
  const sop = await repository.getClinicalFollowUpSopValidationSummary({ clinicIds: [CLINIC_ID] });
  const policySummary = await repository.getClinicalFollowUpSopPolicyTemplateSummary({ clinicIds: [CLINIC_ID] });
  const applicationSummary = await repository.getClinicalFollowUpSopPolicyApplicationSummary({ clinicIds: [CLINIC_ID] });
  const exceptionSummary = await repository.getClinicalFollowUpSopPolicyExceptionClosureSummary({ clinicIds: [CLINIC_ID] });
  const auditSummary = await repository.getClinicalFollowUpSopPolicyAuditRollupSummary({ clinicIds: [CLINIC_ID] });
  const governanceSummary = await repository.getClinicalFollowUpSopPolicyGovernanceReadinessSummary({ clinicIds: [CLINIC_ID] });
  const policies = await repository.listClinicalFollowUpSopPolicyTemplates({ clinicIds: [CLINIC_ID], activeOnly: true });
  const createdPolicy = await repository.createClinicalFollowUpSopPolicyTemplate({
    clinicId: CLINIC_ID,
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    payload: {
      code: "followup-standard",
      title: "Follow-up standard SOP",
      version: "clinic-local-v1",
      requiredValidationStates: ["required", "blocked"],
      defaultValidationState: "required",
      appliesTo: {},
      exceptionAllowed: true,
      active: true,
    },
  });
  const updatedPolicy = await repository.updateClinicalFollowUpSopPolicyTemplate({
    templateId: "10000000-0000-4000-8000-000000000901",
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: { version: "clinic-local-v2" },
  });
  const updated = await repository.updateClinicalFollowUpOperations({
    followUpId: FOLLOW_UP_ID,
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: { triageState: "resolved" },
  });
  const quality = await repository.updateClinicalFollowUpQuality({
    followUpId: FOLLOW_UP_ID,
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: { qualityReviewState: "reviewed" },
  });
  const review = await repository.updateClinicalFollowUpClinicReview({
    followUpId: FOLLOW_UP_ID,
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: { clinicReviewState: "completed" },
  });
  const sopUpdated = await repository.updateClinicalFollowUpSopValidation({
    followUpId: FOLLOW_UP_ID,
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: { sopValidationState: "validated" },
  });
  const sopApplied = await repository.updateClinicalFollowUpSopPolicyApplication({
    followUpId: FOLLOW_UP_ID,
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: { sopPolicyDriftState: "review_required" },
  });
  const sopExceptionClosed = await repository.updateClinicalFollowUpSopPolicyExceptionClosure({
    followUpId: FOLLOW_UP_ID,
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: {
      sopPolicyExceptionState: "accepted",
      sopPolicyExceptionResolution: "Closed inside clinic policy review.",
    },
  });
  const sopAuditReviewed = await repository.updateClinicalFollowUpSopPolicyAuditRollup({
    followUpId: FOLLOW_UP_ID,
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: {
      sopPolicyAuditState: "reviewed",
      sopPolicyAuditNote: "Local SOP policy audit reviewed.",
    },
  });
  const sopGovernanceReviewed = await repository.updateClinicalFollowUpSopPolicyGovernanceReadiness({
    followUpId: FOLLOW_UP_ID,
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: {
      sopPolicyGovernanceState: "reviewed",
      sopPolicyGovernanceNote: "Local SOP policy governance reviewed.",
    },
  });

  assert.equal(queue.items[0].triageState, "escalated");
  assert.equal(queue.items[0].deliveryAttempts, 2);
  assert.equal(summary.totalOpen, 3);
  assert.equal(summary.deliveryFailed, 1);
  assert.equal(outcomes.qualityNeedsAttention, 0);
  assert.equal(clinicReview.clinicNeedsPolicyReview, 0);
  assert.equal(sop.sopRequired, 1);
  assert.equal(policySummary.activeTemplates, 1);
  assert.equal(applicationSummary.reviewRequired, 1);
  assert.equal(exceptionSummary.openExceptions, 1);
  assert.equal(auditSummary.auditReady, 2);
  assert.equal(auditSummary.needsAuditReview, 1);
  assert.equal(governanceSummary.governanceReady, 1);
  assert.equal(governanceSummary.needsGovernanceReview, 1);
  assert.equal(policies.items[0].code, "followup-standard");
  assert.equal(createdPolicy.version, "clinic-local-v1");
  assert.equal(updatedPolicy.title, "Follow-up standard SOP");
  assert.equal(updated.triageState, "escalated");
  assert.equal(quality.qualityReviewState, "needs_attention");
  assert.equal(review.clinicReviewState, "not_scheduled");
  assert.equal(sopUpdated.sopValidationState, "required");
  assert.equal(sopApplied.sopPolicyDriftState, "in_sync");
  assert.equal(sopExceptionClosed.sopPolicyExceptionState, "accepted");
  assert.equal(sopAuditReviewed.sopPolicyAuditState, "reviewed");
  assert.equal(sopAuditReviewed.sopPolicyAuditNote, "Local SOP policy audit reviewed.");
  assert.equal(sopGovernanceReviewed.sopPolicyGovernanceState, "reviewed");
  assert.equal(sopGovernanceReviewed.sopPolicyGovernanceNote, "Local SOP policy governance reviewed.");
  assert.equal(calls.length, 21);
});
