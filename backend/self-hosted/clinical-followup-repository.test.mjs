import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCreateClinicalFollowUpMessageSql,
  buildCreateClinicalFollowUpSql,
  buildCreatePatientFollowUpMessageSql,
  buildListClinicalFollowUpsSql,
  buildListPatientFollowUpsSql,
  buildUpdateClinicalFollowUpSql,
  createClinicalFollowUpRepository,
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
