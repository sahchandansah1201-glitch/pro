import { expect, type Page, test } from "@playwright/test";

import { type DemoRole, setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const FORBIDDEN_VISIBLE =
  /\b(MVP|XAI|Demo|demo|mock|backend|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|governance|readiness|self-hosted|Device Bridge|Body Map|Mini App|Telegram|WhatsApp|Lead ID|Lead|handoff|CTA|DryRun|JSON|PHI|raw ID|quality gate)\b|(?:^|[^\p{L}])(?:демо|мок|бэкенд|лид)(?:[^\p{L}]|$)|DP-(?:2026|LIVE)-[A-Z0-9-]+|\b(?:DL5|HD30|FF-HS|DL3|DL)-[A-Z0-9-]+\b|i-0\d{2}|storagePath|signedUrl|accessToken|qrToken|sessionId|credential|doctorVersionText|patientSafeText|safeSummary|protectedLink|автоматическая подсказка|предварительная оценка|план лечения/iu;

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

type RouteSpec = {
  path: string;
  role?: DemoRole;
  heading: string | RegExp;
  screenshot: string;
};

const ROUTES: RouteSpec[] = [
  {
    path: "/login",
    heading: "Вход в Дерматолог Про",
    screenshot: "entry-login",
  },
  {
    path: "/self-hosted/login",
    heading: "Дерматолог Про — рабочий вход",
    screenshot: "entry-clinic-login",
  },
  {
    path: "/help",
    role: "doctor",
    heading: "Справка",
    screenshot: "shared-help",
  },
  {
    path: "/desk",
    role: "doctor",
    heading: "Рабочий стол",
    screenshot: "doctor-desk",
  },
  {
    path: "/visits",
    role: "doctor",
    heading: "Визиты",
    screenshot: "doctor-visits",
  },
  {
    path: "/cockpit",
    role: "doctor",
    heading: "Анамнез и данные",
    screenshot: "doctor-cockpit",
  },
  {
    path: "/capture",
    role: "doctor",
    heading: "Съёмка",
    screenshot: "doctor-capture",
  },
  {
    path: "/reports",
    role: "doctor",
    heading: "Центр отчётов",
    screenshot: "doctor-reports",
  },
  {
    path: "/patients",
    role: "doctor",
    heading: "Пациенты",
    screenshot: "doctor-patients",
  },
  {
    path: "/patients/p-004",
    role: "doctor",
    heading: "Данные пациента",
    screenshot: "doctor-patient-detail",
  },
  {
    path: "/patients/p-004/visits/v-005?tab=report",
    role: "doctor",
    heading: "Новиков Артём Сергеевич",
    screenshot: "doctor-visit-report",
  },
  {
    path: "/patients/p-004/visits/v-005?tab=imaging",
    role: "doctor",
    heading: "Новиков Артём Сергеевич",
    screenshot: "doctor-visit-imaging",
  },
  {
    path: "/patients/p-004/visits/v-005?tab=assessment",
    role: "doctor",
    heading: "Новиков Артём Сергеевич",
    screenshot: "doctor-visit-assessment",
  },
  {
    path: "/patients/p-004/visits/v-005?tab=conclusion",
    role: "doctor",
    heading: "Новиков Артём Сергеевич",
    screenshot: "doctor-visit-conclusion",
  },
  {
    path: "/patients/p-004/visits/v-005?tab=bodymap",
    role: "doctor",
    heading: "Новиков Артём Сергеевич",
    screenshot: "doctor-visit-bodymap",
  },
  {
    path: "/patients/p-004/lesions/l-008",
    role: "doctor",
    heading: "Очаг B",
    screenshot: "doctor-lesion-detail",
  },
  {
    path: "/practice",
    role: "private_doctor",
    heading: "Центр частной практики",
    screenshot: "private-practice",
  },
  {
    path: "/operator",
    role: "operator",
    heading: "Центр обращений оператора",
    screenshot: "operator-console",
  },
  {
    path: "/operator/booking-requests",
    role: "operator",
    heading: "Запросы на запись",
    screenshot: "operator-booking",
  },
  {
    path: "/operator/dialogs/bd-001",
    role: "operator",
    heading: /Обращение 001/,
    screenshot: "operator-dialog",
  },
  {
    path: "/bot-sim",
    role: "patient",
    heading: "Помощник записи",
    screenshot: "patient-bot-sim",
  },
  {
    path: "/bot-sim/miniapp/booking",
    role: "patient",
    heading: "Запись в клинику",
    screenshot: "patient-bot-booking",
  },
  {
    path: "/me",
    role: "patient",
    heading: "Личный кабинет",
    screenshot: "patient-home",
  },
  {
    path: "/me/history",
    role: "patient",
    heading: "История очагов",
    screenshot: "patient-history",
  },
  {
    path: "/me/booking",
    role: "patient",
    heading: "Запись на приём",
    screenshot: "patient-booking",
  },
  {
    path: "/me/reminders",
    role: "patient",
    heading: "Напоминания",
    screenshot: "patient-reminders",
  },
  {
    path: "/me/reports",
    role: "patient",
    heading: "Мои заключения",
    screenshot: "patient-reports",
  },
  {
    path: "/me/reports/r-001",
    role: "patient",
    heading: "Заключение",
    screenshot: "patient-report-detail",
  },
  {
    path: "/analysis/pal-tok-ac002-demo",
    heading: "Предварительная сводка",
    screenshot: "public-analysis-valid",
  },
  {
    path: "/analysis/pal-tok-ac001-demo",
    heading: "Ссылка истекла",
    screenshot: "public-analysis-expired",
  },
  {
    path: "/analysis/no-such-token",
    heading: "Ссылка не найдена",
    screenshot: "public-analysis-missing",
  },
  {
    path: "/admin",
    role: "clinic_admin",
    heading: "Операционный центр",
    screenshot: "admin-home",
  },
  {
    path: "/admin/doctors",
    role: "clinic_admin",
    heading: "Врачи",
    screenshot: "admin-doctors",
  },
  {
    path: "/admin/services",
    role: "clinic_admin",
    heading: "Услуги и тарифы",
    screenshot: "admin-services",
  },
  {
    path: "/admin/clinics",
    role: "clinic_admin",
    heading: "Клиники и филиалы",
    screenshot: "admin-clinics",
  },
  {
    path: "/admin/integrations",
    role: "clinic_admin",
    heading: "Интеграции",
    screenshot: "admin-integrations",
  },
  {
    path: "/admin/integrations/crm/int-005",
    role: "clinic_admin",
    heading: /Телеграм/,
    screenshot: "admin-integration-detail",
  },
  {
    path: "/admin/bot",
    role: "clinic_admin",
    heading: "Центр управления ботом",
    screenshot: "admin-bot",
  },
  {
    path: "/admin/analytics",
    role: "clinic_admin",
    heading: "Аналитика",
    screenshot: "admin-analytics",
  },
  {
    path: "/admin/governance",
    role: "clinic_admin",
    heading: "Управление доступом",
    screenshot: "admin-governance",
  },
  {
    path: "/sys/users",
    role: "system_admin",
    heading: "Пользователи",
    screenshot: "sys-users",
  },
  {
    path: "/sys/devices",
    role: "system_admin",
    heading: "Устройства",
    screenshot: "sys-devices",
  },
  {
    path: "/sys/audit",
    role: "system_admin",
    heading: "Аудит",
    screenshot: "sys-audit",
  },
  {
    path: "/sys/access-events",
    role: "system_admin",
    heading: "События доступа",
    screenshot: "sys-access-events",
  },
  {
    path: "/sys/release-status",
    role: "system_admin",
    heading: "Готовность публикации",
    screenshot: "sys-release-status",
  },
  {
    path: "/sys/self-hosted-ops",
    role: "system_admin",
    heading: "Рабочий контур",
    screenshot: "sys-ops",
  },
  {
    path: "/sys/api-keys",
    role: "system_admin",
    heading: "Служебные ключи",
    screenshot: "sys-api-keys",
  },
  {
    path: "/unknown-screen-for-ux-batch-34",
    heading: "Страница не найдена",
    screenshot: "entry-not-found",
  },
];

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollWidth,
    docClient: document.documentElement.clientWidth,
    bodyScroll: document.body.scrollWidth,
    bodyClient: document.body.clientWidth,
  }));
  expect(overflow.docScroll, `${label}: document overflow`).toBeLessThanOrEqual(
    overflow.docClient + 1,
  );
  expect(overflow.bodyScroll, `${label}: body overflow`).toBeLessThanOrEqual(
    overflow.bodyClient + 1,
  );
}

async function expectNoForbiddenVisibleTerms(page: Page, label: string) {
  const visibleText = await page.locator("body").innerText();
  expect(
    visibleText,
    `${label}: forbidden visible technical wording`,
  ).not.toMatch(FORBIDDEN_VISIBLE);
  expect(visibleText, `${label}: unsafe medical claim`).not.toMatch(
    /вероятность меланомы|финальный диагноз|рак кожи|назначить лечение|назначено лечение|прогноз/i,
  );
}

async function expectMainTapTargets(page: Page, label: string) {
  const offenders = await page.evaluate(() => {
    const root = document.querySelector("main") ?? document.body;
    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, a[href], input:not([type="hidden"]), textarea, select, [role="button"], [role="tab"], [role="checkbox"]',
      ),
    );
    return nodes.flatMap((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return [];
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return [];
      if (
        node instanceof HTMLInputElement &&
        (node.type === "checkbox" || node.type === "radio")
      ) {
        const label = node.closest("label");
        const labelRect = label?.getBoundingClientRect();
        if (labelRect && labelRect.height >= 44 && labelRect.width >= 44) {
          return [];
        }
      }
      if (rect.height >= 44) return [];
      const label =
        node.getAttribute("aria-label") ||
        node.textContent?.replace(/\s+/g, " ").trim() ||
        node.getAttribute("href") ||
        node.tagName;
      return [
        {
          label: label.slice(0, 120),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      ];
    });
  });

  expect(
    offenders,
    `${label}: interactive targets below 44px\n${offenders
      .map((item) => `  - ${item.width}x${item.height}: ${item.label}`)
      .join("\n")}`,
  ).toEqual([]);
}

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.describe("UX Batch 34 — cross-role native Russian route inventory", () => {
  test("all primary client routes are reachable, Russian, and responsive", async ({
    page,
  }) => {
    const errors = collectPageErrors(page);

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      for (const route of ROUTES) {
        if (route.role) await setDemoRole(page, route.role);
        await page.goto(route.path, { waitUntil: "domcontentloaded" });

        if (route.path !== "/login" && route.path !== "/self-hosted/login") {
          expect(
            page.url(),
            `${route.path}: should not redirect to login`,
          ).not.toMatch(/\/login(\?|$)/);
        }
        await expect(page.locator("body")).toContainText(route.heading);
        await expectNoForbiddenVisibleTerms(
          page,
          `${route.path} @ ${viewport.name}`,
        );
        await expectNoHorizontalOverflow(
          page,
          `${route.path} @ ${viewport.name}`,
        );
        if (viewport.width <= 390) {
          await expectMainTapTargets(page, `${route.path} @ ${viewport.name}`);
        }
        await page.evaluate(() => window.scrollTo({ top: 0, left: 0 }));
        await page.waitForTimeout(25);
        await page.screenshot({
          path: `test-results/ux-batch-34-${route.screenshot}-${viewport.name}.png`,
          fullPage: true,
        });
      }
    }

    expect(errors, "application console/page errors").toEqual([]);
  });
});
