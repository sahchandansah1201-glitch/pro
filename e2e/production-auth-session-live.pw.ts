import { readFileSync } from "node:fs";

import { expect, type Response, test } from "@playwright/test";

import {
  appMain,
  bannerText,
  expectMainTapTargets,
  expectNoHorizontalOverflow,
  filterExpectedHttpStatusConsoleErrors,
  mainText,
} from "./live-admin-test-helpers";

const BASE_URL = (process.env.STAGE4M_LIVE_AUTH_BASE_URL || "https://pro.skindoktor.ru").replace(/\/+$/, "");
const CREDENTIALS_FILE = process.env.STAGE4M_AUTH_CREDENTIALS_FILE || "/root/dermatolog-pro-admin-credentials.txt";
const TOKEN_KEY = "derma-pro:self-hosted-api-token";

test.use({ baseURL: BASE_URL });

function parseCredentials(text: string) {
  const email = text.match(/^Email:\s*(.+)$/m)?.[1]?.trim();
  const password = text.match(/^Password:\s*(.+)$/m)?.[1]?.trim();
  if (!email || !password) throw new Error("Credentials file must include Email and Password lines.");
  return { email, password };
}

function isAuthLoginResponse(response: Response) {
  return response.request().method() === "POST" && new URL(response.url()).pathname === "/api/v1/auth/login";
}

test.describe("Live production auth and session journey", () => {
  test.setTimeout(45_000);

  test("user sees validation, signs in, signs out, and recovers from an expired session", async ({ page }, testInfo) => {
    const { email, password } = parseCredentials(readFileSync(CREDENTIALS_FILE, "utf8"));
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const authResponses: Array<{ status: number }> = [];
    let expected401Count = 0;

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (isAuthLoginResponse(response)) authResponses.push({ status: response.status() });
      if (
        response.status() === 401 &&
        (url.pathname === "/api/v1/auth/login" || url.pathname.startsWith("/api/v1/admin/"))
      ) {
        expected401Count += 1;
      }
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/sys/users", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/self-hosted\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Дерматолог Про — рабочий вход" })).toBeVisible();

    const loginButton = page.getByRole("button", { name: /^Войти$/ });
    const baseUrlInput = page.getByLabel("Адрес системы клиники");
    const emailInput = page.getByLabel("Эл. почта");
    const passwordInput = page.getByLabel("Пароль");
    const showPasswordButton = page.getByRole("button", { name: "Показать введённые символы" });
    await baseUrlInput.fill(BASE_URL);

    await loginButton.click();
    await expect(emailInput).toBeFocused();
    expect(authResponses).toHaveLength(0);

    await emailInput.fill("неверная-почта");
    await passwordInput.fill("wrong-password");
    await expect(passwordInput).toHaveAttribute("type", "password");
    await showPasswordButton.click();
    await expect(passwordInput).toHaveAttribute("type", "text");
    await expect(passwordInput).toHaveValue("wrong-password");
    await page.getByRole("button", { name: "Скрыть введённые символы" }).click();
    await expect(passwordInput).toHaveAttribute("type", "password");
    await loginButton.click();
    expect(await emailInput.evaluate((input: HTMLInputElement) => input.validity.typeMismatch)).toBe(true);
    expect(authResponses).toHaveLength(0);

    await emailInput.fill(`missing-auth-${Date.now()}@example.invalid`);
    const unknownEmailResponsePromise = page.waitForResponse(isAuthLoginResponse);
    await loginButton.click();
    const unknownEmailResponse = await unknownEmailResponsePromise;
    expect(unknownEmailResponse.status()).toBe(401);
    await expect(page.getByRole("alert")).toContainText("Неверная эл. почта или пароль.");
    await expect(emailInput).toHaveAttribute("aria-invalid", "true");
    await expect(passwordInput).toHaveAttribute("aria-invalid", "true");

    await emailInput.fill(email);
    await expect(page.getByRole("alert")).toHaveCount(0);
    const invalidLoginResponsePromise = page.waitForResponse(isAuthLoginResponse);
    await loginButton.click();
    const invalidLoginResponse = await invalidLoginResponsePromise;
    expect(invalidLoginResponse.status()).toBe(401);
    await expect(page.getByRole("alert")).toContainText("Неверная эл. почта или пароль.");
    await expect(emailInput).toHaveAttribute("aria-invalid", "true");
    await expect(passwordInput).toHaveAttribute("aria-invalid", "true");
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-auth-invalid-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole("alert")).toContainText("Неверная эл. почта или пароль.");
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-auth-invalid-mobile-390.png"), fullPage: true });

    await page.setViewportSize({ width: 1280, height: 900 });

    await passwordInput.fill(password);
    const validLoginResponsePromise = page.waitForResponse(isAuthLoginResponse);
    await loginButton.click();
    const validLoginResponse = await validLoginResponsePromise;
    expect(validLoginResponse.status()).toBeGreaterThanOrEqual(200);
    expect(validLoginResponse.status()).toBeLessThan(300);
    await expect(bannerText(page, "Рабочее место · Системный администратор")).toBeVisible({ timeout: 15_000 });
    await expect(appMain(page)).not.toContainText(/Invalid or expired authorization token|Database is unavailable/i);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-auth-active-desktop-1280.png"), fullPage: true });

    await page.getByRole("button", { name: "Выйти из рабочей системы" }).click();
    await expect(page).toHaveURL(/\/self-hosted\/login$/);
    await expect(loginButton).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBeNull();
    await page.goto("/sys/users", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/self-hosted\/login$/);

    await baseUrlInput.fill(BASE_URL);
    await emailInput.fill(email);
    await passwordInput.fill(password);
    const secondLoginResponsePromise = page.waitForResponse(isAuthLoginResponse);
    await loginButton.click();
    const secondLoginResponse = await secondLoginResponsePromise;
    expect(secondLoginResponse.status()).toBeGreaterThanOrEqual(200);
    expect(secondLoginResponse.status()).toBeLessThan(300);
    await expect(bannerText(page, "Рабочее место · Системный администратор")).toBeVisible({ timeout: 15_000 });

    await page.goto("/admin/doctors", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1, name: "Врачи и ассистенты" })).toBeVisible();
    await page.getByRole("tab", { name: "Доступ" }).click();
    await expect(page.getByRole("button", { name: "Отключить доступ" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Задать новый пароль" }).first()).toBeVisible();
    const expiredResponsePromise = page.waitForResponse((response) => {
      const path = new URL(response.url()).pathname;
      return response.status() === 401 && /^\/api\/v1\/admin\/(doctors|users|clinics)$/.test(path);
    });
    await page.evaluate(
      ({ key, eventName }) => {
        localStorage.setItem(key, "expired-live-test-token");
        window.dispatchEvent(new Event(eventName));
      },
      { key: TOKEN_KEY, eventName: "derma-pro:self-hosted-api-session" },
    );
    await expiredResponsePromise;
    await expect(mainText(page, "Сессия истекла")).toBeVisible();
    await expect(mainText(page, "Изменения сотрудников не сохраняются, пока вы не войдёте заново.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Отключить доступ" }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: "Задать новый пароль" }).first()).toBeDisabled();
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-auth-expired-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(mainText(page, "Сессия истекла")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-auth-expired-mobile-390.png"), fullPage: true });

    await page.getByRole("button", { name: "Войти заново" }).click();
    await expect(page).toHaveURL(/\/self-hosted\/login$/);
    await expect(page.getByRole("button", { name: /^Войти$/ })).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), TOKEN_KEY)).toBeNull();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-auth-login-mobile-390.png"), fullPage: true });

    expect(authResponses.filter((response) => response.status === 401)).toHaveLength(2);
    expect(authResponses.filter((response) => response.status >= 200 && response.status < 300)).toHaveLength(2);
    expect(
      filterExpectedHttpStatusConsoleErrors(consoleErrors, 401, expected401Count),
      consoleErrors.join("\n"),
    ).toEqual([]);
    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
    await expect(page.locator("body")).not.toContainText(/storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i);
  });
});
