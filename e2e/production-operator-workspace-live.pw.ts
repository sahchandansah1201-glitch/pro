import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";

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

const BASE_URL = (process.env.STAGE4M_LIVE_OPERATOR_BASE_URL || "https://pro.skindoktor.ru").replace(/\/+$/, "");
const CREDENTIALS_FILE = process.env.STAGE4M_OPERATOR_SETUP_CREDENTIALS_FILE || "/root/dermatolog-pro-admin-credentials.txt";
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

function isResponse(response: Response, method: string, matcher: RegExp) {
  const request = response.request();
  return request.method() === method && matcher.test(new URL(response.url()).pathname);
}

test.describe("Live production operator workspace journey", () => {
  test("operator signs in, creates intake lead, reviews booking queue, and cannot enter other roles", async ({
    page,
  }, testInfo) => {
    test.skip(CONFIRMATION !== REQUIRED_CONFIRMATION, `Set STAGE4M_CONFIRM_CREATE_TEST_CLINIC=${REQUIRED_CONFIRMATION}`);

    const { email, password } = parseCredentials(readFileSync(CREDENTIALS_FILE, "utf8"));
    const suffix = makeSuffix();
    const clinicName = `Клиника оператора ${suffix}`;
    const clinicAddress = `Краснодар, операторская ${suffix}`;
    const operatorDisplayName = `Оператор Dermatolog Pro ${suffix}`;
    const operatorEmail = `operator-live-${suffix}@skindoktor.ru`;
    const operatorPassword = `Dp-${suffix}-Operator-2026!`;
    const leadSummary = `Проверочная заявка оператора ${suffix}`;
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
          url.pathname === "/api/v1/leads/appointments" ||
          url.pathname === "/api/v1/leads" ||
          /^\/api\/v1\/leads\/[^/]+$/.test(url.pathname) ||
          url.pathname === "/api/v1/clinic/booking-requests" ||
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
    await expect(mainText(page, /Заявок на запись по текущему фильтру нет|Пациент/)).toBeVisible();
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
