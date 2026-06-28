import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildBookLeadAppointmentSql,
  buildCreateLeadSql,
  buildUpdateLeadStatusSql,
  normalizeLeadBooking,
  normalizeLeadMutation,
} from "./leads-appointments-write-repository.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const PATIENT_ID = "10000000-0000-4000-8000-000000000201";
const DOCTOR_ID = "10000000-0000-4000-8000-000000000101";
const LEAD_ID = "10000000-0000-4000-8000-000000000501";

function assertNoNestedDataModifyingCte(sql) {
  assert.doesNotMatch(sql, /from\s*\(\s*with\s+(inserted|updated|selected_lead)\s+as\s*\(/i);
}

test("Stage 5L SQL creates leads safely in local PostgreSQL", () => {
  const sql = buildCreateLeadSql({
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    source: "site",
    safeSummary: "Patient asked for screening",
    actorUserId: DOCTOR_ID,
  });

  assert.match(sql, /^with inserted as \(\s*insert into leads/i);
  assert.match(sql, /insert into leads/i);
  assert.match(sql, /'site'/);
  assert.match(sql, /'Patient asked for screening'/);
  assert.match(sql, /left join patients p/);
  assertNoNestedDataModifyingCte(sql);
  assert.doesNotMatch(sql, /SUPABASE_|api-read|api-write|edge function|storage_object_path|signed_url/i);
});

test("Stage 5L SQL updates lead status inside clinic scope", () => {
  const sql = buildUpdateLeadStatusSql({
    leadId: LEAD_ID,
    status: "qualified",
    clinicIds: [CLINIC_ID, "not-a-uuid"],
  });

  assert.match(sql, /^with updated as \(\s*update leads l/i);
  assert.match(sql, /update leads l/i);
  assert.match(sql, /set status = 'qualified'/);
  assert.match(sql, /and l\.clinic_id in \('10000000-0000-4000-8000-000000000001'::uuid\)/);
  assertNoNestedDataModifyingCte(sql);
  assert.doesNotMatch(sql, /not-a-uuid/);
});

test("Stage 5L SQL books a lead by updating it and inserting a visit", () => {
  const sql = buildBookLeadAppointmentSql({
    leadId: LEAD_ID,
    clinicIds: [CLINIC_ID],
    patientId: PATIENT_ID,
    doctorUserId: DOCTOR_ID,
    startedAt: "2026-05-20T09:00:00.000Z",
    chiefComplaint: "Screening visit",
  });

  assert.match(sql, /^with selected_lead as \(/i);
  assert.match(sql, /booked_lead as/i);
  assert.match(sql, /insert into visits/i);
  assert.match(sql, /'draft'::visit_status/);
  assert.match(sql, /'2026-05-20T09:00:00.000Z'::timestamptz/);
  assertNoNestedDataModifyingCte(sql);
});

test("Stage 5L normalizers return safe lead and booking DTOs", () => {
  const lead = normalizeLeadMutation([{
    id: LEAD_ID,
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    source: "site",
    status: "new",
    safeSummary: "Screening",
    patientFullName: "Live Patient",
    patientCode: "DP-LIVE",
    clinicName: "Live Clinic",
  }]);
  assert.equal(lead.id, LEAD_ID);
  assert.equal(lead.patient.fullName, "Live Patient");

  const booking = normalizeLeadBooking({
    lead: { ...lead, patientFullName: "Live Patient", clinicName: "Live Clinic" },
    appointment: {
      id: "10000000-0000-4000-8000-000000000301",
      visitId: "10000000-0000-4000-8000-000000000301",
      patientId: PATIENT_ID,
      doctorUserId: DOCTOR_ID,
      status: "planned",
      patientFullName: "Live Patient",
      clinicName: "Live Clinic",
    },
  });
  assert.equal(booking.lead.id, LEAD_ID);
  assert.equal(booking.appointment.visitId, "10000000-0000-4000-8000-000000000301");
});
