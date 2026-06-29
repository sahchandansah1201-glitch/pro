import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

import { expect, type Response, test } from "@playwright/test";

import {
  appMain,
  bannerText,
  expectMainTapTargets,
  expectNoHorizontalOverflow,
  mainText,
  pageHeaderText,
  sidebarLink,
  sidebarLinks,
} from "./live-admin-test-helpers";

const BASE_URL = (process.env.STAGE4M_LIVE_ASSISTANT_BASE_URL || "https://pro.skindoktor.ru").replace(/\/+$/, "");
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

function hashPassword(password: string) {
  const result = spawnSync("node", ["--input-type=module", "-"], {
    input: [
      'import { hashPassword } from "./backend/self-hosted/auth-crypto.mjs";',
      "const password = process.env.STAGE4M_ASSISTANT_FIXTURE_PASSWORD || '';",
      "process.stdout.write(hashPassword(password));",
    ].join("\n"),
    encoding: "utf8",
    env: {
      ...process.env,
      STAGE4M_ASSISTANT_FIXTURE_PASSWORD: password,
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.error || result.status !== 0) {
    throw new Error(redact(result.stderr || result.error?.message || `password hash failed with exit ${result.status}`, [password]));
  }
  return result.stdout.trim();
}

function setupAssistantCaptureFixture({
  suffix,
  clinicName,
  assistantName,
  assistantEmail,
  assistantPassword,
}: {
  suffix: string;
  clinicName: string;
  assistantName: string;
  assistantEmail: string;
  assistantPassword: string;
}) {
  const clinicSlug = safeSlug(`live-assistant-${suffix}`);
  const patientCode = `LIVE-ASSISTANT-${suffix}`;
  const passwordHash = hashPassword(assistantPassword);
  const sql = `
begin;

with upserted_clinic as (
  insert into clinics (slug, name, timezone, address)
  values (${sqlLiteral(clinicSlug)}, ${sqlLiteral(clinicName)}, 'Europe/Moscow', ${sqlLiteral(`Краснодар, ассистент ${suffix}`)})
  on conflict (slug) do update
  set name = excluded.name,
      address = excluded.address,
      updated_at = now()
  returning id, name
),
upserted_doctor as (
  insert into app_users (email, display_name, disabled_at)
  values (${sqlLiteral(`doctor-for-assistant-${suffix}@skindoktor.ru`)}, ${sqlLiteral(`Врач для съёмки ${suffix}`)}, null)
  on conflict (email) do update
  set display_name = excluded.display_name,
      disabled_at = null,
      updated_at = now()
  returning id
),
upserted_assistant as (
  insert into app_users (email, display_name, password_hash, disabled_at)
  values (${sqlLiteral(assistantEmail)}, ${sqlLiteral(assistantName)}, ${sqlLiteral(passwordHash)}, null)
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
assistant_role as (
  insert into user_roles (user_id, clinic_id, role)
  select a.id, c.id, 'assistant'::app_role
  from upserted_assistant a
  cross join upserted_clinic c
  on conflict (user_id, clinic_id, role) do nothing
  returning id
),
upserted_patient as (
  insert into patients (clinic_id, code, full_name, imaging_consent, created_by)
  select c.id, ${sqlLiteral(patientCode)}, ${sqlLiteral(`Пациент для съёмки ${suffix}`)}, true, d.id
  from upserted_clinic c
  cross join upserted_doctor d
  on conflict (clinic_id, code) do update
  set full_name = excluded.full_name,
      imaging_consent = true,
      deleted_at = null,
      updated_at = now()
  returning id, clinic_id
),
upserted_visit as (
  insert into visits (clinic_id, patient_id, doctor_user_id, status, started_at, chief_complaint)
  select c.id, p.id, d.id, 'in_progress'::visit_status, now(), ${sqlLiteral(`Рабочая съёмка ассистента ${suffix}`)}
  from upserted_clinic c
  cross join upserted_patient p
  cross join upserted_doctor d
  returning id, clinic_id, patient_id
),
upserted_lesion as (
  insert into lesions (clinic_id, patient_id, visit_id, label, body_zone, body_surface)
  select v.clinic_id, v.patient_id, v.id, ${sqlLiteral(`Очаг съёмки ${suffix}`)}, 'предплечье', 'front'
  from upserted_visit v
  returning id
)
insert into audit_log (clinic_id, actor_user_id, action, entity_type, entity_id, correlation_id, metadata_json)
select
  c.id,
  a.id,
  'stage4m.assistant_capture_live_fixture',
  'clinical_asset',
  v.id,
  ${sqlLiteral(`stage4m-assistant-live-${suffix}`)},
  jsonb_build_object('source', 'live_e2e_fixture', 'role', 'assistant')
from upserted_clinic c
cross join upserted_assistant a
cross join upserted_visit v;

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
      assistantPassword,
      passwordHash,
    ]));
  }
}

function isResponse(response: Response, method: string, matcher: RegExp) {
  const request = response.request();
  return request.method() === method && matcher.test(new URL(response.url()).pathname);
}

test.describe("Live production assistant capture journey", () => {
  test("assistant signs in, uploads a visit photo, and cannot enter admin or doctor workspaces", async ({
    page,
  }, testInfo) => {
    test.skip(CONFIRMATION !== REQUIRED_CONFIRMATION, `Set STAGE4M_CONFIRM_CREATE_TEST_CLINIC=${REQUIRED_CONFIRMATION}`);

    const suffix = makeSuffix();
    const clinicName = `Клиника ассистента ${suffix}`;
    const assistantName = `Ассистент съёмки ${suffix}`;
    const assistantEmail = `assistant-live-${suffix}@skindoktor.ru`;
    const assistantPassword = `Dp-${suffix}-Assistant-2026!`;
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const captureResponses: { method: string; path: string; status: number }[] = [];

    setupAssistantCaptureFixture({
      suffix,
      clinicName,
      assistantName,
      assistantEmail,
      assistantPassword,
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      try {
        const url = new URL(response.url());
        if (
          url.pathname === "/api/v1/visits" ||
          /\/api\/v1\/visits\/[^/]+$/.test(url.pathname) ||
          /\/api\/v1\/visits\/[^/]+\/(lesions|assets)$/.test(url.pathname)
        ) {
          captureResponses.push({
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
    await page.getByLabel("Эл. почта").fill(assistantEmail);
    await page.getByLabel("Пароль").fill(assistantPassword);
    const visitsResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/visits$/),
    );
    await page.getByRole("button", { name: /^Войти$/ }).click();
    await expect(bannerText(page, "Рабочее место · Ассистент")).toBeVisible({ timeout: 15_000 });
    const visitsResponse = await visitsResponsePromise;
    expect(visitsResponse.status()).toBeGreaterThanOrEqual(200);
    expect(visitsResponse.status()).toBeLessThan(300);

    await expect(page.getByRole("heading", { level: 1, name: "Съёмка" })).toBeVisible();
    await expect(pageHeaderText(page, "Съёмка", `${assistantName} · рабочая очередь снимков`)).toBeVisible();
    await expect(mainText(page, "Источник данных: система клиники.")).toBeVisible();
    await expect(mainText(page, new RegExp(`Пациент для съёмки ${suffix}`))).toBeVisible();
    await expect(mainText(page, new RegExp(`Очаг съёмки ${suffix}`))).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная роль|демо|mock|system_admin|clinic_admin|doctor|private_doctor|operator|patient|backend|self-hosted|PostgreSQL|diagnosis|risk|prognosis|treatment|measurement|dynamicConclusion|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );

    for (const name of ["Захват фото", "Карта тела", "Пациенты", "Справка"]) {
      await expect(sidebarLinks(page, name), `assistant sidebar should include ${name}`).toHaveCount(1);
    }
    for (const name of [
      "Клиники и кабинеты",
      "Сотрудники и доступ",
      "Врачи",
      "Аналитика",
      "Устройства",
      "Аудит",
      "События доступа",
      "Рабочий стол",
      "Визиты",
      "Отчёты",
      "Заявки",
      "Запросы на запись",
      "Центр практики",
      "Личный кабинет",
    ]) {
      await expect(sidebarLinks(page, name), `assistant sidebar should not include ${name}`).toHaveCount(0);
    }

    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-assistant-capture-desktop-1280.png"), fullPage: true });

    const image = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
    await page.getByLabel("Файл снимка").setInputFiles({
      name: `assistant-capture-${suffix}.png`,
      mimeType: "image/png",
      buffer: image,
    });
    const uploadResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "POST", /^\/api\/v1\/visits\/[^/]+\/assets$/),
    );
    await page.getByRole("button", { name: "Сохранить снимок" }).click();
    const uploadResponse = await uploadResponsePromise;
    expect(uploadResponse.status()).toBeGreaterThanOrEqual(200);
    expect(uploadResponse.status()).toBeLessThan(300);
    await expect(mainText(page, "Снимок сохранён в системе клиники.")).toBeVisible();
    await expect(mainText(page, "В очереди снимков: 1")).toBeVisible();
    await expect(mainText(page, "Дерматоскопия")).toBeVisible();
    await expect(appMain(page)).not.toContainText(/storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i);

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Съёмка" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-assistant-capture-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    await sidebarLink(page, "Пациенты").click();
    await expect(page.getByRole("heading", { level: 1, name: "Пациенты" })).toBeVisible({ timeout: 15_000 });
    await expect(mainText(page, "пациенты загружаются только из системы клиники.")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-assistant-patients-desktop-1280.png"), fullPage: true });

    for (const [route, heading] of [
      ["/admin/clinics", "Клиники и кабинеты"],
      ["/desk", "Рабочий стол"],
      ["/operator", "Консоль оператора"],
      ["/me", "Личный кабинет"],
    ] as const) {
      await page.goto(route, { waitUntil: "networkidle" });
      await expect(mainText(page, "Нет доступа")).toBeVisible();
      await expect(mainText(page, "Ассистент")).toBeVisible();
      await expect(page.getByRole("heading", { name: heading })).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    }

    for (const expected of [
      {
        method: "GET",
        label: "/api/v1/visits",
        pathMatches: (path: string) => path === "/api/v1/visits",
      },
      {
        method: "POST",
        label: "/api/v1/visits/{id}/assets",
        pathMatches: (path: string) => /\/api\/v1\/visits\/[^/]+\/assets/.test(path),
      },
    ] as const) {
      expect(
        captureResponses.some((response) =>
          response.method === expected.method &&
          expected.pathMatches(response.path) &&
          response.status >= 200 &&
          response.status < 300,
        ),
        `missing successful ${expected.method} ${expected.label}`,
      ).toBe(true);
    }
    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  });
});
