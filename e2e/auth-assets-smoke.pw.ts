import { test, expect, type Page } from "@playwright/test";

/**
 * Stage 2A · Opt-in real-auth doctor assets smoke.
 *
 * Skipped unless the following env vars are set:
 *   E2E_DOCTOR_EMAIL
 *   E2E_DOCTOR_PASSWORD
 *   E2E_VISIT_ROUTE   (e.g. /patients/<pid>/visits/<vid>?tab=imaging)
 *
 * Optional:
 *   E2E_EXPECT_ASSET_ROW=1   require at least one asset row.
 *   E2E_TRY_PREVIEW=1        click first row and check preview/error.
 *
 * Read-only by default. Does not upload or delete assets. Does not log
 * tokens, signed URLs, or storage paths.
 */

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const EMAIL = process.env.E2E_DOCTOR_EMAIL;
const PASSWORD = process.env.E2E_DOCTOR_PASSWORD;
const VISIT_ROUTE = process.env.E2E_VISIT_ROUTE;
const EXPECT_ROW = process.env.E2E_EXPECT_ASSET_ROW === "1";
const TRY_PREVIEW = process.env.E2E_TRY_PREVIEW === "1";

const FORBIDDEN_TOKENS = [
  "storageObjectPath",
  "storage_object_path",
  "exif",
];

async function gotoImaging(page: Page, route: string) {
  await page.goto(route, { waitUntil: "networkidle" });
  // If the route did not preselect imaging tab, click it.
  const tab = page.getByRole("tab", { name: "Снимки" });
  if (await tab.isVisible().catch(() => false)) {
    const state = await tab.getAttribute("data-state").catch(() => null);
    if (state !== "active") {
      await tab.click().catch(() => undefined);
    }
  }
}

test.describe("Stage 2A · real-auth doctor assets smoke", () => {
  test.skip(
    !EMAIL || !PASSWORD || !VISIT_ROUTE,
    "Skipped: set E2E_DOCTOR_EMAIL, E2E_DOCTOR_PASSWORD, E2E_VISIT_ROUTE to enable.",
  );

  test("login → visit imaging → assets panel is live, not demo", async ({ page }) => {
    // 1. Login.
    await page.goto("/login", { waitUntil: "networkidle" });

    const emailInput = page.getByLabel("Email");
    const passwordInput = page.getByLabel("Пароль");
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    await emailInput.fill(EMAIL!);
    await passwordInput.fill(PASSWORD!);

    await page.getByRole("button", { name: /^Войти$|^Вход…$/ }).click();

    await expect
      .poll(() => page.url(), { timeout: 15_000 })
      .not.toMatch(/\/login(\?|$)/);

    // 2. Navigate to the visit imaging route.
    await gotoImaging(page, VISIT_ROUTE!);

    // 3. Assets panel exists and is NOT in demo-mode.
    await expect(
      page.getByText("API клинических ассетов не сконфигурирован"),
    ).toHaveCount(0);

    // Either at least one row action OR a safe empty/error state.
    const openButton = page.getByRole("button", { name: /^Открыть снимок / });
    const safeStates = page.getByText(
      /Снимков пока нет|Не удалось загрузить ассеты|Сбой сети при загрузке ассетов|Визит или ассеты не найдены|Недостаточно прав для просмотра ассетов|загрузка…/i,
    );

    const hasRow = (await openButton.count()) > 0;
    const hasSafe = (await safeStates.count()) > 0;
    expect(
      hasRow || hasSafe,
      "Expected either an asset row or a safe empty/error state in the assets panel.",
    ).toBeTruthy();

    if (EXPECT_ROW) {
      expect(
        await openButton.count(),
        "E2E_EXPECT_ASSET_ROW=1 but no 'Открыть снимок …' button rendered.",
      ).toBeGreaterThan(0);
    }

    // 4. Optional preview check.
    if (TRY_PREVIEW && (await openButton.count()) > 0) {
      await openButton.first().click();

      const dialogTitle = page.getByText("Просмотр снимка", { exact: true });
      const safeDownloadError = page.getByText(
        /Снимок не найден\.|Недостаточно прав для открытия снимка\.|Сбой сети при открытии снимка\.|Не удалось открыть снимок\./,
      );

      const opened = await dialogTitle
        .waitFor({ state: "visible", timeout: 10_000 })
        .then(() => true)
        .catch(() => false);

      if (opened) {
        // Visible dialog text must not contain forbidden tokens.
        const dialog = page.getByRole("dialog");
        await expect(
          dialog.getByRole("button", { name: /Открыть в новой вкладке/i }),
        ).toBeVisible();

        // Radix Dialog is modal; keyboard focus should stay inside the preview.
        for (let i = 0; i < 4; i += 1) {
          await page.keyboard.press("Tab");
          expect(
            await dialog.evaluate((el) => el.contains(document.activeElement)),
            "Preview dialog must trap keyboard focus.",
          ).toBeTruthy();
        }

        const text = (await dialog.innerText()).toLowerCase();
        for (const tok of FORBIDDEN_TOKENS) {
          expect(
            text.includes(tok.toLowerCase()),
            `Preview dialog must not expose '${tok}'.`,
          ).toBeFalsy();
        }
        // Should not show a raw https signed URL as visible text.
        expect(
          /https?:\/\//.test(text),
          "Preview dialog must not expose a raw URL in visible text.",
        ).toBeFalsy();
        expect(
          text.includes("sig="),
          "Preview dialog must not expose URL signatures.",
        ).toBeFalsy();
        expect(
          text.includes("access_token"),
          "Preview dialog must not expose access tokens.",
        ).toBeFalsy();

        const imageFallback = dialog.getByText(/Не удалось отобразить изображение/i);
        if (await imageFallback.isVisible().catch(() => false)) {
          await expect(
            dialog.getByRole("button", { name: /^Получить новую ссылку для снимка / }),
          ).toBeVisible();
        }
      } else {
        await expect(safeDownloadError.first()).toBeVisible({ timeout: 5_000 });
      }
    }
  });
});
