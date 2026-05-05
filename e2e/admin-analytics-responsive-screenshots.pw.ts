import { test, expect } from "@playwright/test";

/**
 * E2E: responsive screenshots для /admin/analytics.
 *
 * Снимает full-page скриншоты на трёх ключевых ширинах и проверяет:
 *  - mobile (375):  кнопки сортировки клиник имеют min-height ≥ 44px (tap target).
 *  - tablet (768):  всё ещё mobile-классы (min-h-[44px]) до sm-брейка sm:min-h-[28px]
 *                   применяется с sm = 640px, поэтому здесь ждём 28px.
 *  - desktop (1440): компактный sm:min-h-[28px] сохранён.
 *
 * Скриншоты сохраняются как Playwright snapshots для визуального ревью.
 */

const SIZES = [
  { name: "mobile-375", width: 375, height: 812, expectedMinH: "44px" },
  { name: "tablet-768", width: 768, height: 1024, expectedMinH: "28px" },
  { name: "desktop-1440", width: 1440, height: 900, expectedMinH: "28px" },
] as const;

test.describe("/admin/analytics — responsive screenshots & tap target", () => {
  for (const size of SIZES) {
    test(`${size.name} (${size.width}x${size.height})`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/admin/analytics", { waitUntil: "networkidle" });

      const tablist = page.locator(
        '[role="tablist"][aria-label="Сортировка клиник"]',
      );
      await expect(tablist).toBeVisible();

      for (const name of ["По приоритету", "По конверсии"] as const) {
        const btn = tablist.getByRole("tab", { name });
        await expect(btn).toBeVisible();

        const box = await btn.boundingBox();
        expect(box, `${size.name} / ${name}: boundingBox`).not.toBeNull();

        const minH = await btn.evaluate(
          (el) => getComputedStyle(el as HTMLElement).minHeight,
        );
        expect(
          minH,
          `${size.name} / ${name}: computed min-height`,
        ).toBe(size.expectedMinH);

        if (size.expectedMinH === "44px") {
          expect(
            box!.height,
            `${size.name} / ${name}: rendered height ≥ 44`,
          ).toBeGreaterThanOrEqual(44);
        }
      }

      // Полностраничный скриншот для визуального ревью compact-дизайна.
      await page.screenshot({
        path: `test-results/admin-analytics-${size.name}.png`,
        fullPage: true,
      });
    });
  }
});
