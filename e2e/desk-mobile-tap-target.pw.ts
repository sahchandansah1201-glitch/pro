import { test, expect } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

/**
 * E2E: на мобильном /desk (390×844) все интерактивные элементы
 * должны иметь обе стороны ≥ 44px (правило Apple HIG / Google a11y).
 *
 * Что делает тест:
 *  1. Заходит на /desk под ролью doctor (демо-режим).
 *  2. Перебирает интерактивные элементы внутри <main>.
 *  3. Игнорирует скрытые (display:none / visibility:hidden / нулевой box)
 *     и элементы внутри hidden-контейнеров.
 *  4. Помечает нарушителей атрибутом data-tap-fail="WxH" и красным
 *     контуром — для удобства отладки.
 *  5. Сохраняет скриншот (с подсветкой) в test-results.
 *  6. Падает со списком нарушителей.
 *
 * Скоупим только <main>, не shell/header/sidebar — они проверяются
 * отдельным admin-core-pages-tap-target тестом.
 */

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const ROUTE = "/desk";
const MIN_TAP = 44;

interface Offender {
  tag: string;
  text: string;
  w: number;
  h: number;
  selector: string;
}

test.describe("/desk mobile — tap target ≥ 44×44 @ 390x844", () => {
  test(ROUTE, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setDemoRole(page, "doctor");
    await page.goto(ROUTE, { waitUntil: "networkidle" });

    const offenders: Offender[] = await page.evaluate((MIN: number) => {
      const root = document.querySelector("main") ?? document.body;
      const sel =
        'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="link"], [role="menuitem"]';
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(sel));
      const bad: Offender[] = [];

      function shortSelector(el: HTMLElement): string {
        const tag = el.tagName.toLowerCase();
        const id = el.id ? `#${el.id}` : "";
        const cls = el.className && typeof el.className === "string"
          ? `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`
          : "";
        return `${tag}${id}${cls}`.slice(0, 80);
      }

      for (const el of nodes) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;

        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        if (w < MIN || h < MIN) {
          // Автоматическая разметка нарушителя в DOM.
          el.setAttribute("data-tap-fail", `${w}x${h}`);
          el.style.outline = "2px solid #ef4444";
          el.style.outlineOffset = "1px";
          bad.push({
            tag: el.tagName.toLowerCase(),
            text: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 80),
            w,
            h,
            selector: shortSelector(el),
          });
        }
      }
      return bad;
    }, MIN_TAP);

    // Сохраняем скриншот с подсветкой — даже если нарушений нет
    // (полезно как baseline), и приклеиваем в отчёт Playwright.
    const screenshot = await page.screenshot({ fullPage: true });
    await testInfo.attach("desk-mobile-tap-target.png", {
      body: screenshot,
      contentType: "image/png",
    });
    if (offenders.length > 0) {
      await testInfo.attach("desk-mobile-tap-offenders.json", {
        body: Buffer.from(JSON.stringify(offenders, null, 2), "utf8"),
        contentType: "application/json",
      });
    }

    expect(
      offenders,
      `${ROUTE}: интерактивные элементы < 44×44 на 390×844:\n` +
        offenders
          .map((o) => `  • <${o.tag}> "${o.text}" — ${o.w}×${o.h} (${o.selector})`)
          .join("\n"),
    ).toEqual([]);
  });
});
