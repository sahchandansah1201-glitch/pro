import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildAssignAdminUserRoleSql,
  buildAdminAnalyticsSql,
  buildCreateAdminUserSql,
  buildCreateClinicSql,
  buildCreateClinicIntegrationSql,
  buildCreateClinicServiceSql,
  buildCreatePrivatePracticeSql,
  buildDeleteEmptyClinicSql,
  buildDisableAdminUserSql,
  buildListClinicBotSettingsSql,
  buildListClinicIntegrationsSql,
  buildListAuditEventsSql,
  buildReactivateAdminUserSql,
  buildResetAdminUserPasswordSql,
  buildCreateServiceKeySql,
  buildListClinicServicesSql,
  buildSetAdminUserRoleStatusSql,
  buildSetClinicStatusSql,
  buildUpdateClinicIntegrationSql,
  buildRotateServiceKeySql,
  buildRevokeServiceKeySql,
  buildUpsertClinicBotSettingsSql,
  buildUpdateClinicServiceSql,
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
    buildResetAdminUserPasswordSql({
      userId: "10000000-0000-4000-8000-000000000101",
      passwordHash: "safe-hash",
      clinicIds: ["10000000-0000-4000-8000-000000000001"],
      allClinics: false,
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

  assertMutationUsesWritableCte(
    buildCreateServiceKeySql({
      label: "Мост устройств",
      owner: "Кабинет",
      scopes: ["device:write"],
      secretPrefix: "dpk_1234",
      secretHint: "abcd",
      secretSha256: "hash",
      expiresAt: "2026-07-01T00:00:00.000Z",
      createdByUserId: "10000000-0000-4000-8000-000000000101",
    }),
    "inserted",
  );

  assertMutationUsesWritableCte(
    buildCreateClinicServiceSql({
      clinicId: "10000000-0000-4000-8000-000000000001",
      name: "Дерматоскопия",
      category: "imaging",
      durationMin: 20,
      priceMin: 1800,
      priceMax: 2200,
      consentNote: "Согласие на съёмку",
      onlineBooking: false,
      active: true,
      actorUserId: "10000000-0000-4000-8000-000000000101",
    }),
    "inserted",
  );

  assertMutationUsesWritableCte(
    buildUpdateClinicServiceSql({
      serviceId: "10000000-0000-4000-8000-000000000501",
      clinicId: "10000000-0000-4000-8000-000000000001",
      name: "Дерматоскопия расширенная",
      category: "imaging",
      durationMin: 25,
      priceMin: 2000,
      priceMax: 2400,
      consentNote: "Согласие на съёмку",
      onlineBooking: true,
      active: true,
      actorUserId: "10000000-0000-4000-8000-000000000101",
    }),
    "updated",
  );

  assertMutationUsesWritableCte(
    buildCreateClinicIntegrationSql({
      clinicId: "10000000-0000-4000-8000-000000000001",
      provider: "CRM клиники",
      kind: "crm",
      status: "draft",
      actorUserId: "10000000-0000-4000-8000-000000000101",
    }),
    "inserted",
  );

  assertMutationUsesWritableCte(
    buildUpdateClinicIntegrationSql({
      integrationId: "10000000-0000-4000-8000-000000000601",
      clinicId: "10000000-0000-4000-8000-000000000001",
      provider: "CRM клиники обновлена",
      kind: "crm",
      status: "connected",
      markChecked: true,
      actorUserId: "10000000-0000-4000-8000-000000000101",
    }),
    "updated",
  );

  assertMutationUsesWritableCte(
    buildUpsertClinicBotSettingsSql({
      clinicId: "10000000-0000-4000-8000-000000000001",
      enabled: true,
      intakeSteps: { consent: true, location: true, timeline: true, photo: true, booking: true },
      templates: { greeting: "Здравствуйте" },
      actorUserId: "10000000-0000-4000-8000-000000000101",
    }),
    "upserted",
  );

  assertMutationUsesWritableCte(
    buildRotateServiceKeySql({
      keyId: "10000000-0000-4000-8000-000000000401",
      secretPrefix: "dpk_5678",
      secretHint: "efgh",
      secretSha256: "hash2",
      expiresAt: "2026-08-01T00:00:00.000Z",
    }),
    "updated",
  );

  assertMutationUsesWritableCte(
    buildRevokeServiceKeySql({
      keyId: "10000000-0000-4000-8000-000000000401",
    }),
    "updated",
  );
});

test("admin user creation never overwrites an existing account password", () => {
  const sql = buildCreateAdminUserSql({
    email: "existing@example.test",
    displayName: "Действующий сотрудник",
    passwordHash: "new-hash",
    role: "doctor",
    clinicId: "10000000-0000-4000-8000-000000000001",
  });

  assert.match(sql, /on conflict \(email\) do nothing/i);
  assert.doesNotMatch(sql, /password_hash\s*=\s*excluded\.password_hash/i);
  assert.doesNotMatch(sql, /display_name\s*=\s*excluded\.display_name/i);
});

test("password reset updates only a user inside clinic scope and never returns password material", () => {
  const sql = buildResetAdminUserPasswordSql({
    userId: "10000000-0000-4000-8000-000000000101",
    passwordHash: "$scrypt$safe-hash",
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
    allClinics: false,
  });

  assert.match(sql, /update app_users/i);
  assert.match(sql, /password_hash = '\$scrypt\$safe-hash'/i);
  assert.match(sql, /from user_roles ur/i);
  assert.match(sql, /ur\.clinic_id in \('10000000-0000-4000-8000-000000000001'::uuid\)/i);
  assert.match(sql, /ur\.role in \('doctor', 'private_doctor', 'assistant', 'operator'\)/i);
  assert.match(sql, /protected_role\.role = 'system_admin'/i);
  assert.doesNotMatch(sql, /returning[^;]*(password_hash|credential_version)/is);
});

test("clinic admin analytics and audit exclude global system events", () => {
  const clinicId = "10000000-0000-4000-8000-000000000001";
  const analyticsSql = buildAdminAnalyticsSql({ clinicIds: [clinicId], allClinics: false });
  const auditSql = buildListAuditEventsSql({ clinicIds: [clinicId], allClinics: false });
  const systemAnalyticsSql = buildAdminAnalyticsSql({ allClinics: true });
  const systemAuditSql = buildListAuditEventsSql({ allClinics: true });

  assert.match(analyticsSql, /al\.clinic_id in \('10000000-0000-4000-8000-000000000001'::uuid\)/i);
  assert.match(auditSql, /al\.clinic_id in \('10000000-0000-4000-8000-000000000001'::uuid\)/i);
  assert.doesNotMatch(analyticsSql, /or al\.clinic_id is null/i);
  assert.doesNotMatch(auditSql, /or al\.clinic_id is null/i);
  assert.doesNotMatch(systemAnalyticsSql, /al\.clinic_id in/i);
  assert.doesNotMatch(systemAuditSql, /al\.clinic_id in/i);
});

test("clinic service SQL is scoped and exposes only operational catalog fields", () => {
  const listSql = buildListClinicServicesSql({
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
    allClinics: false,
    search: "приём",
  });
  const createSql = buildCreateClinicServiceSql({
    clinicId: "10000000-0000-4000-8000-000000000001",
    name: "Первичный приём",
    category: "consult",
    durationMin: 30,
    priceMin: 2500,
    priceMax: 3500,
    consentNote: "Согласие на приём",
    onlineBooking: true,
    active: true,
    actorUserId: "10000000-0000-4000-8000-000000000101",
  });

  assert.match(listSql, /from clinic_services s/i);
  assert.match(listSql, /s\.clinic_id in/);
  assert.match(listSql, /s\.deleted_at is null/);
  assert.match(listSql, /"clinicName"/);
  assert.match(createSql, /insert into clinic_services/i);
  assert.match(createSql, /duration_min/);
  assert.match(createSql, /online_booking/);
  assert.doesNotMatch(`${listSql}\n${createSql}`, /patientName|diagnosis|storagePath|signedUrl|accessToken|sessionId/i);
});

test("clinic integration and bot SQL are scoped and operational only", () => {
  const listIntegrationsSql = buildListClinicIntegrationsSql({
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
    allClinics: false,
    search: "crm",
  });
  const createIntegrationSql = buildCreateClinicIntegrationSql({
    clinicId: "10000000-0000-4000-8000-000000000001",
    provider: "CRM клиники",
    kind: "crm",
    status: "draft",
    safeSummaryEnabled: true,
    protectedLinkEnabled: true,
    fieldMap: { source: "lead_source", service: "service_name" },
    actorUserId: "10000000-0000-4000-8000-000000000101",
  });
  const updateIntegrationSql = buildUpdateClinicIntegrationSql({
    integrationId: "10000000-0000-4000-8000-000000000601",
    clinicId: "10000000-0000-4000-8000-000000000001",
    provider: "CRM клиники обновлена",
    kind: "crm",
    status: "connected",
    markChecked: true,
    actorUserId: "10000000-0000-4000-8000-000000000101",
  });
  const listBotSql = buildListClinicBotSettingsSql({
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
    allClinics: false,
  });
  const saveBotSql = buildUpsertClinicBotSettingsSql({
    clinicId: "10000000-0000-4000-8000-000000000001",
    enabled: true,
    intakeSteps: { consent: true, location: true, timeline: true, photo: true, booking: true },
    templates: { greeting: "Здравствуйте", bookingText: "Запись" },
    markDryRun: true,
    actorUserId: "10000000-0000-4000-8000-000000000101",
  });
  const combined = `${listIntegrationsSql}\n${createIntegrationSql}\n${updateIntegrationSql}\n${listBotSql}\n${saveBotSql}`;

  assert.match(listIntegrationsSql, /from clinic_integrations i/i);
  assert.match(listIntegrationsSql, /i\.clinic_id in/);
  assert.match(listIntegrationsSql, /i\.deleted_at is null/);
  assert.match(createIntegrationSql, /insert into clinic_integrations/i);
  assert.match(updateIntegrationSql, /last_checked_at = now\(\)/i);
  assert.match(listBotSql, /from clinics c/i);
  assert.match(listBotSql, /left join clinic_bot_settings/i);
  assert.match(saveBotSql, /insert into clinic_bot_settings/i);
  assert.match(saveBotSql, /last_dry_run_at = now\(\)/i);
  assert.doesNotMatch(combined, /diagnosis|prognosis|treatment|storagePath|signedUrl|accessToken|sessionId|credential|secret/i);
});

test("service key SQL stores hash and mask without raw key value", () => {
  const sql = buildCreateServiceKeySql({
    label: "Мост устройств",
    owner: "Кабинет",
    scopes: ["device:write", "directory:read"],
    secretPrefix: "dpk_1234",
    secretHint: "abcd",
    secretSha256: "sha256hash",
    expiresAt: "2026-07-01T00:00:00.000Z",
    createdByUserId: "10000000-0000-4000-8000-000000000101",
  });

  assert.match(sql, /secret_sha256/);
  assert.match(sql, /secret_prefix/);
  assert.match(sql, /secret_hint/);
  assert.match(sql, /array\['device:write', 'directory:read'\]::text\[\]/);
  assert.doesNotMatch(sql, /secretOnce/);
  assert.doesNotMatch(sql, /dpk_[A-Za-z0-9_-]{20,}/);
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
