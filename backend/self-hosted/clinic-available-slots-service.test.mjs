import assert from "node:assert/strict";
import { test } from "node:test";

import { ForbiddenError } from "./rbac.mjs";
import { createClinicAvailableSlotsService } from "./clinic-available-slots-service.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const ACTOR_ID = "10000000-0000-4000-8000-000000000101";

const operatorAuth = {
  userId: ACTOR_ID,
  roles: ["operator"],
  clinicIds: [CLINIC_ID],
};

test("Stage 5R service lists slots and records safe audit metadata", async () => {
  const auditEvents = [];
  const service = createClinicAvailableSlotsService({
    clinicAvailableSlotsRepository: {
      async listAvailableSlots(params) {
        assert.deepEqual(params.clinicIds, [CLINIC_ID]);
        assert.equal(params.sourceSystem, "clinic_crm");
        return {
          items: [{ id: "slot-1", sourceSystem: "clinic_crm", status: "available" }],
          count: 1,
          limit: 20,
          offset: 0,
          filters: { sourceSystem: "clinic_crm", status: "available", dateFrom: null, dateTo: null },
        };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-1" };
      },
    },
  });

  const result = await service.listAvailableSlots(
    operatorAuth,
    { sourceSystem: "clinic_crm" },
    { correlationId: "corr-5r" },
  );

  assert.equal(result.slots.items.length, 1);
  assert.equal(auditEvents[0].action, "clinic_available_slot.list");
  assert.equal(auditEvents[0].metadata.sourceSystem, "clinic_crm");
});

test("Stage 5R service denies doctor-only slot access", async () => {
  const service = createClinicAvailableSlotsService({
    clinicAvailableSlotsRepository: {},
    auditRepository: {},
  });

  await assert.rejects(
    () => service.listAvailableSlots(
      { userId: ACTOR_ID, roles: ["doctor"], clinicIds: [CLINIC_ID] },
      {},
    ),
    ForbiddenError,
  );
});

