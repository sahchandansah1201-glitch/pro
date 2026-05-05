import { test, expect } from "@playwright/test";

const VALID = "pal-tok-ac002-demo";
const EXPIRED = "pal-tok-ac001-demo";
const INVALID = "no-such-token";

const ROUTES: Array<{ path: string; heading: RegExp }> = [
  { path: `/analysis/${VALID}`, heading: /Предварительная оценка/ },
  { path: `/analysis/${EXPIRED}`, heading: /Ссылка истекла/ },
  { path: `/analysis/${INVALID}`, heading: /Ссылка не найдена/ },
];

for (const r of ROUTES) {
  test(`public analysis ${r.path} — без горизонтального overflow @ 390px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(r.path);
    await expect(page.getByRole("heading", { level: 1, name: r.heading })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
