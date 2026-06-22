import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCreateClinicSql,
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
      slug: "clinic",
      timezone: "Europe/Moscow",
    }),
    "inserted",
  );

  assertMutationUsesWritableCte(
    buildUpdateClinicSql({
      clinicId: "10000000-0000-4000-8000-000000000001",
      name: "Клиника",
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
