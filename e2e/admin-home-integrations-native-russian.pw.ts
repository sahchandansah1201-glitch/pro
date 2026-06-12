import { test, expect } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const FORBIDDEN_VISIBLE =
  /MVP|DryRun|JSON|MIS|МИС|Demo MIS|demo|Demo|демо|backend|бэкенд|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|raw ID|safeSummary|protectedLink|Telegram Bot API|AI\/XAI|PHI|лиды|лидов|лидам|DRM-\d|device bridge|planned \+ confirmed|CRM,|ERP|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i;

const ROUTES = [
  {
    path: "/admin",
    title: "Операционный центр клиники",
    required: [
      "Учебный режим: показаны только агрегаты",
      "Связь с учётной системой выключена",
      "Готовность подключений",
      "Бот и заявки",
      "служебный код скрыт",
    ],
  },
  {
    path: "/admin/integrations",
    title: "Интеграции",
    required: [
      "Учётная система",
      "Учебная система клиники",
      "Краткое резюме и защищённая ссылка",
    ],
  },
  {
    path: "/admin/integrations/crm/int-005",
    title: "Телеграм",
    required: [
      "Мессенджер",
      "Связь полей",
      "Правила передачи данных",
      "Пробная проверка передачи",
    ],
  },
] as const;

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

test.describe("UX Batch 17 · admin home and integrations native Russian UI", () => {
  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      test(`${route.path} @ ${viewport.name}`, async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text());
        });

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await setDemoRole(page, "clinic_admin");
        await page.goto(route.path, { waitUntil: "networkidle" });

        await expect(page.getByRole("heading", { name: route.title })).toBeVisible();
        const visible = await page.locator("main").innerText();
        for (const text of route.required) {
          expect(visible, `${route.path}: required visible text "${text}"`).toContain(text);
        }

        expect(visible, `${route.path}: visible forbidden technical/admin terms`).not.toMatch(
          FORBIDDEN_VISIBLE,
        );
        expect(visible).not.toMatch(/меланома|рак кожи|вероятность меланомы/i);

        const overflow = await page.evaluate(() => {
          const de = document.documentElement;
          const body = document.body;
          return {
            docScroll: de.scrollWidth,
            docClient: de.clientWidth,
            bodyScroll: body.scrollWidth,
            bodyClient: body.clientWidth,
          };
        });
        expect(overflow.docScroll).toBeLessThanOrEqual(overflow.docClient + 1);
        expect(overflow.bodyScroll).toBeLessThanOrEqual(overflow.bodyClient + 1);

        if (viewport.name === "mobile-390") {
          const tapIssues = await page.evaluate(() => {
            const root = document.querySelector("main") ?? document.body;
            const nodes = Array.from(
              root.querySelectorAll<HTMLElement>('button, a[href], input:not([type="hidden"]), [role="tab"]'),
            );
            return nodes
              .map((el) => {
                const rect = el.getBoundingClientRect();
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
          expect(tapIssues, JSON.stringify(tapIssues, null, 2)).toEqual([]);
        }

        await page.screenshot({
          path: `test-results/ux-batch-17${route.path.replace(/\//g, "-")}-${viewport.name}.png`,
          fullPage: true,
        });

        const appErrors = consoleErrors.filter(
          (text) => !/postMessage|cross-origin|ResizeObserver/i.test(text),
        );
        expect(appErrors).toEqual([]);
      });
    }
  }
});
