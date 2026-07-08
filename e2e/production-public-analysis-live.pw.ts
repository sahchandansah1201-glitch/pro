import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

import { expect, type Response, test } from "@playwright/test";

import {
  appMain,
  expectMainTapTargets,
  expectNoHorizontalOverflow,
  mainText,
} from "./live-admin-test-helpers";

const BASE_URL = (process.env.STAGE4M_LIVE_PUBLIC_ANALYSIS_BASE_URL || "https://pro.skindoktor.ru").replace(/\/+$/, "");
const REQUIRED_CONFIRMATION = "I_CONFIRM_CREATE_TEST_CLINIC";
const CONFIRMATION = process.env.STAGE4M_CONFIRM_CREATE_TEST_CLINIC || "";
const PUBLIC_ANALYSIS_API_PATH = "/api/v1/public/analysis/";
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

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function redact(value: unknown, secrets: string[] = []) {
  let text = String(value ?? "")
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

function runPostgres(sql: string, label: string, secrets: string[] = []) {
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
    throw new Error(redact(result.stderr || result.stdout || result.error?.message || `${label} failed with exit ${result.status}`, secrets));
  }
}

function setupPublicAnalysisFixture({
  suffix,
  clinicName,
  safeSummary,
  validToken,
  expiredToken,
}: {
  suffix: string;
  clinicName: string;
  safeSummary: string;
  validToken: string;
  expiredToken: string;
}) {
  const clinicSlug = safeSlug(`live-public-analysis-${suffix}`);
  const patientName = `Пациент публичной сводки ${suffix}`;
  const validTokenHash = sha256(validToken);
  const expiredTokenHash = sha256(expiredToken);
  const sql = `
begin;

with inserted_clinic as (
  insert into clinics (slug, name, timezone, address)
  values (${sqlLiteral(clinicSlug)}, ${sqlLiteral(clinicName)}, 'Europe/Moscow', ${sqlLiteral(`Краснодар, публичная сводка ${suffix}`)})
  returning id
),
inserted_doctor as (
  insert into app_users (email, display_name)
  values (${sqlLiteral(`public-analysis-doctor-${suffix}@example.invalid`)}, ${sqlLiteral(`Врач публичной сводки ${suffix}`)})
  returning id
),
linked_role as (
  insert into user_roles (user_id, clinic_id, role)
  select d.id, c.id, 'doctor'::app_role
  from inserted_doctor d
  cross join inserted_clinic c
  returning id
),
inserted_patient as (
  insert into patients (clinic_id, code, full_name, imaging_consent, created_by)
  select c.id, ${sqlLiteral(`LIVE-PUBLIC-${suffix}`)}, ${sqlLiteral(patientName)}, true, d.id
  from inserted_clinic c
  cross join inserted_doctor d
  returning id, clinic_id
),
inserted_visit as (
  insert into visits (clinic_id, patient_id, doctor_user_id, status, started_at, signed_at, chief_complaint)
  select c.id, p.id, d.id, 'signed'::visit_status, now(), now(), ${sqlLiteral(`Проверочная публичная сводка ${suffix}`)}
  from inserted_clinic c
  cross join inserted_patient p
  cross join inserted_doctor d
  returning id, clinic_id, patient_id, doctor_user_id
),
inserted_asset as (
  insert into clinical_assets (
    clinic_id,
    patient_id,
    visit_id,
    kind,
    object_bucket,
    object_key,
    content_type,
    byte_size,
    captured_at,
    uploaded_by
  )
  select
    v.clinic_id,
    v.patient_id,
    v.id,
    'overview_photo'::asset_kind,
    'live-public-analysis',
    ${sqlLiteral(`overview-${suffix}.jpg`)},
    'image/jpeg',
    128,
    now(),
    v.doctor_user_id
  from inserted_visit v
  returning id
),
inserted_reports as (
  insert into reports (
    clinic_id,
    patient_id,
    visit_id,
    doctor_user_id,
    status,
    physician_text,
    patient_safe_text,
    signed_at
  )
  select
    v.clinic_id,
    v.patient_id,
    v.id,
    v.doctor_user_id,
    'signed',
    'internal physician live text',
    ${sqlLiteral(safeSummary)},
    now()
  from inserted_visit v
  union all
  select
    v.clinic_id,
    v.patient_id,
    v.id,
    v.doctor_user_id,
    'signed',
    'expired internal physician live text',
    ${sqlLiteral(`${safeSummary} expired`)},
    now()
  from inserted_visit v
  returning id, clinic_id, created_at
),
numbered_reports as (
  select id, clinic_id, row_number() over (order by created_at, id) as report_index
  from inserted_reports
)
insert into public_analysis_links (clinic_id, report_id, token_hash, status, expires_at)
select clinic_id, id, ${sqlLiteral(validTokenHash)}, 'active', now() + interval '2 days'
from numbered_reports
where report_index = 1
union all
select clinic_id, id, ${sqlLiteral(expiredTokenHash)}, 'active', now() - interval '1 day'
from numbered_reports
where report_index = 2;

commit;
`.trim();

  runPostgres(sql, "public analysis live fixture", [validToken, expiredToken, validTokenHash, expiredTokenHash]);
  return clinicSlug;
}

function cleanupPublicAnalysisFixture(clinicSlug: string) {
  const sql = `
with target_clinic as (
  select id from clinics where slug = ${sqlLiteral(clinicSlug)}
),
deleted_links as (
  delete from public_analysis_links
  where clinic_id in (select id from target_clinic)
  returning id
),
deleted_assets as (
  delete from clinical_assets
  where clinic_id in (select id from target_clinic)
  returning id
),
deleted_reports as (
  delete from reports
  where clinic_id in (select id from target_clinic)
  returning id
),
deleted_visits as (
  delete from visits
  where clinic_id in (select id from target_clinic)
  returning id
),
deleted_patients as (
  delete from patients
  where clinic_id in (select id from target_clinic)
  returning id
),
deleted_roles as (
  delete from user_roles
  where clinic_id in (select id from target_clinic)
  returning user_id
),
deleted_users as (
  delete from app_users
  where id in (select user_id from deleted_roles)
  returning id
)
delete from clinics
where id in (select id from target_clinic);
`.trim();

  runPostgres(sql, "public analysis live fixture cleanup");
}

function isPublicAnalysisResponse(response: Response) {
  const request = response.request();
  const path = new URL(response.url()).pathname;
  return request.method() === "GET" && path.startsWith(PUBLIC_ANALYSIS_API_PATH);
}

test.describe("Live production public analysis journey", () => {
  test("public recipient opens valid, expired, and missing protected links without authentication", async ({
    page,
  }, testInfo) => {
    test.skip(CONFIRMATION !== REQUIRED_CONFIRMATION, `Set STAGE4M_CONFIRM_CREATE_TEST_CLINIC=${REQUIRED_CONFIRMATION}`);
    test.setTimeout(60_000);

    const suffix = makeSuffix();
    const clinicName = `Клиника публичной сводки ${suffix}`;
    const safeSummary = `Публичная сводка ${suffix}: обратитесь в клинику для очного контроля.`;
    const validToken = `public-live-valid-${suffix}-${randomBytes(8).toString("hex")}`;
    const expiredToken = `public-live-expired-${suffix}-${randomBytes(8).toString("hex")}`;
    const missingToken = `public-live-missing-${suffix}-${randomBytes(8).toString("hex")}`;
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    let clinicSlug = "";

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    try {
      clinicSlug = setupPublicAnalysisFixture({
        suffix,
        clinicName,
        safeSummary,
        validToken,
        expiredToken,
      });

      await page.setViewportSize({ width: 1280, height: 900 });
      const validResponsePromise = page.waitForResponse(isPublicAnalysisResponse);
      await page.goto(`/analysis/${validToken}`, { waitUntil: "networkidle" });
      const validResponse = await validResponsePromise;
      expect(validResponse.status()).toBeGreaterThanOrEqual(200);
      expect(validResponse.status()).toBeLessThan(300);
      await expect(page.getByRole("heading", { level: 1, name: "Предварительная сводка" })).toBeVisible();
      await expect(mainText(page, safeSummary)).toBeVisible();
      await expect(mainText(page, clinicName)).toBeVisible();
      await expect(mainText(page, "Фото подходит для предварительной сводки")).toBeVisible();
      await expect(appMain(page)).not.toContainText(validToken);
      await expect(appMain(page)).not.toContainText(
        /Учебный просмотр|Учебный режим|demo|backend|self-hosted|PostgreSQL|physicianText|storagePath|signedUrl|accessToken|qrToken|sessionId|credential|diagnosis|prognosis|treatment|measurement|dynamicConclusion/i,
      );
      await expectNoHorizontalOverflow(page);
      await expectMainTapTargets(page);
      await page.screenshot({ path: testInfo.outputPath("live-public-analysis-valid-desktop-1280.png"), fullPage: true });

      await page.setViewportSize({ width: 390, height: 844 });
      await expectNoHorizontalOverflow(page);
      await expectMainTapTargets(page);
      await page.screenshot({ path: testInfo.outputPath("live-public-analysis-valid-mobile-390.png"), fullPage: true });

      await page.setViewportSize({ width: 1280, height: 900 });
      const expiredResponsePromise = page.waitForResponse(isPublicAnalysisResponse);
      await page.goto(`/analysis/${expiredToken}`, { waitUntil: "networkidle" });
      const expiredResponse = await expiredResponsePromise;
      expect(expiredResponse.status()).toBeGreaterThanOrEqual(200);
      expect(expiredResponse.status()).toBeLessThan(300);
      await expect(page.getByRole("heading", { level: 1, name: "Ссылка истекла" })).toBeVisible();
      await expect(appMain(page)).not.toContainText(expiredToken);
      await expectNoHorizontalOverflow(page);
      await expectMainTapTargets(page);
      await page.screenshot({ path: testInfo.outputPath("live-public-analysis-expired-desktop-1280.png"), fullPage: true });

      const missingResponsePromise = page.waitForResponse(isPublicAnalysisResponse);
      await page.goto(`/analysis/${missingToken}`, { waitUntil: "networkidle" });
      const missingResponse = await missingResponsePromise;
      expect(missingResponse.status()).toBeGreaterThanOrEqual(200);
      expect(missingResponse.status()).toBeLessThan(300);
      await expect(page.getByRole("heading", { level: 1, name: "Ссылка не найдена" })).toBeVisible();
      await expect(appMain(page)).not.toContainText(missingToken);
      await expectNoHorizontalOverflow(page);
      await expectMainTapTargets(page);
      await page.screenshot({ path: testInfo.outputPath("live-public-analysis-missing-desktop-1280.png"), fullPage: true });

      expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
      expect(pageErrors, pageErrors.join("\n")).toEqual([]);
    } finally {
      if (clinicSlug) cleanupPublicAnalysisFixture(clinicSlug);
    }
  });
});
