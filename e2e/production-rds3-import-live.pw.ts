import { readFileSync } from "node:fs";

import { expect, type Response, test } from "@playwright/test";

import {
  appMain,
  bannerText,
  expectMainTapTargets,
  expectNoHorizontalOverflow,
  mainText,
  sidebarLink,
} from "./live-admin-test-helpers";

const BASE_URL = (process.env.STAGE4M_LIVE_RDS3_BASE_URL || "https://pro.skindoktor.ru").replace(/\/+$/, "");
const CREDENTIALS_FILE = process.env.STAGE4M_RDS3_DOCTOR_CREDENTIALS_FILE || "";
const RECEIPT_FILE = process.env.STAGE4M_RDS3_RECEIPT_FILE || "";
const VISIT_ID = process.env.STAGE4M_RDS3_VISIT_ID || "";

test.use({ baseURL: BASE_URL });

function parseCredentials(text: string) {
  const email = text.match(/^Email:\s*(.+)$/m)?.[1]?.trim();
  const password = text.match(/^Password:\s*(.+)$/m)?.[1]?.trim();
  if (!email || !password) throw new Error("Credentials file must include Email and Password lines.");
  return { email, password };
}

function isResponse(response: Response, method: string, matcher: RegExp) {
  return response.request().method() === method && matcher.test(new URL(response.url()).pathname);
}

test.describe("Live production RDS-3 folder import journey", () => {
  test.setTimeout(60_000);

  test("doctor sees the photo already imported by the Windows bridge as a device capture", async ({ page }, testInfo) => {
    const { email, password } = parseCredentials(readFileSync(CREDENTIALS_FILE, "utf8"));
    const receipt = JSON.parse(readFileSync(RECEIPT_FILE, "utf8")) as {
      assetId: string;
      captureSource: string;
      status: string;
    };
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedApiResponses: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/api/") && response.status() >= 400) {
        failedApiResponses.push(`${response.request().method()} ${url.pathname} ${response.status()}`);
      }
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/self-hosted/login", { waitUntil: "networkidle" });
    await page.getByLabel("Адрес системы клиники").fill(BASE_URL);
    await page.getByLabel("Эл. почта").fill(email);
    await page.getByLabel("Пароль").fill(password);
    await page.getByRole("button", { name: /^Войти$/ }).click();
    await expect(bannerText(page, "Рабочее место · Дерматолог")).toBeVisible({ timeout: 15_000 });

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
    const assetsResponse = await assetsResponsePromise;
    expect(assetsResponse.status()).toBeLessThan(300);
    const assetsBody = await assetsResponse.json() as {
      items?: Array<{ id?: string; captureSource?: string }>;
    };
    expect(
      assetsBody.items?.some((item) =>
        item.id === receipt.assetId && item.captureSource === "device_bridge"),
      "The imported RDS-3 asset is missing from the safe visit asset response.",
    ).toBe(true);
    expect(JSON.stringify(assetsBody)).not.toMatch(
      /objectBucket|objectKey|storagePath|signedUrl|checksumSha256|accessToken|patientSafeText/i,
    );

    await expect(mainText(page, "Дерматоскопия · Прибор")).toBeVisible();
    await expect(appMain(page)).not.toContainText(/device_bridge|metadata_pending|storagePath|signedUrl|checksumSha256/i);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("live-rds3-import-desktop-1280.png"), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(mainText(page, "Дерматоскопия · Прибор")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await expectMainTapTargets(page);
    await page.screenshot({ path: testInfo.outputPath("live-rds3-import-mobile-390.png"), fullPage: true });

    expect(receipt.status).toBe("imported");
    expect(receipt.captureSource).toBe("device_bridge");
    expect(failedApiResponses, failedApiResponses.join("\n")).toEqual([]);
    expect(consoleErrors, consoleErrors.join("\n")).toEqual([]);
    expect(pageErrors, pageErrors.join("\n")).toEqual([]);
  });
});
