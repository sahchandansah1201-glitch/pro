import { expect, type Page } from "@playwright/test";

export const SMOKE_PATIENT_ID = "10000000-0000-4000-8000-000000000201";
export const SMOKE_PATIENT_NAME = "Проверочный Пациент";
const CLINIC = { id: "10000000-0000-4000-8000-000000000101", name: "Проверочная клиника", slug: "synthetic" };

/** Test-only API boundary. No server, database, real credentials or demo role. */
export async function installWorkingSmoke(page: Page, role: "doctor" | "operator" | "clinic_admin" | "system_admin", baseURL: string) {
  const origin = new URL(baseURL).origin;
  const token = `synthetic-working-smoke-${role}`;
  const user = { id: "synthetic-user", displayName: "Проверочный сотрудник", roles: [role],
    roleBindings: [{ role, clinicId: CLINIC.id, clinicName: CLINIC.name, clinicSlug: CLINIC.slug }] };
  const state = {
    failure: false,
    unauthorized: [] as string[],
    unknown: [] as string[],
    external: [] as string[],
    blockedFontRequests: 0,
    requests: [] as Array<{ path: string; method: string }>,
    mutations: [] as Array<{ path: string; method: string; payload: Record<string, unknown> }>,
    patients: [{ id: SMOKE_PATIENT_ID, fullName: SMOKE_PATIENT_NAME, code: "SYNTHETIC-1",
      birthDate: "1990-01-02", sex: "female", phototype: "II", imagingConsent: false, clinic: CLINIC }],
    leads: [{ id: "10000000-0000-4000-8000-000000000501", patient: { id: SMOKE_PATIENT_ID, fullName: SMOKE_PATIENT_NAME, code: "SYNTHETIC-1" },
      clinic: CLINIC, status: "new", source: "operator", safeSummary: "Проверочная заявка", createdAt: "2026-10-14T06:00:00Z" }],
  };
  await page.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) {
      if (url.origin === "https://fonts.googleapis.com") {
        state.blockedFontRequests += 1;
        await route.fulfill({ status: 200, contentType: "text/css", body: "" });
        return;
      }
      state.external.push(url.origin);
      await route.abort("blockedbyclient");
      return;
    }
    if (!url.pathname.startsWith("/api/v1/")) { await route.continue(); return; }
    const path = url.pathname, method = request.method();
    state.requests.push({ path, method });
    const reply = async (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/api/v1/auth/login" && method === "POST") {
      expect(request.postDataJSON()).toEqual({ email: `${role}@synthetic.invalid`, password: "synthetic-password-not-a-credential" });
      await reply({ accessToken: token, user, tokenType: "Bearer", expiresInSeconds: 3600 });
      return;
    }
    if (request.headers().authorization !== `Bearer ${token}`) {
      state.unauthorized.push(path); await reply({ error: { code: "unauthorized" } }, 401); return;
    }
    if (path === "/api/v1/auth/me") { await reply({ user }); return; }
    if (state.failure) { await reply({ error: { code: "unavailable", message: "Рабочие данные недоступны." } }, 503); return; }
    if (path === "/api/v1/admin/clinics") { await reply({ items: [CLINIC] }); return; }
    if (path === "/api/v1/admin/doctors") { await reply({ items: [] }); return; }
    if (path === "/api/v1/admin/analytics") { await reply({ item: { patientsTotal: 0, visitsTotal: 0, assetsTotal: 0, recentAuditEvents: [] } }); return; }
    if (path === "/api/v1/doctor/dashboard") {
      await reply({ kpis: {}, todayVisits: [], recentPatients: [], assetIssues: [], devices: [] }); return;
    }
    if (path === "/api/v1/patients" && method === "GET") { await reply({ items: state.patients }); return; }
    if (path === "/api/v1/patients" && method === "POST") {
      const payload = request.postDataJSON(); state.mutations.push({ path, method, payload });
      const patient = { ...state.patients[0], ...payload, id: "10000000-0000-4000-8000-000000000202", code: "SYNTHETIC-2" };
      state.patients.push(patient); await reply({ item: patient }); return;
    }
    if (path === `/api/v1/patients/${SMOKE_PATIENT_ID}`) { await reply({ item: state.patients[0] }); return; }
    if (path === "/api/v1/visits" || path === `/api/v1/patients/${SMOKE_PATIENT_ID}/visits`) { await reply({ items: [] }); return; }
    if (path === "/api/v1/leads/appointments") {
      await reply({ leads: state.leads, appointments: [], filters: {}, kpis: { leadsTotal: state.leads.length, newLeads: state.leads.length,
        qualifiedLeads: 0, bookedLeads: 0, plannedAppointments: 0, completedAppointments: 0 } }); return;
    }
    if (path === "/api/v1/leads" && method === "POST") {
      const payload = request.postDataJSON(); state.mutations.push({ path, method, payload });
      const lead = { ...state.leads[0], ...payload, patient: { id: "", fullName: "", code: "" }, id: "10000000-0000-4000-8000-000000000502" };
      state.leads.push(lead); await reply({ item: lead }); return;
    }
    if (path === "/api/v1/admin/audit-events") {
      const items = Array.from({ length: 12 }, (_, i) => ({ id: `synthetic-audit-${i}`, createdAt: "2026-10-14T06:00:00Z",
        action: i === 0 ? "device.register" : "report.generate", entityType: i === 0 ? "device" : "report",
        actorName: "Проверочный сотрудник", clinicName: CLINIC.name,
        access_token: "SENSITIVE_CANARY", patient_full_name: "PRIVATE_CANARY", storage_object_path: "PRIVATE_STORAGE_CANARY" }));
      await reply({ items }); return;
    }
    state.unknown.push(`${method} ${path}`);
    await reply({ error: { code: "missing_fixture" } }, 404);
  });
  return state;
}

export async function loginWorkingSmoke(page: Page, role: "doctor" | "operator" | "clinic_admin" | "system_admin") {
  await page.goto("/self-hosted/login");
  await page.getByLabel("Адрес системы клиники").fill(new URL(page.url()).origin);
  await page.getByLabel("Эл. почта", { exact: true }).fill(`${role}@synthetic.invalid`);
  await page.getByLabel("Пароль", { exact: true }).fill("synthetic-password-not-a-credential");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

export function expectWorkingFixtureSafe(state: Awaited<ReturnType<typeof installWorkingSmoke>>) {
  expect(state.unauthorized, "API requests must carry the working session").toEqual([]);
  expect(state.unknown, "unhandled API fixture requests").toEqual([]);
  expect(state.external, "external requests are blocked, not production tests").toEqual([]);
  expect(state.requests.filter(r => r.path === "/api/v1/auth/login")).toHaveLength(1);
}
