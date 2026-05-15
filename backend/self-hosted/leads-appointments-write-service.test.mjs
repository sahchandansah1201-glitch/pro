import assert from "node:assert/strict";
import { test } from "node:test";

import { ForbiddenError } from "./rbac.mjs";
import {
  LeadAppointmentValidationError,
  createLeadsAppointmentsWriteService,
  normalizeBookLeadAppointmentPayload,
  normalizeCreateLeadPayload,
} from "./leads-appointments-write-service.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const PATIENT_ID = "10000000-0000-4000-8000-000000000201";
const DOCTOR_ID = "10000000-0000-4000-8000-000000000101";
const LEAD_ID = "10000000-0000-4000-8000-000000000501";
const VISIT_ID = "10000000-0000-4000-8000-000000000301";

const operatorAuth = {
  userId: DOCTOR_ID,
  roles: ["operator"],
  clinicIds: [CLINIC_ID],
};

function createService({ repositoryOverrides = {}, auditEvents = [] } = {}) {
  const lead = {
    id: LEAD_ID,
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    source: "site",
    status: "new",
    safeSummary: "Screening",
    patient: { id: PATIENT_ID, fullName: "Live Patient", code: "DP-LIVE" },
    clinic: { id: CLINIC_ID, name: "Live Clinic" },
  };
  const appointment = {
    id: VISIT_ID,
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    doctorUserId: DOCTOR_ID,
    status: "planned",
    patient: { id: PATIENT_ID, fullName: "Live Patient" },
    clinic: { id: CLINIC_ID, name: "Live Clinic" },
  };
  return createLeadsAppointmentsWriteService({
    leadsAppointmentsWriteRepository: {
      async createLead() {
        return lead;
      },
      async updateLeadStatus(_params) {
        return { ...lead, status: _params.status };
      },
      async bookLeadAppointment() {
        return { lead: { ...lead, status: "booked" }, appointment };
      },
      ...repositoryOverrides,
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-1" };
      },
    },
  });
}

test("Stage 5L normalizers validate lead and booking payloads", () => {
  assert.deepEqual(normalizeCreateLeadPayload({ source: "site", safeSummary: "New patient" }), {
    clinicId: null,
    patientId: null,
    source: "site",
    safeSummary: "New patient",
  });
  assert.throws(
    () => normalizeCreateLeadPayload({ source: "crm", safeSummary: "" }),
    LeadAppointmentValidationError,
  );
  assert.equal(
    normalizeBookLeadAppointmentPayload(
      { startedAt: "2026-05-20T09:00:00.000Z" },
      { userId: DOCTOR_ID, roles: ["doctor"] },
    ).doctorUserId,
    DOCTOR_ID,
  );
  assert.throws(
    () => normalizeBookLeadAppointmentPayload({ startedAt: "not-a-date" }, operatorAuth),
    LeadAppointmentValidationError,
  );
});

test("Stage 5L service creates lead, updates status, books appointment and audits", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const created = await service.createLead(
    { source: "site", safeSummary: "New screening lead" },
    operatorAuth,
    { correlationId: "corr-5l" },
  );
  assert.equal(created.lead.id, LEAD_ID);

  const qualified = await service.updateLeadStatus(
    LEAD_ID,
    { status: "qualified" },
    operatorAuth,
    { correlationId: "corr-5l" },
  );
  assert.equal(qualified.lead.status, "qualified");

  const booked = await service.bookLeadAppointment(
    LEAD_ID,
    { patientId: PATIENT_ID, doctorUserId: DOCTOR_ID, startedAt: "2026-05-20T09:00:00.000Z" },
    operatorAuth,
    { correlationId: "corr-5l" },
  );
  assert.equal(booked.appointment.id, VISIT_ID);
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    ["lead.create", "lead.status.update", "lead.appointment.book"],
  );
});

test("Stage 5L service rejects roles without write access and missing leads", async () => {
  const service = createService({
    repositoryOverrides: {
      async updateLeadStatus() {
        return null;
      },
    },
  });

  assert.rejects(
    () => service.createLead(
      { source: "operator", safeSummary: "Nope" },
      { userId: "assistant", roles: ["assistant"], clinicIds: [CLINIC_ID] },
    ),
    ForbiddenError,
  );
  await assert.rejects(
    () => service.updateLeadStatus(LEAD_ID, { status: "lost" }, operatorAuth),
    /Lead was not found/,
  );
});
