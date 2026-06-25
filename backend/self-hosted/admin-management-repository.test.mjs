import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildAssignAdminUserRoleSql,
  buildCreateAdminUserSql,
  buildCreateClinicSql,
  buildCreatePrivatePracticeSql,
  buildDeleteEmptyClinicSql,
  buildDisableAdminUserSql,
  buildReactivateAdminUserSql,
  buildSetAdminUserRoleStatusSql,
  buildSetClinicStatusSql,
  buildUpdateClinicSql,
} from "./admin-management-repository.mjs";

const DIRECT_DML_IN_FROM_PATTERN = /from\s*\(\s*(insert|update|delete)\b/i;
const WRITABLE_CTE_IN_SUBQUERY_PATTERN = /from\s*\(\s*with\b/i;

function assertMutationUsesWritableCte(sql, expectedCteName) {
  assert.match(sql, new RegExp(`^with\\s+${expectedCteName}\\s+as\\s*\\(`, "i"));
  assert.match(sql, new RegExp(`with\\s+${expectedCteName}\\s+as\\s*\\(`, "i"));
  assert.doesNotMatch(sql, DIRECT_DML_IN_FROM_PATTERN);
  assert.doesNotMatch(sql, WRITABLE_CTE_IN_SUBQUERY_PATTERN);
}

test("admin management mutation SQL uses writable CTEs PostgreSQL accepts", () => {
  assertMutationUsesWritableCte(
    buildCreateAdminUserSql({
      email: "doctor@example.test",
      displayName: "Врач",
      passwordHash: "hash",
      role: "doctor",
      clinicId: "10000000-0000-4000-8000-000000000001",
    }),
    "user_row",
  );

  assertMutationUsesWritableCte(
    buildAssignAdminUserRoleSql({
      userId: "10000000-0000-4000-8000-000000000101",
      role: "doctor",
      clinicId: "10000000-0000-4000-8000-000000000001",
    }),
    "inserted",
  );

  assertMutationUsesWritableCte(
    buildCreateClinicSql({
      name: "Клиника",
      address: "Краснодар",
      slug: "clinic",
      timezone: "Europe/Moscow",
    }),
    "inserted",
  );

  assertMutationUsesWritableCte(
    buildUpdateClinicSql({
      clinicId: "10000000-0000-4000-8000-000000000001",
      name: "Клиника",
      address: "Краснодар",
      slug: "clinic",
      timezone: "Europe/Moscow",
    }),
    "updated",
  );

  assertMutationUsesWritableCte(
    buildDisableAdminUserSql({
      userId: "10000000-0000-4000-8000-000000000101",
    }),
    "updated",
  );

  assertMutationUsesWritableCte(
    buildReactivateAdminUserSql({
      userId: "10000000-0000-4000-8000-000000000101",
    }),
    "updated",
  );

  assertMutationUsesWritableCte(
    buildSetClinicStatusSql({
      clinicId: "10000000-0000-4000-8000-000000000001",
      status: "suspended",
      reason: "billing_pause",
      actorUserId: "10000000-0000-4000-8000-000000000101",
    }),
    "updated",
  );

  assertMutationUsesWritableCte(
    buildSetAdminUserRoleStatusSql({
      userId: "10000000-0000-4000-8000-000000000101",
      role: "doctor",
      clinicId: "10000000-0000-4000-8000-000000000001",
      status: "disabled",
      reason: "temporary_pause",
      actorUserId: "10000000-0000-4000-8000-000000000102",
    }),
    "updated",
  );
});

test("private practice SQL creates clinic and owner roles atomically with writable CTEs", () => {
  const sql = buildCreatePrivatePracticeSql({
    name: "Кабинет",
    address: "Краснодар",
    slug: "cabinet",
    timezone: "Europe/Moscow",
    ownerEmail: "owner@example.test",
    ownerDisplayName: "Владелец кабинета",
    ownerPasswordHash: "hash",
  });

  for (const cteName of ["clinic_row", "user_row", "role_rows"]) {
    assert.match(sql, new RegExp(`with[\\s\\S]*${cteName}\\s+as\\s*\\(`, "i"));
  }
  assert.match(sql, /^with\s+clinic_row\s+as\s*\(/i);
  assert.doesNotMatch(sql, DIRECT_DML_IN_FROM_PATTERN);
  assert.doesNotMatch(sql, WRITABLE_CTE_IN_SUBQUERY_PATTERN);
  assert.match(sql, /'clinic_admin'/);
  assert.match(sql, /'private_doctor'/);
  assert.match(sql, /address/);
});

test("clinic delete SQL archives only empty clinics and returns blocker counts", () => {
  const sql = buildDeleteEmptyClinicSql({
    clinicId: "10000000-0000-4000-8000-000000000001",
  });

  assert.match(sql, /^with\s+blockers\s+as\s*\(/i);
  assert.match(sql, /update clinics/i);
  assert.match(sql, /set deleted_at = now\(\)/i);
  assert.doesNotMatch(sql, /delete from clinics/i);
  assert.match(sql, /user_roles/);
  assert.match(sql, /patients/);
  assert.match(sql, /visits/);
  assert.match(sql, /clinical_assets/);
  assert.match(sql, /reports/);
  assert.match(sql, /"blockerCount"/);
  assert.doesNotMatch(sql, DIRECT_DML_IN_FROM_PATTERN);
  assert.doesNotMatch(sql, WRITABLE_CTE_IN_SUBQUERY_PATTERN);
});
