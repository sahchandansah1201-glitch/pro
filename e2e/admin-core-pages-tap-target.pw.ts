import { test, expect } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

/**
 * E2E: на 390px все интерактивные элементы (кнопки, ссылки, поля ввода,
 * tab-кнопки) на core admin-страницах имеют высоту ≥ 44px.
 *
 * Игнорируем:
 *  - скрытые элементы (display:none, visibility:hidden, нулевой box);
 *  - элементы внутри hidden-контейнеров (md:block таблицы скрыты на мобиле).
 */

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const ROUTES = [
  "/admin",
  "/admin/doctors",
  "/admin/services",
  "/admin/clinics",
  "/admin/integrations",
  "/admin/integrations/crm/int-005",
  "/admin/analytics",
  "/admin/governance",
] as const;
const MIN_TAP = 44;

test.describe("Admin core pages — tap target ≥ 44px @ 390x844", () => {
  for (const route of ROUTES) {
    test(`${route}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await setDemoRole(page, "clinic_admin");
      await page.goto(route, { waitUntil: "networkidle" });

      const offenders = await page.evaluate((MIN: number) => {
        // Скоупим проверку контентом страницы — не shell/header/sidebar.
        const root = document.querySelector("main") ?? document.body;
        const sel = 'button, a[href], input:not([type="hidden"]), [role="tab"]';
        const nodes = Array.from(root.querySelectorAll<HTMLElement>(sel));
        const bad: { tag: string; text: string; h: number; w: number }[] = [];
        for (const el of nodes) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === "hidden" || cs.display === "none") continue;
          if (rect.height < MIN) {
            bad.push({
              tag: el.tagName.toLowerCase(),
              text: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 80),
              h: Math.round(rect.height),
              w: Math.round(rect.width),
            });
          }
        }
        return bad;
      }, MIN_TAP);

      const filtered = offenders;

      expect(
        filtered,
        `${route}: интерактивные элементы < 44px на 390:\n` +
          filtered.map((o) => `  • <${o.tag}> "${o.text}" — ${o.w}x${o.h}`).join("\n"),
      ).toEqual([]);
    });
  }
});
