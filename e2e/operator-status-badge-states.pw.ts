import { test, expect, Page } from "@playwright/test";

/**
 * E2E-регрессия атомарного переноса бейджа статуса защищённой ссылки
 * на /operator — отдельно для состояний «активна» и «истекла».
 *
 * «Атомарный перенос» означает:
 *   - бейдж занимает одну визуальную строку (точка и текст не разъезжаются
 *     по двум строкам внутри пилюли);
 *   - при нехватке ширины родителя бейдж переносится целиком как один
 *     inline-блок, а не разрывается между подписью «Статус:» и пилюлей
 *     произвольным образом.
 *
 * Базовые фикстуры (DEMO_NOW): bd-001 — истекшая ссылка (выбрана по умолчанию),
 * bd-002 — активная ссылка.
 */

const BADGE_SELECTOR =
  '[role="status"][aria-label*="Статус защищённой ссылки"]';

async function gotoOperator(page: Page) {
  await page.goto("/operator", { waitUntil: "networkidle" });
  await page.waitForSelector(BADGE_SELECTOR);
}

async function selectActiveDialog(page: Page) {
  // Кликаем по карточке диалога bd-002 — у неё активная защищённая ссылка.
  await page.getByText("bd-002", { exact: false }).first().click();
  await page.waitForSelector(
    '[role="status"][aria-label*="активна"]',
  );
}

async function shrinkLinkCard(page: Page, widthPx: number) {
  // Сужаем родителя бейджа, чтобы спровоцировать перенос — без правки кода.
  await page.addStyleTag({
    content: `
      :root { --pw-narrow: ${widthPx}px; }
      :is(div):has(> ${BADGE_SELECTOR}) {
        max-width: var(--pw-narrow) !important;
        width: var(--pw-narrow) !important;
      }
    `,
  });
}

interface BadgeMetrics {
  badgeHeight: number;
  lineHeight: number;
  textHeight: number;
  dotTop: number;
  dotBottom: number;
  textTop: number;
  textBottom: number;
}

async function readBadgeMetrics(
  page: Page,
  ariaMatch: RegExp,
): Promise<BadgeMetrics> {
  const badge = page.locator(BADGE_SELECTOR, {
    hasText: ariaMatch.source.includes("активна") ? "активна" : "истекла",
  }).first();
  return await badge.evaluate((el) => {
    const spans = el.querySelectorAll("span");
    const dot = spans[0] as HTMLElement;
    const text = spans[1] as HTMLElement;
    const er = el.getBoundingClientRect();
    const dr = dot.getBoundingClientRect();
    const tr = text.getBoundingClientRect();
    const lineHeight =
      parseFloat(getComputedStyle(text).lineHeight || "0") || tr.height;
    return {
      badgeHeight: er.height,
      textHeight: tr.height,
      lineHeight,
      dotTop: dr.top,
      dotBottom: dr.bottom,
      textTop: tr.top,
      textBottom: tr.bottom,
    };
  });
}

function assertSingleLine(m: BadgeMetrics) {
  expect(m.badgeHeight).toBeLessThanOrEqual(
    Math.max(m.lineHeight, m.textHeight) * 1.6,
  );
  const overlap =
    Math.min(m.dotBottom, m.textBottom) - Math.max(m.dotTop, m.textTop);
  expect(overlap).toBeGreaterThan(0);
}

test.describe("Operator — атомарный перенос бейджа: «истекла»", () => {
  test("истекла @ 160px: единая визуальная строка + визуальный снимок", async ({
    page,
  }) => {
    await gotoOperator(page);
    await shrinkLinkCard(page, 160);
    const badge = page
      .locator(BADGE_SELECTOR, { hasText: "истекла" })
      .first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveScreenshot("badge-expired-narrow-160.png");
    assertSingleLine(await readBadgeMetrics(page, /истекла/));
  });

  test("истекла @ 120px: пилюля по-прежнему однострочна", async ({ page }) => {
    await gotoOperator(page);
    await shrinkLinkCard(page, 120);
    const badge = page
      .locator(BADGE_SELECTOR, { hasText: "истекла" })
      .first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveScreenshot("badge-expired-narrow-120.png");
    assertSingleLine(await readBadgeMetrics(page, /истекла/));
  });
});

test.describe("Operator — атомарный перенос бейджа: «активна»", () => {
  test("активна @ 160px: единая визуальная строка + визуальный снимок", async ({
    page,
  }) => {
    await gotoOperator(page);
    await selectActiveDialog(page);
    await shrinkLinkCard(page, 160);
    const badge = page
      .locator(BADGE_SELECTOR, { hasText: "активна" })
      .first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveScreenshot("badge-active-narrow-160.png");
    assertSingleLine(await readBadgeMetrics(page, /активна/));
  });

  test("активна @ 120px: пилюля по-прежнему однострочна", async ({ page }) => {
    await gotoOperator(page);
    await selectActiveDialog(page);
    await shrinkLinkCard(page, 120);
    const badge = page
      .locator(BADGE_SELECTOR, { hasText: "активна" })
      .first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveScreenshot("badge-active-narrow-120.png");
    assertSingleLine(await readBadgeMetrics(page, /активна/));
  });
});
