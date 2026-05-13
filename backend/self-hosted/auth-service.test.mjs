import assert from "node:assert/strict";
import { test } from "node:test";

import { hashPassword } from "./auth-crypto.mjs";
import { createAuthService, InvalidCredentialsError } from "./auth-service.mjs";

const config = {
  jwtIssuer: "dermatolog-pro-test",
  jwtSecret: "stage4c-auth-service-secret",
  jwtExpiresInSeconds: 3600,
};

function createService(overrides = {}) {
  const auditEvents = [];
  const user = overrides.user ?? {
    id: "10000000-0000-4000-8000-000000000101",
    email: "doctor.demo@example.invalid",
    displayName: "Demo Doctor",
    passwordHash: hashPassword("demo-password", { salt: "stage4c-demo-salt" }),
    roles: [
      {
        role: "doctor",
        clinicId: "10000000-0000-4000-8000-000000000001",
        clinicSlug: "demo-clinic",
      },
    ],
  };
  const service = createAuthService({
    config,
    nowSeconds: () => 100,
    authRepository: {
      async findActiveUserByEmail() {
        return user;
      },
      async findUserContextById() {
        return {
          id: user.id,
          displayName: user.displayName,
          roles: user.roles,
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
  return { service, auditEvents };
}

test("login issues a bearer token, role bindings, and audit event", async () => {
  const { service, auditEvents } = createService();
  const result = await service.login(
    { email: "doctor.demo@example.invalid", password: "demo-password" },
    { correlationId: "corr-1" },
  );

  assert.equal(result.tokenType, "Bearer");
  assert.match(result.accessToken, /^[^.]+\.[^.]+\.[^.]+$/);
  assert.equal(result.user.displayName, "Demo Doctor");
  assert.equal(result.user.roles[0].role, "doctor");
  assert.equal(auditEvents[0].action, "auth.login");
  assert.doesNotMatch(JSON.stringify(result), /demo-password|passwordHash|\$scrypt/);
});

test("login rejects invalid credentials", async () => {
  const { service } = createService();
  await assert.rejects(
    () => service.login({ email: "doctor.demo@example.invalid", password: "wrong" }),
    InvalidCredentialsError,
  );
});

test("authenticate verifies token and reloads current role bindings", async () => {
  const { service } = createService();
  const login = await service.login(
    { email: "doctor.demo@example.invalid", password: "demo-password" },
    { correlationId: "corr-1" },
  );
  const context = await service.authenticate({
    authorization: `Bearer ${login.accessToken}`,
  });

  assert.equal(context.userId, "10000000-0000-4000-8000-000000000101");
  assert.deepEqual(context.roles, ["doctor"]);
  assert.deepEqual(context.clinicIds, ["10000000-0000-4000-8000-000000000001"]);
  assert.equal(context.roleBindings[0].clinicSlug, "demo-clinic");
});
