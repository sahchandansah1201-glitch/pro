import test from "node:test";
import assert from "node:assert/strict";

import { createVisitScheduleService } from "./visit-schedule-service.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000101";

function authContext(role = "doctor") {
  return {
    userId: USER_ID,
    roles: [role],
    clinicIds: [CLINIC_ID],
  };
}

test("Stage 5J service lists doctor-scoped schedule and audits read", async () => {
  const repositoryCalls = [];
  const auditEvents = [];
  const service = createVisitScheduleService({
    visitScheduleRepository: {
      async listVisits(params) {
        repositoryCalls.push(params);
        return {
          items: [{ id: "visit-1" }],
          count: 1,
          limit: 50,
          offset: 0,
          filters: { status: "draft" },
        };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
      },
    },
  });

  const result = await service.listVisits(
    authContext("doctor"),
    { status: "draft" },
    { correlationId: "corr-5j" },
  );
  assert.equal(result.schedule.items.length, 1);
  assert.equal(repositoryCalls[0].doctorUserId, USER_ID);
  assert.deepEqual(repositoryCalls[0].clinicIds, [CLINIC_ID]);
  assert.equal(auditEvents[0].action, "visit.schedule.list");
  assert.equal(auditEvents[0].entityType, "visit");
  assert.equal(auditEvents[0].correlationId, "corr-5j");
});

test("Stage 5J service lets clinic_admin see clinic schedule without doctor filter", async () => {
  let paramsSeen = null;
  const service = createVisitScheduleService({
    visitScheduleRepository: {
      async listVisits(params) {
        paramsSeen = params;
        return { items: [], count: 0, limit: 50, offset: 0, filters: { status: "all" } };
      },
    },
    auditRepository: { async recordEvent() {} },
  });

  await service.listVisits(authContext("clinic_admin"), {}, { correlationId: "corr-admin" });
  assert.equal(paramsSeen.doctorUserId, null);
  assert.deepEqual(paramsSeen.clinicIds, [CLINIC_ID]);
});

test("Stage 5J service denies roles without visit read access", async () => {
  const service = createVisitScheduleService({
    visitScheduleRepository: { async listVisits() { return {}; } },
    auditRepository: { async recordEvent() {} },
  });

  await assert.rejects(
    () => service.listVisits(authContext("operator"), {}, { correlationId: "corr-deny" }),
    /access|role|resource/i,
  );
});
