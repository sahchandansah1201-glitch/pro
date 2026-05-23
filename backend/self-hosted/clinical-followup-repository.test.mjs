import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCreateClinicalFollowUpMessageSql,
  buildCreateClinicalFollowUpSql,
  buildCreatePatientFollowUpMessageSql,
  buildClinicalFollowUpClinicReviewSummarySql,
  buildClinicalFollowUpOutcomeQualitySummarySql,
  buildClinicalFollowUpOperationsSummarySql,
  buildClinicalFollowUpSopValidationSummarySql,
  buildListClinicalFollowUpsSql,
  buildListClinicalFollowUpOperationsSql,
  buildListPatientFollowUpsSql,
  buildUpdateClinicalFollowUpOperationsSql,
  buildUpdateClinicalFollowUpClinicReviewSql,
  buildUpdateClinicalFollowUpQualitySql,
  buildUpdateClinicalFollowUpSopValidationSql,
  buildUpdateClinicalFollowUpSql,
  createClinicalFollowUpRepository,
  normalizeClinicalFollowUpOperationsParams,
  normalizeClinicalFollowUpParams,
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
      }];
    },
  });

  const queue = await repository.listClinicalFollowUpOperations({ clinicIds: [CLINIC_ID] });
  const summary = await repository.getClinicalFollowUpOperationsSummary({ clinicIds: [CLINIC_ID] });
  const outcomes = await repository.getClinicalFollowUpOutcomeQualitySummary({ clinicIds: [CLINIC_ID] });
  const clinicReview = await repository.getClinicalFollowUpClinicReviewSummary({ clinicIds: [CLINIC_ID] });
  const sop = await repository.getClinicalFollowUpSopValidationSummary({ clinicIds: [CLINIC_ID] });
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

  assert.equal(queue.items[0].triageState, "escalated");
  assert.equal(queue.items[0].deliveryAttempts, 2);
  assert.equal(summary.totalOpen, 3);
  assert.equal(summary.deliveryFailed, 1);
  assert.equal(outcomes.qualityNeedsAttention, 0);
  assert.equal(clinicReview.clinicNeedsPolicyReview, 0);
  assert.equal(sop.sopRequired, 1);
  assert.equal(updated.triageState, "escalated");
  assert.equal(quality.qualityReviewState, "needs_attention");
  assert.equal(review.clinicReviewState, "not_scheduled");
  assert.equal(sopUpdated.sopValidationState, "required");
  assert.equal(calls.length, 9);
});
