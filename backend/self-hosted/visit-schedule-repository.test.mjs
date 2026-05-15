import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVisitScheduleSql,
  createVisitScheduleRepository,
  normalizeVisitSchedule,
  normalizeVisitScheduleParams,
} from "./visit-schedule-repository.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const DOCTOR_ID = "10000000-0000-4000-8000-000000000101";

test("Stage 5J schedule SQL scopes visits safely and excludes protected storage fields", () => {
  const sql = buildVisitScheduleSql({
    clinicIds: [CLINIC_ID],
    doctorUserId: DOCTOR_ID,
    status: "in_progress",
    dateFrom: "2026-05-01",
    dateTo: "2026-05-31",
    search: "Patient",
    limit: 25,
    offset: 5,
  });

  assert.match(sql, /from visits v/);
  assert.match(sql, /join patients p on p\.id = v\.patient_id and p\.deleted_at is null/);
  assert.match(sql, /v\.clinic_id in \('10000000-0000-4000-8000-000000000001'::uuid\)/);
  assert.match(sql, /v\.doctor_user_id = '10000000-0000-4000-8000-000000000101'::uuid/);
  assert.match(sql, /v\.status = 'in_progress'::visit_status/);
  assert.match(sql, /v\.started_at::date >= '2026-05-01'::date/);
  assert.match(sql, /limit 25/);
  assert.match(sql, /offset 5/);
  assert.doesNotMatch(sql, /object_key|object_bucket|password_hash|access_token|signed_url|storage_object_path/i);
  assert.doesNotMatch(sql, /supabase|api-read|api-write|edge function/i);
});

test("Stage 5J params reject unsafe filters and cap limits", () => {
  const params = normalizeVisitScheduleParams(new URLSearchParams({
    status: "bad",
    dateFrom: "not-date",
    dateTo: "2026-05-31",
    search: "x".repeat(200),
    limit: "999",
    offset: "-10",
  }));

  assert.equal(params.status, "");
  assert.equal(params.dateFrom, "");
  assert.equal(params.dateTo, "2026-05-31");
  assert.equal(params.search.length, 120);
  assert.equal(params.limit, 200);
  assert.equal(params.offset, 0);
});

test("Stage 5J repository normalizes visit schedule result", async () => {
  const repository = createVisitScheduleRepository({
    async queryJson(sql) {
      assert.match(sql, /scoped_visits/);
      return [{
        items: [{
          id: "visit-1",
          clinicId: CLINIC_ID,
          patientId: "patient-1",
          doctorUserId: DOCTOR_ID,
          status: "draft",
          startedAt: "2026-05-15T09:00:00.000Z",
          signedAt: null,
          chiefComplaint: "Контроль",
          patientFullName: "Patient One",
          patientCode: "DP-1",
          clinicSlug: "main",
          clinicName: "Main Clinic",
        }],
        count: 1,
        limit: 50,
        offset: 0,
        filters: { status: "all", dateFrom: null, dateTo: null, search: null },
      }];
    },
  });

  const schedule = await repository.listVisits({ clinicIds: [CLINIC_ID] });
  assert.equal(schedule.items.length, 1);
  assert.equal(schedule.items[0].patient.fullName, "Patient One");
  assert.equal(schedule.items[0].clinic.name, "Main Clinic");
  assert.equal(schedule.count, 1);
});

test("Stage 5J normalizer returns a safe empty schedule by default", () => {
  const schedule = normalizeVisitSchedule(null);
  assert.deepEqual(schedule.items, []);
  assert.equal(schedule.count, 0);
  assert.equal(schedule.filters.status, "all");
});
