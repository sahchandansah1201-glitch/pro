import assert from "node:assert/strict";
import { test } from "node:test";

import { ForbiddenError } from "./rbac.mjs";
import { createLeadsAppointmentsService } from "./leads-appointments-service.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";

test("Stage 5K service reads overview with doctor-scoped appointments and audit", async () => {
  const calls = [];
  const auditEvents = [];
  const service = createLeadsAppointmentsService({
    leadsAppointmentsRepository: {
      async getOverview(params) {
        calls.push(params);
        return {
          kpis: {
            leadsTotal: 2,
            newLeads: 1,
            qualifiedLeads: 1,
            bookedLeads: 0,
            plannedAppointments: 3,
            completedAppointments: 1,
          },
          leads: [{ id: "lead-1" }],
          appointments: [{ id: "visit-1" }],
          filters: { leadStatus: "all", appointmentStatus: "all", dateFrom: null, dateTo: null, search: null },
        };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
      },
    },
  });

  const result = await service.getOverview(
    {
      userId: "10000000-0000-4000-8000-000000000101",
      roles: ["doctor"],
      clinicIds: [CLINIC_ID],
    },
    { limit: 5 },
    { correlationId: "corr-5k" },
  );

  assert.equal(result.overview.kpis.leadsTotal, 2);
  assert.equal(calls[0].doctorUserId, "10000000-0000-4000-8000-000000000101");
  assert.deepEqual(calls[0].clinicIds, [CLINIC_ID]);
  assert.equal(auditEvents[0].action, "leads.appointments.overview.read");
  assert.equal(auditEvents[0].entityType, "lead_appointment_overview");
  assert.equal(auditEvents[0].metadata.leads, 1);
});

test("Stage 5K service lets operators read clinic overview without doctor filter", async () => {
  let paramsSeen = null;
  const service = createLeadsAppointmentsService({
    leadsAppointmentsRepository: {
      async getOverview(params) {
        paramsSeen = params;
        return {
          kpis: {},
          leads: [],
          appointments: [],
          filters: { leadStatus: "all", appointmentStatus: "all" },
        };
      },
    },
    auditRepository: { async recordEvent() {} },
  });

  await service.getOverview({
    userId: "operator-1",
    roles: ["operator"],
    clinicIds: [CLINIC_ID],
  });

  assert.equal(paramsSeen.doctorUserId, null);
  assert.deepEqual(paramsSeen.clinicIds, [CLINIC_ID]);
});

test("Stage 5K service denies roles without leads/appointments read access", async () => {
  const service = createLeadsAppointmentsService({
    leadsAppointmentsRepository: { async getOverview() { throw new Error("should not run"); } },
    auditRepository: { async recordEvent() {} },
  });

  await assert.rejects(
    () => service.getOverview({ userId: "assistant-1", roles: ["assistant"], clinicIds: [CLINIC_ID] }),
    ForbiddenError,
  );
});
