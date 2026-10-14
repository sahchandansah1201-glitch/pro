import { expect, type Page, test } from "@playwright/test";
import { expectWorkingFixtureSafe, installWorkingSmoke, loginWorkingSmoke, SMOKE_PATIENT_ID, SMOKE_PATIENT_NAME } from "./helpers/working-smoke";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

async function expectPatientScreenUsable(page: Page) {
  const metrics = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth, width: document.documentElement.clientWidth,
  }));
  expect(metrics.scroll).toBeLessThanOrEqual(metrics.width + 1);
  expect(await page.locator("main").innerText()).not.toMatch(
    /self-hosted|backend|production|mock|учебный режим|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
  );
}

test.describe("Doctor working patients flow", () => {
  test("working login lists API records and saves a new synthetic patient", async ({ page, baseURL }) => {
    const fixture = await installWorkingSmoke(page, "doctor", baseURL!);
    await loginWorkingSmoke(page, "doctor");
    await page.goto("/patients");
    await expect(page.getByRole("heading", { name: "Пациенты", exact: true })).toBeVisible();
    await expect(page.getByText("В списке: 1")).toBeVisible();
    await expect(page.getByRole("note", { name: "Режим работы списка пациентов" })).toContainText("Рабочий режим");
    await page.getByRole("button", { name: "Добавить пациента", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "Новый пациент", exact: true });
    await dialog.getByLabel("ФИО", { exact: true }).fill("Новый Проверочный Пациент");
    await dialog.getByLabel("Дата рождения", { exact: true }).fill("2000-01-02");
    await dialog.getByRole("button", { name: "Добавить пациента", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText("В списке: 2")).toBeVisible();
    await expect(page.getByRole("link", { name: "Новый Проверочный Пациент", exact: true })).toBeVisible();
    expect(fixture.mutations).toHaveLength(1);
    expect(fixture.mutations[0]).toMatchObject({ path: "/api/v1/patients", method: "POST",
      payload: { fullName: "Новый Проверочный Пациент", birthDate: "2000-01-02" } });
    expectWorkingFixtureSafe(fixture);
  });

  test("patients and API patient card remain accessible at desktop and mobile widths", async ({ page, baseURL }, testInfo) => {
    const fixture = await installWorkingSmoke(page, "doctor", baseURL!);
    await loginWorkingSmoke(page, "doctor");
    const pageErrors: string[] = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/patients");
      const card = page.getByRole("link", { name: new RegExp(`^${SMOKE_PATIENT_NAME}`) }).filter({ visible: true });
      await expect(card).toBeVisible();
      await expect(card).toHaveAttribute("href", `/patients/${SMOKE_PATIENT_ID}`);
      await expectPatientScreenUsable(page);
      await page.screenshot({ path: testInfo.outputPath(`patients-${viewport.width}.png`), fullPage: true });
      await card.click();
      await expect(page.getByRole("heading", { name: SMOKE_PATIENT_NAME, exact: true })).toBeVisible();
      await expectPatientScreenUsable(page);
      await page.screenshot({ path: testInfo.outputPath(`patient-card-${viewport.width}.png`), fullPage: true });
    }
    expect(pageErrors).toEqual([]);
    expect(fixture.mutations).toEqual([]);
    expectWorkingFixtureSafe(fixture);
  });

  test("API failure does not replace the list with historical patient data", async ({ page, baseURL }) => {
    const fixture = await installWorkingSmoke(page, "doctor", baseURL!);
    await loginWorkingSmoke(page, "doctor");
    fixture.failure = true;
    await page.goto("/patients");
    await expect(page.getByRole("heading", { name: "Не удалось загрузить список пациентов", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Повторить загрузку списка пациентов", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: SMOKE_PATIENT_NAME, exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Иванова Наталья Олеговна", exact: true })).toHaveCount(0);
    expect(fixture.mutations).toEqual([]);
    expectWorkingFixtureSafe(fixture);
  });

  test("a legacy local role key cannot open patient records without a working login", async ({ page, baseURL }) => {
    const fixture = await installWorkingSmoke(page, "doctor", baseURL!);
    await page.addInitScript(() => localStorage.setItem("derma-pro:demo-role", "doctor"));
    await page.goto("/patients");
    await expect(page).toHaveURL(/\/self-hosted\/login$/);
    await expect(page.getByRole("heading", { name: "Войти в систему клиники", exact: true })).toBeVisible();
    await expect(page.getByRole("table")).toHaveCount(0);
    expect(fixture.requests).toEqual([]);
    expect(fixture.external).toEqual([]);
  });
});
