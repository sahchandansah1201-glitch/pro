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
    async reactivateUser(params) {
      calls.push(["reactivateUser", params]);
      return { id: params.userId, disabledAt: null, active: true };
    },
    async setUserRoleStatus(params) {
      calls.push(["setUserRoleStatus", params]);
      return { id: params.userId, role: params.role, clinicId: params.clinicId, status: params.status };
    },
    async listClinics(params) {
      calls.push(["listClinics", params]);
      return [];
    },
    async createClinic(params) {
      calls.push(["createClinic", params]);
      return { id: "10000000-0000-4000-8000-000000000301", ...params };
    },
    async createPrivatePractice(params) {
      calls.push(["createPrivatePractice", { ...params, ownerPasswordHash: params.ownerPasswordHash ? "[hash]" : "" }]);
      return {
        clinic: {
          id: "10000000-0000-4000-8000-000000000301",
          name: params.name,
          slug: params.slug,
          timezone: params.timezone,
        },
        owner: {
          id: "10000000-0000-4000-8000-000000000201",
          email: params.ownerEmail,
          displayName: params.ownerDisplayName,
          active: true,
          roles: [
            {
              role: "clinic_admin",
              clinicId: "10000000-0000-4000-8000-000000000301",
              clinicName: params.name,
              clinicSlug: params.slug,
            },
            {
              role: "private_doctor",
              clinicId: "10000000-0000-4000-8000-000000000301",
              clinicName: params.name,
              clinicSlug: params.slug,
            },
          ],
        },
      };
    },
    async updateClinic(params) {
      calls.push(["updateClinic", params]);
      return { id: params.clinicId, name: params.name };
    },
    async setClinicStatus(params) {
      calls.push(["setClinicStatus", params]);
      return { id: params.clinicId, status: params.status, statusReason: params.reason };
    },
    async deleteEmptyClinic(params) {
      calls.push(["deleteEmptyClinic", params]);
      return { id: params.clinicId, deleted: true, blockerCount: 0, blockers: {} };
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

test("system admin creates private practice with one owner carrying clinic admin and private doctor roles", async () => {
  const { service, calls, auditEvents } = createService();
  const result = await service.createPrivatePractice(
    {
      clinicName: "Кабинет Морозова",
      address: "Краснодар, ул. Северная, 11",
      slug: "morozov-cabinet",
      timezone: "Europe/Moscow",
      ownerEmail: "morozov@example.test",
      ownerDisplayName: "Морозов Дмитрий Игоревич",
      ownerPassword: "long-password-1",
    },
    SYSTEM_AUTH,
    { correlationId: "test" },
  );

  assert.equal(result.item.clinic.name, "Кабинет Морозова");
  assert.deepEqual(result.item.owner.roles.map((role) => role.role), ["clinic_admin", "private_doctor"]);
  assert.deepEqual(calls[0], [
    "createPrivatePractice",
    {
      name: "Кабинет Морозова",
      address: "Краснодар, ул. Северная, 11",
      slug: "morozov-cabinet",
      timezone: "Europe/Moscow",
      ownerEmail: "morozov@example.test",
      ownerDisplayName: "Морозов Дмитрий Игоревич",
      ownerPasswordHash: "[hash]",
    },
  ]);
  assert.equal(auditEvents[0].action, "admin.private_practice.create");
  assert.equal(auditEvents[0].metadata.ownerRoleCount, 2);
  assert.equal(auditEvents[0].metadata.passwordStoredAsHash, true);
  assert.equal(JSON.stringify(result).includes("long-password-1"), false);
});

test("system admin creates clinic from Russian name and human address without manual slug", async () => {
  const { service, calls, auditEvents } = createService();
  const result = await service.createClinic(
    {
      name: "Яблоко ООО",
      address: "70-я октября, Краснодар",
      timezone: "Europe/Moscow",
    },
    SYSTEM_AUTH,
    { correlationId: "test" },
  );

  assert.equal(result.item.name, "Яблоко ООО");
  assert.equal(result.item.address, "70-я октября, Краснодар");
  assert.deepEqual(calls[0], [
    "createClinic",
    {
      name: "Яблоко ООО",
      address: "70-я октября, Краснодар",
      slug: "yabloko-ooo",
      timezone: "Europe/Moscow",
    },
  ]);
  assert.equal(auditEvents[0].action, "admin.clinic.create");
});

test("system admin updates clinic address and timezone", async () => {
  const { service, calls } = createService();
  const result = await service.updateClinic(
    "10000000-0000-4000-8000-000000000001",
    {
      name: "Яблоко ООО",
      address: "ул. Северная, 11, Краснодар",
      timezone: "Europe/Moscow",
    },
    SYSTEM_AUTH,
    { correlationId: "test" },
  );

  assert.equal(result.item.name, "Яблоко ООО");
  assert.deepEqual(calls[0], [
    "updateClinic",
    {
      clinicId: "10000000-0000-4000-8000-000000000001",
      name: "Яблоко ООО",
      address: "ул. Северная, 11, Краснодар",
      slug: "yabloko-ooo",
      timezone: "Europe/Moscow",
    },
  ]);
});

test("system admin suspends, reactivates, and archives clinics with audit", async () => {
  const { service, calls, auditEvents } = createService();
  const result = await service.setClinicStatus(
    "10000000-0000-4000-8000-000000000001",
    {
      status: "suspended",
      reason: "Не оплачено",
    },
    SYSTEM_AUTH,
    { correlationId: "test" },
  );

  assert.equal(result.item.status, "suspended");
  assert.deepEqual(calls[0], [
    "setClinicStatus",
    {
      clinicId: "10000000-0000-4000-8000-000000000001",
      status: "suspended",
      reason: "Не оплачено",
      actorUserId: SYSTEM_AUTH.userId,
    },
  ]);
  assert.equal(auditEvents[0].action, "admin.clinic.status.update");
  assert.equal(auditEvents[0].metadata.status, "suspended");

  await assert.rejects(
    () =>
      service.setClinicStatus(
        "10000000-0000-4000-8000-000000000001",
        { status: "deleted" },
        SYSTEM_AUTH,
        { correlationId: "test" },
      ),
    /validation/i,
  );
});

test("system admin deletes only empty clinics", async () => {
  const { service, calls, auditEvents } = createService();
  const result = await service.deleteEmptyClinic(
    "10000000-0000-4000-8000-000000000001",
    SYSTEM_AUTH,
    { correlationId: "test" },
  );

  assert.equal(result.item.deleted, true);
  assert.deepEqual(calls[0], [
    "deleteEmptyClinic",
    {
      clinicId: "10000000-0000-4000-8000-000000000001",
    },
  ]);
  assert.equal(auditEvents[0].action, "admin.clinic.delete.empty");
});

test("system admin reactivates account and can disable one role without deleting the employee", async () => {
  const { service, calls, auditEvents } = createService();
  const reactivated = await service.reactivateUser(
    "10000000-0000-4000-8000-000000000201",
    SYSTEM_AUTH,
    { correlationId: "test" },
  );
  const roleStatus = await service.setUserRoleStatus(
    "10000000-0000-4000-8000-000000000201",
    {
      role: "private_doctor",
      clinicId: "10000000-0000-4000-8000-000000000001",
      status: "disabled",
      reason: "Пауза кабинета",
    },
    SYSTEM_AUTH,
    { correlationId: "test" },
  );

  assert.equal(reactivated.item.active, true);
  assert.equal(roleStatus.item.status, "disabled");
  assert.deepEqual(calls.map((call) => call[0]), ["reactivateUser", "setUserRoleStatus"]);
  assert.equal(auditEvents[0].action, "admin.user.reactivate");
  assert.equal(auditEvents[1].action, "admin.user.role.status.update");
});

test("analytics returns aggregate counters and audit events only", async () => {
  const { service } = createService();
  const result = await service.getAnalytics(SYSTEM_AUTH, { correlationId: "test" });
  assert.equal(result.item.clinics, 1);
  assert.equal(result.item.patients, 0);
  assert.deepEqual(result.item.recentAuditEvents, [{ id: "audit-1", action: "admin.user.create" }]);
  assert.equal(JSON.stringify(result).includes("patientName"), false);
});

test("system admin lists audit events through safe service scope", async () => {
  const { service, calls, auditEvents } = createService();
  const result = await service.listAuditEvents({}, SYSTEM_AUTH, { correlationId: "test-audit" });

  assert.deepEqual(result.items, [{ id: "audit-1", action: "admin.user.create" }]);
  assert.deepEqual(calls[0], [
    "listAuditEvents",
    {
      allClinics: true,
      clinicIds: [],
      limit: 100,
      roles: ["system_admin"],
    },
  ]);
  assert.equal(auditEvents[0].action, "admin.audit.list");
  assert.equal(auditEvents[0].entityType, "audit");
  assert.equal(auditEvents[0].correlationId, "test-audit");
  assert.equal(JSON.stringify(result).includes("metadata_json"), false);
});
