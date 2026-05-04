import { test, expect, Page } from "@playwright/test";

/**
 * E2E-регрессия: при узкой ширине карточки на /operator бейдж статуса
 * защищённой ссылки переносится как ЕДИНЫЙ блок (без разрывов между
 * подписью «Статус:» и пилюлей и без разрывов внутри пилюли —
 * точка и текст всегда на одной визуальной строке).
 *
 * Стратегия проверки:
 *  1) Сужаем правую панель «Защищённая ссылка» через CSS-инъекцию,
 *     чтобы заставить родительский ряд переносить дочерние элементы.
 *  2) Снимаем скриншот всего бейджа (визуальная регрессия).
 *  3) Дополнительно валидируем геометрию getBoundingClientRect():
 *     - высота бейджа ≤ ~1.6× высоты строки текста (значит, пилюля
 *       НЕ распалась на 2 строки внутри);
 *     - точка и текст имеют пересекающиеся вертикальные диапазоны
 *       (на одной визуальной строке).
 */

const BADGE_SELECTOR =
  '[role="status"][aria-label*="Статус защищённой ссылки"]';

async function gotoOperator(page: Page) {
  await page.goto("/operator", { waitUntil: "networkidle" });
  await page.waitForSelector(BADGE_SELECTOR);
}

async function shrinkLinkCard(page: Page, widthPx: number) {
  // Узкая «карточка»: ограничиваем ширину предка бейджа без правки исходников.
  await page.addStyleTag({
    content: `
      ${BADGE_SELECTOR} { /* anchor */ }
      :root { --pw-narrow: ${widthPx}px; }
      ${BADGE_SELECTOR} { max-width: var(--pw-narrow); }
      /* Сужаем родительский ряд, чтобы вызвать перенос подписи и пилюли. */
      :is(div):has(> ${BADGE_SELECTOR}) {
        max-width: var(--pw-narrow) !important;
        width: var(--pw-narrow) !important;
      }
    `,
  });
}

test.describe("Operator — protected link status badge wraps as a single block", () => {
  test("узкая ширина: пилюля не разрывается внутри (визуальный + геометрический контракт)", async ({
    page,
  }) => {
    await gotoOperator(page);
    await shrinkLinkCard(page, 160);

    const badge = page.locator(BADGE_SELECTOR).first();
    await expect(badge).toBeVisible();

    // 1) Визуальная регрессия — снимок всего бейджа.
    await expect(badge).toHaveScreenshot("badge-narrow-160.png");

    // 2) Геометрия: бейдж — одна визуальная строка.
    const metrics = await badge.evaluate((el) => {
      const spans = el.querySelectorAll("span");
      const dot = spans[0] as HTMLElement;
      const text = spans[1] as HTMLElement;
      const er = el.getBoundingClientRect();
      const dr = dot.getBoundingClientRect();
      const tr = text.getBoundingClientRect();
      const lineHeight = parseFloat(
        getComputedStyle(text).lineHeight || "0",
      ) || tr.height;
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

    // Бейдж не «вырос» в две строки: высота не превышает ~1.6 строки.
    expect(metrics.badgeHeight).toBeLessThanOrEqual(
      Math.max(metrics.lineHeight, metrics.textHeight) * 1.6,
    );

    // Вертикальные диапазоны точки и текста пересекаются — общая строка.
    const overlap =
      Math.min(metrics.dotBottom, metrics.textBottom) -
      Math.max(metrics.dotTop, metrics.textTop);
    expect(overlap).toBeGreaterThan(0);
  });

  test("очень узкая ширина (120px): бейдж по-прежнему однострочный", async ({
    page,
  }) => {
    await gotoOperator(page);
    await shrinkLinkCard(page, 120);

    const badge = page.locator(BADGE_SELECTOR).first();
    await expect(badge).toBeVisible();
    await expect(badge).toHaveScreenshot("badge-narrow-120.png");

    const ok = await badge.evaluate((el) => {
      const spans = el.querySelectorAll("span");
      const dr = (spans[0] as HTMLElement).getBoundingClientRect();
      const tr = (spans[1] as HTMLElement).getBoundingClientRect();
      // Точка и текст пересекаются вертикально (одна строка).
      return Math.min(dr.bottom, tr.bottom) - Math.max(dr.top, tr.top) > 0;
    });
    expect(ok).toBe(true);
  });
});
