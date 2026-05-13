import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildAuditInsertSql,
  createAuditRepository,
  recordAuditBestEffort,
} from "./audit-repository.mjs";

test("buildAuditInsertSql writes append-only audit event with escaped JSON metadata", () => {
  const sql = buildAuditInsertSql({
    clinicId: "10000000-0000-4000-8000-000000000001",
    actorUserId: "10000000-0000-4000-8000-000000000101",
    action: "patient.list",
    entityType: "patient",
    correlationId: "corr-1",
    metadata: { search: "O'Hara" },
  });

  assert.match(sql, /insert into audit_log/);
  assert.match(sql, /patient\.list/);
  assert.match(sql, /O''Hara/);
  assert.doesNotMatch(sql, /password_hash|access_token|storage_object_path/);
});

test("recordAuditBestEffort suppresses audit failures", async () => {
  const ok = await recordAuditBestEffort(createAuditRepository({
    async queryJson() {
      return { id: "audit-1" };
    },
  }), {
    action: "auth.login",
    entityType: "app_user",
    correlationId: "corr-1",
  });
  assert.equal(ok, true);

  const failed = await recordAuditBestEffort(createAuditRepository({
    async queryJson() {
      throw new Error("audit unavailable");
    },
  }), {
    action: "auth.login",
    entityType: "app_user",
    correlationId: "corr-1",
  });
  assert.equal(failed, false);
});
