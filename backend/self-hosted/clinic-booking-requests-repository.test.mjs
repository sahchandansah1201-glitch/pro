import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildClinicBookingRequestDetailSql,
  buildClinicBookingRequestsSql,
  buildBookClinicBookingRequestFromSlotSql,
  buildUpdateClinicBookingRequestSql,
  createClinicBookingRequestsRepository,
  normalizeClinicBookingRequest,
  normalizeClinicBookingRequestParams,
} from "./clinic-booking-requests-repository.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const REQUEST_ID = "10000000-0000-4000-8000-000000000501";
const USER_ID = "10000000-0000-4000-8000-000000000101";
const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const SLOT_ID = "10000000-0000-4000-8000-000000000701";

test("Stage 5P repository builds scoped list SQL with filters and pagination", () => {
  const sql = buildClinicBookingRequestsSql({
    clinicIds: [CLINIC_ID],
    status: "requested",
    search: "контроль",
    limit: 10,
    offset: 20,
  });

  assert.match(sql, /patient_portal_booking_requests br/);
  assert.match(sql, /br\.clinic_id in/);
  assert.match(sql, /br\.status = 'requested'/);
  assert.match(sql, /ilike '%контроль%'/);
  assert.match(sql, /limit 10/);
  assert.match(sql, /offset 20/);
  assert.doesNotMatch(sql, /supabase|api-read|api-write|edge function|SUPABASE_/i);
});

test("Stage 5P repository builds detail and update SQL without physical deletion", () => {
  const detailSql = buildClinicBookingRequestDetailSql({
    requestId: REQUEST_ID,
    clinicIds: [CLINIC_ID],
  });
  assert.match(detailSql, new RegExp(REQUEST_ID));
  assert.match(detailSql, /row_to_json/);

  const updateSql = buildUpdateClinicBookingRequestSql({
    requestId: REQUEST_ID,
    status: "booked",
    clinicNote: "Подтверждено клиникой",
    assignedVisitId: VISIT_ID,
    reviewedByUserId: USER_ID,
    clinicIds: [CLINIC_ID],
  });
  assert.match(updateSql, /update patient_portal_booking_requests/);
  assert.match(updateSql, /reviewed_at = now\(\)/);
  assert.match(updateSql, /status = 'booked'/);
  assert.match(updateSql, new RegExp(VISIT_ID));
  assert.doesNotMatch(updateSql, /\bdelete\s+from\b/i);
});

test("Stage 5P repository normalizes query params and DTOs", () => {
  const params = normalizeClinicBookingRequestParams(
    new URLSearchParams("status=bad&search=abcdefghijklmnopqrstuvwxyz&limit=999&offset=4"),
  );
  assert.equal(params.status, "all");
  assert.equal(params.search, "abcdefghijklmnopqrstuvwxyz");
  assert.equal(params.limit, 100);
  assert.equal(params.offset, 4);

  const dto = normalizeClinicBookingRequest({
    id: REQUEST_ID,
    clinicId: CLINIC_ID,
    patientId: "10000000-0000-4000-8000-000000000201",
    status: "reviewing",
    patientFullName: "Пациент",
    patientCode: "DP-1",
    clinicName: "Clinic",
    assignedVisitId: VISIT_ID,
  });
  assert.equal(dto.id, REQUEST_ID);
  assert.equal(dto.patient.code, "DP-1");
  assert.equal(dto.assignedVisit.id, VISIT_ID);
});

test("Stage 5S repository builds atomic slot confirmation SQL", () => {
  const sql = buildBookClinicBookingRequestFromSlotSql({
    requestId: REQUEST_ID,
    slotId: SLOT_ID,
    clinicNote: "Подтверждено из локального окна",
    reviewedByUserId: USER_ID,
    clinicIds: [CLINIC_ID],
  });

  assert.match(sql, /selected_request/);
  assert.match(sql, /clinic_available_slots/);
  assert.match(sql, /s\.status = 'available'/);
  assert.match(sql, /set status = 'booked'/);
  assert.match(sql, /insert into visits/);
  assert.match(sql, /'draft'::visit_status/);
  assert.match(sql, /update patient_portal_booking_requests/);
  assert.match(sql, /assigned_visit_id = iv\.id/);
  assert.match(sql, new RegExp(SLOT_ID));
  assert.doesNotMatch(sql, /\bdelete\s+from\b|supabase|api-read|api-write|edge function|SUPABASE_/i);
});

test("Stage 5P/5S repository executes list/detail/update/book through queryJson", async () => {
  const calls = [];
  const repository = createClinicBookingRequestsRepository({
    async queryJson(sql) {
      calls.push(sql);
      if (sql.includes("jsonb_build_object")) {
        return [{
          items: [{ id: REQUEST_ID, clinicId: CLINIC_ID, status: "requested" }],
          count: 1,
          limit: 25,
          offset: 0,
          filters: { status: "all" },
        }];
      }
      return [{ id: REQUEST_ID, clinicId: CLINIC_ID, status: "reviewing" }];
    },
  });

  const list = await repository.listBookingRequests({ allClinics: true });
  const detail = await repository.getBookingRequest({ requestId: REQUEST_ID, allClinics: true });
  const updated = await repository.updateBookingRequest({
    requestId: REQUEST_ID,
    status: "reviewing",
    reviewedByUserId: USER_ID,
    allClinics: true,
  });
  const booked = await repository.bookBookingRequestFromSlot({
    requestId: REQUEST_ID,
    slotId: SLOT_ID,
    reviewedByUserId: USER_ID,
    allClinics: true,
  });

  assert.equal(list.count, 1);
  assert.equal(detail.status, "reviewing");
  assert.equal(updated.id, REQUEST_ID);
  assert.equal(booked.id, REQUEST_ID);
  assert.equal(calls.length, 4);
});
