import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

import { expect, type Response, test } from "@playwright/test";

import { appMain, expectMainTapTargets, expectNoHorizontalOverflow, mainText, sidebarLink, sidebarLinks } from "./live-admin-test-helpers";

const BASE_URL = (process.env.STAGE4M_LIVE_ADMIN_BASE_URL || "https://pro.skindoktor.ru").replace(/\/+$/, "");
const CREDENTIALS_FILE = process.env.STAGE4M_ADMIN_CREDENTIALS_FILE || "/root/dermatolog-pro-admin-credentials.txt";
const REQUIRED_CONFIRMATION = "I_CONFIRM_CREATE_TEST_CLINIC";
const CONFIRMATION = process.env.STAGE4M_CONFIRM_CREATE_TEST_CLINIC || "";

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

function isAdminClinicResponse(response: Response, method: string, matcher: RegExp) {
  const request = response.request();
  return request.method() === method && matcher.test(new URL(response.url()).pathname);
}

function isAdminUserResponse(response: Response, method: string, matcher: RegExp) {
  const request = response.request();
  return request.method() === method && matcher.test(new URL(response.url()).pathname);
}

function isAdminAuditResponse(response: Response) {
  const request = response.request();
  return request.method() === "GET" && new URL(response.url()).pathname === "/api/v1/admin/audit-events";
}

function isAdminServiceKeyResponse(response: Response, method: string, matcher: RegExp) {
  const request = response.request();
  return request.method() === method && matcher.test(new URL(response.url()).pathname);
}

function isOpsResponse(response: Response, path: string) {
  const request = response.request();
  return request.method() === "GET" && new URL(response.url()).pathname === path;
}

test.describe("Live production admin management journey", () => {
  test("system admin creates clinics, users, and verifies audit through the visible UI", async ({ page }, testInfo) => {
    test.skip(CONFIRMATION !== REQUIRED_CONFIRMATION, `Set STAGE4M_CONFIRM_CREATE_TEST_CLINIC=${REQUIRED_CONFIRMATION}`);

    const { email, password } = parseCredentials(readFileSync(CREDENTIALS_FILE, "utf8"));
    const suffix = makeSuffix();
    const clinicName = `Проверочная клиника ${suffix}`;
    const clinicAddress = `Краснодар, проверочная ${suffix}`;
    const updatedClinicAddress = `Краснодар, обновлённая ${suffix}`;
    const adminDisplayName = `Админ 2 ${suffix}`;
    const adminEmail = `admin2-${suffix}@skindoktor.ru`;
    const adminPassword = `Dp-${suffix}-Admin-2026!`;
    const clinicAdminClinicName = `Клиника администратора ${suffix}`;
    const clinicAdminClinicAddress = `Краснодар, админ-клиника ${suffix}`;
    const clinicAdminUpdatedAddress = `Краснодар, админ-клиника проверена ${suffix}`;
    const clinicAdminDisplayName = `Администратор клиники ${suffix}`;
    const clinicAdminEmail = `clinic-admin-${suffix}@skindoktor.ru`;
    const clinicAdminPassword = `Dp-${suffix}-Clinic-2026!`;
    const clinicAdminDoctorName = `Врач клиники ${suffix}`;
    const clinicAdminDoctorEmail = `clinic-doctor-${suffix}@skindoktor.ru`;
    const clinicAdminDoctorPassword = `Dp-${suffix}-Doctor-2026!`;
    const serviceKeyLabel = `Проверочный ключ ${suffix}`;
    const serviceKeyOwner = `Автотест ${suffix}`;
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const adminResponses: { method: string; path: string; status: number }[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      try {
        const url = new URL(response.url());
        if (
          url.pathname.startsWith("/api/v1/admin/clinics") ||
          url.pathname.startsWith("/api/v1/admin/users") ||
          url.pathname.startsWith("/api/v1/admin/doctors") ||
          url.pathname.startsWith("/api/v1/admin/analytics") ||
          url.pathname.startsWith("/api/v1/admin/service-keys")
        ) {
          adminResponses.push({
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

    await expect(page.getByText("Рабочее место · Системный администратор")).toBeVisible({ timeout: 15_000 });
    await sidebarLink(page, "Клиники и кабинеты").click();
    await expect(page.getByRole("heading", { name: "Клиники и кабинеты" })).toBeVisible();
    await expect(page.getByText(/Учебный режим/i)).toHaveCount(0);

    await page.getByRole("button", { name: "Создать клинику" }).click();
    await expect(page.getByText("Укажите название и адрес клиники.")).toBeVisible();

    await page.getByLabel("Название клиники").fill(clinicName);
    await page.getByLabel("Адрес клиники").fill(clinicAddress);
    await page.getByLabel("Часовой пояс клиники").click();
    await page.getByRole("option", { name: "Москва, Краснодар · UTC+3" }).click();

    const createResponsePromise = page.waitForResponse((response) =>
      isAdminClinicResponse(response, "POST", /^\/api\/v1\/admin\/clinics$/),
    );
    await page.getByRole("button", { name: "Создать клинику" }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBeGreaterThanOrEqual(200);
    expect(createResponse.status()).toBeLessThan(300);

    await expect(page.getByText(`Клиника сохранена и добавлена в список: ${clinicName}`)).toBeVisible();
    await expect(page.getByText(clinicName).first()).toBeVisible();
    await expect(page.getByText(`адрес: ${clinicAddress}`).first()).toBeVisible();

    await page.getByRole("button", { name: "Редактировать" }).first().click();
    await expect(page.getByRole("region", { name: "Редактирование клиники" })).toBeVisible();
    await page.getByLabel("Адрес редактируемой клиники").fill(updatedClinicAddress);

    const updateResponsePromise = page.waitForResponse((response) =>
      isAdminClinicResponse(response, "PATCH", /^\/api\/v1\/admin\/clinics\/[^/]+$/),
    );
    await page.getByRole("button", { name: "Сохранить изменения" }).click();
    const updateResponse = await updateResponsePromise;
    expect(updateResponse.status()).toBeGreaterThanOrEqual(200);
    expect(updateResponse.status()).toBeLessThan(300);

    await expect(page.getByText(`Изменения сохранены: ${clinicName}`)).toBeVisible();
    await expect(page.getByText(`адрес: ${updatedClinicAddress}`).first()).toBeVisible();

    const suspendResponsePromise = page.waitForResponse((response) =>
      isAdminClinicResponse(response, "PATCH", /^\/api\/v1\/admin\/clinics\/[^/]+\/status$/),
    );
    await page.getByRole("button", { name: "Приостановить" }).first().click();
    const suspendResponse = await suspendResponsePromise;
    expect(suspendResponse.status()).toBeGreaterThanOrEqual(200);
    expect(suspendResponse.status()).toBeLessThan(300);
    await expect(page.getByText(`Статус обновлён: ${clinicName} · Приостановлена`)).toBeVisible();

    const reactivateClinicResponsePromise = page.waitForResponse((response) =>
      isAdminClinicResponse(response, "PATCH", /^\/api\/v1\/admin\/clinics\/[^/]+\/status$/),
    );
    await page.getByRole("button", { name: "Вернуть в работу" }).first().click();
    const reactivateClinicResponse = await reactivateClinicResponsePromise;
    expect(reactivateClinicResponse.status()).toBeGreaterThanOrEqual(200);
    expect(reactivateClinicResponse.status()).toBeLessThan(300);
    await expect(page.getByText(`Статус обновлён: ${clinicName} · Работает`)).toBeVisible();

    const archiveResponsePromise = page.waitForResponse((response) =>
      isAdminClinicResponse(response, "PATCH", /^\/api\/v1\/admin\/clinics\/[^/]+\/status$/),
    );
    await page.getByRole("button", { name: "В архив" }).first().click();
    const archiveResponse = await archiveResponsePromise;
    expect(archiveResponse.status()).toBeGreaterThanOrEqual(200);
    expect(archiveResponse.status()).toBeLessThan(300);
    await expect(page.getByText(`Статус обновлён: ${clinicName} · Архив`)).toBeVisible();

    await page.getByRole("button", { name: "Удалить пустую запись" }).first().click();
    await expect(page.getByText(new RegExp(`Подтвердите удаление пустой записи: ${clinicName}`))).toBeVisible();
    const deleteClinicResponsePromise = page.waitForResponse((response) =>
      isAdminClinicResponse(response, "DELETE", /^\/api\/v1\/admin\/clinics\/[^/]+$/),
    );
    await page.getByRole("button", { name: "Подтвердить удаление" }).click();
    const deleteClinicResponse = await deleteClinicResponsePromise;
    expect(deleteClinicResponse.status()).toBeGreaterThanOrEqual(200);
    expect(deleteClinicResponse.status()).toBeLessThan(300);
    await expect(page.getByText(`Пустая запись удалена: ${clinicName}`)).toBeVisible();

    await expect(page.getByText(/Invalid or expired authorization token|Database is unavailable/i)).toHaveCount(0);
    await expect(appMain(page)).not.toContainText(/Учебный режим|демо|mock/i);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-clinics-desktop-1280.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: "Клиники и кабинеты" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-clinics-mobile-390.png"), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });

    await sidebarLink(page, "Сотрудники и доступ").click();
    await expect(page.getByRole("heading", { name: "Сотрудники и доступ" })).toBeVisible();
    await expect(page.getByText(/Учебный режим/i)).toHaveCount(0);
    await page.getByLabel("ФИО сотрудника").fill(adminDisplayName);
    await page.getByLabel("Эл. почта").fill(adminEmail);
    await page.getByLabel("Временный пароль").fill(adminPassword);
    await page.getByLabel("Роль", { exact: true }).selectOption("system_admin");
    await expect(page.getByLabel("Клиника", { exact: true })).toBeDisabled();

    const createUserResponsePromise = page.waitForResponse((response) =>
      isAdminUserResponse(response, "POST", /^\/api\/v1\/admin\/users$/),
    );
    await page.getByRole("button", { name: "Создать сотрудника" }).click();
    const createUserResponse = await createUserResponsePromise;
    expect(createUserResponse.status()).toBeGreaterThanOrEqual(200);
    expect(createUserResponse.status()).toBeLessThan(300);

    await expect(page.getByText(`Учётная запись создана: ${adminDisplayName}`)).toBeVisible();
    await expect(page.getByText(adminDisplayName).first()).toBeVisible();
    await expect(page.getByText(adminEmail).first()).toBeVisible();
    await expect(page.getByText("Системный администратор").first()).toBeVisible();
    await expect(page.getByText(/Сессия истекла|Invalid or expired authorization token|Database is unavailable/i)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-users-created-desktop-1280.png"), fullPage: true });

    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page.getByRole("button", { name: /^Войти$/ })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Адрес системы клиники").fill(BASE_URL);
    await page.getByLabel("Эл. почта").fill(adminEmail);
    await page.getByLabel("Пароль").fill(adminPassword);
    await page.getByRole("button", { name: /^Войти$/ }).click();
    await expect(page.getByText("Рабочее место · Системный администратор")).toBeVisible({ timeout: 15_000 });
    await sidebarLink(page, "Сотрудники и доступ").click();
    await expect(page.getByText(adminDisplayName).first()).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText(adminEmail).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-users-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    const auditResponsePromise = page.waitForResponse(isAdminAuditResponse);
    await sidebarLink(page, "Аудит").click();
    const auditResponse = await auditResponsePromise;
    expect(auditResponse.status()).toBeGreaterThanOrEqual(200);
    expect(auditResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { name: "Аудит" })).toBeVisible();
    await expect(page.getByText(/Рабочий режим: журнал читается из базы сервера/)).toBeVisible();
    await expect(appMain(page)).not.toContainText(/Учебный режим|Экспорт отключён|backend|self-hosted|payload|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i);
    await expect(page.getByRole("tab", { name: "Клиники" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Сотрудники" })).toBeVisible();
    await expect(page.getByText(/Клиника создана|Сотрудник создан|Роль назначена/).first()).toBeVisible();

    await page.getByLabel("Поиск аудита").fill(`нет совпадений ${suffix}`);
    await expect(page.getByText("События не найдены. Измените фильтр или обновите журнал.")).toBeVisible();
    await page.getByLabel("Поиск аудита").fill("");
    await page.getByRole("button", { name: "Проверить целостность" }).click();
    await expect(page.getByText(/Целостность: записей/)).toBeVisible();
    const auditDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Скачать журнал" }).click();
    const auditDownload = await auditDownloadPromise;
    expect(auditDownload.suggestedFilename()).toMatch(/^audit-events-\d{4}-\d{2}-\d{2}\.csv$/);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-audit-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: "Аудит" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-audit-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    const accessEventsResponsePromise = page.waitForResponse(isAdminAuditResponse);
    await sidebarLink(page, "События доступа").click();
    const accessEventsResponse = await accessEventsResponsePromise;
    expect(accessEventsResponse.status()).toBeGreaterThanOrEqual(200);
    expect(accessEventsResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { name: "События доступа" })).toBeVisible();
    await expect(page.getByText(/Данные читаются из рабочей системы клиники/)).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная роль|system_admin|backend|self-hosted|RPC list_access_events_admin|payload|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expect(page.getByLabel("Источник событий")).not.toContainText("Учебные данные");
    await expect(
      page
        .locator("tbody tr", { hasText: /Клиника создана|Сотрудник создан|Роль назначена/ })
        .first(),
    ).toBeVisible();

    await page.getByLabel("Поиск событий доступа").fill(`нет совпадений ${suffix}`);
    await expect(page.getByText("События не найдены. Измените фильтры или обновите журнал.").first()).toBeVisible();
    await page.getByLabel("Поиск событий доступа").fill("");
    const accessDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Скачать события доступа таблицей" }).click();
    const accessDownload = await accessDownloadPromise;
    expect(accessDownload.suggestedFilename()).toMatch(
      /^access-events-\d{4}-\d{2}-\d{2}-all-all-pages-\d+-rows-\d+-cols\.csv$/,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-access-events-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: "События доступа" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-access-events-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    await sidebarLink(page, "Готовность публикации").click();
    await expect(page.getByRole("heading", { level: 1, name: "Готовность публикации" })).toBeVisible();
    await expect(page.getByText(/Рабочий режим: готовность публикации/)).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная роль|system_admin|backend|self-hosted|payload|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-release-status-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Готовность публикации" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-release-status-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    const opsStatusResponsePromise = page.waitForResponse((response) => isOpsResponse(response, "/api/v1/ops/status"));
    const opsRuntimeResponsePromise = page.waitForResponse((response) =>
      isOpsResponse(response, "/api/v1/ops/runtime-checks"),
    );
    const productReadinessResponsePromise = page.waitForResponse((response) =>
      isOpsResponse(response, "/api/v1/product/readiness"),
    );
    await sidebarLink(page, "Рабочий контур").click();
    const [opsStatusResponse, opsRuntimeResponse, productReadinessResponse] = await Promise.all([
      opsStatusResponsePromise,
      opsRuntimeResponsePromise,
      productReadinessResponsePromise,
    ]);
    expect(opsStatusResponse.status()).toBeGreaterThanOrEqual(200);
    expect(opsStatusResponse.status()).toBeLessThan(300);
    expect(opsRuntimeResponse.status()).toBeGreaterThanOrEqual(200);
    expect(opsRuntimeResponse.status()).toBeLessThan(300);
    expect(productReadinessResponse.status()).toBeGreaterThanOrEqual(200);
    expect(productReadinessResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { level: 1, name: "Рабочий контур" })).toBeVisible();
    await expect(page.getByText("Готовность продукта").first()).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная роль|system_admin|backend|self-hosted|PostgreSQL|Object storage runtime|Post-deploy verification|Restore dry-run|Audit export dry-run|metadata-only|PHI|S3-compatible|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-self-hosted-ops-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Рабочий контур" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-self-hosted-ops-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    const serviceKeysListResponsePromise = page.waitForResponse((response) =>
      isAdminServiceKeyResponse(response, "GET", /^\/api\/v1\/admin\/service-keys$/),
    );
    await sidebarLink(page, "Служебные ключи").click();
    const serviceKeysListResponse = await serviceKeysListResponsePromise;
    expect(serviceKeysListResponse.status()).toBeGreaterThanOrEqual(200);
    expect(serviceKeysListResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { level: 1, name: "Служебные ключи" })).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная|учебное действие|system_admin|backend|self-hosted|PostgreSQL|Object storage runtime|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );

    await page.getByLabel("Название служебного ключа").fill(serviceKeyLabel);
    await page.getByLabel("Владелец или назначение").fill(serviceKeyOwner);
    const createServiceKeyResponsePromise = page.waitForResponse((response) =>
      isAdminServiceKeyResponse(response, "POST", /^\/api\/v1\/admin\/service-keys$/),
    );
    await page.getByRole("button", { name: "Создать ключ" }).click();
    const createServiceKeyResponse = await createServiceKeyResponsePromise;
    expect(createServiceKeyResponse.status()).toBeGreaterThanOrEqual(200);
    expect(createServiceKeyResponse.status()).toBeLessThan(300);
    await expect(page.getByText(`Ключ создан: ${serviceKeyLabel}. Значение показано один раз.`)).toBeVisible();
    await expect(page.getByText("Новый ключ показан один раз")).toBeVisible();
    await page.getByRole("button", { name: "Скрыть ключ" }).click();
    await expect(page.getByText("Новый ключ показан один раз")).toHaveCount(0);
    const serviceKeyRegion = page.getByRole("region", { name: `Служебный ключ ${serviceKeyLabel}` });
    await expect(serviceKeyRegion).toBeVisible();
    await expect(serviceKeyRegion).toContainText(serviceKeyOwner);

    const rotateServiceKeyResponsePromise = page.waitForResponse((response) =>
      isAdminServiceKeyResponse(response, "PATCH", /^\/api\/v1\/admin\/service-keys\/[^/]+\/rotate$/),
    );
    await serviceKeyRegion.getByRole("button", { name: "Обновить ключ" }).click();
    const rotateServiceKeyResponse = await rotateServiceKeyResponsePromise;
    expect(rotateServiceKeyResponse.status()).toBeGreaterThanOrEqual(200);
    expect(rotateServiceKeyResponse.status()).toBeLessThan(300);
    await expect(page.getByText(`Ключ обновлён: ${serviceKeyLabel}. Новое значение показано один раз.`)).toBeVisible();
    await expect(page.getByText("Новый ключ показан один раз")).toBeVisible();
    await page.getByRole("button", { name: "Скрыть ключ" }).click();
    await expect(page.getByText("Новый ключ показан один раз")).toHaveCount(0);

    const revokeServiceKeyResponsePromise = page.waitForResponse((response) =>
      isAdminServiceKeyResponse(response, "PATCH", /^\/api\/v1\/admin\/service-keys\/[^/]+\/revoke$/),
    );
    await serviceKeyRegion.getByRole("button", { name: "Отозвать ключ" }).click();
    const revokeServiceKeyResponse = await revokeServiceKeyResponsePromise;
    expect(revokeServiceKeyResponse.status()).toBeGreaterThanOrEqual(200);
    expect(revokeServiceKeyResponse.status()).toBeLessThan(300);
    await expect(page.getByText(`Ключ отозван: ${serviceKeyLabel}.`)).toBeVisible();
    await expect(serviceKeyRegion.getByText("Отозван")).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная|учебное действие|system_admin|backend|self-hosted|PostgreSQL|Object storage runtime|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-api-keys-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Служебные ключи" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-api-keys-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    await sidebarLink(page, "Справка").click();
    await expect(page.getByRole("heading", { level: 1, name: "Справка" })).toBeVisible();
    await expect(page.getByText("Безопасность и границы текущей версии")).toBeVisible();
    await expect(page.getByText("Права на разделы проверяются сервером и зависят от роли сотрудника.")).toBeVisible();
    await expect(page.getByText("Помощник записи даёт только навигационную подсказку для передачи врачу.")).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная|учебный|учебное|учебном|учебные|демо|system_admin|backend|self-hosted|PostgreSQL|Object storage runtime|storagePath|signedUrl|accessToken|qrToken|sessionId|credential|MVP|metadata|workflow|policy|evidence|rollout|monitoring|validation|governance|readiness|Device Bridge|Body Map|Mini App|raw ID|лид/i,
    );
    await page.getByLabel("Поиск по разделам справки").fill(`нет раздела ${suffix}`);
    await expect(page.getByText(/Ничего не найдено по запросу/)).toBeVisible();
    await page.getByRole("button", { name: "Очистить поиск" }).click();
    await expect(page.getByText(/Ничего не найдено по запросу/)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-help-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Справка" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-help-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    await sidebarLink(page, "Клиники и кабинеты").click();
    await expect(page.getByRole("heading", { name: "Клиники и кабинеты" })).toBeVisible();
    await page.getByLabel("Название клиники").fill(clinicAdminClinicName);
    await page.getByLabel("Адрес клиники").fill(clinicAdminClinicAddress);
    await page.getByLabel("Часовой пояс клиники").click();
    await page.getByRole("option", { name: "Москва, Краснодар · UTC+3" }).click();
    const createClinicAdminClinicResponsePromise = page.waitForResponse((response) =>
      isAdminClinicResponse(response, "POST", /^\/api\/v1\/admin\/clinics$/),
    );
    await page.getByRole("button", { name: "Создать клинику" }).click();
    const createClinicAdminClinicResponse = await createClinicAdminClinicResponsePromise;
    expect(createClinicAdminClinicResponse.status()).toBeGreaterThanOrEqual(200);
    expect(createClinicAdminClinicResponse.status()).toBeLessThan(300);
    await expect(page.getByText(`Клиника сохранена и добавлена в список: ${clinicAdminClinicName}`)).toBeVisible();

    await sidebarLink(page, "Сотрудники и доступ").click();
    await expect(page.getByRole("heading", { name: "Сотрудники и доступ" })).toBeVisible();
    await page.getByLabel("ФИО сотрудника").fill(clinicAdminDisplayName);
    await page.getByLabel("Эл. почта").fill(clinicAdminEmail);
    await page.getByLabel("Временный пароль").fill(clinicAdminPassword);
    await page.getByLabel("Роль", { exact: true }).selectOption("clinic_admin");
    await page.getByLabel("Клиника", { exact: true }).selectOption({ label: clinicAdminClinicName });
    const createClinicAdminResponsePromise = page.waitForResponse((response) =>
      isAdminUserResponse(response, "POST", /^\/api\/v1\/admin\/users$/),
    );
    await page.getByRole("button", { name: "Создать сотрудника" }).click();
    const createClinicAdminResponse = await createClinicAdminResponsePromise;
    expect(createClinicAdminResponse.status()).toBeGreaterThanOrEqual(200);
    expect(createClinicAdminResponse.status()).toBeLessThan(300);
    await expect(page.getByText(`Учётная запись создана: ${clinicAdminDisplayName}`)).toBeVisible();
    await expect(page.getByText(clinicAdminEmail).first()).toBeVisible();

    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page.getByRole("button", { name: /^Войти$/ })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Адрес системы клиники").fill(BASE_URL);
    await page.getByLabel("Эл. почта").fill(clinicAdminEmail);
    await page.getByLabel("Пароль").fill(clinicAdminPassword);
    const clinicAdminAnalyticsResponsePromise = page.waitForResponse((response) =>
      isAdminClinicResponse(response, "GET", /^\/api\/v1\/admin\/analytics$/),
    );
    await page.getByRole("button", { name: /^Войти$/ }).click();
    await expect(page.getByText("Рабочее место · Администратор клиники")).toBeVisible({ timeout: 15_000 });
    const clinicAdminAnalyticsResponse = await clinicAdminAnalyticsResponsePromise;
    expect(clinicAdminAnalyticsResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminAnalyticsResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { level: 1, name: "Операционный центр клиники" })).toBeVisible();
    await expect(page.getByText("Рабочий режим: показатели читаются из рабочей базы сервиса. Персональные строки, фото и медицинские выводы не выводятся.")).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная роль|учебная оценка|Учебная система|демо|mock|system_admin|backend|self-hosted|PostgreSQL|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-home-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Операционный центр клиники" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-home-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    for (const name of [
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
      await expect(sidebarLinks(page, name), `clinic_admin sidebar should include ${name}`).toHaveCount(1);
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
      await expect(sidebarLinks(page, name), `clinic_admin sidebar should not include ${name}`).toHaveCount(0);
    }

    const clinicAdminClinicListResponsePromise = page.waitForResponse((response) =>
      isAdminClinicResponse(response, "GET", /^\/api\/v1\/admin\/clinics$/),
    );
    await sidebarLink(page, "Клиники и кабинеты").click();
    const clinicAdminClinicListResponse = await clinicAdminClinicListResponsePromise;
    expect(clinicAdminClinicListResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminClinicListResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { name: "Клиники и кабинеты" })).toBeVisible();
    await expect(page.getByText("Доступ администратора клиники")).toBeVisible();
    await expect(page.getByRole("button", { name: "Создать клинику" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Создать кабинет и владельца" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Приостановить" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "В архив" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Удалить пустую запись" })).toHaveCount(0);
    await expect(page.getByText(clinicAdminClinicName).first()).toBeVisible();
    await expect(page.getByText(`адрес: ${clinicAdminClinicAddress}`).first()).toBeVisible();

    await page.getByRole("button", { name: "Редактировать" }).first().click();
    await expect(page.getByRole("region", { name: "Редактирование клиники" })).toBeVisible();
    await page.getByLabel("Адрес редактируемой клиники").fill(clinicAdminUpdatedAddress);
    const clinicAdminUpdateResponsePromise = page.waitForResponse((response) =>
      isAdminClinicResponse(response, "PATCH", /^\/api\/v1\/admin\/clinics\/[^/]+$/),
    );
    await page.getByRole("button", { name: "Сохранить изменения" }).click();
    const clinicAdminUpdateResponse = await clinicAdminUpdateResponsePromise;
    expect(clinicAdminUpdateResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminUpdateResponse.status()).toBeLessThan(300);
    await expect(page.getByText(`Изменения сохранены: ${clinicAdminClinicName}`)).toBeVisible();
    await expect(page.getByText(`адрес: ${clinicAdminUpdatedAddress}`).first()).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|демо|mock|system_admin|backend|self-hosted|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-clinics-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: "Клиники и кабинеты" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-clinics-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    const clinicAdminDoctorsListResponsePromise = page.waitForResponse((response) =>
      isAdminUserResponse(response, "GET", /^\/api\/v1\/admin\/doctors$/),
    );
    await sidebarLink(page, "Врачи").click();
    const clinicAdminDoctorsListResponse = await clinicAdminDoctorsListResponsePromise;
    expect(clinicAdminDoctorsListResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminDoctorsListResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { level: 1, name: "Врачи" })).toBeVisible();
    await page.getByLabel("ФИО врача").fill(clinicAdminDoctorName);
    await page.getByLabel("Эл. почта").fill(clinicAdminDoctorEmail);
    await page.getByLabel("Временный пароль").fill(clinicAdminDoctorPassword);
    await page.getByLabel("Тип врача").selectOption("doctor");
    await page.getByLabel("Клиника").selectOption({ label: clinicAdminClinicName });
    const clinicAdminCreateDoctorResponsePromise = page.waitForResponse((response) =>
      isAdminUserResponse(response, "POST", /^\/api\/v1\/admin\/doctors$/),
    );
    await page.getByRole("button", { name: "Добавить врача" }).click();
    const clinicAdminCreateDoctorResponse = await clinicAdminCreateDoctorResponsePromise;
    expect(clinicAdminCreateDoctorResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminCreateDoctorResponse.status()).toBeLessThan(300);
    await expect(page.getByText(`Врач добавлен: ${clinicAdminDoctorName}`)).toBeVisible();
    await expect(page.getByText(clinicAdminDoctorEmail).first()).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|демо|mock|system_admin|backend|self-hosted|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-doctors-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Врачи" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-doctors-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    const clinicAdminAnalyticsDeepResponsePromise = page.waitForResponse((response) =>
      isAdminClinicResponse(response, "GET", /^\/api\/v1\/admin\/analytics$/),
    );
    await sidebarLink(page, "Аналитика").click();
    const clinicAdminAnalyticsDeepResponse = await clinicAdminAnalyticsDeepResponsePromise;
    expect(clinicAdminAnalyticsDeepResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminAnalyticsDeepResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { level: 1, name: "Аналитика" })).toBeVisible();
    await expect(page.getByText("Рабочий режим: показаны только агрегаты. Персональные строки, фото, диагнозы и внутренние ссылки не выводятся.")).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|демо|mock|system_admin|backend|self-hosted|PostgreSQL|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-analytics-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Аналитика" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-analytics-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/sys/users", { waitUntil: "networkidle" });
    await expect(mainText(page, "Нет доступа")).toBeVisible();
    await expect(mainText(page, "Администратор клиники")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Сотрудники и доступ" })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    expect(adminResponses.some((item) => item.method === "GET" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "POST" && item.path === "/api/v1/admin/clinics" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "POST" && item.path === "/api/v1/admin/users" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "GET" && item.path === "/api/v1/admin/analytics" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "POST" && item.path === "/api/v1/admin/doctors" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "POST" && item.path === "/api/v1/admin/service-keys" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "PATCH" && /\/api\/v1\/admin\/service-keys\/[^/]+\/rotate/.test(item.path) && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "PATCH" && /\/api\/v1\/admin\/service-keys\/[^/]+\/revoke/.test(item.path) && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "PATCH" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "DELETE" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
