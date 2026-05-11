import { test, expect } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

/**
 * E2E: на мобильной ширине кнопки сортировки клиник
 * («По приоритету», «По конверсии») должны иметь tap target ≥ 44px по высоте.
 *
 * SAFETY: только агрегатные DOM/box-проверки, без пациент-уровневых данных.
 */

test.describe("/admin/analytics — clinic sort buttons mobile tap target", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("min-height ≥ 44px на мобильной ширине", async ({ page }) => {
    await setDemoRole(page, "clinic_admin");
    await page.goto("/admin/analytics", { waitUntil: "networkidle" });

    const tablist = page.locator('[role="tablist"][aria-label="Сортировка клиник"]');
    await expect(tablist).toBeVisible();

    for (const name of ["По приоритету", "По конверсии"] as const) {
      const btn = tablist.getByRole("tab", { name });
      await expect(btn).toBeVisible();

      const box = await btn.boundingBox();
      expect(box, `${name}: boundingBox`).not.toBeNull();
      expect(box!.height, `${name}: height ≥ 44`).toBeGreaterThanOrEqual(44);

      const minH = await btn.evaluate(
        (el) => getComputedStyle(el as HTMLElement).minHeight,
      );
      // На мобильной ширине должен применяться min-h-[44px], а не sm:min-h-[28px].
      expect(minH, `${name}: computed min-height`).toBe("44px");
    }
  });
});
