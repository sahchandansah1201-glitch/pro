import { readFileSync } from "node:fs";

import { expect, type Page, type Response, test } from "@playwright/test";

import {
  appMain,
  bannerText,
  expectMainTapTargets,
  expectNoHorizontalOverflow,
  mainText,
  sidebarLink,
} from "./live-admin-test-helpers";

const BASE_URL = (process.env.STAGE4M_LIVE_RDS3_BASE_URL || "https://pro.skindoktor.ru").replace(/\/+$/, "");
const DOCTOR_CREDENTIALS_FILE = process.env.STAGE4M_RDS3_DOCTOR_CREDENTIALS_FILE || "";
const ASSISTANT_CREDENTIALS_FILE = process.env.STAGE4M_RDS3_ASSISTANT_CREDENTIALS_FILE || "";
const RECEIPT_FILE = process.env.STAGE4M_RDS3_RECEIPT_FILE || "";
const VISIT_ID = process.env.STAGE4M_RDS3_VISIT_ID || "";

type ImportReceipt = {
  assetId: string;
  captureSource: string;
  status: string;
};

type RuntimeDiagnostics = {
  consoleErrors: string[];
  pageErrors: string[];
  failedApiResponses: string[];
};

test.use({ baseURL: BASE_URL });

function parseCredentials(text: string) {
  const email = text.match(/^Email:\s*(.+)$/m)?.[1]?.trim();
  const password = text.match(/^Password:\s*(.+)$/m)?.[1]?.trim();
  if (!email || !password) throw new Error("Credentials file must include Email and Password lines.");
  return { email, password };
}

function readReceipt(): ImportReceipt {
  return JSON.parse(readFileSync(RECEIPT_FILE, "utf8")) as ImportReceipt;
}

function isResponse(response: Response, method: string, matcher: RegExp) {
  return response.request().method() === method && matcher.test(new URL(response.url()).pathname);
}

function watchRuntime(page: Page): RuntimeDiagnostics {
  const diagnostics: RuntimeDiagnostics = {
    consoleErrors: [],
    pageErrors: [],
    failedApiResponses: [],
  };
  page.on("console", (message) => {
    if (message.type() === "error") diagnostics.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/api/") && response.status() >= 400) {
      diagnostics.failedApiResponses.push(`${response.request().method()} ${url.pathname} ${response.status()}`);
    }
  });
  return diagnostics;
}

async function signIn(page: Page, credentialsFile: string, expectedWorkspace: string) {
  const { email, password } = parseCredentials(readFileSync(credentialsFile, "utf8"));
  await page.goto("/self-hosted/login", { waitUntil: "networkidle" });
  await page.getByLabel("Адрес системы клиники").fill(BASE_URL);
  await page.getByLabel("Эл. почта").fill(email);
  await page.getByLabel("Пароль").fill(password);
  await page.getByRole("button", { name: /^Войти$/ }).click();
  await expect(bannerText(page, expectedWorkspace)).toBeVisible({ timeout: 15_000 });
}

async function expectImportedAsset(response: Response, receipt: ImportReceipt) {
  expect(response.status()).toBeLessThan(300);
  const body = await response.json() as {
    items?: Array<{ id?: string; captureSource?: string }>;
  };
  expect(
    body.items?.some((item) =>
      item.id === receipt.assetId && item.captureSource === "device_bridge"),
    "The imported RDS-3 asset is missing from the safe visit asset response.",
  ).toBe(true);
  expect(JSON.stringify(body)).not.toMatch(
    /objectBucket|objectKey|storagePath|signedUrl|checksumSha256|accessToken|patientSafeText/i,
  );
}

function expectCleanRuntime(diagnostics: RuntimeDiagnostics) {
  expect(diagnostics.failedApiResponses, diagnostics.failedApiResponses.join("\n")).toEqual([]);
  expect(diagnostics.consoleErrors, diagnostics.consoleErrors.join("\n")).toEqual([]);
  expect(diagnostics.pageErrors, diagnostics.pageErrors.join("\n")).toEqual([]);
}

test.describe("Live production RDS-3 folder import journey", () => {
  test.setTimeout(60_000);

  test("assistant sees the Windows bridge photo in the capture queue", async ({ page }, testInfo) => {
    const receipt = readReceipt();
    const diagnostics = watchRuntime(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    const visitsResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/visits$/),
    );
    await signIn(page, ASSISTANT_CREDENTIALS_FILE, "Рабочее место · Ассистент");
    const visitsResponse = await visitsResponsePromise;
    expect(visitsResponse.status()).toBeLessThan(300);
    const visitsBody = await visitsResponse.json() as {
      items?: Array<{ id?: string; patient?: { fullName?: string } }>;
    };
    const targetVisit = visitsBody.items?.find((item) => item.id === VISIT_ID);
    const patientName = targetVisit?.patient?.fullName;
    expect(patientName, "The configured RDS-3 visit is not visible to this assistant.").toBeTruthy();

    await expect(page.getByRole("heading", { level: 1, name: "Съёмка" })).toBeVisible();
    const visitSelect = page.getByRole("combobox").first();
    await visitSelect.click();
    await page.getByRole("option").filter({ hasText: patientName }).first().click();

    const assetsResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", new RegExp(`^/api/v1/visits/${VISIT_ID}/assets$`)),
    );
    await page.getByRole("button", { name: "Обновить" }).click();
    await expectImportedAsset(await assetsResponsePromise, receipt);

    await expect(mainText(page, "Дерматоскопия · Прибор")).toBeVisible();
    await expect(appMain(page)).not.toContainText(/device_bridge|metadata_pending|storagePath|signedUrl|checksumSha256/i);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-rds3-assistant-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(mainText(page, "Дерматоскопия · Прибор")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-rds3-assistant-mobile-390.png"), fullPage: true });

    expect(receipt.status).toBe("imported");
    expect(receipt.captureSource).toBe("device_bridge");
    expectCleanRuntime(diagnostics);
  });

  test("doctor sees the Windows bridge photo in the visit images", async ({ page }, testInfo) => {
    const receipt = readReceipt();
    const diagnostics = watchRuntime(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    await signIn(page, DOCTOR_CREDENTIALS_FILE, "Рабочее место · Дерматолог");

    const visitsResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", /^\/api\/v1\/visits$/),
    );
    await sidebarLink(page, "Визиты").click();
    const visitsResponse = await visitsResponsePromise;
    expect(visitsResponse.status()).toBeLessThan(300);
    const visitsBody = await visitsResponse.json() as { items?: Array<{ id?: string; patientId?: string }> };
    const targetVisit = visitsBody.items?.find((item) => item.id === VISIT_ID);
    expect(targetVisit?.patientId, "The configured RDS-3 visit is not visible to this doctor.").toBeTruthy();

    const visitResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", new RegExp(`^/api/v1/visits/${VISIT_ID}$`)),
    );
    await page.goto(`/patients/${targetVisit?.patientId}/visits/${VISIT_ID}`, { waitUntil: "domcontentloaded" });
    expect((await visitResponsePromise).status()).toBeLessThan(300);
    await expect(mainText(page, "Источник данных: система клиники")).toBeVisible();

    const assetsResponsePromise = page.waitForResponse((response) =>
      isResponse(response, "GET", new RegExp(`^/api/v1/visits/${VISIT_ID}/assets$`)),
    );
    await page.getByRole("tab", { name: "Снимки" }).click();
    await expectImportedAsset(await assetsResponsePromise, receipt);

    await expect(mainText(page, "Дерматоскопия · Прибор")).toBeVisible();
    await expect(appMain(page)).not.toContainText(/device_bridge|metadata_pending|storagePath|signedUrl|checksumSha256/i);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-rds3-doctor-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(mainText(page, "Дерматоскопия · Прибор")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-rds3-doctor-mobile-390.png"), fullPage: true });

    expect(receipt.status).toBe("imported");
    expect(receipt.captureSource).toBe("device_bridge");
    expectCleanRuntime(diagnostics);
  });
});
