import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

import { expect, type Response, test } from "@playwright/test";

import {
  appMain,
  bannerText,
  expectMainTapTargets,
  expectNoHorizontalOverflow,
  filterExpectedHttpStatusConsoleErrors,
  mainLink,
  mainText,
  sidebarLink,
  sidebarLinks,
} from "./live-admin-test-helpers";

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

function isAdminServiceResponse(response: Response, method: string, matcher: RegExp) {
  const request = response.request();
  return request.method() === method && matcher.test(new URL(response.url()).pathname);
}

function isAdminIntegrationResponse(response: Response, method: string, matcher: RegExp) {
  const request = response.request();
  return request.method() === method && matcher.test(new URL(response.url()).pathname);
}

function isAdminBotResponse(response: Response, method: string, matcher: RegExp) {
  const request = response.request();
  return request.method() === method && matcher.test(new URL(response.url()).pathname);
}

function isAdminGovernanceResponse(response: Response, method: string, matcher: RegExp) {
  const request = response.request();
  return request.method() === method && matcher.test(new URL(response.url()).pathname);
}

function isDeviceResponse(response: Response, method: string, matcher: RegExp) {
  const request = response.request();
  return request.method() === method && matcher.test(new URL(response.url()).pathname);
}

function isOpsResponse(response: Response, path: string) {
  const request = response.request();
  return request.method() === "GET" && new URL(response.url()).pathname === path;
}

test.describe("Live production admin management journey", () => {
  test.setTimeout(90_000);

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
    const clinicAdminAssistantName = `Ассистент клиники ${suffix}`;
    const clinicAdminAssistantEmail = `clinic-assistant-${suffix}@skindoktor.ru`;
    const clinicAdminAssistantPassword = `Dp-${suffix}-Assistant-2026!`;
    const clinicAdminServiceName = `Дерматоскопия проверочная ${suffix}`;
    const clinicAdminUpdatedServiceName = `Дерматоскопия контрольная ${suffix}`;
    const clinicAdminServiceConsent = `Согласие на съёмку ${suffix}`;
    const clinicAdminIntegrationName = `Клиентская база ${suffix}`;
    const clinicAdminUpdatedIntegrationName = `Клиентская база проверена ${suffix}`;
    const clinicAdminBotGreeting = `Здравствуйте, клиника ${suffix} поможет подготовить обращение.`;
    const serviceKeyLabel = `Проверочный ключ ${suffix}`;
    const serviceKeyOwner = `Автотест ${suffix}`;
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const adminResponses: { method: string; path: string; status: number }[] = [];
    let adminUserCreateRequestCount = 0;
    const deviceResponses: { method: string; path: string; status: number }[] = [];
    const governanceResponses: { method: string; path: string; status: number }[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (request.method() === "POST" && url.pathname === "/api/v1/admin/users") {
        adminUserCreateRequestCount += 1;
      }
    });
    page.on("response", (response) => {
      try {
        const url = new URL(response.url());
        if (
          url.pathname.startsWith("/api/v1/admin/clinics") ||
          url.pathname.startsWith("/api/v1/admin/users") ||
          url.pathname.startsWith("/api/v1/admin/doctors") ||
          url.pathname.startsWith("/api/v1/admin/analytics") ||
          url.pathname.startsWith("/api/v1/admin/services") ||
          url.pathname.startsWith("/api/v1/admin/integrations") ||
          url.pathname.startsWith("/api/v1/admin/bot-settings") ||
          url.pathname.startsWith("/api/v1/admin/service-keys")
        ) {
          adminResponses.push({
            method: response.request().method(),
            path: url.pathname,
            status: response.status(),
          });
        }
        if (url.pathname.startsWith("/api/v1/patient-photo-protocol-release/governance")) {
          governanceResponses.push({
            method: response.request().method(),
            path: url.pathname,
            status: response.status(),
          });
        }
        if (url.pathname.startsWith("/api/v1/device")) {
          deviceResponses.push({
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
    await expect(mainText(page, /Учебный режим/i)).toHaveCount(0);

    await page.getByRole("button", { name: "Создать клинику" }).click();
    await expect(mainText(page, "Укажите название и адрес клиники.")).toBeVisible();

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

    await expect(mainText(page, `Клиника сохранена и добавлена в список: ${clinicName}`)).toBeVisible();
    await expect(mainText(page, clinicName).first()).toBeVisible();
    await expect(mainText(page, `адрес: ${clinicAddress}`).first()).toBeVisible();

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

    await expect(mainText(page, `Изменения сохранены: ${clinicName}`)).toBeVisible();
    await expect(mainText(page, `адрес: ${updatedClinicAddress}`).first()).toBeVisible();

    const suspendResponsePromise = page.waitForResponse((response) =>
      isAdminClinicResponse(response, "PATCH", /^\/api\/v1\/admin\/clinics\/[^/]+\/status$/),
    );
    await page.getByRole("button", { name: "Приостановить" }).first().click();
    const suspendResponse = await suspendResponsePromise;
    expect(suspendResponse.status()).toBeGreaterThanOrEqual(200);
    expect(suspendResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Статус обновлён: ${clinicName} · Приостановлена`)).toBeVisible();

    const reactivateClinicResponsePromise = page.waitForResponse((response) =>
      isAdminClinicResponse(response, "PATCH", /^\/api\/v1\/admin\/clinics\/[^/]+\/status$/),
    );
    await page.getByRole("button", { name: "Вернуть в работу" }).first().click();
    const reactivateClinicResponse = await reactivateClinicResponsePromise;
    expect(reactivateClinicResponse.status()).toBeGreaterThanOrEqual(200);
    expect(reactivateClinicResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Статус обновлён: ${clinicName} · Работает`)).toBeVisible();

    const archiveResponsePromise = page.waitForResponse((response) =>
      isAdminClinicResponse(response, "PATCH", /^\/api\/v1\/admin\/clinics\/[^/]+\/status$/),
    );
    await page.getByRole("button", { name: "В архив" }).first().click();
    const archiveResponse = await archiveResponsePromise;
    expect(archiveResponse.status()).toBeGreaterThanOrEqual(200);
    expect(archiveResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Статус обновлён: ${clinicName} · Архив`)).toBeVisible();

    await page.getByRole("button", { name: "Удалить пустую запись" }).first().click();
    await expect(mainText(page, new RegExp(`Подтвердите удаление пустой записи: ${clinicName}`))).toBeVisible();
    const deleteClinicResponsePromise = page.waitForResponse((response) =>
      isAdminClinicResponse(response, "DELETE", /^\/api\/v1\/admin\/clinics\/[^/]+$/),
    );
    await page.getByRole("button", { name: "Подтвердить удаление" }).click();
    const deleteClinicResponse = await deleteClinicResponsePromise;
    expect(deleteClinicResponse.status()).toBeGreaterThanOrEqual(200);
    expect(deleteClinicResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Пустая запись удалена: ${clinicName}`)).toBeVisible();

    await expect(mainText(page, /Invalid or expired authorization token|Database is unavailable/i)).toHaveCount(0);
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
    await expect(mainText(page, /Учебный режим/i)).toHaveCount(0);
    const createUserRegion = page.getByRole("region", { name: "Создание сотрудника" });
    await page.getByLabel("ФИО сотрудника").fill(adminDisplayName);
    await page.getByLabel("Эл. почта").fill(adminEmail);
    await page.getByLabel("Временный пароль").fill("123456789");
    await page.getByLabel("Роль", { exact: true }).selectOption("system_admin");
    await expect(page.getByLabel("Клиника", { exact: true })).toBeDisabled();

    const createRequestsBeforeValidation = adminUserCreateRequestCount;
    await page.getByRole("button", { name: "Создать сотрудника" }).click();
    await expect(createUserRegion.getByRole("alert")).toContainText(
      "Временный пароль должен быть не короче 10 символов.",
    );
    await expect(page.getByLabel("Временный пароль")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Временный пароль")).toBeFocused();
    expect(adminUserCreateRequestCount).toBe(createRequestsBeforeValidation);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-users-validation-desktop-1280.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(createUserRegion.getByRole("alert")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-users-validation-mobile-390.png"), fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.getByLabel("Временный пароль").fill(adminPassword);
    await expect(createUserRegion.getByRole("alert")).toHaveCount(0);

    const createUserResponsePromise = page.waitForResponse((response) =>
      isAdminUserResponse(response, "POST", /^\/api\/v1\/admin\/users$/),
    );
    await page.getByRole("button", { name: "Создать сотрудника" }).click();
    const createUserResponse = await createUserResponsePromise;
    expect(createUserResponse.status()).toBeGreaterThanOrEqual(200);
    expect(createUserResponse.status()).toBeLessThan(300);

    await expect(mainText(page, `Учётная запись создана: ${adminDisplayName}`)).toBeVisible();
    await expect(mainText(page, adminDisplayName).first()).toBeVisible();
    await expect(mainText(page, adminEmail).first()).toBeVisible();
    await expect(mainText(page, "Системный администратор").first()).toBeVisible();
    await expect(mainText(page, /Сессия истекла|Invalid or expired authorization token|Database is unavailable/i)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-users-created-desktop-1280.png"), fullPage: true });

    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page.getByRole("button", { name: /^Войти$/ })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Адрес системы клиники").fill(BASE_URL);
    await page.getByLabel("Эл. почта").fill(adminEmail);
    await page.getByLabel("Пароль").fill(adminPassword);
    await page.getByRole("button", { name: /^Войти$/ }).click();
    await expect(bannerText(page, "Рабочее место · Системный администратор")).toBeVisible({ timeout: 15_000 });
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
      "Справка",
    ]) {
      await expect(sidebarLinks(page, name), `system_admin sidebar should include ${name}`).toHaveCount(1);
    }
    await sidebarLink(page, "Сотрудники и доступ").click();
    await expect(mainText(page, adminDisplayName).first()).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: "networkidle" });
    await expect(mainText(page, adminEmail).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-users-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    const deviceBridgeResponsePromise = page.waitForResponse((response) =>
      isDeviceResponse(response, "GET", /^\/api\/v1\/device-bridges$/),
    );
    const devicesResponsePromise = page.waitForResponse((response) =>
      isDeviceResponse(response, "GET", /^\/api\/v1\/devices$/),
    );
    const deviceWorkerStatusResponsePromise = page.waitForResponse((response) =>
      isDeviceResponse(response, "GET", /^\/api\/v1\/device-bridge-worker\/status$/),
    );
    const deviceReadinessResponsePromise = page.waitForResponse((response) =>
      isDeviceResponse(response, "GET", /^\/api\/v1\/device-bridge-worker\/production-readiness$/),
    );
    await sidebarLink(page, "Устройства").click();
    const [
      deviceBridgeResponse,
      devicesResponse,
      deviceWorkerStatusResponse,
      deviceReadinessResponse,
    ] = await Promise.all([
      deviceBridgeResponsePromise,
      devicesResponsePromise,
      deviceWorkerStatusResponsePromise,
      deviceReadinessResponsePromise,
    ]);
    for (const response of [
      deviceBridgeResponse,
      devicesResponse,
      deviceWorkerStatusResponse,
      deviceReadinessResponse,
    ]) {
      expect(response.status()).toBeGreaterThanOrEqual(200);
      expect(response.status()).toBeLessThan(300);
    }
    await expect(page.getByRole("heading", { level: 1, name: "Устройства" })).toBeVisible();
    await expect(mainText(page, "Рабочая система подключена. Устройства и мосты читаются из реестра рабочей системы клиники.")).toBeVisible();
    await expect(mainText(page, "Реестр устройств загружен из рабочей системы.")).toBeVisible();
    await expect(mainText(page, "Служба моста устройств")).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|демо|mock|system_admin|backend|self-hosted|PostgreSQL|Object storage runtime|storagePath|signedUrl|accessToken|qrToken|sessionId|credential|Device Bridge|metadata|payload_json|worker-only/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-devices-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Устройства" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-admin-devices-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    const auditResponsePromise = page.waitForResponse(isAdminAuditResponse);
    await sidebarLink(page, "Аудит").click();
    const auditResponse = await auditResponsePromise;
    expect(auditResponse.status()).toBeGreaterThanOrEqual(200);
    expect(auditResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { name: "Аудит" })).toBeVisible();
    await expect(mainText(page, /Рабочий режим: журнал читается из базы сервера/)).toBeVisible();
    await expect(appMain(page)).not.toContainText(/Учебный режим|Экспорт отключён|backend|self-hosted|payload|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i);
    await expect(page.getByRole("tab", { name: "Клиники" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Сотрудники" })).toBeVisible();
    await page.getByLabel("Поиск аудита").fill(clinicName);
    await expect(mainText(page, "Клиника создана").first()).toBeVisible();

    await page.getByLabel("Поиск аудита").fill(`нет совпадений ${suffix}`);
    await expect(mainText(page, "События не найдены. Измените фильтр или обновите журнал.")).toBeVisible();
    await page.getByLabel("Поиск аудита").fill("");
    await page.getByRole("button", { name: "Проверить целостность" }).click();
    await expect(mainText(page, /Целостность: записей/)).toBeVisible();
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
    await expect(mainText(page, /Данные читаются из рабочей системы клиники/)).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная роль|system_admin|backend|self-hosted|RPC list_access_events_admin|payload|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expect(page.getByLabel("Источник событий")).not.toContainText("Учебные данные");
    await page.getByLabel("Поиск событий доступа").fill(clinicName);
    await expect(
      page
        .locator("tbody tr", { hasText: "Клиника создана" })
        .first(),
    ).toBeVisible();

    await page.getByLabel("Поиск событий доступа").fill(`нет совпадений ${suffix}`);
    await expect(mainText(page, "События не найдены. Измените фильтры или обновите журнал.").first()).toBeVisible();
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
    await expect(mainText(page, /Рабочий режим: готовность публикации/)).toBeVisible();
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
    await expect(mainText(page, "Готовность продукта").first()).toBeVisible();
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
    await expect(mainText(page, `Ключ создан: ${serviceKeyLabel}. Значение показано один раз.`)).toBeVisible();
    await expect(mainText(page, "Новый ключ показан один раз")).toBeVisible();
    await page.getByRole("button", { name: "Скрыть ключ" }).click();
    await expect(mainText(page, "Новый ключ показан один раз")).toHaveCount(0);
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
    await expect(mainText(page, `Ключ обновлён: ${serviceKeyLabel}. Новое значение показано один раз.`)).toBeVisible();
    await expect(mainText(page, "Новый ключ показан один раз")).toBeVisible();
    await page.getByRole("button", { name: "Скрыть ключ" }).click();
    await expect(mainText(page, "Новый ключ показан один раз")).toHaveCount(0);

    const revokeServiceKeyResponsePromise = page.waitForResponse((response) =>
      isAdminServiceKeyResponse(response, "PATCH", /^\/api\/v1\/admin\/service-keys\/[^/]+\/revoke$/),
    );
    await serviceKeyRegion.getByRole("button", { name: "Отозвать ключ" }).click();
    const revokeServiceKeyResponse = await revokeServiceKeyResponsePromise;
    expect(revokeServiceKeyResponse.status()).toBeGreaterThanOrEqual(200);
    expect(revokeServiceKeyResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Ключ отозван: ${serviceKeyLabel}.`)).toBeVisible();
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
    await expect(mainText(page, "Безопасность и границы текущей версии")).toBeVisible();
    await expect(mainText(page, "Права на разделы проверяются сервером и зависят от роли сотрудника.")).toBeVisible();
    await expect(mainText(page, "Помощник записи даёт только навигационную подсказку для передачи врачу.")).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|учебная|учебный|учебное|учебном|учебные|демо|system_admin|backend|self-hosted|PostgreSQL|Object storage runtime|storagePath|signedUrl|accessToken|qrToken|sessionId|credential|MVP|metadata|workflow|policy|evidence|rollout|monitoring|validation|governance|readiness|Device Bridge|Body Map|Mini App|raw ID|лид/i,
    );
    await page.getByLabel("Поиск по разделам справки").fill(`нет раздела ${suffix}`);
    await expect(mainText(page, /Ничего не найдено по запросу/)).toBeVisible();
    await page.getByRole("button", { name: "Очистить поиск" }).click();
    await expect(mainText(page, /Ничего не найдено по запросу/)).toHaveCount(0);
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
    await expect(mainText(page, `Клиника сохранена и добавлена в список: ${clinicAdminClinicName}`)).toBeVisible();

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
    await expect(mainText(page, `Учётная запись создана: ${clinicAdminDisplayName}`)).toBeVisible();
    await expect(mainText(page, clinicAdminEmail).first()).toBeVisible();

    await page.getByRole("button", { name: "Выйти" }).click();
    await expect(page.getByRole("button", { name: /^Войти$/ })).toBeVisible({ timeout: 15_000 });
    await page.getByLabel("Адрес системы клиники").fill(BASE_URL);
    await page.getByLabel("Эл. почта").fill(clinicAdminEmail);
    await page.getByLabel("Пароль").fill(clinicAdminPassword);
    const clinicAdminAnalyticsResponsePromise = page.waitForResponse((response) =>
      isAdminClinicResponse(response, "GET", /^\/api\/v1\/admin\/analytics$/),
    );
    await page.getByRole("button", { name: /^Войти$/ }).click();
    await expect(bannerText(page, "Рабочее место · Администратор клиники")).toBeVisible({ timeout: 15_000 });
    const clinicAdminAnalyticsResponse = await clinicAdminAnalyticsResponsePromise;
    expect(clinicAdminAnalyticsResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminAnalyticsResponse.status()).toBeLessThan(300);
    const clinicAdminAnalyticsPayload = await clinicAdminAnalyticsResponse.json();
    const clinicAdminRecentAuditEvents = clinicAdminAnalyticsPayload?.item?.recentAuditEvents;
    expect(Array.isArray(clinicAdminRecentAuditEvents)).toBe(true);
    expect(clinicAdminRecentAuditEvents.length).toBeGreaterThan(0);
    expect(
      clinicAdminRecentAuditEvents.every(
        (event: { clinicName?: string | null }) => event.clinicName === clinicAdminClinicName,
      ),
    ).toBe(true);
    const clinicAdminAuditEvents7d = Number(clinicAdminAnalyticsPayload?.item?.auditEvents7d);
    expect(Number.isInteger(clinicAdminAuditEvents7d)).toBe(true);
    expect(clinicAdminAuditEvents7d).toBeGreaterThan(0);
    expect(clinicAdminAuditEvents7d).toBeLessThanOrEqual(clinicAdminRecentAuditEvents.length);
    await expect(page.getByRole("heading", { level: 1, name: "Операционный центр клиники" })).toBeVisible();
    await expect(mainText(page, "Рабочий режим: показатели читаются из рабочей базы сервиса. Персональные строки, фото и медицинские выводы не выводятся.")).toBeVisible();
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
      "Врачи и ассистенты",
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
    await expect(mainText(page, "Доступ администратора клиники")).toBeVisible();
    await expect(page.getByRole("button", { name: "Создать клинику" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Создать кабинет и владельца" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Приостановить" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "В архив" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Удалить пустую запись" })).toHaveCount(0);
    await expect(mainText(page, clinicAdminClinicName).first()).toBeVisible();
    await expect(mainText(page, `адрес: ${clinicAdminClinicAddress}`).first()).toBeVisible();

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
    await expect(mainText(page, `Изменения сохранены: ${clinicAdminClinicName}`)).toBeVisible();
    await expect(mainText(page, `адрес: ${clinicAdminUpdatedAddress}`).first()).toBeVisible();
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
    await sidebarLink(page, "Врачи и ассистенты").click();
    const clinicAdminDoctorsListResponse = await clinicAdminDoctorsListResponsePromise;
    expect(clinicAdminDoctorsListResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminDoctorsListResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { level: 1, name: "Врачи и ассистенты" })).toBeVisible();
    await expect(page.getByRole("tablist", { name: "Разделы сотрудников" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Врачи" })).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: "Добавить врача" }).click();
    const doctorRegion = page.getByRole("region", { name: "Добавить врача" });
    await doctorRegion.getByLabel("ФИО врача").fill(clinicAdminDoctorName);
    await doctorRegion.getByLabel("Эл. почта", { exact: true }).fill(clinicAdminDoctorEmail);
    const doctorPasswordInput = doctorRegion.getByLabel("Временный пароль", { exact: true });
    await doctorPasswordInput.fill(clinicAdminDoctorPassword);
    await expect(doctorPasswordInput).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Показать временный пароль врача" }).click();
    await expect(doctorPasswordInput).toHaveAttribute("type", "text");
    await expect(doctorPasswordInput).toHaveValue(clinicAdminDoctorPassword);
    await page.getByRole("button", { name: "Скрыть временный пароль врача" }).click();
    await expect(doctorPasswordInput).toHaveAttribute("type", "password");
    await doctorRegion.getByRole("combobox", { name: "Тип врача" }).selectOption("doctor");
    await doctorRegion.getByRole("combobox", { name: "Клиника" }).selectOption({ label: clinicAdminClinicName });
    const clinicAdminCreateDoctorResponsePromise = page.waitForResponse((response) =>
      isAdminUserResponse(response, "POST", /^\/api\/v1\/admin\/doctors$/),
    );
    await doctorRegion.getByRole("button", { name: "Добавить врача" }).click();
    const clinicAdminCreateDoctorResponse = await clinicAdminCreateDoctorResponsePromise;
    expect(clinicAdminCreateDoctorResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminCreateDoctorResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Врач добавлен: ${clinicAdminDoctorName}`)).toBeVisible();
    await expect(mainText(page, clinicAdminDoctorEmail).first()).toBeVisible();

    await doctorRegion.getByLabel("ФИО врача").fill(`${clinicAdminDoctorName} повтор`);
    await doctorRegion.getByLabel("Эл. почта", { exact: true }).fill(clinicAdminDoctorEmail);
    await doctorPasswordInput.fill(`${clinicAdminDoctorPassword}-repeat`);
    await doctorRegion.getByRole("combobox", { name: "Тип врача" }).selectOption("doctor");
    await doctorRegion.getByRole("combobox", { name: "Клиника" }).selectOption({ label: clinicAdminClinicName });
    const duplicateDoctorConsoleErrorsStart = consoleErrors.length;
    const clinicAdminDuplicateDoctorResponsePromise = page.waitForResponse((response) =>
      isAdminUserResponse(response, "POST", /^\/api\/v1\/admin\/doctors$/),
    );
    await doctorRegion.getByRole("button", { name: "Добавить врача" }).click();
    const clinicAdminDuplicateDoctorResponse = await clinicAdminDuplicateDoctorResponsePromise;
    expect(clinicAdminDuplicateDoctorResponse.status()).toBe(409);
    await expect(mainText(page, "Учётная запись с такой почтой уже существует.")).toBeVisible();
    await expect(mainText(page, clinicAdminDoctorEmail).first()).toBeVisible();
    const duplicateDoctorConsoleErrors = consoleErrors.splice(duplicateDoctorConsoleErrorsStart);
    expect(
      filterExpectedHttpStatusConsoleErrors(duplicateDoctorConsoleErrors, 409, 1),
      duplicateDoctorConsoleErrors.join("\n"),
    ).toEqual([]);

    await page.getByRole("tab", { name: "Ассистенты" }).click();
    await expect(page.getByRole("heading", { name: "Ассистенты клиники" })).toBeVisible();
    await page.getByRole("button", { name: "Добавить ассистента" }).click();
    const assistantRegion = page.getByRole("region", { name: "Добавить ассистента" });
    await assistantRegion.getByLabel("ФИО ассистента").fill(clinicAdminAssistantName);
    await assistantRegion.getByLabel("Эл. почта ассистента").fill(clinicAdminAssistantEmail);
    const assistantPasswordInput = assistantRegion.getByLabel("Временный пароль ассистента", { exact: true });
    await assistantPasswordInput.fill("123456789");
    await expect(assistantPasswordInput).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Показать временный пароль ассистента" }).click();
    await expect(assistantPasswordInput).toHaveAttribute("type", "text");
    await expect(assistantPasswordInput).toHaveValue("123456789");
    await page.getByRole("button", { name: "Скрыть временный пароль ассистента" }).click();
    await expect(assistantPasswordInput).toHaveAttribute("type", "password");
    await assistantRegion.getByRole("combobox", { name: "Клиника ассистента" }).selectOption({ label: clinicAdminClinicName });
    const assistantCreateRequestsBeforeValidation = adminUserCreateRequestCount;
    await assistantRegion.getByRole("button", { name: "Добавить ассистента" }).click();
    await expect(mainText(page, "Временный пароль должен быть не короче 10 символов.")).toBeVisible();
    expect(adminUserCreateRequestCount).toBe(assistantCreateRequestsBeforeValidation);

    await assistantPasswordInput.fill(clinicAdminAssistantPassword);
    const clinicAdminCreateAssistantResponsePromise = page.waitForResponse((response) =>
      isAdminUserResponse(response, "POST", /^\/api\/v1\/admin\/users$/),
    );
    await assistantRegion.getByRole("button", { name: "Добавить ассистента" }).click();
    const clinicAdminCreateAssistantResponse = await clinicAdminCreateAssistantResponsePromise;
    expect(clinicAdminCreateAssistantResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminCreateAssistantResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Ассистент добавлен: ${clinicAdminAssistantName}`)).toBeVisible();
    await expect(mainText(page, clinicAdminAssistantEmail).first()).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|демо|mock|system_admin|backend|self-hosted|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0 }));
    await appMain(page).evaluate((element) => element.scrollTo({ top: 0, left: 0 }));
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-doctors-desktop-1280.png") });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Врачи и ассистенты" })).toBeVisible();
    await expect(mainText(page, clinicAdminAssistantEmail).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0 }));
    await appMain(page).evaluate((element) => element.scrollTo({ top: 0, left: 0 }));
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-doctors-mobile-390.png") });

    await page.setViewportSize({ width: 1280, height: 900 });
    const accessTab = page.getByRole("tab", { name: "Доступ" });
    await accessTab.click();
    await expect(accessTab).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: "Ассистенты" })).toHaveAttribute("aria-selected", "false");
    await expect(page.getByRole("heading", { name: "Управление доступом" })).toBeVisible();
    await expect(mainText(page, "Учётная запись и роль — разные уровни доступа.")).toBeVisible();
    await page.getByLabel("Поиск сотрудников").fill(clinicAdminDoctorEmail);
    await expect(mainText(page, clinicAdminDoctorEmail).first()).toBeVisible();
    await expect(mainText(page, clinicAdminAssistantEmail)).toHaveCount(0);
    await page.getByLabel("Поиск сотрудников").fill("");
    await page.getByRole("combobox", { name: "Фильтр доступа" }).selectOption("active");
    await expect(mainText(page, clinicAdminAssistantEmail).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Приостановить роль врача" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Отключить доступ" }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0 }));
    await appMain(page).evaluate((element) => element.scrollTo({ top: 0, left: 0 }));
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-access-desktop-1280.png") });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { name: "Управление доступом" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0 }));
    await appMain(page).evaluate((element) => element.scrollTo({ top: 0, left: 0 }));
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-access-mobile-390.png") });

    await page.setViewportSize({ width: 1280, height: 900 });
    const clinicAdminServicesListResponsePromise = page.waitForResponse((response) =>
      isAdminServiceResponse(response, "GET", /^\/api\/v1\/admin\/services$/),
    );
    await sidebarLink(page, "Услуги").click();
    const clinicAdminServicesListResponse = await clinicAdminServicesListResponsePromise;
    expect(clinicAdminServicesListResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminServicesListResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { level: 1, name: "Услуги и тарифы" })).toBeVisible();
    await expect(mainText(page, "Рабочий режим: услуги сохраняются в базе клиники и доступны для настройки записи после проверки условий.")).toBeVisible();
    await page.getByLabel("Название услуги").fill(clinicAdminServiceName);
    await page.getByLabel("Клиника услуги").selectOption({ label: clinicAdminClinicName });
    await page.getByLabel("Категория услуги").selectOption("imaging");
    await page.getByLabel("Длительность услуги").fill("25");
    await page.getByLabel("Минимальная цена").fill("2500");
    await page.getByLabel("Максимальная цена").fill("3500");
    await page.getByLabel("Согласие для услуги").fill(clinicAdminServiceConsent);
    await appMain(page).locator("label", { hasText: "Онлайн-запись" }).locator('input[type="checkbox"]').first().check();

    const clinicAdminCreateServiceResponsePromise = page.waitForResponse((response) =>
      isAdminServiceResponse(response, "POST", /^\/api\/v1\/admin\/services$/),
    );
    await page.getByRole("button", { name: "Создать услугу" }).click();
    const clinicAdminCreateServiceResponse = await clinicAdminCreateServiceResponsePromise;
    expect(clinicAdminCreateServiceResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminCreateServiceResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Услуга создана: ${clinicAdminServiceName}`)).toBeVisible();
    await expect(mainText(page, clinicAdminServiceName).first()).toBeVisible();
    await expect(mainText(page, clinicAdminServiceConsent).first()).toBeVisible();

    const createdServiceRow = appMain(page).locator("tr", { hasText: clinicAdminServiceName }).first();
    await createdServiceRow.getByRole("button", { name: "Редактировать" }).click();
    const editServiceRegion = page.getByRole("region", { name: "Редактирование услуги" });
    await expect(editServiceRegion).toBeVisible();
    await editServiceRegion.getByLabel("Название редактируемой услуги").fill(clinicAdminUpdatedServiceName);
    await editServiceRegion.getByLabel("Длительность редактируемой услуги").fill("35");
    await editServiceRegion.getByLabel("Минимальная цена редактируемой услуги").fill("3000");
    await editServiceRegion.getByLabel("Максимальная цена редактируемой услуги").fill("4000");
    await editServiceRegion.getByLabel("Согласие редактируемой услуги").fill(`${clinicAdminServiceConsent} обновлено`);
    const clinicAdminUpdateServiceResponsePromise = page.waitForResponse((response) =>
      isAdminServiceResponse(response, "PATCH", /^\/api\/v1\/admin\/services\/[^/]+$/),
    );
    await editServiceRegion.getByRole("button", { name: "Сохранить услугу" }).click();
    const clinicAdminUpdateServiceResponse = await clinicAdminUpdateServiceResponsePromise;
    expect(clinicAdminUpdateServiceResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminUpdateServiceResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Услуга обновлена: ${clinicAdminUpdatedServiceName}`)).toBeVisible();
    await expect(mainText(page, clinicAdminUpdatedServiceName).first()).toBeVisible();
    await expect(mainText(page, /3\s000–4\s000 ₽/).first()).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|демо|mock|system_admin|backend|self-hosted|PostgreSQL|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-services-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Услуги и тарифы" })).toBeVisible();
    await expect(mainText(page, clinicAdminUpdatedServiceName).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-services-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    const clinicAdminIntegrationsListResponsePromise = page.waitForResponse((response) =>
      isAdminIntegrationResponse(response, "GET", /^\/api\/v1\/admin\/integrations$/),
    );
    await sidebarLink(page, "Интеграции").click();
    const clinicAdminIntegrationsListResponse = await clinicAdminIntegrationsListResponsePromise;
    expect(clinicAdminIntegrationsListResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminIntegrationsListResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { level: 1, name: "Интеграции" })).toBeVisible();
    await expect(mainText(page, "Рабочий режим: подключения сохраняются в базе клиники. Передача фото, клинических решений и персональных данных закрыта правилами.")).toBeVisible();
    await page.getByLabel("Название подключения").fill(clinicAdminIntegrationName);
    await page.getByLabel("Клиника подключения").selectOption({ label: clinicAdminClinicName });
    await page.getByLabel("Тип подключения").selectOption("crm");
    const clinicAdminCreateIntegrationResponsePromise = page.waitForResponse((response) =>
      isAdminIntegrationResponse(response, "POST", /^\/api\/v1\/admin\/integrations$/),
    );
    await page.getByRole("button", { name: "Создать подключение" }).click();
    const clinicAdminCreateIntegrationResponse = await clinicAdminCreateIntegrationResponsePromise;
    expect(clinicAdminCreateIntegrationResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminCreateIntegrationResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Подключение создано: ${clinicAdminIntegrationName}`)).toBeVisible();
    await expect(mainText(page, clinicAdminIntegrationName).first()).toBeVisible();

    const createdIntegrationRow = appMain(page).locator("tr", { hasText: clinicAdminIntegrationName }).first();
    const integrationDetailResponsePromise = page.waitForResponse((response) =>
      isAdminIntegrationResponse(response, "GET", /^\/api\/v1\/admin\/integrations\/[^/]+$/),
    );
    await mainLink(page, "Открыть").click();
    const integrationDetailResponse = await integrationDetailResponsePromise;
    expect(integrationDetailResponse.status()).toBeGreaterThanOrEqual(200);
    expect(integrationDetailResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { level: 1, name: clinicAdminIntegrationName })).toBeVisible();
    await page.getByLabel("Название подключения").fill(clinicAdminUpdatedIntegrationName);
    await page.getByLabel("Статус подключения").selectOption("connected");
    const updateIntegrationResponsePromise = page.waitForResponse((response) =>
      isAdminIntegrationResponse(response, "PATCH", /^\/api\/v1\/admin\/integrations\/[^/]+$/),
    );
    await page.getByRole("button", { name: "Сохранить подключение" }).click();
    const updateIntegrationResponse = await updateIntegrationResponsePromise;
    expect(updateIntegrationResponse.status()).toBeGreaterThanOrEqual(200);
    expect(updateIntegrationResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Подключение сохранено: ${clinicAdminUpdatedIntegrationName}`)).toBeVisible();
    const checkIntegrationResponsePromise = page.waitForResponse((response) =>
      isAdminIntegrationResponse(response, "POST", /^\/api\/v1\/admin\/integrations\/[^/]+\/check$/),
    );
    await page.getByRole("button", { name: "Проверить подключение" }).click();
    const checkIntegrationResponse = await checkIntegrationResponsePromise;
    expect(checkIntegrationResponse.status()).toBeGreaterThanOrEqual(200);
    expect(checkIntegrationResponse.status()).toBeLessThan(300);
    await expect(mainText(page, "Проверка подключения выполнена.")).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|демо|mock|system_admin|backend|self-hosted|PostgreSQL|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-integration-detail-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: clinicAdminUpdatedIntegrationName })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-integration-detail-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    const clinicAdminBotListResponsePromise = page.waitForResponse((response) =>
      isAdminBotResponse(response, "GET", /^\/api\/v1\/admin\/bot-settings$/),
    );
    await sidebarLink(page, "Бот").click();
    const clinicAdminBotListResponse = await clinicAdminBotListResponsePromise;
    expect(clinicAdminBotListResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminBotListResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { level: 1, name: "Бот" })).toBeVisible();
    await expect(mainText(page, "Рабочий режим: настройки сохраняются в базе клиники. Пробная проверка не отправляет сообщения пациентам.")).toBeVisible();
    await page.getByLabel("Клиника бота").selectOption({ label: clinicAdminClinicName });
    await page.getByLabel("Приветствие").fill(clinicAdminBotGreeting);
    const clinicAdminBotUpdateResponsePromise = page.waitForResponse((response) =>
      isAdminBotResponse(response, "PATCH", /^\/api\/v1\/admin\/bot-settings$/),
    );
    await page.getByRole("button", { name: "Сохранить настройки" }).click();
    const clinicAdminBotUpdateResponse = await clinicAdminBotUpdateResponsePromise;
    expect(clinicAdminBotUpdateResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminBotUpdateResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Настройки бота сохранены: ${clinicAdminClinicName}`)).toBeVisible();
    const clinicAdminBotDryRunResponsePromise = page.waitForResponse((response) =>
      isAdminBotResponse(response, "POST", /^\/api\/v1\/admin\/bot-settings\/dry-run$/),
    );
    await page.getByRole("button", { name: "Проверить сценарий" }).click();
    const clinicAdminBotDryRunResponse = await clinicAdminBotDryRunResponsePromise;
    expect(clinicAdminBotDryRunResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminBotDryRunResponse.status()).toBeLessThan(300);
    await expect(mainText(page, `Пробный сценарий проверен: ${clinicAdminClinicName}`)).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|демо|mock|system_admin|backend|self-hosted|PostgreSQL|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-bot-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Бот" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-bot-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    const clinicAdminGovernanceListResponsePromise = page.waitForResponse((response) =>
      isAdminGovernanceResponse(response, "GET", /^\/api\/v1\/patient-photo-protocol-release\/governance$/),
    );
    await sidebarLink(page, "Управление доступом").click();
    const clinicAdminGovernanceListResponse = await clinicAdminGovernanceListResponsePromise;
    expect(clinicAdminGovernanceListResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminGovernanceListResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { level: 1, name: "Управление доступом" })).toBeVisible();
    await expect(mainText(page, "Только агрегаты")).toBeVisible();
    await expect(mainText(page, "Проверка хранения и сроков")).toBeVisible();
    await expect(mainText(page, "Проверка файлов и сеансов")).toBeVisible();

    for (const [buttonName, path] of [
      ["Блокировать окна без правил", /^\/api\/v1\/patient-photo-protocol-release\/governance\/block-unapproved-retention$/],
      ["Закрыть окна без срока", /^\/api\/v1\/patient-photo-protocol-release\/governance\/block-missing-expiry$/],
      ["Закрыть временные коды", /^\/api\/v1\/patient-photo-protocol-release\/governance\/block-unsafe-session-artifacts$/],
      ["Подготовить новую выдачу", /^\/api\/v1\/patient-photo-protocol-release\/governance\/prepare-access-artifact-rotation$/],
      ["Подготовить ключ входа", /^\/api\/v1\/patient-photo-protocol-release\/governance\/issue-access-credential-hash$/],
      ["Отозвать истёкшие окна", /^\/api\/v1\/patient-photo-protocol-release\/governance\/revoke-expired$/],
    ] as const) {
      const governanceOperationResponsePromise = page.waitForResponse((response) =>
        isAdminGovernanceResponse(response, "POST", path),
      );
      await appMain(page).getByRole("button", { name: buttonName }).first().click();
      const governanceOperationResponse = await governanceOperationResponsePromise;
      expect(governanceOperationResponse.status()).toBeGreaterThanOrEqual(200);
      expect(governanceOperationResponse.status()).toBeLessThan(300);
    }

    await expect(mainText(page, "Последнее действие системы")).toBeVisible();
    await expect(appMain(page)).not.toContainText(
      /Учебный режим|демо|mock|system_admin|backend|self-hosted|PostgreSQL|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-governance-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("heading", { level: 1, name: "Управление доступом" })).toBeVisible();
    await expect(mainText(page, "Только агрегаты")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-clinic-admin-governance-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });
    const clinicAdminAnalyticsDeepResponsePromise = page.waitForResponse((response) =>
      isAdminClinicResponse(response, "GET", /^\/api\/v1\/admin\/analytics$/),
    );
    await sidebarLink(page, "Аналитика").click();
    const clinicAdminAnalyticsDeepResponse = await clinicAdminAnalyticsDeepResponsePromise;
    expect(clinicAdminAnalyticsDeepResponse.status()).toBeGreaterThanOrEqual(200);
    expect(clinicAdminAnalyticsDeepResponse.status()).toBeLessThan(300);
    await expect(page.getByRole("heading", { level: 1, name: "Аналитика" })).toBeVisible();
    await expect(mainText(page, "Рабочий режим: показаны только агрегаты. Персональные строки, фото, диагнозы и внутренние ссылки не выводятся.")).toBeVisible();
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
    expect(adminResponses.some((item) => item.method === "POST" && item.path === "/api/v1/admin/services" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "PATCH" && /\/api\/v1\/admin\/services\/[^/]+/.test(item.path) && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "POST" && item.path === "/api/v1/admin/integrations" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "PATCH" && /\/api\/v1\/admin\/integrations\/[^/]+/.test(item.path) && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "POST" && /\/api\/v1\/admin\/integrations\/[^/]+\/check/.test(item.path) && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "PATCH" && item.path === "/api/v1/admin/bot-settings" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "POST" && item.path === "/api/v1/admin/bot-settings/dry-run" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "POST" && item.path === "/api/v1/admin/service-keys" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "PATCH" && /\/api\/v1\/admin\/service-keys\/[^/]+\/rotate/.test(item.path) && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "PATCH" && /\/api\/v1\/admin\/service-keys\/[^/]+\/revoke/.test(item.path) && item.status >= 200 && item.status < 300)).toBe(true);
    expect(governanceResponses.some((item) => item.method === "GET" && item.path === "/api/v1/patient-photo-protocol-release/governance" && item.status >= 200 && item.status < 300)).toBe(true);
    for (const path of [
      "/api/v1/patient-photo-protocol-release/governance/block-unapproved-retention",
      "/api/v1/patient-photo-protocol-release/governance/block-missing-expiry",
      "/api/v1/patient-photo-protocol-release/governance/block-unsafe-session-artifacts",
      "/api/v1/patient-photo-protocol-release/governance/prepare-access-artifact-rotation",
      "/api/v1/patient-photo-protocol-release/governance/issue-access-credential-hash",
      "/api/v1/patient-photo-protocol-release/governance/revoke-expired",
    ]) {
      expect(governanceResponses.some((item) => item.method === "POST" && item.path === path && item.status >= 200 && item.status < 300)).toBe(true);
    }
    for (const path of [
      "/api/v1/device-bridges",
      "/api/v1/devices",
      "/api/v1/device-bridge-worker/status",
      "/api/v1/device-bridge-worker/production-readiness",
    ]) {
      expect(deviceResponses.some((item) => item.method === "GET" && item.path === path && item.status >= 200 && item.status < 300)).toBe(true);
    }
    expect(adminResponses.some((item) => item.method === "PATCH" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(adminResponses.some((item) => item.method === "DELETE" && item.status >= 200 && item.status < 300)).toBe(true);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
