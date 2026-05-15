import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCountClinicBookingRequestsSql,
  buildGetClinicBookingRequestSql,
  buildListClinicBookingRequestsSql,
  buildUpdateClinicBookingRequestSql,
  normalizeBookingRequestCounts,
  normalizeBookingRequestList,
  normalizeBookingRequestSingle,
} from "./clinic-booking-requests-repository.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const REQ_ID = "10000000-0000-4000-8000-000000000711";
const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const REVIEWER_ID = "10000000-0000-4000-8000-000000000101";

test("Stage 5P SQL lists clinic booking requests with scope and status filter", () => {
  const sql = buildListClinicBookingRequestsSql({
    clinicIds: [CLINIC_ID, "not-a-uuid"],
    status: "requested",
    limit: 25,
    offset: 0,
  });
  assert.match(sql, /from patient_portal_booking_requests br/);
  assert.match(sql, /and br\.clinic_id in \('10000000-0000-4000-8000-000000000001'::uuid\)/);
  assert.match(sql, /and br\.status = 'requested'/);
  assert.match(sql, /limit 25/);
  assert.doesNotMatch(sql, /not-a-uuid/);
  assert.doesNotMatch(sql, /SUPABASE_|api-read|api-write|edge function|signed_url|storage_object_path/i);
});

test("Stage 5P SQL counts booking requests grouped by status", () => {
  const sql = buildCountClinicBookingRequestsSql({
    clinicIds: [CLINIC_ID],
    status: "all",
  });
  assert.match(sql, /count\(\*\) filter \(where br\.status = 'requested'\)/);
  assert.match(sql, /count\(\*\) filter \(where br\.status = 'booked'\)/);
});

test("Stage 5P SQL fetches a single booking request inside scope", () => {
  const sql = buildGetClinicBookingRequestSql({
    bookingRequestId: REQ_ID,
    clinicIds: [CLINIC_ID],
  });
  assert.match(sql, /where br\.id = '10000000-0000-4000-8000-000000000711'::uuid/);
  assert.match(sql, /and br\.clinic_id in/);
});

test("Stage 5P SQL updates booking request and stores assigned visit", () => {
  const sql = buildUpdateClinicBookingRequestSql({
    bookingRequestId: REQ_ID,
    clinicIds: [CLINIC_ID],
    reviewerUserId: REVIEWER_ID,
    status: "booked",
    assignedVisitId: VISIT_ID,
    clinicNote: "Назначили на четверг.",
  });
  assert.match(sql, /update patient_portal_booking_requests br/);
  assert.match(sql, /set status = 'booked'/);
  assert.match(sql, /reviewed_by_user_id = '10000000-0000-4000-8000-000000000101'::uuid/);
  assert.match(sql, /assigned_visit_id = case[\s\S]+'10000000-0000-4000-8000-000000000301'::uuid/);
  assert.match(sql, /'Назначили на четверг\.'/);
});

test("Stage 5P normalizers shape DTOs without leaking sensitive columns", () => {
  const list = normalizeBookingRequestList([
    {
      id: REQ_ID,
      clinicId: CLINIC_ID,
      patientId: "p-1",
      status: "requested",
      preferredFrom: "2026-06-01T10:00:00.000Z",
      reason: "Контроль родинки",
      patientFullName: "Live Patient",
      clinicName: "Live Clinic",
    },
  ]);
  assert.equal(list.length, 1);
  assert.equal(list[0].patient.fullName, "Live Patient");
  assert.equal(list[0].assignedVisitId, null);

  const single = normalizeBookingRequestSingle([{ id: REQ_ID, status: "booked" }]);
  assert.equal(single.id, REQ_ID);
  assert.equal(single.status, "booked");

  const counts = normalizeBookingRequestCounts([
    { total: 5, requested: 2, reviewing: 1, booked: 1, cancelled: 1 },
  ]);
  assert.equal(counts.total, 5);
  assert.equal(counts.requested, 2);
});
