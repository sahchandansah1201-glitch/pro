import assert from "node:assert/strict";
import { test } from "node:test";

import { readSelfHostedConfig } from "./config.mjs";
import { handleSelfHostedRequest } from "./routes.mjs";

const CONFIG = readSelfHostedConfig({
  DATABASE_URL: "postgres://user:secret@postgres:5432/app",
  OBJECT_STORAGE_ENDPOINT: "http://minio:9000",
  JWT_SECRET: "stage6-admin-test-secret",
});

const AUTH_CONTEXT = {
  userId: "10000000-0000-4000-8000-000000000101",
  displayName: "System Admin",
  roles: ["system_admin"],
  clinicIds: [],
  roleBindings: [{ role: "system_admin", clinicId: null }],
};

function createRuntime(calls = []) {
  return {
    dbClient: {
      async checkConnection() {
        return { connected: true };
      },
    },
    authService: {
      async authenticate() {
        return AUTH_CONTEXT;
      },
    },
    adminManagementService: {
      async createClinic(body, authContext, meta) {
        calls.push(["createClinic", body, authContext.roles, meta.correlationId]);
        return {
          item: { id: "10000000-0000-4000-8000-000000000301", name: body.name, address: body.address, slug: body.slug },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async createPrivatePractice(body, authContext, meta) {
        calls.push(["createPrivatePractice", body.ownerEmail, authContext.roles, meta.correlationId]);
        return {
          item: {
            clinic: { id: "10000000-0000-4000-8000-000000000301", name: body.clinicName, address: body.address, slug: body.slug },
            owner: {
              id: "10000000-0000-4000-8000-000000000201",
              displayName: body.ownerDisplayName,
              email: body.ownerEmail,
              roles: [
                { role: "clinic_admin", clinicId: "10000000-0000-4000-8000-000000000301", clinicName: body.clinicName },
                { role: "private_doctor", clinicId: "10000000-0000-4000-8000-000000000301", clinicName: body.clinicName },
              ],
            },
          },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async createUser(body, authContext, meta) {
        calls.push(["createUser", body.role, authContext.roles, meta.correlationId]);
        return {
          item: { id: "10000000-0000-4000-8000-000000000201", displayName: body.displayName, email: body.email },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async reactivateUser(userId, authContext, meta) {
        calls.push(["reactivateUser", userId, authContext.roles, meta.correlationId]);
        return {
          item: { id: userId, active: true, disabledAt: null },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async setUserRoleStatus(userId, body, authContext, meta) {
        calls.push(["setUserRoleStatus", userId, body.status, body.role, authContext.roles, meta.correlationId]);
        return {
          item: { id: userId, role: body.role, clinicId: body.clinicId, status: body.status },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async setClinicStatus(clinicId, body, authContext, meta) {
        calls.push(["setClinicStatus", clinicId, body.status, authContext.roles, meta.correlationId]);
        return {
          item: { id: clinicId, status: body.status, statusReason: body.reason ?? null },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async deleteEmptyClinic(clinicId, authContext, meta) {
        calls.push(["deleteEmptyClinic", clinicId, authContext.roles, meta.correlationId]);
        return {
          item: { id: clinicId, deleted: true, blockerCount: 0, blockers: {} },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async getAnalytics(authContext, meta) {
        calls.push(["getAnalytics", authContext.roles, meta.correlationId]);
        return {
          item: {
            clinics: 1,
            activeUsers: 2,
            doctors: 1,
            patients: 0,
            visits: 0,
            photos: 0,
            signedReports: 0,
            auditEvents7d: 2,
            recentAuditEvents: [{ id: "audit-1", action: "admin.user.create" }],
          },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async listAuditEvents(params, authContext, meta) {
        calls.push(["listAuditEvents", params, authContext.roles, meta.correlationId]);
        return {
          items: [
            {
              id: "audit-1",
              action: "admin.clinic.create",
              entityType: "clinic",
              actorName: "System Admin",
              clinicName: "Яблоко ООО",
              createdAt: "2026-06-22T00:00:00.000Z",
            },
          ],
          meta: { limit: 100, offset: 0, count: 1 },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
    },
  };
}

async function request(path, { method = "GET", body = undefined, runtime = createRuntime() } = {}) {
  const response = await handleSelfHostedRequest(
    {
      method,
      url: path,
      headers: {
        origin: "http://localhost:8080",
        authorization: "Bearer header.payload.signature",
      },
      body,
    },
    CONFIG,
    () => "2026-06-22T00:00:00.000Z",
    runtime,
  );
  return {
    ...response,
    json: response.body ? JSON.parse(response.body) : null,
  };
}

test("admin management routes create clinic, create doctor, and read aggregate analytics", async () => {
  const calls = [];
  const runtime = createRuntime(calls);

  const clinic = await request("/api/v1/admin/clinics", {
    method: "POST",
    runtime,
    body: JSON.stringify({ name: "Клиника тест", address: "Краснодар" }),
  });
  assert.equal(clinic.status, 201);
  assert.equal(clinic.json.item.name, "Клиника тест");
  assert.equal(clinic.json.item.address, "Краснодар");

  const doctor = await request("/api/v1/admin/doctors", {
    method: "POST",
    runtime,
    body: JSON.stringify({
      displayName: "Врач Тестовый",
      email: "doctor@example.test",
      password: "long-password-1",
      role: "private_doctor",
      clinicId: "10000000-0000-4000-8000-000000000301",
    }),
  });
  assert.equal(doctor.status, 201);
  assert.equal(doctor.json.item.displayName, "Врач Тестовый");

  const privatePractice = await request("/api/v1/admin/private-practices", {
    method: "POST",
    runtime,
    body: JSON.stringify({
      clinicName: "Кабинет тестовый",
      address: "Краснодар",
      ownerDisplayName: "Врач Владелец",
      ownerEmail: "owner@example.test",
      ownerPassword: "long-password-1",
    }),
  });
  assert.equal(privatePractice.status, 201);
  assert.equal(privatePractice.json.item.clinic.name, "Кабинет тестовый");
  assert.deepEqual(privatePractice.json.item.owner.roles.map((role) => role.role), ["clinic_admin", "private_doctor"]);

  const analytics = await request("/api/v1/admin/analytics", { runtime });
  assert.equal(analytics.status, 200);
  assert.equal(analytics.json.item.clinics, 1);
  assert.equal(analytics.body.includes("patientName"), false);
  assert.deepEqual(calls.map((call) => call[0]), ["createClinic", "createUser", "createPrivatePractice", "getAnalytics"]);
});

test("admin management routes expose lifecycle actions for clinics, users, and role bindings", async () => {
  const calls = [];
  const runtime = createRuntime(calls);

  const suspended = await request("/api/v1/admin/clinics/10000000-0000-4000-8000-000000000301/status", {
    method: "PATCH",
    runtime,
    body: JSON.stringify({ status: "suspended", reason: "Не оплачено" }),
  });
  assert.equal(suspended.status, 200);
  assert.equal(suspended.json.item.status, "suspended");

  const deleted = await request("/api/v1/admin/clinics/10000000-0000-4000-8000-000000000301", {
    method: "DELETE",
    runtime,
  });
  assert.equal(deleted.status, 200);
  assert.equal(deleted.json.item.deleted, true);

  const reactivated = await request("/api/v1/admin/users/10000000-0000-4000-8000-000000000201/reactivate", {
    method: "PATCH",
    runtime,
  });
  assert.equal(reactivated.status, 200);
  assert.equal(reactivated.json.item.active, true);

  const roleStatus = await request("/api/v1/admin/users/10000000-0000-4000-8000-000000000201/role-status", {
    method: "PATCH",
    runtime,
    body: JSON.stringify({
      role: "private_doctor",
      clinicId: "10000000-0000-4000-8000-000000000301",
      status: "disabled",
      reason: "Пауза кабинета",
    }),
  });
  assert.equal(roleStatus.status, 200);
  assert.equal(roleStatus.json.item.status, "disabled");

  assert.deepEqual(calls.map((call) => call[0]), [
    "setClinicStatus",
    "deleteEmptyClinic",
    "reactivateUser",
    "setUserRoleStatus",
  ]);
});

test("admin management OpenAPI route is public and documents operation ids", async () => {
  const response = await request("/openapi.stage6-admin-management.json", { runtime: createRuntime() });
  assert.equal(response.status, 200);
  assert.equal(response.json.paths["/api/v1/admin/users"].post.operationId, "createAdminUser");
  assert.equal(response.json.paths["/api/v1/admin/private-practices"].post.operationId, "createAdminPrivatePractice");
  assert.equal(response.json.paths["/api/v1/admin/clinics/{clinicId}/status"].patch.operationId, "setAdminClinicStatus");
  assert.equal(response.json.paths["/api/v1/admin/users/{userId}/reactivate"].patch.operationId, "reactivateAdminUser");
  assert.equal(response.json.paths["/api/v1/admin/users/{userId}/role-status"].patch.operationId, "setAdminUserRoleStatus");
  assert.equal(response.json.paths["/api/v1/admin/analytics"].get.operationId, "getAdminAnalytics");
  assert.equal(response.json.paths["/api/v1/admin/audit-events"].get.operationId, "listAdminAuditEvents");
});

test("admin management routes list safe production audit events", async () => {
  const calls = [];
  const runtime = createRuntime(calls);

  const response = await request("/api/v1/admin/audit-events", { runtime });

  assert.equal(response.status, 200);
  assert.equal(response.json.source, "postgres");
  assert.equal(response.json.items[0].action, "admin.clinic.create");
  assert.equal(response.json.items[0].clinicName, "Яблоко ООО");
  assert.equal(response.body.includes("metadata_json"), false);
  assert.equal(response.body.includes("storagePath"), false);
  assert.deepEqual(calls[0], [
    "listAuditEvents",
    {
      limit: 50,
      offset: 0,
      search: "",
    },
    ["system_admin"],
    "stage4i-local",
  ]);
});
