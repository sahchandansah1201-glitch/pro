import assert from "node:assert/strict";
import { test } from "node:test";

import { createAdminManagementRepository } from "./admin-management-repository.mjs";
import { createAdminManagementService } from "./admin-management-service.mjs";
import { createAuditRepository } from "./audit-repository.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const SERVICE_ID = "10000000-0000-4000-8000-000000000501";
const CLINIC_AUTH = {
  userId: "10000000-0000-4000-8000-000000000102",
  roles: ["clinic_admin"],
  clinicIds: [CLINIC_ID],
};

function createService(updateResult) {
  const auditWrites = [];
  const dbClient = {
    async queryJson(sql) {
      if (sql.includes("update clinic_services")) {
        if (updateResult instanceof Error) throw updateResult;
        return updateResult;
      }
      if (sql.includes("insert into audit_log")) {
        auditWrites.push(sql);
        return { id: "audit-result" };
      }
      throw new Error("Unexpected database operation");
    },
  };
  return {
    service: createAdminManagementService({
      adminManagementRepository: createAdminManagementRepository(dbClient),
      auditRepository: createAuditRepository(dbClient),
    }),
    auditWrites,
  };
}

test("a service update without an accessible row returns not found and writes no success audit", async () => {
  const { service, auditWrites } = createService(null);

  await assert.rejects(
    () => service.updateClinicService(SERVICE_ID, { priceMin: 1200, priceMax: 1200 }, CLINIC_AUTH),
    (error) => error.publicStatus === 404 && error.publicCode === "not_found",
  );
  assert.deepEqual(auditWrites, []);
});

test("a successful service update returns the row and writes one success audit", async () => {
  const item = { id: SERVICE_ID, clinicId: CLINIC_ID, priceMin: 1200, priceMax: 1200 };
  const { service, auditWrites } = createService(item);

  const result = await service.updateClinicService(
    SERVICE_ID,
    { priceMin: 1200, priceMax: 1200 },
    CLINIC_AUTH,
    { correlationId: "service-update-success" },
  );

  assert.deepEqual(result.item, item);
  assert.equal(auditWrites.length, 1);
  assert.ok(auditWrites[0].includes("'admin.service.update'"));
  assert.ok(auditWrites[0].includes(`'${SERVICE_ID}'::uuid`));
  assert.ok(auditWrites[0].includes("'service-update-success'"));
});

test("a missing service also returns not found for a system admin without a success audit", async () => {
  const { service, auditWrites } = createService(null);

  await assert.rejects(
    () => service.updateClinicService(
      SERVICE_ID,
      { clinicId: CLINIC_ID, priceMin: 1200, priceMax: 1200 },
      { ...CLINIC_AUTH, roles: ["system_admin"], clinicIds: [] },
    ),
    (error) => error.publicStatus === 404 && error.publicCode === "not_found",
  );
  assert.deepEqual(auditWrites, []);
});

test("a database update failure propagates without a success audit", async () => {
  const databaseError = new Error("Database unavailable");
  const { service, auditWrites } = createService(databaseError);

  await assert.rejects(
    () => service.updateClinicService(SERVICE_ID, { priceMin: 1200, priceMax: 1200 }, CLINIC_AUTH),
    (error) => error === databaseError,
  );
  assert.deepEqual(auditWrites, []);
});
