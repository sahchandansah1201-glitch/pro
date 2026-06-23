import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCreateClinicSql,
  buildCreatePrivatePracticeSql,
  buildDisableAdminUserSql,
  buildUpdateClinicSql,
} from "./admin-management-repository.mjs";

const DIRECT_DML_IN_FROM_PATTERN = /from\s*\(\s*(insert|update|delete)\b/i;

function assertMutationUsesWritableCte(sql, expectedCteName) {
  assert.match(sql, new RegExp(`with\\s+${expectedCteName}\\s+as\\s*\\(`, "i"));
  assert.match(sql, new RegExp(`select\\s+\\*\\s+from\\s+${expectedCteName}`, "i"));
  assert.doesNotMatch(sql, DIRECT_DML_IN_FROM_PATTERN);
}

test("admin management mutation SQL uses writable CTEs PostgreSQL accepts", () => {
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
  assert.doesNotMatch(sql, DIRECT_DML_IN_FROM_PATTERN);
  assert.match(sql, /'clinic_admin'/);
  assert.match(sql, /'private_doctor'/);
  assert.match(sql, /address/);
});
