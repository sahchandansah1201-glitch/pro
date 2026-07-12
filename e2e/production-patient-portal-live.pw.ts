import { randomBytes, randomUUID } from "node:crypto";
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

const BASE_URL = (process.env.STAGE4M_LIVE_PATIENT_BASE_URL || "https://pro.skindoktor.ru").replace(/\/+$/, "");
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

function makeSuffix() {
  return randomBytes(4).toString("hex");
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

function hashPatientPassword(password: string) {
  const result = spawnSync("node", ["--input-type=module", "-"], {
    input: [
      'import { hashPassword } from "./backend/self-hosted/auth-crypto.mjs";',
      "const password = process.env.STAGE4M_PATIENT_FIXTURE_PASSWORD || '';",
      "process.stdout.write(hashPassword(password));",
    ].join("\n"),
    encoding: "utf8",
    env: {
      ...process.env,
      STAGE4M_PATIENT_FIXTURE_PASSWORD: password,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    throw new Error(redact(result.stderr || result.error?.message || `password hash failed with exit ${result.status}`, [password]));
  }
  return result.stdout.trim();
}

function setupPatientPortalFixture({
  suffix,
  clinicName,
  patientName,
  patientEmail,
  patientPassword,
  doctorId,
  visitId,
  reportId,
  reportText,
  physicianOnlyText,
}: {
  suffix: string;
  clinicName: string;
  patientName: string;
  patientEmail: string;
  patientPassword: string;
  doctorId: string;
  visitId: string;
  reportId: string;
  reportText: string;
  physicianOnlyText: string;
}) {
  const clinicSlug = safeSlug(`live-patient-${suffix}`);
  const patientCode = `LIVE-PATIENT-${suffix}`;
  const passwordHash = hashPatientPassword(patientPassword);
  const sql = `
begin;

with upserted_clinic as (
  insert into clinics (slug, name, timezone, address)
  values (${sqlLiteral(clinicSlug)}, ${sqlLiteral(clinicName)}, 'Europe/Moscow', ${sqlLiteral(`Краснодар, пациентский тест ${suffix}`)})
  on conflict (slug) do update
  set name = excluded.name,
      address = excluded.address,
      updated_at = now()
  returning id, name
),
upserted_user as (
  insert into app_users (email, display_name, password_hash, disabled_at)
  values (${sqlLiteral(patientEmail)}, ${sqlLiteral(patientName)}, ${sqlLiteral(passwordHash)}, null)
  on conflict (email) do update
  set display_name = excluded.display_name,
      password_hash = excluded.password_hash,
      disabled_at = null,
      updated_at = now()
  returning id, email, display_name
),
upserted_doctor as (
  insert into app_users (id, email, display_name, disabled_at)
  values (${sqlLiteral(doctorId)}::uuid, ${sqlLiteral(`patient-report-doctor-${suffix}@skindoktor.ru`)}, ${sqlLiteral(`Врач заключения ${suffix}`)}, null)
  on conflict (id) do update
  set display_name = excluded.display_name,
      disabled_at = null,
      updated_at = now()
  returning id
),
upserted_patient as (
  insert into patients (clinic_id, code, full_name, imaging_consent, created_by)
  select c.id, ${sqlLiteral(patientCode)}, ${sqlLiteral(patientName)}, false, null
  from upserted_clinic c
  on conflict (clinic_id, code) do update
  set full_name = excluded.full_name,
      deleted_at = null,
      updated_at = now()
  returning id, clinic_id, full_name
),
linked_role as (
  insert into user_roles (user_id, clinic_id, role)
  select u.id, c.id, 'patient'::app_role
  from upserted_user u
  cross join upserted_clinic c
  on conflict (user_id, clinic_id, role) do nothing
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
linked_patient as (
  insert into patient_user_links (user_id, patient_id)
  select u.id, p.id
  from upserted_user u
  cross join upserted_patient p
  on conflict (user_id, patient_id) do nothing
  returning user_id
),
created_visit as (
  insert into visits (id, clinic_id, patient_id, doctor_user_id, status, started_at, chief_complaint)
  select ${sqlLiteral(visitId)}::uuid, c.id, p.id, d.id, 'signed'::visit_status, now(), ${sqlLiteral(`Контрольное заключение пациента ${suffix}`)}
  from upserted_clinic c
  cross join upserted_patient p
  cross join upserted_doctor d
  on conflict (id) do update
  set chief_complaint = excluded.chief_complaint,
      status = excluded.status,
      started_at = excluded.started_at,
      updated_at = now()
  returning id, clinic_id, patient_id, doctor_user_id
),
created_report as (
  insert into reports (id, clinic_id, patient_id, visit_id, doctor_user_id, status, physician_text, patient_safe_text, signed_at)
  select ${sqlLiteral(reportId)}::uuid, v.clinic_id, v.patient_id, v.id, v.doctor_user_id, 'signed', ${sqlLiteral(physicianOnlyText)}, ${sqlLiteral(reportText)}, now()
  from created_visit v
  on conflict (id) do update
  set status = excluded.status,
      physician_text = excluded.physician_text,
      patient_safe_text = excluded.patient_safe_text,
      signed_at = excluded.signed_at,
      updated_at = now()
  returning id
),
preferences as (
  insert into patient_portal_reminder_preferences (
    user_id,
    patient_id,
    appointment_reminders_enabled,
    report_notifications_enabled,
    preferred_channel
  )
  select u.id, p.id, true, true, 'email'
  from upserted_user u
  cross join upserted_patient p
  on conflict (user_id) do update
  set appointment_reminders_enabled = true,
      report_notifications_enabled = true,
      preferred_channel = 'email',
      updated_at = now()
  returning user_id
)
insert into audit_log (clinic_id, actor_user_id, action, entity_type, entity_id, correlation_id, metadata_json)
select
  c.id,
  u.id,
  'stage4m.patient_portal_live_fixture',
  'patient_portal',
  p.id,
  ${sqlLiteral(`stage4m-patient-live-${suffix}`)},
  jsonb_build_object('source', 'live_e2e_fixture', 'role', 'patient', 'reportId', r.id::text)
from upserted_clinic c
cross join upserted_user u
cross join created_report r
cross join upserted_patient p;

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
      patientPassword,
      passwordHash,
    ]));
  }
}

function isResponse(response: Response, method: string, matcher: RegExp) {
  const request = response.request();
  return request.method() === method && matcher.test(new URL(response.url()).pathname);
}

function filterExpectedOptionalPhotoProtocol404(errors: string[], expected404Count: number) {
  let remaining = expected404Count;
  return errors.filter((error) => {
    if (remaining > 0 && /Failed to load resource: the server responded with a status of 404/.test(error)) {
      remaining -= 1;
      return false;
    }
    return true;
  });
}

test.describe("Live production patient portal journey", () => {
  test("patient signs in, opens portal history, creates booking request, and cannot enter other roles", async ({
    page,
  }, testInfo) => {
    test.skip(CONFIRMATION !== REQUIRED_CONFIRMATION, `Set STAGE4M_CONFIRM_CREATE_TEST_CLINIC=${REQUIRED_CONFIRMATION}`);

    const suffix = makeSuffix();
    const clinicName = `Клиника пациента ${suffix}`;
    const patientName = `Пациент Dermatolog Pro ${suffix}`;
    const patientEmail = `patient-live-${suffix}@skindoktor.ru`;
    const patientPassword = `Dp-${suffix}-Patient-2026!`;
    const doctorId = randomUUID();
    const visitId = randomUUID();
    const reportId = randomUUID();
    const patientReportText = `Пациентское заключение доступно в личном кабинете ${suffix}. Рекомендация: согласовать следующий контрольный осмотр с клиникой.`;
    const physicianOnlyText = `Внутренняя врачебная версия ${suffix}: не показывать пациенту.`;
    const bookingReason = `Проверочная запись пациента ${suffix}`;
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const patientResponses: { method: string; path: string; status: number }[] = [];
    let optionalPhotoProtocol404Count = 0;

    setupPatientPortalFixture({
      suffix,
      clinicName,
      patientName,
      patientEmail,
      patientPassword,
      doctorId,
      visitId,
      reportId,
      reportText: patientReportText,
      physicianOnlyText,
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      try {
        const url = new URL(response.url());
        if (
          url.pathname === "/api/v1/me/portal" ||
          url.pathname === "/api/v1/me/history" ||
          url.pathname === "/api/v1/me/booking-requests" ||
          url.pathname === "/api/v1/me/reminder-preferences" ||
          url.pathname === "/api/v1/me/follow-ups" ||
          url.pathname.startsWith("/api/v1/me/reports/")
        ) {
          patientResponses.push({
            method: response.request().method(),
            path: url.pathname,
            status: response.status(),
          });
        }
        if (
          url.pathname === `/api/v1/me/photo-protocols/${visitId}` &&
          response.request().method() === "GET" &&
          response.status() === 404
        ) {
          optionalPhotoProtocol404Count += 1;
        }
      } catch {
        // Ignore non-URL response records.
      }
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/self-hosted/login", { waitUntil: "networkidle" });
    await page.getByLabel("Адрес системы клиники").fill(BASE_URL);
    await page.getByLabel("Эл. почта").fill(patientEmail);
    await page.getByLabel("Пароль").fill(patientPassword);
    const portalResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/me\/portal$/),
    );
    await page.getByRole("button", { name: /^Войти$/ }).click();
    await expect(bannerText(page, "Рабочее место · Пациент")).toBeVisible({ timeout: 15_000 });
    const portalResponse = await portalResponsePromise;
    expect(portalResponse.status()).toBeGreaterThanOrEqual(200);
    expect(portalResponse.status()).toBeLessThan(300);

    await expect(page.getByRole("heading", { level: 1, name: "Личный кабинет" })).toBeVisible();
    await expect(pageHeaderText(page, "Личный кабинет", patientName)).toBeVisible();
    await expect(mainText(page, "Данные личного кабинета загружены из системы клиники.")).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная роль|демо|mock|system_admin|clinic_admin|doctor|private_doctor|operator|backend|self-hosted|PostgreSQL|diagnosis|risk|prognosis|treatment|measurement|dynamicConclusion|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );

    for (const name of ["Главная", "История очагов", "Отчёты", "Запись", "Напоминания", "Справка"]) {
      await expect(sidebarLinks(page, name), `patient sidebar should include ${name}`).toHaveCount(1);
    }
    for (const name of [
      "Клиники и кабинеты",
      "Сотрудники и доступ",
      "Врачи и ассистенты",
      "Аналитика",
      "Устройства",
      "Аудит",
      "События доступа",
      "Готовность публикации",
      "Рабочий контур",
      "Служебные ключи",
      "Рабочий стол",
      "Пациенты",
      "Визиты",
      "Карта тела",
      "Съёмка",
      "Заявки",
      "Запросы на запись",
      "Центр практики",
    ]) {
      await expect(sidebarLinks(page, name), `patient sidebar should not include ${name}`).toHaveCount(0);
    }

    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-patient-home-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Личный кабинет" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-patient-home-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    const historyResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/me\/history$/),
    );
    await sidebarLink(page, "История очагов").click();
    await expect(page.getByRole("heading", { level: 1, name: "История очагов" })).toBeVisible({ timeout: 15_000 });
    const historyResponse = await historyResponsePromise;
    expect(historyResponse.status()).toBeGreaterThanOrEqual(200);
    expect(historyResponse.status()).toBeLessThan(300);
    await expect(pageHeaderText(page, "История очагов", "Опубликованная клиникой история наблюдения")).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная роль|демо|mock|system_admin|clinic_admin|doctor|private_doctor|operator|backend|self-hosted|PostgreSQL|diagnosis|prognosis|treatment|dynamicConclusion|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-patient-history-desktop-1280.png"), fullPage: true });

    const reportsPortalRefreshPromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/me\/portal$/),
    );
    await sidebarLink(page, "Отчёты").click();
    await expect(page.getByRole("heading", { level: 1, name: "Заключения" })).toBeVisible({ timeout: 15_000 });
    const reportsPortalRefresh = await reportsPortalRefreshPromise;
    expect(reportsPortalRefresh.status()).toBeGreaterThanOrEqual(200);
    expect(reportsPortalRefresh.status()).toBeLessThan(300);
    await expect(pageHeaderText(page, "Заключения", "Опубликованные клиникой заключения")).toBeVisible();
    await expect(mainText(page, patientReportText)).toBeVisible();
    await expect(appMain(page)).not.toContainText(physicianOnlyText);
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная роль|демо|mock|system_admin|clinic_admin|doctor|private_doctor|operator|backend|self-hosted|PostgreSQL|diagnosis|prognosis|treatment|dynamicConclusion|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-patient-reports-desktop-1280.png"), fullPage: true });

    const reportDetailResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", new RegExp(`^/api/v1/me/reports/${reportId}$`)),
    );
    await mainLink(page, "Открыть").click();
    await expect(page.getByRole("heading", { level: 1, name: "Заключение" })).toBeVisible({ timeout: 15_000 });
    const reportDetailResponse = await reportDetailResponsePromise;
    expect(reportDetailResponse.status()).toBeGreaterThanOrEqual(200);
    expect(reportDetailResponse.status()).toBeLessThan(300);
    await expect(pageHeaderText(page, "Заключение", "Опубликовано клиникой для пациента")).toBeVisible();
    await expect(mainText(page, "Заключение для пациента")).toBeVisible();
    await expect(mainText(page, patientReportText)).toBeVisible();
    await expect(appMain(page)).not.toContainText(physicianOnlyText);
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная роль|демо|mock|system_admin|clinic_admin|doctor|private_doctor|operator|backend|self-hosted|PostgreSQL|diagnosis|prognosis|treatment|dynamicConclusion|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-patient-report-detail-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Заключение" })).toBeVisible();
    await expect(mainText(page, patientReportText)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-patient-report-detail-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    const bookingPortalRefreshPromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/me\/portal$/),
    );
    await sidebarLink(page, "Запись").click();
    await expect(page.getByRole("heading", { level: 1, name: "Запись на приём" })).toBeVisible({ timeout: 15_000 });
    const bookingPortalRefresh = await bookingPortalRefreshPromise;
    expect(bookingPortalRefresh.status()).toBeGreaterThanOrEqual(200);
    expect(bookingPortalRefresh.status()).toBeLessThan(300);
    await expect(mainText(page, "Самозапись пациента")).toBeVisible();
    await page.getByLabel("Предпочтительное начало записи").fill("2026-07-15T10:00");
    await page.getByLabel("Предпочтительное окончание записи").fill("2026-07-15T11:00");
    await page.getByLabel("Причина запроса на запись").fill(bookingReason);
    const createBookingResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "POST", /^\/api\/v1\/me\/booking-requests$/),
    );
    await page.getByRole("button", { name: "Отправить запрос" }).click();
    const createBookingResponse = await createBookingResponsePromise;
    expect(createBookingResponse.status()).toBeGreaterThanOrEqual(200);
    expect(createBookingResponse.status()).toBeLessThan(300);
    await expect(mainText(page, "Запрос на запись отправлен в клинику.")).toBeVisible();
    await expect(mainText(page, bookingReason)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-patient-booking-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Запись на приём" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-patient-booking-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    const remindersPortalRefreshPromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/me\/portal$/),
    );
    const followUpsResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/me\/follow-ups$/),
    );
    await sidebarLink(page, "Напоминания").click();
    await expect(page.getByRole("heading", { level: 1, name: "Напоминания" })).toBeVisible({ timeout: 15_000 });
    const [remindersPortalRefresh, followUpsResponse] = await Promise.all([
      remindersPortalRefreshPromise,
      followUpsResponsePromise,
    ]);
    expect(remindersPortalRefresh.status()).toBeGreaterThanOrEqual(200);
    expect(remindersPortalRefresh.status()).toBeLessThan(300);
    expect(followUpsResponse.status()).toBeGreaterThanOrEqual(200);
    expect(followUpsResponse.status()).toBeLessThan(300);
    await expect(pageHeaderText(page, "Напоминания", "Настройки напоминаний и сообщения клиники")).toBeVisible();
    await page.getByLabel("Напоминать о ближайшем приёме").uncheck();
    await page.getByLabel("Канал уведомлений пациента").selectOption("phone");
    const reminderPreferencesResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "PATCH", /^\/api\/v1\/me\/reminder-preferences$/),
    );
    await page.getByRole("button", { name: "Сохранить настройки" }).click();
    const reminderPreferencesResponse = await reminderPreferencesResponsePromise;
    expect(reminderPreferencesResponse.status()).toBeGreaterThanOrEqual(200);
    expect(reminderPreferencesResponse.status()).toBeLessThan(300);
    await expect(mainText(page, "Настройки напоминаний сохранены.")).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная роль|демо|mock|system_admin|clinic_admin|doctor|private_doctor|operator|backend|self-hosted|PostgreSQL|diagnosis|risk|prognosis|treatment|measurement|dynamicConclusion|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-patient-reminders-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Напоминания" })).toBeVisible();
    await expect(mainText(page, "Настройки напоминаний сохранены.")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-patient-reminders-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    for (const [route, heading] of [
      ["/admin/clinics", "Клиники и кабинеты"],
      ["/desk", "Рабочий стол"],
      ["/operator", "Консоль оператора"],
    ] as const) {
      await page.goto(route, { waitUntil: "networkidle" });
      await expect(mainText(page, "Нет доступа")).toBeVisible();
      await expect(mainText(page, "Пациент")).toBeVisible();
      await expect(page.getByRole("heading", { name: heading })).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    }

    for (const expected of [
      ["GET", "/api/v1/me/portal"],
      ["GET", "/api/v1/me/history"],
      ["GET", `/api/v1/me/reports/${reportId}`],
      ["POST", "/api/v1/me/booking-requests"],
      ["GET", "/api/v1/me/follow-ups"],
      ["PATCH", "/api/v1/me/reminder-preferences"],
    ] as const) {
      expect(
        patientResponses.some((response) =>
          response.method === expected[0] &&
          response.path === expected[1] &&
          response.status >= 200 &&
          response.status < 300,
        ),
        `missing successful ${expected[0]} ${expected[1]}`,
      ).toBe(true);
    }
    expect(optionalPhotoProtocol404Count).toBeLessThanOrEqual(1);
    const unexpectedConsoleErrors = filterExpectedOptionalPhotoProtocol404(consoleErrors, optionalPhotoProtocol404Count);
    expect(unexpectedConsoleErrors, unexpectedConsoleErrors.join("\n")).toEqual([]);
    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  });
});
