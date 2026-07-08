import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

import { expect, type Response, test } from "@playwright/test";

import {
  appMain,
  bannerText,
  expectMainTapTargets,
  expectNoHorizontalOverflow,
  mainText,
} from "./live-admin-test-helpers";

const BASE_URL = (process.env.STAGE4M_LIVE_BOT_BOOKING_BASE_URL || "https://pro.skindoktor.ru").replace(/\/+$/, "");
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

function setupBotBookingFixture({
  suffix,
  clinicName,
  patientName,
  patientEmail,
  patientPassword,
}: {
  suffix: string;
  clinicName: string;
  patientName: string;
  patientEmail: string;
  patientPassword: string;
}) {
  const clinicSlug = safeSlug(`live-bot-booking-${suffix}`);
  const patientCode = `LIVE-BOT-${suffix}`;
  const passwordHash = hashPatientPassword(patientPassword);
  const sql = `
begin;

with upserted_clinic as (
  insert into clinics (slug, name, timezone, address)
  values (${sqlLiteral(clinicSlug)}, ${sqlLiteral(clinicName)}, 'Europe/Moscow', ${sqlLiteral(`Краснодар, помощник записи ${suffix}`)})
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
linked_patient as (
  insert into patient_user_links (user_id, patient_id)
  select u.id, p.id
  from upserted_user u
  cross join upserted_patient p
  on conflict (user_id, patient_id) do nothing
  returning user_id
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
  'stage4m.bot_booking_live_fixture',
  'patient_portal',
  p.id,
  ${sqlLiteral(`stage4m-bot-booking-live-${suffix}`)},
  jsonb_build_object('source', 'live_e2e_fixture', 'role', 'patient')
from upserted_clinic c
cross join upserted_user u
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

test.describe("Live production bot mini-app booking journey", () => {
  test("patient signs in, opens mini-app booking, sends request, and sees persisted feedback", async ({
    page,
  }, testInfo) => {
    test.skip(CONFIRMATION !== REQUIRED_CONFIRMATION, `Set STAGE4M_CONFIRM_CREATE_TEST_CLINIC=${REQUIRED_CONFIRMATION}`);

    const suffix = makeSuffix();
    const clinicName = `Клиника помощника ${suffix}`;
    const patientName = `Пациент помощника ${suffix}`;
    const patientEmail = `bot-booking-live-${suffix}@skindoktor.ru`;
    const patientPassword = `Dp-${suffix}-Bot-2026!`;
    const bookingReason = `Запись через помощника ${suffix}`;
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const responses: { method: string; path: string; status: number }[] = [];

    setupBotBookingFixture({
      suffix,
      clinicName,
      patientName,
      patientEmail,
      patientPassword,
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      try {
        const url = new URL(response.url());
        if (url.pathname === "/api/v1/me/portal" || url.pathname === "/api/v1/me/booking-requests") {
          responses.push({
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
    await page.getByLabel("Эл. почта").fill(patientEmail);
    await page.getByLabel("Пароль").fill(patientPassword);
    const loginPortalResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/me\/portal$/),
    );
    await page.getByRole("button", { name: /^Войти$/ }).click();
    await expect(bannerText(page, "Рабочее место · Пациент")).toBeVisible({ timeout: 15_000 });
    const loginPortalResponse = await loginPortalResponsePromise;
    expect(loginPortalResponse.status()).toBeGreaterThanOrEqual(200);
    expect(loginPortalResponse.status()).toBeLessThan(300);

    const miniAppPortalResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/me\/portal$/),
    );
    await page.goto("/bot-sim/miniapp/booking", { waitUntil: "networkidle" });
    const miniAppPortalResponse = await miniAppPortalResponsePromise;
    expect(miniAppPortalResponse.status()).toBeGreaterThanOrEqual(200);
    expect(miniAppPortalResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { level: 1, name: "Помощник записи" })).toBeVisible();
    await expect(mainText(page, patientName)).toBeVisible();
    await expect(mainText(page, clinicName)).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|Учебная|учебная|демо|mock|system_admin|clinic_admin|doctor|private_doctor|operator|backend|self-hosted|PostgreSQL|diagnosis|risk|prognosis|treatment|measurement|dynamicConclusion|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );

    await page.getByLabel("Предпочтительное начало записи").fill("2026-07-18T10:00");
    await page.getByLabel("Причина запроса на запись").fill(bookingReason);
    const createBookingResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "POST", /^\/api\/v1\/me\/booking-requests$/),
    );
    await page.getByRole("button", { name: "Отправить заявку" }).click();
    const createBookingResponse = await createBookingResponsePromise;
    expect(createBookingResponse.status()).toBeGreaterThanOrEqual(200);
    expect(createBookingResponse.status()).toBeLessThan(300);
    await expect(mainText(page, "Заявка на запись отправлена в клинику.")).toBeVisible();
    await expect(mainText(page, bookingReason)).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-bot-booking-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Помощник записи" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-bot-booking-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin/clinics", { waitUntil: "networkidle" });
    await expect(mainText(page, "Нет доступа")).toBeVisible();
    await expect(mainText(page, "Пациент")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Клиники и кабинеты" })).toHaveCount(0);

    for (const expected of [
      ["GET", "/api/v1/me/portal"],
      ["POST", "/api/v1/me/booking-requests"],
    ] as const) {
      expect(
        responses.some((response) =>
          response.method === expected[0] &&
          response.path === expected[1] &&
          response.status >= 200 &&
          response.status < 300,
        ),
        `missing successful ${expected[0]} ${expected[1]}`,
      ).toBe(true);
    }
    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  });
});
