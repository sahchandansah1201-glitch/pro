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
      async listServiceKeys(params, authContext, meta) {
        calls.push(["listServiceKeys", params, authContext.roles, meta.correlationId]);
        return {
          items: [
            {
              id: "10000000-0000-4000-8000-000000000401",
              label: "Мост устройств",
              owner: "Кабинет",
              masked: "dpk_1234…abcd",
              scopes: ["device:write"],
              status: "active",
            },
          ],
          meta: { limit: 50, offset: 0, count: 1 },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async listClinicServices(params, authContext, meta) {
        calls.push(["listClinicServices", params, authContext.roles, meta.correlationId]);
        return {
          items: [
            {
              id: "10000000-0000-4000-8000-000000000501",
              clinicId: "10000000-0000-4000-8000-000000000301",
              clinicName: "Клиника тест",
              name: "Первичный приём",
              category: "consult",
              durationMin: 30,
              priceMin: 2500,
              priceMax: 3500,
              consentNote: "Согласие на приём",
              onlineBooking: true,
              active: true,
            },
          ],
          meta: { limit: 50, offset: 0, count: 1 },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async createClinicService(body, authContext, meta) {
        calls.push(["createClinicService", body, authContext.roles, meta.correlationId]);
        return {
          item: {
            id: "10000000-0000-4000-8000-000000000502",
            clinicId: body.clinicId,
            clinicName: "Клиника тест",
            name: body.name,
            category: body.category,
            durationMin: body.durationMin,
            priceMin: body.priceMin,
            priceMax: body.priceMax,
            consentNote: body.consentNote,
            onlineBooking: body.onlineBooking,
            active: body.active,
          },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async updateClinicService(serviceId, body, authContext, meta) {
        calls.push(["updateClinicService", serviceId, body, authContext.roles, meta.correlationId]);
        return {
          item: {
            id: serviceId,
            clinicId: body.clinicId,
            clinicName: "Клиника тест",
            name: body.name,
            category: body.category,
            durationMin: body.durationMin,
            priceMin: body.priceMin,
            priceMax: body.priceMax,
            consentNote: body.consentNote,
            onlineBooking: body.onlineBooking,
            active: body.active,
          },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async listClinicIntegrations(params, authContext, meta) {
        calls.push(["listClinicIntegrations", params, authContext.roles, meta.correlationId]);
        return {
          items: [
            {
              id: "10000000-0000-4000-8000-000000000601",
              clinicId: "10000000-0000-4000-8000-000000000301",
              clinicName: "Клиника тест",
              provider: "CRM клиники",
              kind: "crm",
              status: "draft",
              safeSummaryEnabled: true,
              protectedLinkEnabled: true,
              fieldMap: { source: "lead_source" },
            },
          ],
          meta: { limit: 50, offset: 0, count: 1 },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async getClinicIntegration(integrationId, authContext, meta) {
        calls.push(["getClinicIntegration", integrationId, authContext.roles, meta.correlationId]);
        return {
          item: {
            id: integrationId,
            clinicId: "10000000-0000-4000-8000-000000000301",
            clinicName: "Клиника тест",
            provider: "CRM клиники",
            kind: "crm",
            status: "draft",
          },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async createClinicIntegration(body, authContext, meta) {
        calls.push(["createClinicIntegration", body, authContext.roles, meta.correlationId]);
        return {
          item: {
            id: "10000000-0000-4000-8000-000000000602",
            clinicId: body.clinicId,
            clinicName: "Клиника тест",
            provider: body.provider,
            kind: body.kind,
            status: body.status,
            safeSummaryEnabled: body.safeSummaryEnabled,
            protectedLinkEnabled: body.protectedLinkEnabled,
            fieldMap: body.fieldMap,
          },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async updateClinicIntegration(integrationId, body, authContext, meta) {
        calls.push(["updateClinicIntegration", integrationId, body, authContext.roles, meta.correlationId]);
        return {
          item: {
            id: integrationId,
            clinicId: body.clinicId,
            clinicName: "Клиника тест",
            provider: body.provider,
            kind: body.kind,
            status: body.status,
          },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async checkClinicIntegration(integrationId, body, authContext, meta) {
        calls.push(["checkClinicIntegration", integrationId, body, authContext.roles, meta.correlationId]);
        return {
          item: {
            id: integrationId,
            clinicId: body.clinicId,
            clinicName: "Клиника тест",
            provider: "CRM клиники",
            kind: "crm",
            status: "connected",
            lastCheckedAt: "2026-06-22T00:00:00.000Z",
          },
          check: { ok: true, message: "Проверка выполнена." },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async listClinicBotSettings(authContext, meta) {
        calls.push(["listClinicBotSettings", authContext.roles, meta.correlationId]);
        return {
          items: [
            {
              id: "10000000-0000-4000-8000-000000000701",
              clinicId: "10000000-0000-4000-8000-000000000301",
              clinicName: "Клиника тест",
              enabled: true,
              intakeSteps: { consent: true, location: true, timeline: true, photo: true, booking: true },
              templates: {},
            },
          ],
          meta: { limit: 50, offset: 0, count: 1 },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async updateClinicBotSettings(body, authContext, meta) {
        calls.push(["updateClinicBotSettings", body, authContext.roles, meta.correlationId]);
        return {
          item: {
            id: "10000000-0000-4000-8000-000000000701",
            clinicId: body.clinicId,
            clinicName: "Клиника тест",
            enabled: body.enabled,
            intakeSteps: body.intakeSteps,
            templates: body.templates,
          },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async dryRunClinicBotSettings(body, authContext, meta) {
        calls.push(["dryRunClinicBotSettings", body, authContext.roles, meta.correlationId]);
        return {
          item: {
            id: "10000000-0000-4000-8000-000000000701",
            clinicId: body.clinicId,
            clinicName: "Клиника тест",
            enabled: body.enabled,
            intakeSteps: body.intakeSteps,
            templates: body.templates,
            lastDryRunAt: "2026-06-22T00:00:00.000Z",
          },
          preview: { ok: true, message: "Пробный сценарий собран." },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async createServiceKey(body, authContext, meta) {
        calls.push(["createServiceKey", body, authContext.roles, meta.correlationId]);
        return {
          item: {
            id: "10000000-0000-4000-8000-000000000401",
            label: body.label,
            owner: body.owner,
            masked: "dpk_1234…abcd",
            scopes: body.scopes,
            status: "active",
            secretOnce: "dpk_created_once",
          },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async rotateServiceKey(keyId, body, authContext, meta) {
        calls.push(["rotateServiceKey", keyId, body, authContext.roles, meta.correlationId]);
        return {
          item: {
            id: keyId,
            label: "Мост устройств",
            owner: "Кабинет",
            masked: "dpk_5678…efgh",
            scopes: ["device:write"],
            status: "active",
            secretOnce: "dpk_rotated_once",
          },
          scope: { allClinics: true, clinicIds: [] },
        };
      },
      async revokeServiceKey(keyId, authContext, meta) {
        calls.push(["revokeServiceKey", keyId, authContext.roles, meta.correlationId]);
        return {
          item: {
            id: keyId,
            label: "Мост устройств",
            owner: "Кабинет",
            masked: "dpk_5678…efgh",
            scopes: ["device:write"],
            status: "revoked",
          },
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

test("admin management routes manage service keys without storing raw values in list", async () => {
  const calls = [];
  const runtime = createRuntime(calls);

  const list = await request("/api/v1/admin/service-keys", { runtime });
  assert.equal(list.status, 200);
  assert.equal(list.json.items[0].label, "Мост устройств");
  assert.equal(list.body.includes("dpk_created_once"), false);

  const created = await request("/api/v1/admin/service-keys", {
    method: "POST",
    runtime,
    body: JSON.stringify({
      label: "Мост устройств",
      owner: "Кабинет",
      scopes: ["device:write"],
      expiresInDays: 30,
    }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.item.secretOnce, "dpk_created_once");

  const rotated = await request("/api/v1/admin/service-keys/10000000-0000-4000-8000-000000000401/rotate", {
    method: "PATCH",
    runtime,
    body: JSON.stringify({ expiresInDays: 90 }),
  });
  assert.equal(rotated.status, 200);
  assert.equal(rotated.json.item.secretOnce, "dpk_rotated_once");

  const revoked = await request("/api/v1/admin/service-keys/10000000-0000-4000-8000-000000000401/revoke", {
    method: "PATCH",
    runtime,
  });
  assert.equal(revoked.status, 200);
  assert.equal(revoked.json.item.status, "revoked");
  assert.deepEqual(calls.map((call) => call[0]).slice(-4), [
    "listServiceKeys",
    "createServiceKey",
    "rotateServiceKey",
    "revokeServiceKey",
  ]);
});

test("admin management routes list, create, and update clinic services", async () => {
  const calls = [];
  const runtime = createRuntime(calls);

  const list = await request("/api/v1/admin/services", { runtime });
  assert.equal(list.status, 200);
  assert.equal(list.json.items[0].name, "Первичный приём");

  const created = await request("/api/v1/admin/services", {
    method: "POST",
    runtime,
    body: JSON.stringify({
      clinicId: "10000000-0000-4000-8000-000000000301",
      name: "Дерматоскопия",
      category: "imaging",
      durationMin: 20,
      priceMin: 1800,
      priceMax: 2200,
      consentNote: "Согласие на съёмку",
      onlineBooking: false,
      active: true,
    }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.item.category, "imaging");

  const updated = await request("/api/v1/admin/services/10000000-0000-4000-8000-000000000502", {
    method: "PATCH",
    runtime,
    body: JSON.stringify({
      clinicId: "10000000-0000-4000-8000-000000000301",
      name: "Дерматоскопия расширенная",
      category: "imaging",
      durationMin: 25,
      priceMin: 2000,
      priceMax: 2400,
      consentNote: "Согласие на съёмку",
      onlineBooking: true,
      active: true,
    }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.item.durationMin, 25);
  assert.equal(updated.body.includes("storagePath"), false);
  assert.deepEqual(calls.map((call) => call[0]).slice(-3), [
    "listClinicServices",
    "createClinicService",
    "updateClinicService",
  ]);
});

test("admin management routes list, create, update, and check clinic integrations", async () => {
  const calls = [];
  const runtime = createRuntime(calls);

  const list = await request("/api/v1/admin/integrations", { runtime });
  assert.equal(list.status, 200);
  assert.equal(list.json.items[0].provider, "CRM клиники");

  const created = await request("/api/v1/admin/integrations", {
    method: "POST",
    runtime,
    body: JSON.stringify({
      clinicId: "10000000-0000-4000-8000-000000000301",
      provider: "CRM клиники",
      kind: "crm",
      status: "draft",
      safeSummaryEnabled: true,
      protectedLinkEnabled: true,
      fieldMap: { source: "lead_source" },
    }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.json.item.kind, "crm");

  const read = await request("/api/v1/admin/integrations/10000000-0000-4000-8000-000000000602", { runtime });
  assert.equal(read.status, 200);
  assert.equal(read.json.item.id, "10000000-0000-4000-8000-000000000602");

  const updated = await request("/api/v1/admin/integrations/10000000-0000-4000-8000-000000000602", {
    method: "PATCH",
    runtime,
    body: JSON.stringify({
      clinicId: "10000000-0000-4000-8000-000000000301",
      provider: "CRM клиники обновлена",
      kind: "crm",
      status: "connected",
    }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.json.item.status, "connected");

  const checked = await request("/api/v1/admin/integrations/10000000-0000-4000-8000-000000000602/check", {
    method: "POST",
    runtime,
    body: JSON.stringify({ clinicId: "10000000-0000-4000-8000-000000000301" }),
  });
  assert.equal(checked.status, 200);
  assert.equal(checked.json.check.ok, true);
  assert.equal(checked.body.includes("accessToken"), false);
  assert.equal(checked.body.includes("storagePath"), false);
  assert.deepEqual(calls.map((call) => call[0]).slice(-5), [
    "listClinicIntegrations",
    "createClinicIntegration",
    "getClinicIntegration",
    "updateClinicIntegration",
    "checkClinicIntegration",
  ]);
});

test("admin management routes list, update, and dry-run clinic bot settings", async () => {
  const calls = [];
  const runtime = createRuntime(calls);

  const list = await request("/api/v1/admin/bot-settings", { runtime });
  assert.equal(list.status, 200);
  assert.equal(list.json.items[0].clinicName, "Клиника тест");

  const saved = await request("/api/v1/admin/bot-settings", {
    method: "PATCH",
    runtime,
    body: JSON.stringify({
      clinicId: "10000000-0000-4000-8000-000000000301",
      enabled: true,
      intakeSteps: { consent: true, location: true, timeline: true, photo: true, booking: true },
      templates: { greeting: "Здравствуйте", bookingText: "Запись" },
    }),
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.json.item.templates.greeting, "Здравствуйте");

  const dryRun = await request("/api/v1/admin/bot-settings/dry-run", {
    method: "POST",
    runtime,
    body: JSON.stringify({
      clinicId: "10000000-0000-4000-8000-000000000301",
      enabled: true,
      intakeSteps: { consent: true, location: true, timeline: true, photo: true, booking: true },
      templates: { greeting: "Здравствуйте" },
    }),
  });
  assert.equal(dryRun.status, 200);
  assert.equal(dryRun.json.preview.ok, true);
  assert.equal(dryRun.body.includes("sessionId"), false);
  assert.deepEqual(calls.map((call) => call[0]).slice(-3), [
    "listClinicBotSettings",
    "updateClinicBotSettings",
    "dryRunClinicBotSettings",
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
  assert.equal(response.json.paths["/api/v1/admin/services"].get.operationId, "listAdminClinicServices");
  assert.equal(response.json.paths["/api/v1/admin/services"].post.operationId, "createAdminClinicService");
  assert.equal(response.json.paths["/api/v1/admin/services/{serviceId}"].patch.operationId, "updateAdminClinicService");
  assert.equal(response.json.paths["/api/v1/admin/integrations"].get.operationId, "listAdminClinicIntegrations");
  assert.equal(response.json.paths["/api/v1/admin/integrations"].post.operationId, "createAdminClinicIntegration");
  assert.equal(response.json.paths["/api/v1/admin/integrations/{integrationId}"].patch.operationId, "updateAdminClinicIntegration");
  assert.equal(response.json.paths["/api/v1/admin/integrations/{integrationId}/check"].post.operationId, "checkAdminClinicIntegration");
  assert.equal(response.json.paths["/api/v1/admin/bot-settings"].get.operationId, "listAdminClinicBotSettings");
  assert.equal(response.json.paths["/api/v1/admin/bot-settings"].patch.operationId, "updateAdminClinicBotSettings");
  assert.equal(response.json.paths["/api/v1/admin/bot-settings/dry-run"].post.operationId, "dryRunAdminClinicBotSettings");
  assert.equal(response.json.paths["/api/v1/admin/audit-events"].get.operationId, "listAdminAuditEvents");
  assert.equal(response.json.paths["/api/v1/admin/service-keys"].get.operationId, "listAdminServiceKeys");
  assert.equal(response.json.paths["/api/v1/admin/service-keys"].post.operationId, "createAdminServiceKey");
  assert.equal(response.json.paths["/api/v1/admin/service-keys/{keyId}/rotate"].patch.operationId, "rotateAdminServiceKey");
  assert.equal(response.json.paths["/api/v1/admin/service-keys/{keyId}/revoke"].patch.operationId, "revokeAdminServiceKey");
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
