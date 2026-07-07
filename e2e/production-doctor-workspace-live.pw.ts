import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

import { expect, type Response, test } from "@playwright/test";

import {
  appMain,
  bannerText,
  expectMainTapTargets,
  expectNoHorizontalOverflow,
  mainLink,
  mainText,
  pageHeaderText,
  sidebarLink,
  sidebarLinks,
} from "./live-admin-test-helpers";

const BASE_URL = (process.env.STAGE4M_LIVE_DOCTOR_BASE_URL || "https://pro.skindoktor.ru").replace(/\/+$/, "");
const CREDENTIALS_FILE = process.env.STAGE4M_DOCTOR_SETUP_CREDENTIALS_FILE || "/root/dermatolog-pro-admin-credentials.txt";
const REQUIRED_CONFIRMATION = "I_CONFIRM_CREATE_TEST_CLINIC";
const CONFIRMATION = process.env.STAGE4M_CONFIRM_CREATE_TEST_CLINIC || "";
const COMPOSE_ENV_FILE = process.env.STAGE4M_COMPOSE_ENV_FILE || "deploy/self-hosted/.env.production";
const COMPOSE_PROJECT_NAME = process.env.STAGE4M_COMPOSE_PROJECT_NAME || "dermatolog-pro-production";
const COMPOSE_FILES = [
  process.env.STAGE4M_COMPOSE_BASE_FILE || "deploy/self-hosted/docker-compose.stage4a.yml",
  process.env.STAGE4M_COMPOSE_PRODUCTION_FILE || "deploy/self-hosted/docker-compose.production.example.yml",
];

test.use({
  baseURL: BASE_URL,
});

function parseCredentials(text: string) {
  const email = text.match(/^Email:\s*(.+)$/m)?.[1]?.trim();
  const password = text.match(/^Password:\s*(.+)$/m)?.[1]?.trim();
  if (!email || !password) throw new Error("Credentials file must include Email and Password lines.");
  return { email, password };
}

function makeSuffix() {
  return randomBytes(4).toString("hex");
}

function isResponse(response: Response, method: string, matcher: RegExp) {
  const request = response.request();
  return request.method() === method && matcher.test(new URL(response.url()).pathname);
}

function sqlLiteral(value: unknown) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function safeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function redact(value: unknown, secrets: string[] = []) {
  let text = String(value ?? "")
    .replace(/\$scrypt\$[A-Za-z0-9_./$-]+/g, "[redacted-password-hash]")
    .replace(/postgres:\/\/([^:]+):([^@]+)@/g, "postgres://$1:[redacted]@")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted-token]");
  for (const secret of secrets) {
    if (secret) text = text.split(secret).join("[redacted-secret]");
  }
  return text;
}

function dockerComposeArgs(args: string[]) {
  const result = ["compose", "--env-file", COMPOSE_ENV_FILE];
  for (const file of COMPOSE_FILES) result.push("-f", file);
  return [...result, "-p", COMPOSE_PROJECT_NAME, ...args];
}

function hashPassword(password: string) {
  const result = spawnSync("node", ["--input-type=module", "-"], {
    input: [
      'import { hashPassword } from "./backend/self-hosted/auth-crypto.mjs";',
      "const password = process.env.STAGE4M_DOCTOR_FIXTURE_PASSWORD || '';",
      "process.stdout.write(hashPassword(password));",
    ].join("\n"),
    encoding: "utf8",
    env: {
      ...process.env,
      STAGE4M_DOCTOR_FIXTURE_PASSWORD: password,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    throw new Error(redact(result.stderr || result.error?.message || `password hash failed with exit ${result.status}`, [password]));
  }
  return result.stdout.trim();
}

function setupDoctorVisitReportFixture({
  suffix,
  clinicName,
  doctorDisplayName,
  doctorEmail,
  doctorPassword,
  patientFullName,
  visitComplaint,
}: {
  suffix: string;
  clinicName: string;
  doctorDisplayName: string;
  doctorEmail: string;
  doctorPassword: string;
  patientFullName: string;
  visitComplaint: string;
}) {
  const clinicSlug = safeSlug(`live-doctor-visit-report-${suffix}`);
  const patientCode = `LIVE-REPORT-${suffix}`;
  const passwordHash = hashPassword(doctorPassword);
  const sql = `
begin;

with upserted_clinic as (
  insert into clinics (slug, name, timezone, address)
  values (${sqlLiteral(clinicSlug)}, ${sqlLiteral(clinicName)}, 'Europe/Moscow', ${sqlLiteral(`Краснодар, отчёты ${suffix}`)})
  on conflict (slug) do update
  set name = excluded.name,
      address = excluded.address,
      updated_at = now()
  returning id, name
),
upserted_doctor as (
  insert into app_users (email, display_name, password_hash, disabled_at)
  values (${sqlLiteral(doctorEmail)}, ${sqlLiteral(doctorDisplayName)}, ${sqlLiteral(passwordHash)}, null)
  on conflict (email) do update
  set display_name = excluded.display_name,
      password_hash = excluded.password_hash,
      disabled_at = null,
      updated_at = now()
  returning id
),
doctor_role as (
  insert into user_roles (user_id, clinic_id, role)
  select d.id, c.id, 'doctor'::app_role
  from upserted_doctor d
  cross join upserted_clinic c
  on conflict (user_id, clinic_id, role) do nothing
  returning id
),
upserted_patient as (
  insert into patients (clinic_id, code, full_name, birth_date, sex, phototype, imaging_consent, created_by)
  select c.id, ${sqlLiteral(patientCode)}, ${sqlLiteral(patientFullName)}, '1987-04-12'::date, 'female', 'III', true, d.id
  from upserted_clinic c
  cross join upserted_doctor d
  on conflict (clinic_id, code) do update
  set full_name = excluded.full_name,
      imaging_consent = true,
      deleted_at = null,
      updated_at = now()
  returning id, clinic_id
),
created_visit as (
  insert into visits (clinic_id, patient_id, doctor_user_id, status, started_at, chief_complaint)
  select c.id, p.id, d.id, 'in_progress'::visit_status, now(), ${sqlLiteral(visitComplaint)}
  from upserted_clinic c
  cross join upserted_patient p
  cross join upserted_doctor d
  returning id, clinic_id, patient_id, doctor_user_id
),
created_lesion as (
  insert into lesions (clinic_id, patient_id, visit_id, label, body_zone, body_surface, risk_level)
  select v.clinic_id, v.patient_id, v.id, ${sqlLiteral(`Очаг отчёта ${suffix}`)}, 'предплечье', 'front', 'low'
  from created_visit v
  returning id
),
created_report as (
  insert into reports (clinic_id, patient_id, visit_id, doctor_user_id, status, physician_text, patient_safe_text)
  select v.clinic_id, v.patient_id, v.id, v.doctor_user_id, 'draft', ${sqlLiteral(`Черновик врача ${suffix}`)}, ${sqlLiteral(`Текст для пациента ${suffix}`)}
  from created_visit v
  returning id
)
insert into audit_log (clinic_id, actor_user_id, action, entity_type, entity_id, correlation_id, metadata_json)
select
  c.id,
  d.id,
  'stage4m.doctor_visit_report_live_fixture',
  'visit',
  v.id,
  ${sqlLiteral(`stage4m-doctor-visit-report-${suffix}`)},
  jsonb_build_object('source', 'live_e2e_fixture', 'role', 'doctor')
from upserted_clinic c
cross join upserted_doctor d
cross join created_visit v;

commit;
`.trim();

  const result = spawnSync("docker", dockerComposeArgs([
    "exec",
    "-T",
    "postgres",
    "psql",
    "--no-psqlrc",
    "--quiet",
    "--set",
    "ON_ERROR_STOP=1",
    "-U",
    "dermatolog",
    "-d",
    "dermatolog_pro",
  ]), {
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error || result.status !== 0) {
    throw new Error(redact(result.stderr || result.stdout || result.error?.message || `fixture failed with exit ${result.status}`, [
      doctorPassword,
      passwordHash,
    ]));
  }
}

test.describe("Live production doctor workspace journey", () => {
  test("doctor signs in, sees scoped workspace, creates an intake request, and cannot enter admin", async ({
    page,
  }, testInfo) => {
    test.skip(CONFIRMATION !== REQUIRED_CONFIRMATION, `Set STAGE4M_CONFIRM_CREATE_TEST_CLINIC=${REQUIRED_CONFIRMATION}`);

    const { email, password } = parseCredentials(readFileSync(CREDENTIALS_FILE, "utf8"));
    const suffix = makeSuffix();
    const clinicName = `Клиника врача ${suffix}`;
    const clinicAddress = `Краснодар, врачебная ${suffix}`;
    const doctorDisplayName = `Врач Dermatolog Pro ${suffix}`;
    const doctorEmail = `doctor-live-${suffix}@skindoktor.ru`;
    const doctorPassword = `Dp-${suffix}-Doctor-2026!`;
    const leadSummary = `Проверочная заявка врача ${suffix}`;
    const patientFullName = `Пациент Врача ${suffix}`;
    const updatedPatientFullName = `Пациент Врача ${suffix} обновлён`;
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const doctorResponses: { method: string; path: string; status: number }[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      try {
        const url = new URL(response.url());
        if (
          url.pathname === "/api/v1/doctor/dashboard" ||
          url.pathname === "/api/v1/leads/appointments" ||
          url.pathname === "/api/v1/leads" ||
          url.pathname === "/api/v1/patients" ||
          /^\/api\/v1\/patients\/[^/]+$/.test(url.pathname)
        ) {
          doctorResponses.push({
            method: response.request().method(),
            path: url.pathname,
            status: response.status(),
          });
        }
      } catch {
        // Ignore non-URL response records.
      }
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/self-hosted/login", { waitUntil: "networkidle" });
    await page.getByLabel("Адрес системы клиники").fill(BASE_URL);
    await page.getByLabel("Эл. почта").fill(email);
    await page.getByLabel("Пароль").fill(password);
    await page.getByRole("button", { name: /^Войти$/ }).click();

    await expect(bannerText(page, "Рабочее место · Системный администратор")).toBeVisible({ timeout: 15_000 });

    await sidebarLink(page, "Клиники и кабинеты").click();
    await expect(page.getByRole("heading", { name: "Клиники и кабинеты" })).toBeVisible();
    await page.getByLabel("Название клиники").fill(clinicName);
    await page.getByLabel("Адрес клиники").fill(clinicAddress);
    await page.getByLabel("Часовой пояс клиники").click();
    await page.getByRole("option", { name: "Москва, Краснодар · UTC+3" }).click();
    const createClinicResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "POST", /^\/api\/v1\/admin\/clinics$/),
    );
    await page.getByRole("button", { name: "Создать клинику" }).click();
    const createClinicResponse = await createClinicResponsePromise;
    expect(createClinicResponse.status()).toBeGreaterThanOrEqual(200);
    expect(createClinicResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Клиника сохранена и добавлена в список: ${clinicName}`)).toBeVisible();

    await sidebarLink(page, "Врачи").click();
    await expect(page.getByRole("heading", { level: 1, name: "Врачи" })).toBeVisible();
    await page.getByLabel("ФИО врача").fill(doctorDisplayName);
    await page.getByLabel("Эл. почта").fill(doctorEmail);
    await page.getByLabel("Временный пароль").fill(doctorPassword);
    await page.getByLabel("Тип врача").selectOption("doctor");
    await page.getByLabel("Клиника").selectOption({ label: clinicName });
    const createDoctorResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "POST", /^\/api\/v1\/admin\/doctors$/),
    );
    await page.getByRole("button", { name: "Добавить врача" }).click();
    const createDoctorResponse = await createDoctorResponsePromise;
    expect(createDoctorResponse.status()).toBeGreaterThanOrEqual(200);
    expect(createDoctorResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Врач добавлен: ${doctorDisplayName}`)).toBeVisible();
    await expect(mainText(page, doctorEmail).first()).toBeVisible();

    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page.getByRole("button", { name: /^Войти$/ })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Адрес системы клиники").fill(BASE_URL);
    await page.getByLabel("Эл. почта").fill(doctorEmail);
    await page.getByLabel("Пароль").fill(doctorPassword);
    const dashboardResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/doctor\/dashboard$/),
    );
    const leadsResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/leads\/appointments$/),
    );
    await page.getByRole("button", { name: /^Войти$/ }).click();
    await expect(bannerText(page, "Рабочее место · Дерматолог")).toBeVisible({ timeout: 15_000 });
    const [dashboardResponse, leadsResponse] = await Promise.all([dashboardResponsePromise, leadsResponsePromise]);
    expect(dashboardResponse.status()).toBeGreaterThanOrEqual(200);
    expect(dashboardResponse.status()).toBeLessThan(300);
    expect(leadsResponse.status()).toBeGreaterThanOrEqual(200);
    expect(leadsResponse.status()).toBeLessThan(300);

    await expect(page.getByRole("heading", { level: 1, name: "Рабочий стол" })).toBeVisible();
    await expect(mainText(page, `${doctorDisplayName} · рабочий стол клиники`)).toBeVisible();
    await expect(mainText(page, "Источник данных: система клиники.").first()).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная роль|учебная очередь|демо|mock|system_admin|clinic_admin|backend|self-hosted|PostgreSQL|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );

    for (const name of [
      "Рабочее место врача",
      "Рабочий стол",
      "Пациенты",
      "Визиты",
      "Отчёты",
      "Карта тела",
      "Съёмка",
      "Справка",
    ]) {
      await expect(sidebarLinks(page, name), `doctor sidebar should include ${name}`).toHaveCount(1);
    }
    for (const name of [
      "Клиники и кабинеты",
      "Сотрудники и доступ",
      "Устройства",
      "Аудит",
      "События доступа",
      "Готовность публикации",
      "Рабочий контур",
      "Служебные ключи",
    ]) {
      await expect(sidebarLinks(page, name), `doctor sidebar should not include ${name}`).toHaveCount(0);
    }

    await page.getByLabel("Краткое описание заявки").fill(leadSummary);
    const createLeadResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "POST", /^\/api\/v1\/leads$/),
    );
    await page.getByRole("button", { name: "Добавить заявку" }).click();
    const createLeadResponse = await createLeadResponsePromise;
    expect(createLeadResponse.status()).toBeGreaterThanOrEqual(200);
    expect(createLeadResponse.status()).toBeLessThan(300);
    await expect(mainText(page, /создана в системе клиники/)).toBeVisible();
    await expect(mainText(page, leadSummary).first()).toBeVisible();

    const patientsListResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/patients$/),
    );
    await sidebarLink(page, "Пациенты").click();
    const patientsListResponse = await patientsListResponsePromise;
    expect(patientsListResponse.status()).toBeGreaterThanOrEqual(200);
    expect(patientsListResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { level: 1, name: "Пациенты" })).toBeVisible();
    await expect(mainText(page, "Рабочий режим:")).toBeVisible();

    await page.getByRole("button", { name: "Новый пациент" }).click();
    const createPatientDialog = page.getByRole("dialog", { name: "Новый пациент" });
    await expect(createPatientDialog).toBeVisible();
    await createPatientDialog.getByRole("button", { name: "Создать пациента" }).click();
    await expect(createPatientDialog.getByText("Укажите ФИО пациента.")).toBeVisible();
    await createPatientDialog.getByLabel("ФИО").fill(patientFullName);
    await createPatientDialog.getByLabel("Дата рождения").fill("1990-06-15");
    await createPatientDialog.getByLabel("Пол пациента").click();
    await page.getByRole("option", { name: "Мужской" }).click();
    await createPatientDialog.getByLabel("Фототип пациента").click();
    await page.getByRole("option", { name: "III" }).click();
    await createPatientDialog.getByLabel("Согласие на медицинскую съёмку").click();
    const createPatientResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "POST", /^\/api\/v1\/patients$/),
    );
    await createPatientDialog.getByRole("button", { name: "Создать пациента" }).click();
    const createPatientResponse = await createPatientResponsePromise;
    expect(createPatientResponse.status()).toBeGreaterThanOrEqual(200);
    expect(createPatientResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Пациент ${patientFullName} создан в системе клиники.`)).toBeVisible();
    await expect(mainText(page, patientFullName)).toBeVisible();

    await page.getByLabel(`Редактировать пациента ${patientFullName}`).filter({ visible: true }).first().click();
    const editPatientDialog = page.getByRole("dialog", { name: "Редактировать пациента" });
    await expect(editPatientDialog).toBeVisible();
    await editPatientDialog.getByLabel("ФИО").fill(updatedPatientFullName);
    const editPatientResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "PATCH", /^\/api\/v1\/patients\/[^/]+$/),
    );
    await editPatientDialog.getByRole("button", { name: "Сохранить изменения" }).click();
    const editPatientResponse = await editPatientResponsePromise;
    expect(editPatientResponse.status()).toBeGreaterThanOrEqual(200);
    expect(editPatientResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Изменения по пациенту ${updatedPatientFullName} сохранены в системе клиники.`)).toBeVisible();
    await expect(mainText(page, updatedPatientFullName)).toBeVisible();

    const patientDetailResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/patients\/[^/]+$/),
    );
    await mainLink(page, updatedPatientFullName).click();
    const patientDetailResponse = await patientDetailResponsePromise;
    expect(patientDetailResponse.status()).toBeGreaterThanOrEqual(200);
    expect(patientDetailResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { level: 1, name: updatedPatientFullName })).toBeVisible();
    await expect(mainText(page, "Данные из системы клиники")).toBeVisible();
    await mainLink(page, "К списку").click();
    await expect(page.getByRole("heading", { level: 1, name: "Пациенты" })).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-doctor-patients-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Пациенты" })).toBeVisible();
    await expect(mainText(page, updatedPatientFullName)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-doctor-patients-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByLabel(`Скрыть пациента ${updatedPatientFullName}`).filter({ visible: true }).first().click();
    await expect(page.getByRole("alertdialog", { name: "Архивировать пациента?" })).toBeVisible();
    const archivePatientResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "DELETE", /^\/api\/v1\/patients\/[^/]+$/),
    );
    await page.getByRole("button", { name: "Архивировать" }).click();
    const archivePatientResponse = await archivePatientResponsePromise;
    expect(archivePatientResponse.status()).toBeGreaterThanOrEqual(200);
    expect(archivePatientResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Пациент ${updatedPatientFullName} архивирован в системе клиники.`)).toBeVisible();
    await expect(page.getByLabel(`Редактировать пациента ${updatedPatientFullName}`)).toHaveCount(0);

    await sidebarLink(page, "Рабочий стол").click();
    await expect(page.getByRole("heading", { level: 1, name: "Рабочий стол" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-doctor-desk-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Рабочий стол" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-doctor-desk-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin/clinics", { waitUntil: "networkidle" });
    await expect(mainText(page, "Нет доступа")).toBeVisible();
    await expect(mainText(page, "Дерматолог")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Клиники и кабинеты" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    expect(doctorResponses.some((item) => item.method === "GET" && item.path === "/api/v1/doctor/dashboard" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(doctorResponses.some((item) => item.method === "GET" && item.path === "/api/v1/leads/appointments" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(doctorResponses.some((item) => item.method === "POST" && item.path === "/api/v1/leads" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(doctorResponses.some((item) => item.method === "GET" && item.path === "/api/v1/patients" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(doctorResponses.some((item) => item.method === "POST" && item.path === "/api/v1/patients" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(doctorResponses.some((item) => item.method === "PATCH" && /^\/api\/v1\/patients\/[^/]+$/.test(item.path) && item.status >= 200 && item.status < 300)).toBe(true);
    expect(doctorResponses.some((item) => item.method === "GET" && /^\/api\/v1\/patients\/[^/]+$/.test(item.path) && item.status >= 200 && item.status < 300)).toBe(true);
    expect(doctorResponses.some((item) => item.method === "DELETE" && /^\/api\/v1\/patients\/[^/]+$/.test(item.path) && item.status >= 200 && item.status < 300)).toBe(true);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("private doctor owner signs in, opens practice center, creates an intake request, and cannot enter system admin", async ({
    page,
  }, testInfo) => {
    test.skip(CONFIRMATION !== REQUIRED_CONFIRMATION, `Set STAGE4M_CONFIRM_CREATE_TEST_CLINIC=${REQUIRED_CONFIRMATION}`);

    const { email, password } = parseCredentials(readFileSync(CREDENTIALS_FILE, "utf8"));
    const suffix = makeSuffix();
    const practiceName = `Кабинет частного врача ${suffix}`;
    const practiceAddress = `Краснодар, частная практика ${suffix}`;
    const ownerDisplayName = `Частный врач ${suffix}`;
    const ownerEmail = `private-live-${suffix}@skindoktor.ru`;
    const ownerPassword = `Dp-${suffix}-Private-2026!`;
    const leadSummary = `Проверочная заявка частного кабинета ${suffix}`;
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const practiceResponses: { method: string; path: string; status: number }[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      try {
        const url = new URL(response.url());
        if (
          url.pathname === "/api/v1/admin/private-practices" ||
          url.pathname === "/api/v1/doctor/dashboard" ||
          url.pathname === "/api/v1/leads/appointments" ||
          url.pathname === "/api/v1/leads"
        ) {
          practiceResponses.push({
            method: response.request().method(),
            path: url.pathname,
            status: response.status(),
          });
        }
      } catch {
        // Ignore non-URL response records.
      }
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/self-hosted/login", { waitUntil: "networkidle" });
    await page.getByLabel("Адрес системы клиники").fill(BASE_URL);
    await page.getByLabel("Эл. почта").fill(email);
    await page.getByLabel("Пароль").fill(password);
    await page.getByRole("button", { name: /^Войти$/ }).click();
    await expect(bannerText(page, "Рабочее место · Системный администратор")).toBeVisible({ timeout: 15_000 });

    await sidebarLink(page, "Клиники и кабинеты").click();
    await expect(page.getByRole("heading", { name: "Клиники и кабинеты" })).toBeVisible();
    await page.getByLabel("Название кабинета").fill(practiceName);
    await page.getByLabel("Адрес кабинета").fill(practiceAddress);
    await page.getByLabel("ФИО владельца кабинета").fill(ownerDisplayName);
    await page.getByLabel("Эл. почта владельца кабинета").fill(ownerEmail);
    await page.getByLabel("Временный пароль владельца кабинета").fill(ownerPassword);
    await page.getByLabel("Часовой пояс кабинета").click();
    await page.getByRole("option", { name: "Москва, Краснодар · UTC+3" }).click();
    const createPracticeResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "POST", /^\/api\/v1\/admin\/private-practices$/),
    );
    await page.getByRole("button", { name: "Создать кабинет и владельца" }).click();
    const createPracticeResponse = await createPracticeResponsePromise;
    expect(createPracticeResponse.status()).toBeGreaterThanOrEqual(200);
    expect(createPracticeResponse.status()).toBeLessThan(300);
    await expect(
      mainText(page, `Кабинет создан: ${practiceName}. Владелец получил доступ администратора и частного врача.`),
    ).toBeVisible();

    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page.getByRole("button", { name: /^Войти$/ })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Адрес системы клиники").fill(BASE_URL);
    await page.getByLabel("Эл. почта").fill(ownerEmail);
    await page.getByLabel("Пароль").fill(ownerPassword);
    await page.getByRole("button", { name: /^Войти$/ }).click();
    await expect(bannerText(page, /Частный врач/)).toBeVisible({ timeout: 15_000 });

    await expect(sidebarLinks(page, "Центр практики")).toHaveCount(1);
    await sidebarLink(page, "Центр практики").click();
    await expect(page.getByRole("heading", { level: 1, name: "Центр частной практики" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(pageHeaderText(page, "Центр частной практики", `${ownerDisplayName} · ${practiceName}`)).toBeVisible();
    await expect(mainText(page, "Источник данных: система клиники.")).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная роль|учебная очередь|демо|mock|system_admin|backend|self-hosted|PostgreSQL|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );

    for (const name of [
      "Центр практики",
      "Рабочее место врача",
      "Рабочий стол",
      "Пациенты",
      "Визиты",
      "Отчёты",
      "Карта тела",
      "Съёмка",
      "Операционный центр",
      "Клиники и кабинеты",
      "Врачи",
      "Услуги",
      "Интеграции",
      "Бот",
      "Аналитика",
      "Управление доступом",
      "Справка",
    ]) {
      await expect(sidebarLinks(page, name), `private doctor owner sidebar should include ${name}`).toHaveCount(1);
    }
    for (const name of [
      "Сотрудники и доступ",
      "Устройства",
      "Аудит",
      "События доступа",
      "Готовность публикации",
      "Рабочий контур",
      "Служебные ключи",
    ]) {
      await expect(sidebarLinks(page, name), `private doctor owner sidebar should not include ${name}`).toHaveCount(0);
    }

    await expect
      .poll(() =>
        practiceResponses.some(
          (item) => item.method === "GET" && item.path === "/api/v1/doctor/dashboard" && item.status >= 200 && item.status < 300,
        ),
      )
      .toBe(true);
    await expect
      .poll(() =>
        practiceResponses.some(
          (item) => item.method === "GET" && item.path === "/api/v1/leads/appointments" && item.status >= 200 && item.status < 300,
        ),
      )
      .toBe(true);

    await page.getByLabel("Краткое описание заявки").fill(leadSummary);
    const createLeadResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "POST", /^\/api\/v1\/leads$/),
    );
    await page.getByRole("button", { name: "Добавить заявку" }).click();
    const createLeadResponse = await createLeadResponsePromise;
    expect(createLeadResponse.status()).toBeGreaterThanOrEqual(200);
    expect(createLeadResponse.status()).toBeLessThan(300);
    await expect(mainText(page, /Заявка создана в системе клиники/)).toBeVisible();
    await expect(mainText(page, leadSummary)).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-private-doctor-practice-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Центр частной практики" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-private-doctor-practice-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    await sidebarLink(page, "Клиники и кабинеты").click();
    await expect(page.getByRole("heading", { name: "Клиники и кабинеты" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Создать клинику" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Создать кабинет и владельца" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await page.goto("/sys/users", { waitUntil: "networkidle" });
    await expect(mainText(page, "Нет доступа")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Сотрудники и доступ" })).toHaveCount(0);

    expect(practiceResponses.some((item) => item.method === "POST" && item.path === "/api/v1/admin/private-practices" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(practiceResponses.some((item) => item.method === "POST" && item.path === "/api/v1/leads" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test("doctor opens visits and reports from real clinic records", async ({
    page,
  }, testInfo) => {
    test.skip(CONFIRMATION !== REQUIRED_CONFIRMATION, `Set STAGE4M_CONFIRM_CREATE_TEST_CLINIC=${REQUIRED_CONFIRMATION}`);

    const suffix = makeSuffix();
    const clinicName = `Клиника отчётов ${suffix}`;
    const doctorDisplayName = `Врач отчётов ${suffix}`;
    const doctorEmail = `doctor-reports-${suffix}@skindoktor.ru`;
    const doctorPassword = `Dp-${suffix}-Reports-2026!`;
    const patientFullName = `Пациент отчёта ${suffix}`;
    const visitComplaint = `Проверка визита и отчёта ${suffix}`;
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const visitResponses: { method: string; path: string; status: number }[] = [];

    setupDoctorVisitReportFixture({
      suffix,
      clinicName,
      doctorDisplayName,
      doctorEmail,
      doctorPassword,
      patientFullName,
      visitComplaint,
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      try {
        const url = new URL(response.url());
        if (
          url.pathname === "/api/v1/doctor/dashboard" ||
          url.pathname === "/api/v1/leads/appointments" ||
          url.pathname === "/api/v1/visits" ||
          /^\/api\/v1\/visits\/[^/]+$/.test(url.pathname) ||
          /^\/api\/v1\/visits\/[^/]+\/lesions$/.test(url.pathname) ||
          /^\/api\/v1\/visits\/[^/]+\/report$/.test(url.pathname) ||
          /^\/api\/v1\/visits\/[^/]+\/report-package$/.test(url.pathname)
        ) {
          visitResponses.push({
            method: response.request().method(),
            path: url.pathname,
            status: response.status(),
          });
        }
      } catch {
        // Ignore non-URL response records.
      }
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/self-hosted/login", { waitUntil: "networkidle" });
    await page.getByLabel("Адрес системы клиники").fill(BASE_URL);
    await page.getByLabel("Эл. почта").fill(doctorEmail);
    await page.getByLabel("Пароль").fill(doctorPassword);
    await page.getByRole("button", { name: /^Войти$/ }).click();
    await expect(bannerText(page, "Рабочее место · Дерматолог")).toBeVisible({ timeout: 15_000 });

    const visitsResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/visits$/),
    );
    await sidebarLink(page, "Визиты").click();
    const visitsResponse = await visitsResponsePromise;
    expect(visitsResponse.status()).toBeGreaterThanOrEqual(200);
    expect(visitsResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { level: 1, name: "Визиты" })).toBeVisible();
    await expect(mainText(page, "Данные загружаются из системы клиники.")).toBeVisible();

    const visitSearchResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/visits$/),
    );
    await page.getByLabel("Поиск визитов").fill(patientFullName);
    const visitSearchResponse = await visitSearchResponsePromise;
    expect(visitSearchResponse.status()).toBeGreaterThanOrEqual(200);
    expect(visitSearchResponse.status()).toBeLessThan(300);
    await expect(mainText(page, patientFullName)).toBeVisible();
    await expect(mainText(page, visitComplaint)).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная роль|учебная очередь|учебн|демо|mock|system_admin|clinic_admin|backend|self-hosted|PostgreSQL|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-doctor-visits-desktop-1280.png"), fullPage: true });

    const visitDetailResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/visits\/[^/]+$/),
    );
    await mainLink(page, "Открыть визит").click();
    const visitDetailResponse = await visitDetailResponsePromise;
    expect(visitDetailResponse.status()).toBeGreaterThanOrEqual(200);
    expect(visitDetailResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(patientFullName) })).toBeVisible();
    await expect(mainText(page, "Источник данных: система клиники")).toBeVisible();

    const reportResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/visits\/[^/]+\/report$/),
    );
    const reportPackageResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/visits\/[^/]+\/report-package$/),
    );
    await page.getByRole("tab", { name: "Отчёт" }).click();
    const [reportResponse, reportPackageResponse] = await Promise.all([
      reportResponsePromise,
      reportPackageResponsePromise,
    ]);
    expect(reportResponse.status()).toBeGreaterThanOrEqual(200);
    expect(reportResponse.status()).toBeLessThan(300);
    expect(reportPackageResponse.status()).toBeGreaterThanOrEqual(200);
    expect(reportPackageResponse.status()).toBeLessThan(300);
    await expect(mainText(page, "Рабочий отчёт")).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная роль|учебная очередь|учебн|демо|mock|system_admin|clinic_admin|backend|self-hosted|PostgreSQL|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );

    await sidebarLink(page, "Отчёты").click();
    await expect(page.getByRole("heading", { level: 1, name: "Отчёты" })).toBeVisible();
    const reportQueueResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/visits$/),
    );
    await page.getByLabel("Поиск отчётов").fill(patientFullName);
    const reportQueueResponse = await reportQueueResponsePromise;
    expect(reportQueueResponse.status()).toBeGreaterThanOrEqual(200);
    expect(reportQueueResponse.status()).toBeLessThan(300);
    await expect(mainText(page, patientFullName)).toBeVisible();
    await expect(mainText(page, "Черновик открыт")).toBeVisible();
    await expect(mainText(page, "Источник данных: система клиники.")).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная роль|учебная очередь|учебн|демо|mock|system_admin|clinic_admin|backend|self-hosted|PostgreSQL|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-doctor-reports-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Отчёты" })).toBeVisible();
    await expect(mainText(page, patientFullName)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-doctor-reports-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    await sidebarLink(page, "Визиты").click();
    await expect(page.getByRole("heading", { level: 1, name: "Визиты" })).toBeVisible();
    await page.getByLabel("Поиск визитов").fill(patientFullName);
    await expect(mainText(page, patientFullName)).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-doctor-visits-mobile-390.png"), fullPage: true });

    expect(visitResponses.some((item) => item.method === "GET" && item.path === "/api/v1/doctor/dashboard" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(visitResponses.some((item) => item.method === "GET" && item.path === "/api/v1/leads/appointments" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(visitResponses.some((item) => item.method === "GET" && item.path === "/api/v1/visits" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(visitResponses.some((item) => item.method === "GET" && /^\/api\/v1\/visits\/[^/]+$/.test(item.path) && item.status >= 200 && item.status < 300)).toBe(true);
    expect(visitResponses.some((item) => item.method === "GET" && /^\/api\/v1\/visits\/[^/]+\/report$/.test(item.path) && item.status >= 200 && item.status < 300)).toBe(true);
    expect(visitResponses.some((item) => item.method === "GET" && /^\/api\/v1\/visits\/[^/]+\/report-package$/.test(item.path) && item.status >= 200 && item.status < 300)).toBe(true);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
