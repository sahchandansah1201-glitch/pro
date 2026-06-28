import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildFindActiveUserByEmailSql,
  buildFindUserContextByIdSql,
  createAuthRepository,
} from "./auth-repository.mjs";

test("buildFindActiveUserByEmailSql looks up active user and role bindings safely", () => {
  const sql = buildFindActiveUserByEmailSql("Doctor.O'Hara@example.invalid");

  assert.match(sql, /from app_users u/);
  assert.match(sql, /user_roles ur/);
  assert.match(sql, /'clinicName', c\.name/);
  assert.match(sql, /disabled_at is null/);
  assert.match(sql, /doctor\.o''hara@example\.invalid/);
  assert.doesNotMatch(sql, /supabase|auth\.users/i);
});

test("buildFindUserContextByIdSql returns role context without password hash", () => {
  const sql = buildFindUserContextByIdSql("10000000-0000-4000-8000-000000000101");

  assert.match(sql, /where u.id = '10000000-0000-4000-8000-000000000101'::uuid/);
  assert.doesNotMatch(sql, /password_hash/);
});

test("createAuthRepository normalizes user rows", async () => {
  const repository = createAuthRepository({
    async queryJson(sql) {
      if (sql.includes("password_hash")) {
        return {
          id: "u-1",
          email: "doctor@example.invalid",
          displayName: "Demo Doctor",
          passwordHash: "$scrypt$hash",
          roles: [{ role: "doctor", clinicId: "clinic-1", clinicName: "Demo Clinic", clinicSlug: "demo" }],
        };
      }
      return {
        id: "u-1",
        displayName: "Demo Doctor",
        roles: [{ role: "doctor", clinicId: "clinic-1", clinicName: "Demo Clinic", clinicSlug: "demo" }],
      };
    },
  });

  const user = await repository.findActiveUserByEmail("doctor@example.invalid");
  const context = await repository.findUserContextById("u-1");

  assert.equal(user.displayName, "Demo Doctor");
  assert.equal(user.roles[0].role, "doctor");
  assert.equal(user.roles[0].clinicName, "Demo Clinic");
  assert.equal(context.roles[0].clinicSlug, "demo");
  assert.equal(context.roles[0].clinicName, "Demo Clinic");
  assert.equal(context.passwordHash, undefined);
});
