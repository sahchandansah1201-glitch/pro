import { expect, type Page, test } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const FORBIDDEN_VISIBLE =
  /self-hosted|backend|production|mock|демо|Demo|metadata|workflow|policy|evidence|rollout|monitoring|validation|raw ID|storagePath|signedUrl|accessToken|qrToken|sessionId|credential|soft|PostgreSQL|7-point|TDS/i;

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollWidth,
    docClient: document.documentElement.clientWidth,
    bodyScroll: document.body.scrollWidth,
    bodyClient: document.body.clientWidth,
  }));

  expect(
    overflow.docScroll,
    `${label}: documentElement.scrollWidth (${overflow.docScroll}) > clientWidth (${overflow.docClient})`,
  ).toBeLessThanOrEqual(overflow.docClient + 1);
  expect(
    overflow.bodyScroll,
    `${label}: body.scrollWidth (${overflow.bodyScroll}) > clientWidth (${overflow.bodyClient})`,
  ).toBeLessThanOrEqual(overflow.bodyClient + 1);
}

async function expectNoForbiddenVisibleTerms(page: Page, label: string) {
  const visibleText = await page.locator("body").innerText();
  expect(visibleText, `${label}: visible UI contains forbidden technical wording`).not.toMatch(FORBIDDEN_VISIBLE);
}

async function expectMobileTapTargets(page: Page, label: string) {
  const smallTargets = await page.locator("main a:visible, main button:visible, main [role='button']:visible").evaluateAll(
    (nodes) =>
      nodes
        .map((node) => {
          const rect = node.getBoundingClientRect();
          const text =
            node.getAttribute("aria-label") ||
            node.textContent?.replace(/\s+/g, " ").trim() ||
            node.getAttribute("href") ||
            node.tagName;
          return { width: rect.width, height: rect.height, text };
        })
        .filter((item) => item.width > 0 && item.height > 0 && (item.width < 44 || item.height < 44)),
  );

  expect(smallTargets, `${label}: tap targets below 44px`).toEqual([]);
}

test.describe("Doctor patients native Russian flow", () => {
  test.beforeEach(async ({ page }) => {
    await setDemoRole(page, "doctor");
  });

  test("patient list gate and safe screen-only actions use native Russian copy", async ({ page }) => {
    await page.goto("/patients", { waitUntil: "networkidle" });

    expect(page.url(), "patients page should not redirect to login").not.toMatch(/\/login(\?|$)/);
    await expect(page.getByRole("heading", { name: "Пациенты" })).toBeVisible();
    await expect(page.getByText("В списке: 10")).toBeVisible();

    const modeNote = page.getByRole("note", { name: "Режим работы списка пациентов" });
    await expect(modeNote).toBeVisible();
    await expect(modeNote).toContainText("Учебный режим");
    await expect(modeNote).toContainText("новые записи и удаление не меняют данные клиники");

    const currentAction = page.getByRole("region", { name: "Что делать с пациентами сейчас" });
    await expect(currentAction).toBeVisible();
    await expect(currentAction).toContainText("Открыть карточку пациента");
    await expect(currentAction).toContainText("без согласия на съёмку");
    await expect(currentAction.getByRole("link", { name: "Открыть карточку" })).toHaveAttribute("href", "/patients/p-007");

    const newPatientButton = page.getByRole("button", { name: "Новый пациент" });
    const modeNoteId = await modeNote.getAttribute("id");
    expect(modeNoteId).toBe("patients-demo-gate-note");
    await expect(newPatientButton).toHaveAttribute("aria-describedby", modeNoteId ?? "");
    await newPatientButton.click();

    const createStatus = page.getByRole("status", { name: "Статус действий с пациентами" });
    await expect(createStatus).toHaveAttribute("aria-live", "polite");
    await expect(createStatus).toHaveAttribute("aria-atomic", "true");
    await expect(createStatus).toContainText("Создание пациента доступно только после входа в систему клиники");
    await expect(createStatus).toContainText("Реальные данные пациентов здесь не вводите");
    await expect(page.getByText("В списке: 10")).toBeVisible();

    const hideButton = page
      .getByRole("button", { name: "Скрыть пациента Иванова Наталья Олеговна" })
      .first();

    await hideButton.click();

    const hideDialog = page.getByRole("alertdialog", {
      name: "Скрыть пациента на этом экране?",
    });
    await expect(hideDialog).toBeVisible();
    await expect(hideDialog.getByRole("button", { name: "Отмена" })).toBeVisible();
    await expect(hideDialog.getByRole("button", { name: "Скрыть на этом экране" })).toBeVisible();
    await expect(hideDialog).toContainText("Реальные данные клиники не изменяются");

    await hideDialog.getByRole("button", { name: "Отмена" }).click();
    await expect(hideDialog).not.toBeVisible();
    await expect(page.getByText("В списке: 10")).toBeVisible();

    await hideButton.click();
    await expect(hideDialog).toBeVisible();
    await hideDialog.getByRole("button", { name: "Скрыть на этом экране" }).click();

    const hideStatus = page.getByRole("status", {
      name: "Статус действий с пациентами",
    });
    await expect(hideStatus).toContainText("Пациент Иванова Наталья Олеговна скрыт только на этом экране");
    await expect(page.getByText("В списке: 9")).toBeVisible();
    await expect(page.getByRole("link", { name: "Иванова Наталья Олеговна", exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Отменить скрытие" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Скрытие пациента" })).toContainText(
      "Скрытие пациента Иванова Наталья Олеговна отменено.",
    );
    await expect(page.getByText("В списке: 10")).toBeVisible();
    await expect(page.getByRole("link", { name: "Иванова Наталья Олеговна", exact: true })).toBeVisible();
    await expectNoForbiddenVisibleTerms(page, "/patients");
  });

  test("patients and patient card render cleanly on desktop and mobile", async ({ page }) => {
    const routes = [
      {
        path: "/patients",
        heading: "Пациенты",
        actionRegion: "Что делать с пациентами сейчас",
        screenshot: "doctor-patients-native-russian",
      },
      {
        path: "/patients/p-004",
        heading: "Новиков Артём Сергеевич",
        actionRegion: "Что делать с карточкой пациента",
        screenshot: "doctor-patient-detail-native-russian",
      },
    ];
    const viewports = [
      { name: "desktop-1280", width: 1280, height: 900 },
      { name: "mobile-390", width: 390, height: 844 },
    ];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const route of routes) {
        await page.goto(route.path, { waitUntil: "networkidle" });
        await expect(page.locator("main")).toContainText(route.heading);
        await expect(page.getByRole("region", { name: route.actionRegion })).toContainText("Что делать сейчас");
        await expectNoForbiddenVisibleTerms(page, `${route.path} @ ${viewport.name}`);
        await expectNoHorizontalOverflow(page, `${route.path} @ ${viewport.name}`);
        if (viewport.width <= 390) {
          await expectMobileTapTargets(page, `${route.path} @ ${viewport.name}`);
        }
        await page.screenshot({
          path: `test-results/${route.screenshot}-${viewport.name}.png`,
          fullPage: true,
        });
      }
    }

    expect(consoleErrors, "application console errors").toEqual([]);
    expect(pageErrors, "application page errors").toEqual([]);
  });
});
