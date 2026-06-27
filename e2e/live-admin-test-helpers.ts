import { expect, type Page } from "@playwright/test";

export function appMain(page: Page) {
  return page.locator("main").first();
}

export function sidebarLinks(page: Page, name: string) {
  return page.locator('[data-sidebar="menu-button"]').filter({ hasText: name });
}

export function sidebarLink(page: Page, name: string) {
  return sidebarLinks(page, name).first();
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollWidth,
    docClient: document.documentElement.clientWidth,
    bodyScroll: document.body.scrollWidth,
    bodyClient: document.body.clientWidth,
  }));
  expect(overflow.docScroll).toBeLessThanOrEqual(overflow.docClient + 1);
  expect(overflow.bodyScroll).toBeLessThanOrEqual(overflow.bodyClient + 1);
}

export async function expectMainTapTargets(page: Page) {
  const offenders = await page.evaluate(() => {
    const root = document.querySelector("main") ?? document.body;
    const tapRect = (el: HTMLElement) => {
      if (el instanceof HTMLInputElement && el.type === "checkbox") {
        const label = el.closest("label");
        if (label instanceof HTMLElement) return label.getBoundingClientRect();
      }
      return el.getBoundingClientRect();
    };
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, a[href], input:not([type="hidden"]), textarea, select, [role="button"], [role="tab"], [role="combobox"]',
      ),
    )
      .map((el) => {
        const rect = tapRect(el);
        const style = getComputedStyle(el);
        return {
          text: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          hidden:
            rect.width === 0 ||
            rect.height === 0 ||
            style.display === "none" ||
            style.visibility === "hidden",
        };
      })
      .filter((item) => !item.hidden && item.height < 44);
  });
  expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
}
