import assert from "node:assert/strict";
import { test } from "node:test";

import { createAdminManagementService } from "./admin-management-service.mjs";

const SYSTEM_AUTH = {
  userId: "10000000-0000-4000-8000-000000000101",
  roles: ["system_admin"],
  clinicIds: [],
};

const CLINIC_AUTH = {
  userId: "10000000-0000-4000-8000-000000000102",
  roles: ["clinic_admin"],
  clinicIds: ["10000000-0000-4000-8000-000000000001"],
};

function createService({ calls = [] } = {}) {
  const repository = {
    async listUsers(params) {
      calls.push(["listUsers", params]);
      return [];
    },
    async createUser(params) {
      calls.push(["createUser", { ...params, passwordHash: params.passwordHash ? "[hash]" : "" }]);
      return { id: "10000000-0000-4000-8000-000000000201", displayName: params.displayName, email: params.email };
    },
    async assignUserRole(params) {
      calls.push(["assignUserRole", params]);
      return { id: params.userId, assignedRole: params.role };
    },
    async disableUser(params) {
      calls.push(["disableUser", params]);
      return { id: params.userId, disabledAt: "2026-06-22T00:00:00.000Z" };
    },
    async listClinics(params) {
      calls.push(["listClinics", params]);
      return [];
    },
    async createClinic(params) {
      calls.push(["createClinic", params]);
      return { id: "10000000-0000-4000-8000-000000000301", ...params };
    },
    async updateClinic(params) {
      calls.push(["updateClinic", params]);
      return { id: params.clinicId, name: params.name };
    },
    async getAnalytics(params) {
      calls.push(["getAnalytics", params]);
      return {
        clinics: 1,
        activeUsers: 2,
        doctors: 1,
        patients: 0,
        visits: 0,
        photos: 0,
        signedReports: 0,
        auditEvents7d: 1,
      };
    },
    async listAuditEvents(params) {
      calls.push(["listAuditEvents", params]);
      return [{ id: "audit-1", action: "admin.user.create" }];
    },
  };
  const auditEvents = [];
  const auditRepository = {
    async recordEvent(event) {
      auditEvents.push(event);
      return { id: `audit-${auditEvents.length}` };
    },
  };
  return {
    service: createAdminManagementService({
      adminManagementRepository: repository,
      auditRepository,
    }),
    calls,
    auditEvents,
  };
}

test("system admin creates clinic admins and private doctors with hashed passwords and audit", async () => {
  const { service, calls, auditEvents } = createService();
  const result = await service.createUser(
    {
      email: "doctor@example.test",
      displayName: "Петров Пётр Петрович",
      password: "long-password-1",
      role: "private_doctor",
      clinicId: "10000000-0000-4000-8000-000000000001",
    },
    SYSTEM_AUTH,
    { correlationId: "test" },
  );

  assert.equal(result.item.displayName, "Петров Пётр Петрович");
  assert.deepEqual(calls[0], [
    "createUser",
    {
      email: "doctor@example.test",
      displayName: "Петров Пётр Петрович",
      password: "long-password-1",
      role: "private_doctor",
      clinicId: "10000000-0000-4000-8000-000000000001",
      passwordHash: "[hash]",
    },
  ]);
  assert.equal(auditEvents[0].action, "admin.user.create");
  assert.equal(auditEvents[0].metadata.passwordStoredAsHash, true);
});

test("clinic admin cannot assign system roles or outside clinic roles", async () => {
  const { service } = createService();
  await assert.rejects(
    () =>
      service.createUser(
        {
          email: "root@example.test",
          displayName: "Root User",
          password: "long-password-1",
          role: "system_admin",
        },
        CLINIC_AUTH,
        { correlationId: "test" },
      ),
    /validation/i,
  );

  await assert.rejects(
    () =>
      service.createUser(
        {
          email: "doctor@example.test",
          displayName: "Doctor User",
          password: "long-password-1",
          role: "doctor",
          clinicId: "10000000-0000-4000-8000-000000000099",
        },
        CLINIC_AUTH,
        { correlationId: "test" },
      ),
    /outside/i,
  );
});

test("analytics returns aggregate counters and audit events only", async () => {
  const { service } = createService();
  const result = await service.getAnalytics(SYSTEM_AUTH, { correlationId: "test" });
  assert.equal(result.item.clinics, 1);
  assert.equal(result.item.patients, 0);
  assert.deepEqual(result.item.recentAuditEvents, [{ id: "audit-1", action: "admin.user.create" }]);
  assert.equal(JSON.stringify(result).includes("patientName"), false);
});
