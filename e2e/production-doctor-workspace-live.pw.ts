import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

import { expect, type Response, test } from "@playwright/test";

import {
  appMain,
  bannerText,
  expectMainTapTargets,
  expectNoHorizontalOverflow,
  mainText,
  sidebarLink,
  sidebarLinks,
} from "./live-admin-test-helpers";

const BASE_URL = (process.env.STAGE4M_LIVE_DOCTOR_BASE_URL || "https://pro.skindoktor.ru").replace(/\/+$/, "");
const CREDENTIALS_FILE = process.env.STAGE4M_DOCTOR_SETUP_CREDENTIALS_FILE || "/root/dermatolog-pro-admin-credentials.txt";
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
          url.pathname === "/api/v1/leads"
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
    await expect(mainText(page, `${ownerDisplayName} · ${practiceName}`)).toBeVisible();
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
});
