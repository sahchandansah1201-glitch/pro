import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAdminAnalyticsSql } from "./admin-management-repository.mjs";
import { createAdminManagementService } from "./admin-management-service.mjs";
import { handleAdminManagementRequest } from "./admin-management-routes.mjs";

function serviceFixture() {
  const queries = [], audits = [];
  const service = createAdminManagementService({
    adminManagementRepository: {
      getAnalytics: async (params) => { queries.push(params); return { visits: 20, ...(params.period ? { period: { ...params.period, visitsCreated: 2 } } : {}) }; },
      listAuditEvents: async () => [],
    },
    auditRepository: { recordEvent: async (event) => audits.push(event) },
  });
  return { service, queries, audits };
}

const CLINIC = "10000000-0000-4000-8000-000000000001";
const PERIOD = { dateFrom: "2026-08-01", dateTo: "2026-08-30", timeZone: "Europe/Moscow" };
const AUTH = { userId: "10000000-0000-4000-8000-000000000101", roles: ["clinic_admin"], clinicIds: [CLINIC] };

test("analytics adds calendar-period counters without replacing existing totals", () => {
  const sql = buildAdminAnalyticsSql({ clinicIds: [CLINIC], period: PERIOD });
  assert.match(sql, /'period', jsonb_build_object/);
  assert.match(sql, /v\.created_at >= .*2026-08-01.*at time zone 'Europe\/Moscow'/);
  assert.match(sql, /v\.created_at < .*2026-08-30.*interval '1 day'.*at time zone 'Europe\/Moscow'/);
  assert.match(sql, /a\.kind in \('overview_photo', 'dermoscopy'\)/);
  assert.match(sql, /r\.signed_at >=/);
  assert.match(sql, /p\.deleted_at is null/);
  assert.match(sql, /v\.clinic_id in/);
  assert.match(sql, /'visits', \(select count\(\*\)::int from visits v where true/);
  assert.match(sql, /'auditEvents7d'.*interval '7 days'/);
  assert.doesNotMatch(buildAdminAnalyticsSql({ clinicIds: [CLINIC] }), /'period'/);
});

test("analytics rejects an impossible period before querying or auditing", async () => {
  const { service, queries, audits } = serviceFixture();
  await assert.rejects(() => service.getAnalytics(AUTH, {}, new URLSearchParams({ ...PERIOD, dateTo: "2026-02-31" })), (e) => e.publicStatus === 422);
  assert.equal(queries.length, 0);
  assert.equal(audits.length, 0);
});

test("analytics route returns the requested period with unchanged totals and tenant scope", async () => {
  const { service, queries } = serviceFixture();
  const response = await handleAdminManagementRequest({
    method: "GET", url: new URL(`https://synthetic.invalid/api/v1/admin/analytics?${new URLSearchParams(PERIOD)}&clinicId=foreign&allClinics=true`),
    request: { headers: {} }, config: { corsOrigins: [] }, requestOrigin: "",
    runtimeServices: { authService: { authenticate: async () => AUTH }, adminManagementService: service },
    correlationId: "period-test", now: () => "2026-08-30T00:00:00Z",
  });
  assert.equal(response.status, 200);
  const { item } = JSON.parse(response.body);
  assert.equal(item.visits, 20);
  assert.deepEqual(item.period, { ...PERIOD, visitsCreated: 2 });
  assert.deepEqual(queries[0].clinicIds, [CLINIC]);
  assert.equal(queries[0].allClinics, false);
});

for (const query of [
  "dateFrom=2026-08-01", "dateFrom=&dateTo=&timeZone=Europe/Moscow",
  "dateFrom=2026-08-30&dateTo=2026-08-01&timeZone=Europe/Moscow",
  "dateFrom=2026-02-29&dateTo=2026-03-01&timeZone=Europe/Moscow",
  "dateFrom=0000-01-01&dateTo=2026-01-01&timeZone=Europe/Moscow",
  "dateFrom=2026-01-01&dateTo=2026-01-01&timeZone=UTC",
  "dateFrom=2026-01-01&dateFrom=2026-02-01&dateTo=2026-03-01&timeZone=Europe/Moscow",
]) {
  test(`analytics rejects invalid date contract: ${query}`, async () => {
    const { service, queries, audits } = serviceFixture();
    await assert.rejects(() => service.getAnalytics(AUTH, {}, new URLSearchParams(query)), (e) => e.publicStatus === 422);
    assert.equal(queries.length + audits.length, 0);
  });
}

test("analytics accepts a leap day and retains the exact no-query contract", async () => {
  const { service, queries } = serviceFixture();
  const period = { ...PERIOD, dateFrom: "2024-02-29", dateTo: "2024-02-29" };
  assert.deepEqual((await service.getAnalytics(AUTH, {}, new URLSearchParams(period))).item.period, { ...period, visitsCreated: 2 });
  const old = await service.getAnalytics(AUTH);
  assert.deepEqual(old.item, { visits: 20, recentAuditEvents: [] });
  assert.deepEqual(queries[1], { roles: ["clinic_admin"], clinicIds: [CLINIC], allClinics: false });
});

for (const role of ["doctor", "private_doctor", "assistant", "operator", "patient", "no-clinic", "anonymous"]) {
  test(`analytics period does not grant access to ${role}`, async () => {
    const { service, queries, audits } = serviceFixture();
    const auth = role === "anonymous" ? null : { ...AUTH, roles: [role === "no-clinic" ? "clinic_admin" : role], clinicIds: role === "no-clinic" ? [] : [CLINIC] };
    await assert.rejects(() => service.getAnalytics(auth, {}, new URLSearchParams(PERIOD)), (e) => e.publicStatus === (role === "anonymous" ? 401 : 403));
    assert.equal(queries.length + audits.length, 0);
  });
}

test("period SQL scopes every table and system scope is explicit", () => {
  const clinicSql = buildAdminAnalyticsSql({ clinicIds: [CLINIC], period: PERIOD }).split("'period'")[1];
  for (const alias of ["p", "v", "a", "r"]) assert.ok(clinicSql.includes(`${alias}.clinic_id in ('${CLINIC}'::uuid)`));
  const systemSql = buildAdminAnalyticsSql({ allClinics: true, period: PERIOD });
  assert.doesNotMatch(systemSql, /clinic_id in/);
  assert.match(buildAdminAnalyticsSql({ clinicIds: [], period: PERIOD }), /clinic_id in \(null\)/);
});
