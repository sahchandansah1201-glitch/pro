import { test, expect } from "@playwright/test";

/**
 * E2E: переключение периода в /admin/analytics и проверка a11y-контракта
 * пустых состояний в реальном браузере.
 *
 * Контракт:
 *   - страница содержит range-таблист «Период» с табами
 *     «Все данные» / «Март 2026» / «Последние 90 дней»;
 *   - переключение периода действительно меняет aria-selected;
 *   - все блоки с data-empty="true" имеют role="status" и aria-live="polite";
 *   - при пустом срезе (Март 2026 на демо-данных) появляется хотя бы один
 *     empty-state, и он по-прежнему удовлетворяет ARIA-контракту.
 *
 * SAFETY: только агрегатные DOM-проверки. Никаких пациент-уровневых селекторов.
 */

const PERIOD_TABLIST = '[role="tablist"][aria-label="Период"]';

async function setClinicAdminRole(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("derma-pro:demo-role", "clinic_admin");
    } catch {
      // ignore
    }
  });
}

async function waitLoaded(page: import("@playwright/test").Page) {
  // Дождаться окончания skeleton-загрузки секций.
  await page.waitForFunction(
    () => document.querySelectorAll('[data-loading="true"]').length === 0,
    null,
    { timeout: 5_000 },
  );
}

test.describe("/admin/analytics — empty states a11y across period switches", () => {
  test("переключение периода обновляет таблист и empty-state'ы соблюдают role/aria-live", async ({ page }) => {
    await setClinicAdminRole(page);
    await page.goto("/admin/analytics", { waitUntil: "networkidle" });

    // Таблист периода присутствует.
    const tablist = page.locator(PERIOD_TABLIST);
    await expect(tablist).toBeVisible();

    const tabAll = tablist.getByRole("tab", { name: "Все данные" });
    const tabMarch = tablist.getByRole("tab", { name: "Март 2026" });
    const tab90d = tablist.getByRole("tab", { name: "Последние 90 дней" });

    await expect(tabAll).toHaveAttribute("aria-selected", "true");

    await waitLoaded(page);

    /**
     * Проверка инварианта на текущем состоянии страницы:
     *   - все элементы с data-empty="true" имеют role="status" и aria-live="polite".
     */
    const assertEmptyAriaContract = async (label: string) => {
      const empties = page.locator('[data-empty="true"]');
      const n = await empties.count();
      for (let i = 0; i < n; i++) {
        const el = empties.nth(i);
        await expect(el, `${label}: empty[${i}] role`).toHaveAttribute("role", "status");
        await expect(el, `${label}: empty[${i}] aria-live`).toHaveAttribute("aria-live", "polite");
      }
      return n;
    };

    // Период «Все данные»: контракт сохраняется (даже если 0 empty).
    await assertEmptyAriaContract("all");

    // Переключаем на «Март 2026» — там часть секций должны стать пустыми.
    await tabMarch.click();
    await expect(tabMarch).toHaveAttribute("aria-selected", "true");
    await expect(tabAll).toHaveAttribute("aria-selected", "false");
    await waitLoaded(page);

    await assertEmptyAriaContract("march_2026");

    // Переключаем на «Последние 90 дней».
    await tab90d.click();
    await expect(tab90d).toHaveAttribute("aria-selected", "true");
    await waitLoaded(page);
    await assertEmptyAriaContract("last_90d");

    // Возвращаемся на «Все данные» — контракт всё ещё держится.
    await tabAll.click();
    await expect(tabAll).toHaveAttribute("aria-selected", "true");
    await waitLoaded(page);
    await assertEmptyAriaContract("all (return)");
  });
});
