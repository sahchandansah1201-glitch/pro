import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildLeadsAppointmentsSql,
  normalizeLeadsAppointments,
  normalizeLeadsAppointmentsParams,
} from "./leads-appointments-repository.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const DOCTOR_ID = "10000000-0000-4000-8000-000000000101";

test("Stage 5K SQL reads leads and visit-derived appointments safely", () => {
  const sql = buildLeadsAppointmentsSql({
    clinicIds: [CLINIC_ID],
    doctorUserId: DOCTOR_ID,
    leadStatus: "qualified",
    appointmentStatus: "planned",
    dateFrom: "2026-05-01",
    dateTo: "2026-05-31",
    search: "Live",
    limit: 9,
  });

  assert.match(sql, /from leads l/);
  assert.match(sql, /from visits v/);
  assert.match(sql, /l\.clinic_id in/);
  assert.match(sql, /v\.doctor_user_id = '10000000-0000-4000-8000-000000000101'::uuid/);
  assert.match(sql, /l\.status = 'qualified'/);
  assert.match(sql, /'planned'/);
  assert.match(sql, /limit 9/);
  assert.doesNotMatch(sql, /object_bucket|object_key|storage_object_path|signed_url|access_token|SUPABASE_/i);
});

test("Stage 5K params reject unsupported filters and cap limit", () => {
  const params = normalizeLeadsAppointmentsParams(
    new URLSearchParams({
      leadStatus: "DROP TABLE leads",
      appointmentStatus: "unknown",
      dateFrom: "bad-date",
      dateTo: "2026-05-31",
      search: "x".repeat(160),
      limit: "999",
    }),
  );

  assert.equal(params.leadStatus, "");
  assert.equal(params.appointmentStatus, "");
  assert.equal(params.dateFrom, "");
  assert.equal(params.dateTo, "2026-05-31");
  assert.equal(params.search.length, 120);
  assert.equal(params.limit, 20);
});

test("Stage 5K normalizer returns safe overview defaults and rows", () => {
  const overview = normalizeLeadsAppointments({
    kpis: {
      leadsTotal: "2",
      newLeads: 1,
      qualifiedLeads: 1,
      bookedLeads: 0,
      plannedAppointments: "3",
      completedAppointments: 4,
    },
    leads: [{
      id: "lead-1",
      clinicId: CLINIC_ID,
      patientId: null,
      source: "site",
      status: "new",
      safeSummary: "Новая заявка",
      createdAt: "2026-05-15T08:00:00.000Z",
      patientFullName: null,
      patientCode: null,
      clinicName: "Live Clinic",
    }],
    appointments: [{
      id: "visit-1",
      visitId: "visit-1",
      clinicId: CLINIC_ID,
      patientId: "patient-1",
      status: "planned",
      channel: "self_hosted",
      slotAt: "2026-05-15T10:00:00.000Z",
      patientFullName: "Live Patient",
      patientCode: "DP-1",
      clinicName: "Live Clinic",
    }],
  });

  assert.equal(overview.kpis.leadsTotal, 2);
  assert.equal(overview.kpis.plannedAppointments, 3);
  assert.equal(overview.leads[0].safeSummary, "Новая заявка");
  assert.equal(overview.appointments[0].patient.fullName, "Live Patient");
  assert.equal(normalizeLeadsAppointments(null).leads.length, 0);
});
