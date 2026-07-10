import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

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

const BASE_URL = (process.env.STAGE4M_LIVE_OPERATOR_BASE_URL || "https://pro.skindoktor.ru").replace(/\/+$/, "");
const CREDENTIALS_FILE = process.env.STAGE4M_OPERATOR_SETUP_CREDENTIALS_FILE || "/root/dermatolog-pro-admin-credentials.txt";
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

function sqlLiteral(value: unknown) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function dockerComposeArgs(args: string[]) {
  const result = ["compose", "--env-file", COMPOSE_ENV_FILE];
  for (const file of COMPOSE_FILES) result.push("-f", file);
  return [...result, "-p", COMPOSE_PROJECT_NAME, ...args];
}

function setupOperatorDialogFixture({
  suffix,
  clinicName,
  operatorEmail,
  requestId,
  patientId,
  patientUserId,
  patientName,
  requestReason,
}: {
  suffix: string;
  clinicName: string;
  operatorEmail: string;
  requestId: string;
  patientId: string;
  patientUserId: string;
  patientName: string;
  requestReason: string;
}) {
  const patientEmail = `patient-for-operator-${suffix}@example.invalid`;
  const patientCode = `LIVE-OPERATOR-${suffix}`;
  const sql = `
begin;

with target_clinic as (
  select id from clinics where name = ${sqlLiteral(clinicName)} limit 1
),
target_operator as (
  select id from app_users where email = ${sqlLiteral(operatorEmail)} limit 1
),
inserted_patient_user as (
  insert into app_users (id, email, display_name, disabled_at)
  select ${sqlLiteral(patientUserId)}::uuid, ${sqlLiteral(patientEmail)}, ${sqlLiteral(`Пациент обращения ${suffix}`)}, null
  from target_clinic
  cross join target_operator
  returning id
),
inserted_patient_role as (
  insert into user_roles (user_id, clinic_id, role)
  select u.id, c.id, 'patient'::app_role
  from inserted_patient_user u
  cross join target_clinic c
  returning id
),
inserted_patient as (
  insert into patients (id, clinic_id, code, full_name, imaging_consent, created_by)
  select ${sqlLiteral(patientId)}::uuid, c.id, ${sqlLiteral(patientCode)}, ${sqlLiteral(patientName)}, false, o.id
  from target_clinic c
  cross join target_operator o
  returning id, clinic_id
),
inserted_patient_link as (
  insert into patient_user_links (user_id, patient_id)
  select u.id, p.id
  from inserted_patient_user u
  cross join inserted_patient p
  returning user_id
),
inserted_request as (
  insert into patient_portal_booking_requests (
    id,
    clinic_id,
    patient_id,
    requested_by_user_id,
    preferred_from,
    preferred_to,
    reason,
    status
  )
  select
    ${sqlLiteral(requestId)}::uuid,
    p.clinic_id,
    p.id,
    u.id,
    now() + interval '1 day',
    now() + interval '1 day 1 hour',
    ${sqlLiteral(requestReason)},
    'requested'
  from inserted_patient p
  cross join inserted_patient_user u
  returning id, clinic_id
)
insert into audit_log (clinic_id, actor_user_id, action, entity_type, entity_id, correlation_id, metadata_json)
select
  r.clinic_id,
  o.id,
  'stage4m.operator_dialog_live_fixture',
  'patient_portal_booking_request',
  r.id,
  ${sqlLiteral(`stage4m-operator-dialog-live-${suffix}`)},
  jsonb_build_object('source', 'live_e2e_fixture', 'role', 'operator')
from inserted_request r
cross join target_operator o;

do $stage4m_operator_dialog_live_fixture$
begin
  if not exists (
    select 1
    from patient_portal_booking_requests
    where id = ${sqlLiteral(requestId)}::uuid
  ) then
    raise exception 'operator dialog live fixture did not create the booking request';
  end if;
end
$stage4m_operator_dialog_live_fixture$;

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
    const detail = String(result.stderr || result.stdout || result.error?.message || `exit ${result.status}`)
      .replace(/postgres:\/\/([^:]+):([^@]+)@/g, "postgres://$1:[redacted]@")
      .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted-token]");
    throw new Error(`operator dialog fixture failed: ${detail.trim()}`);
  }
}

function isResponse(response: Response, method: string, matcher: RegExp) {
  const request = response.request();
  return request.method() === method && matcher.test(new URL(response.url()).pathname);
}

test.describe("Live production operator workspace journey", () => {
  test("operator signs in, creates intake lead, reviews booking queue, and cannot enter other roles", async ({
    page,
  }, testInfo) => {
    test.skip(CONFIRMATION !== REQUIRED_CONFIRMATION, `Set STAGE4M_CONFIRM_CREATE_TEST_CLINIC=${REQUIRED_CONFIRMATION}`);
    test.setTimeout(90_000);

    const { email, password } = parseCredentials(readFileSync(CREDENTIALS_FILE, "utf8"));
    const suffix = makeSuffix();
    const clinicName = `Клиника оператора ${suffix}`;
    const clinicAddress = `Краснодар, операторская ${suffix}`;
    const operatorDisplayName = `Оператор Dermatolog Pro ${suffix}`;
    const operatorEmail = `operator-live-${suffix}@skindoktor.ru`;
    const operatorPassword = `Dp-${suffix}-Operator-2026!`;
    const leadSummary = `Проверочная заявка оператора ${suffix}`;
    const dialogPatientName = `Пациент обращения ${suffix}`;
    const dialogRequestReason = `Запрос на запись оператора ${suffix}`;
    const dialogNote = `Уточнить удобное время ${suffix}`;
    const dialogRequestId = randomUUID();
    const dialogPatientId = randomUUID();
    const dialogPatientUserId = randomUUID();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const operatorResponses: { method: string; path: string; status: number }[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      try {
        const url = new URL(response.url());
        if (
          url.pathname === "/api/v1/admin/clinics" ||
          url.pathname === "/api/v1/admin/users" ||
          url.pathname === "/api/v1/admin/audit-events" ||
          url.pathname === "/api/v1/leads/appointments" ||
          url.pathname === "/api/v1/leads" ||
          /^\/api\/v1\/leads\/[^/]+$/.test(url.pathname) ||
          url.pathname === "/api/v1/clinic/booking-requests" ||
          /^\/api\/v1\/clinic\/booking-requests\/[^/]+$/.test(url.pathname) ||
          url.pathname === "/api/v1/integrations/booking-imports" ||
          url.pathname === "/api/v1/integrations/booking-imports/status" ||
          url.pathname === "/api/v1/clinic/available-slots"
        ) {
          operatorResponses.push({
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
    await expect(page.getByRole("heading", { level: 1, name: "Клиники и кабинеты" })).toBeVisible();
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

    await sidebarLink(page, "Сотрудники и доступ").click();
    await expect(page.getByRole("heading", { level: 1, name: "Сотрудники и доступ" })).toBeVisible();
    await page.getByLabel("ФИО сотрудника").fill(operatorDisplayName);
    await page.getByLabel("Эл. почта").fill(operatorEmail);
    await page.getByLabel("Временный пароль").fill(operatorPassword);
    await page.getByLabel("Роль", { exact: true }).selectOption("operator");
    await page.getByLabel("Клиника", { exact: true }).selectOption({ label: clinicName });
    const createOperatorResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "POST", /^\/api\/v1\/admin\/users$/),
    );
    await page.getByRole("button", { name: "Создать сотрудника" }).click();
    const createOperatorResponse = await createOperatorResponsePromise;
    expect(createOperatorResponse.status()).toBeGreaterThanOrEqual(200);
    expect(createOperatorResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Учётная запись создана: ${operatorDisplayName}`)).toBeVisible();
    await expect(mainText(page, operatorEmail)).toBeVisible();

    setupOperatorDialogFixture({
      suffix,
      clinicName,
      operatorEmail,
      requestId: dialogRequestId,
      patientId: dialogPatientId,
      patientUserId: dialogPatientUserId,
      patientName: dialogPatientName,
      requestReason: dialogRequestReason,
    });

    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page.getByRole("button", { name: /^Войти$/ })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Адрес системы клиники").fill(BASE_URL);
    await page.getByLabel("Эл. почта").fill(operatorEmail);
    await page.getByLabel("Пароль").fill(operatorPassword);
    const firstLeadsResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/leads\/appointments$/),
    );
    await page.getByRole("button", { name: /^Войти$/ }).click();
    await expect(bannerText(page, "Рабочее место · Оператор поддержки")).toBeVisible({ timeout: 15_000 });
    const firstLeadsResponse = await firstLeadsResponsePromise;
    expect(firstLeadsResponse.status()).toBeGreaterThanOrEqual(200);
    expect(firstLeadsResponse.status()).toBeLessThan(300);

    await expect(page.getByRole("heading", { level: 1, name: "Консоль оператора" })).toBeVisible();
    await expect(pageHeaderText(page, "Консоль оператора", `${operatorDisplayName} · рабочая очередь заявок`)).toBeVisible();
    await expect(mainText(page, "Данные загружены из системы клиники.")).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная роль|учебная очередь|демо|mock|system_admin|clinic_admin|doctor|private_doctor|backend|self-hosted|PostgreSQL|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );

    for (const name of ["Заявки", "Запросы на запись", "Справка"]) {
      await expect(sidebarLinks(page, name), `operator sidebar should include ${name}`).toHaveCount(1);
    }
    for (const name of [
      "Клиники и кабинеты",
      "Сотрудники и доступ",
      "Врачи",
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
      "Отчёты",
      "Карта тела",
      "Съёмка",
      "Центр практики",
    ]) {
      await expect(sidebarLinks(page, name), `operator sidebar should not include ${name}`).toHaveCount(0);
    }

    await page.getByLabel("Краткое описание заявки").fill(leadSummary);
    const createLeadResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "POST", /^\/api\/v1\/leads$/),
    );
    await page.getByRole("button", { name: "Создать заявку" }).click();
    const createLeadResponse = await createLeadResponsePromise;
    expect(createLeadResponse.status()).toBeGreaterThanOrEqual(200);
    expect(createLeadResponse.status()).toBeLessThan(300);
    await expect(mainText(page, "Заявка создана.")).toBeVisible();
    await expect(mainText(page, leadSummary)).toBeVisible();

    const qualifyResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "PATCH", /^\/api\/v1\/leads\/[^/]+$/),
    );
    await page.getByRole("button", { name: `Уточнить заявку: ${leadSummary}` }).click();
    const qualifyResponse = await qualifyResponsePromise;
    expect(qualifyResponse.status()).toBeGreaterThanOrEqual(200);
    expect(qualifyResponse.status()).toBeLessThan(300);
    await expect(mainText(page, "Заявка: статус уточнённые.")).toBeVisible();

    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-operator-console-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Консоль оператора" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-operator-console-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    const bookingRequestsResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/clinic\/booking-requests$/),
    );
    const importBatchesResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/integrations\/booking-imports$/),
    );
    const importStatusResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/integrations\/booking-imports\/status$/),
    );
    const availableSlotsResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/clinic\/available-slots$/),
    );
    await sidebarLink(page, "Запросы на запись").click();
    await expect(page.getByRole("heading", { level: 1, name: "Запросы на запись" })).toBeVisible({ timeout: 15_000 });
    const [bookingRequestsResponse, importBatchesResponse, importStatusResponse, availableSlotsResponse] = await Promise.all([
      bookingRequestsResponsePromise,
      importBatchesResponsePromise,
      importStatusResponsePromise,
      availableSlotsResponsePromise,
    ]);
    for (const response of [bookingRequestsResponse, importBatchesResponse, importStatusResponse, availableSlotsResponse]) {
      expect(response.status()).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(300);
    }
    await expect(pageHeaderText(page, "Запросы на запись", `${operatorDisplayName} · заявки на запись`)).toBeVisible();
    await expect(mainText(page, "Данные загружены из системы клиники.")).toBeVisible();
    await expect(mainText(page, "Готовность свободных окон")).toBeVisible();
    await expect(mainText(page, "Очередь заявок на запись")).toBeVisible();
    await page.getByLabel("Поиск заявок на запись").fill(dialogRequestReason);
    await expect(mainText(page, dialogPatientName)).toBeVisible();
    await expect(mainText(page, dialogRequestReason)).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная роль|демо|mock|system_admin|clinic_admin|doctor|private_doctor|backend|self-hosted|PostgreSQL|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-operator-booking-requests-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Запросы на запись" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-operator-booking-requests-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    const dialogGetResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", new RegExp(`^/api/v1/clinic/booking-requests/${dialogRequestId}$`)),
    );
    await mainLink(page, `Открыть карточку обращения: ${dialogPatientName}`).click();
    const dialogGetResponse = await dialogGetResponsePromise;
    expect(dialogGetResponse.status()).toBeGreaterThanOrEqual(200);
    expect(dialogGetResponse.status()).toBeLessThan(300);
    await expect(pageHeaderText(page, "Карточка обращения", `${operatorDisplayName} · обработка заявки на запись`)).toBeVisible();
    await expect(mainText(page, dialogPatientName)).toBeVisible();
    await expect(mainText(page, dialogRequestReason)).toBeVisible();
    await page.getByRole("button", { name: "Сохранить заметку" }).click();
    await expect(mainText(page, "Введите заметку клиники.")).toBeVisible();
    await page.getByLabel("Заметка клиники по обращению").fill(dialogNote);
    const dialogPatchResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "PATCH", new RegExp(`^/api/v1/clinic/booking-requests/${dialogRequestId}$`)),
    );
    await page.getByRole("button", { name: "Сохранить заметку" }).click();
    const dialogPatchResponse = await dialogPatchResponsePromise;
    expect(dialogPatchResponse.status()).toBeGreaterThanOrEqual(200);
    expect(dialogPatchResponse.status()).toBeLessThan(300);
    await expect(mainText(page, "Заметка сохранена. Обращение взято в работу.")).toBeVisible();
    await expect(mainText(page, "В работе").first()).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|демо|mock|backend|self-hosted|PostgreSQL|storagePath|signedUrl|accessToken|qrToken|sessionId|credential|LIVE-OPERATOR/i,
    );
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-operator-dialog-desktop-1280.png"), fullPage: true });

    const dialogReloadResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", new RegExp(`^/api/v1/clinic/booking-requests/${dialogRequestId}$`)),
    );
    await page.reload({ waitUntil: "networkidle" });
    const dialogReloadResponse = await dialogReloadResponsePromise;
    expect(dialogReloadResponse.status()).toBeGreaterThanOrEqual(200);
    expect(dialogReloadResponse.status()).toBeLessThan(300);
    await expect(page.getByLabel("Заметка клиники по обращению")).toHaveValue(dialogNote);
    await expect(mainText(page, "В работе").first()).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Карточка обращения" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-operator-dialog-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    for (const [route, heading] of [
      ["/admin/clinics", "Клиники и кабинеты"],
      ["/sys/users", "Сотрудники и доступ"],
      ["/desk", "Рабочий стол"],
    ] as const) {
      await page.goto(route, { waitUntil: "networkidle" });
      await expect(mainText(page, "Нет доступа")).toBeVisible();
      await expect(mainText(page, "Оператор поддержки")).toBeVisible();
      await expect(page.getByRole("heading", { name: heading })).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    }

    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page.getByRole("button", { name: /^Войти$/ })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Адрес системы клиники").fill(BASE_URL);
    await page.getByLabel("Эл. почта").fill(email);
    await page.getByLabel("Пароль").fill(password);
    await page.getByRole("button", { name: /^Войти$/ }).click();
    await expect(bannerText(page, "Рабочее место · Системный администратор")).toBeVisible({ timeout: 15_000 });

    const auditResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/admin\/audit-events$/),
    );
    await sidebarLink(page, "Аудит").click();
    const auditResponse = await auditResponsePromise;
    expect(auditResponse.status()).toBeGreaterThanOrEqual(200);
    expect(auditResponse.status()).toBeLessThan(300);
    await page.getByLabel("Поиск аудита").fill("Заметка обращения сохранена");
    await expect(mainText(page, "Заметка обращения сохранена").first()).toBeVisible();
    await expect(mainText(page, "обращения на запись").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-operator-dialog-audit-desktop-1280.png"), fullPage: true });

    for (const expected of [
      ["POST", "/api/v1/admin/clinics"],
      ["POST", "/api/v1/admin/users"],
      ["GET", "/api/v1/leads/appointments"],
      ["POST", "/api/v1/leads"],
      ["PATCH", "/api/v1/leads"],
      ["GET", "/api/v1/clinic/booking-requests"],
      ["GET", "/api/v1/integrations/booking-imports"],
      ["GET", "/api/v1/integrations/booking-imports/status"],
      ["GET", "/api/v1/clinic/available-slots"],
      ["GET", `/api/v1/clinic/booking-requests/${dialogRequestId}`],
      ["PATCH", `/api/v1/clinic/booking-requests/${dialogRequestId}`],
      ["GET", "/api/v1/admin/audit-events"],
    ] as const) {
      const [method, path] = expected;
      expect(
        operatorResponses.some((item) =>
          item.method === method &&
          (path === "/api/v1/leads" ? item.path.startsWith(path) : item.path === path) &&
          item.status >= 200 &&
          item.status < 300,
        ),
        `missing successful ${method} ${path}`,
      ).toBe(true);
    }
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
