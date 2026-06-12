import { test, expect } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

const BADGE_SELECTOR =
  '[role="status"][aria-label*="Статус защищённой ссылки"]';

test.describe("Operator protected-link status badge — smoke", () => {
  test("renders expired and active status badges with accessible announcements", async ({
    page,
  }) => {
    await setDemoRole(page, "operator");
    await page.goto("/operator", { waitUntil: "networkidle" });

    expect(page.url(), "operator smoke should not redirect to /login").not.toMatch(
      /\/login(\?|$)/,
    );

    const expiredBadge = page.locator(BADGE_SELECTOR, { hasText: "истекла" }).first();
    await expect(expiredBadge).toBeVisible();
    await expect(expiredBadge).toHaveAttribute("aria-live", "polite");
    await expect(expiredBadge).toHaveAttribute("aria-atomic", "true");
    await expect(expiredBadge).toHaveAttribute(
      "aria-label",
      /Статус защищённой ссылки: истекла/,
    );

    await page
      .locator(".cursor-pointer", { hasText: "Обращение 002" })
      .first()
      .click();

    const activeBadge = page.locator(BADGE_SELECTOR, { hasText: "активна" }).first();
    await expect(activeBadge).toBeVisible();
    await expect(activeBadge).toHaveAttribute("aria-live", "polite");
    await expect(activeBadge).toHaveAttribute("aria-atomic", "true");
    await expect(activeBadge).toHaveAttribute(
      "aria-label",
      /Статус защищённой ссылки: активна/,
    );
  });
});
