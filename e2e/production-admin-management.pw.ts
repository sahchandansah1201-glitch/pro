import { expect, type Page, test } from "@playwright/test";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const TOKEN_KEY = "derma-pro:self-hosted-api-token";
const USER_KEY = "derma-pro:self-hosted-api-user";
const BASE_URL_KEY = "derma-pro:self-hosted-api-base-url";

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

interface MockAdminUser {
  id: string;
  email: string;
  displayName: string;
  active: boolean;
  disabledAt: string | null;
  createdAt: string;
  roles: Array<{
    role: string;
    clinicId: string | null;
    clinicName: string | null;
    clinicSlug: string | null;
  }>;
}

interface MockAuditEvent {
  id: string;
  action: string;
  actorName: string;
  clinicName: string;
  createdAt: string;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollWidth,
    docClient: document.documentElement.clientWidth,
    bodyScroll: document.body.scrollWidth,
    bodyClient: document.body.clientWidth,
  }));
  expect(overflow.docScroll).toBeLessThanOrEqual(overflow.docClient + 1);
  expect(overflow.bodyScroll).toBeLessThanOrEqual(overflow.bodyClient + 1);
}

async function scrollMainToTop(page: Page) {
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0 }));
  await page.locator("main").first().evaluate((element) => element.scrollTo({ top: 0, left: 0 }));
}

async function expectMainTapTargets(page: Page) {
  const offenders = await page.evaluate(() => {
    const root = document.querySelector("main") ?? document.body;
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, a[href], input:not([type="hidden"]), textarea, select, [role="button"], [role="tab"]',
      ),
    )
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
  expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
}

async function setApiUser(page: Page, roles: string[]) {
  if (page.url() === "about:blank") await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ roles, tokenKey, userKey, baseUrlKey }) => {
      window.localStorage.setItem(tokenKey, "test-token");
      window.localStorage.setItem(baseUrlKey, window.location.origin);
      window.localStorage.setItem(
        userKey,
        JSON.stringify({
          id: "10000000-0000-4000-8000-000000000101",
          displayName: roles.includes("system_admin") ? "Системный администратор" : "Администратор клиники",
          roles,
        }),
      );
      window.dispatchEvent(new Event("derma-pro:self-hosted-api-session"));
    },
    { roles, tokenKey: TOKEN_KEY, userKey: USER_KEY, baseUrlKey: BASE_URL_KEY },
  );
}

async function navigateInApp(page: Page, path: string) {
  await page.evaluate((nextPath) => {
    window.history.pushState({}, "", nextPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

test.describe("Production admin management journey", () => {
  test.describe.configure({ timeout: 90_000 });

  for (const viewport of VIEWPORTS) {
    test(`system admin creates clinic, clinic admin, doctor, and analytics @ ${viewport.name}`, async ({ page }, testInfo) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const requestFailures: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("requestfailed", (request) => {
        requestFailures.push(`${request.failure()?.errorText ?? "request failed"} ${request.url()}`);
      });

      await page.route("https://fonts.googleapis.com/**", async (route) => {
        await route.fulfill({ status: 200, contentType: "text/css", body: "" });
      });

      const clinics = [
        {
          id: "10000000-0000-4000-8000-000000000001",
          name: "Dermatolog Pro",
          address: "Москва",
          slug: "primary-clinic",
          timezone: "Europe/Moscow",
          usersCount: 1,
          patientsCount: 0,
          visitsCount: 0,
          createdAt: "2026-06-22T00:00:00.000Z",
        },
      ];
      const users: MockAdminUser[] = [
        {
          id: "10000000-0000-4000-8000-000000000101",
          email: "admin@skindoktor.ru",
          displayName: "Администратор Dermatolog Pro",
          active: true,
          disabledAt: null,
          createdAt: "2026-06-22T00:00:00.000Z",
          roles: [{ role: "system_admin", clinicId: null, clinicName: null, clinicSlug: null }],
        },
      ];
      const doctors: MockAdminUser[] = [];
      const auditEvents: MockAuditEvent[] = [];

      await page.route("**/api/v1/admin/clinics", async (route) => {
        if (route.request().method() === "POST") {
          const body = route.request().postDataJSON() as { name: string; address?: string; timezone?: string };
          const item = {
            id: "10000000-0000-4000-8000-000000000301",
            name: body.name,
            address: body.address || "Краснодар",
            slug: "clinic-test",
            timezone: body.timezone || "Europe/Moscow",
            usersCount: 0,
            patientsCount: 0,
            visitsCount: 0,
            createdAt: "2026-06-22T00:00:00.000Z",
          };
          clinics.unshift(item);
          auditEvents.unshift({ id: "audit-clinic", action: "admin.clinic.create", actorName: "Системный администратор", clinicName: item.name, createdAt: item.createdAt });
          await route.fulfill({ json: { item, source: "postgres" }, status: 201 });
          return;
        }
        await route.fulfill({ json: { items: clinics, source: "postgres" } });
      });

      await page.route("**/api/v1/admin/clinics/*", async (route) => {
        if (route.request().method() === "PATCH") {
          const body = route.request().postDataJSON() as { name?: string; address?: string; timezone?: string };
          const clinicId = decodeURIComponent(route.request().url().split("/").pop() ?? "");
          const clinic = clinics.find((item) => item.id === clinicId);
          if (clinic) {
            clinic.name = body.name || clinic.name;
            clinic.address = body.address || clinic.address;
            clinic.timezone = body.timezone || clinic.timezone;
            auditEvents.unshift({
              id: "audit-clinic-update",
              action: "admin.clinic.update",
              actorName: "Системный администратор",
              clinicName: clinic.name,
              createdAt: "2026-06-22T00:00:00.000Z",
            });
          }
          await route.fulfill({ json: { item: clinic, source: "postgres" } });
          return;
        }
        await route.fallback();
      });

      await page.route("**/api/v1/admin/users**", async (route) => {
        if (route.request().url().includes("/disable")) {
          await route.fulfill({ json: { item: { active: false }, source: "postgres" } });
          return;
        }
        if (route.request().url().includes("/role")) {
          const body = route.request().postDataJSON() as { role: string; clinicId?: string | null };
          const userId = route.request().url().match(/\/admin\/users\/([^/]+)\/role/)?.[1];
          const user = users.find((item) => item.id === decodeURIComponent(userId ?? ""));
          const clinic = clinics.find((item) => item.id === body.clinicId) ?? clinics[0];
          if (user) {
            user.roles.unshift({ role: body.role, clinicId: body.clinicId ?? null, clinicName: clinic.name, clinicSlug: clinic.slug });
            auditEvents.unshift({ id: "audit-role", action: "admin.user.role.assign", actorName: "Системный администратор", clinicName: clinic.name, createdAt: "2026-06-22T00:00:00.000Z" });
          }
          await route.fulfill({ json: { item: user, source: "postgres" } });
          return;
        }
        if (route.request().method() === "POST") {
          const body = route.request().postDataJSON() as { displayName: string; email: string; role: string; clinicId?: string };
          const clinic = clinics.find((item) => item.id === body.clinicId) ?? clinics[0];
          const userSequence = 400 + users.length;
          const item = {
            id: `10000000-0000-4000-8000-${String(userSequence).padStart(12, "0")}`,
            email: body.email,
            displayName: body.displayName,
            active: true,
            disabledAt: null,
            createdAt: "2026-06-22T00:00:00.000Z",
            roles: [{ role: body.role, clinicId: clinic.id, clinicName: clinic.name, clinicSlug: clinic.slug }],
          };
          users.unshift(item);
          auditEvents.unshift({ id: `audit-user-${userSequence}`, action: "admin.user.create", actorName: "Системный администратор", clinicName: clinic.name, createdAt: item.createdAt });
          await route.fulfill({ json: { item, source: "postgres" }, status: 201 });
          return;
        }
        await route.fulfill({ json: { items: users, source: "postgres" } });
      });

      await page.route("**/api/v1/admin/doctors**", async (route) => {
        if (route.request().method() === "POST") {
          const body = route.request().postDataJSON() as { displayName: string; email: string; role: string; clinicId: string };
          const clinic = clinics.find((item) => item.id === body.clinicId) ?? clinics[0];
          const item = {
            id: "10000000-0000-4000-8000-000000000501",
            email: body.email,
            displayName: body.displayName,
            active: true,
            disabledAt: null,
            createdAt: "2026-06-22T00:00:00.000Z",
            roles: [{ role: body.role, clinicId: clinic.id, clinicName: clinic.name, clinicSlug: clinic.slug }],
          };
          doctors.unshift(item);
          auditEvents.unshift({ id: "audit-doctor", action: "admin.user.create", actorName: "Администратор клиники", clinicName: clinic.name, createdAt: item.createdAt });
          await route.fulfill({ json: { item, source: "postgres" }, status: 201 });
          return;
        }
        await route.fulfill({ json: { items: doctors, source: "postgres" } });
      });

      await page.route("**/api/v1/admin/analytics", async (route) => {
        await route.fulfill({
          json: {
            item: {
              clinics: clinics.length,
              activeUsers: users.filter((user) => user.active).length + doctors.filter((doctor) => doctor.active).length,
              doctors: doctors.length,
              patients: 0,
              visits: 0,
              photos: 0,
              signedReports: 0,
              auditEvents7d: auditEvents.length,
              recentAuditEvents: auditEvents,
            },
            source: "postgres",
          },
        });
      });

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setApiUser(page, ["system_admin"]);

      await navigateInApp(page, "/admin/clinics");
      await expect(page.getByRole("heading", { name: "Клиники и кабинеты" })).toBeVisible();
      await expect(page.getByText(/сначала создайте клинику или частный кабинет/i)).toBeVisible();
      await expect(page.getByText(/Учебный режим/i)).toHaveCount(0);
      await page.getByLabel("Название клиники").fill("Клиника тестового запуска");
      await page.getByLabel("Адрес клиники").fill("Краснодар, 70-я октября");
      await page.getByRole("button", { name: "Создать клинику" }).click();
      await expect(page.getByText("Клиника сохранена и добавлена в список: Клиника тестового запуска")).toBeVisible();
      await expect(page.getByText("адрес: Краснодар, 70-я октября")).toBeVisible();
      await page.getByRole("button", { name: "Редактировать" }).first().click();
      await page.getByLabel("Адрес редактируемой клиники").fill("Краснодар, ул. Северная, 11");
      await page.getByRole("button", { name: "Сохранить изменения" }).click();
      await expect(page.getByText("Изменения сохранены: Клиника тестового запуска")).toBeVisible();
      await expect(page.getByText("адрес: Краснодар, ул. Северная, 11")).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`admin-clinics-${viewport.name}.png`), fullPage: true });

      await navigateInApp(page, "/sys/users");
      await expect(page.getByRole("heading", { name: "Сотрудники и доступ" })).toBeVisible();
      await expect(page.getByText(/Учебный режим/i)).toHaveCount(0);
      await page.getByLabel("ФИО сотрудника").fill("Администратор Тестовой Клиники");
      await page.getByLabel("Эл. почта").fill("clinic-admin@example.test");
      await page.getByLabel("Временный пароль").fill("long-password-1");
      await page.getByLabel("Роль", { exact: true }).selectOption("clinic_admin");
      await page.getByLabel("Клиника", { exact: true }).selectOption("10000000-0000-4000-8000-000000000301");
      await page.getByRole("button", { name: "Создать сотрудника" }).click();
      await expect(page.getByText("Учётная запись создана: Администратор Тестовой Клиники")).toBeVisible();
      await page.getByLabel("Учётная запись").selectOption("10000000-0000-4000-8000-000000000401");
      await page.getByLabel("Новая роль").selectOption("operator");
      await page.getByLabel("Клиника для роли").selectOption("10000000-0000-4000-8000-000000000301");
      await page.getByRole("button", { name: "Добавить роль" }).click();
      await expect(page.getByText("Роль назначена: Администратор Тестовой Клиники")).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`sys-users-${viewport.name}.png`), fullPage: true });

      await setApiUser(page, ["clinic_admin"]);
      await navigateInApp(page, "/admin/doctors");
      await expect(page.locator("h1", { hasText: "Врачи и ассистенты" })).toBeVisible();
      await expect(page.getByText(/Учебный режим/i)).toHaveCount(0);
      await expect(page.getByRole("tablist", { name: "Разделы сотрудников" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Врачи" })).toHaveAttribute("aria-selected", "true");
      await page.getByRole("button", { name: "Добавить врача" }).click();
      const doctorRegion = page.getByRole("region", { name: "Добавить врача" });
      await doctorRegion.getByLabel("ФИО врача").fill("Дерматолог Тестовый");
      await doctorRegion.getByLabel("Эл. почта", { exact: true }).fill("doctor@example.test");
      const doctorPasswordInput = doctorRegion.getByLabel("Временный пароль", { exact: true });
      await doctorPasswordInput.fill("long-password-1");
      await page.getByRole("button", { name: "Показать временный пароль врача" }).click();
      await expect(doctorPasswordInput).toHaveAttribute("type", "text");
      await expect(doctorPasswordInput).toHaveValue("long-password-1");
      await page.getByRole("button", { name: "Скрыть временный пароль врача" }).click();
      await expect(doctorPasswordInput).toHaveAttribute("type", "password");
      await doctorRegion.getByRole("combobox", { name: "Тип врача" }).selectOption("private_doctor");
      await doctorRegion.getByRole("combobox", { name: "Клиника" }).selectOption("10000000-0000-4000-8000-000000000301");
      await doctorRegion.getByRole("button", { name: "Добавить врача" }).click();
      await expect(page.getByText("Врач добавлен: Дерматолог Тестовый")).toBeVisible();
      await scrollMainToTop(page);
      await page.screenshot({ path: testInfo.outputPath(`admin-doctors-doctors-${viewport.name}.png`) });

      await page.getByRole("tab", { name: "Ассистенты" }).click();
      await expect(page.getByRole("heading", { name: "Ассистенты клиники" })).toBeVisible();
      await page.getByRole("button", { name: "Добавить ассистента" }).click();
      const assistantRegion = page.getByRole("region", { name: "Добавить ассистента" });
      await assistantRegion.getByLabel("ФИО ассистента").fill("Ассистент Тестовый");
      await assistantRegion.getByLabel("Эл. почта ассистента").fill("assistant@example.test");
      const assistantPasswordInput = assistantRegion.getByLabel("Временный пароль ассистента", { exact: true });
      await assistantPasswordInput.fill("assistant-password-1");
      await page.getByRole("button", { name: "Показать временный пароль ассистента" }).click();
      await expect(assistantPasswordInput).toHaveAttribute("type", "text");
      await expect(assistantPasswordInput).toHaveValue("assistant-password-1");
      await page.getByRole("button", { name: "Скрыть временный пароль ассистента" }).click();
      await expect(assistantPasswordInput).toHaveAttribute("type", "password");
      await assistantRegion.getByRole("combobox", { name: "Клиника ассистента" }).selectOption("10000000-0000-4000-8000-000000000301");
      await assistantRegion.getByRole("button", { name: "Добавить ассистента" }).click();
      await expect(page.getByText("Ассистент добавлен: Ассистент Тестовый")).toBeVisible();
      await expect(page.getByText("assistant@example.test")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      if (viewport.name.includes("mobile")) await expectMainTapTargets(page);
      await scrollMainToTop(page);
      await page.screenshot({ path: testInfo.outputPath(`admin-doctors-assistants-${viewport.name}.png`) });

      const accessTab = page.getByRole("tab", { name: "Доступ" });
      await accessTab.click();
      await expect(accessTab).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("tab", { name: "Ассистенты" })).toHaveAttribute("aria-selected", "false");
      await expect(page.getByRole("heading", { name: "Управление доступом" })).toBeVisible();
      await expect(page.getByText("Учётная запись и роль — разные уровни доступа.")).toBeVisible();
      await page.getByLabel("Поиск сотрудников").fill("doctor@example.test");
      await expect(page.getByText("doctor@example.test")).toBeVisible();
      await expect(page.getByText("assistant@example.test")).toHaveCount(0);
      await page.getByLabel("Поиск сотрудников").fill("");
      await page.getByRole("combobox", { name: "Фильтр доступа" }).selectOption("active");
      await expect(page.getByText("assistant@example.test")).toBeVisible();
      await expect(page.getByRole("button", { name: "Приостановить роль врача" })).toBeVisible();
      await expectNoHorizontalOverflow(page);
      if (viewport.name.includes("mobile")) await expectMainTapTargets(page);
      await scrollMainToTop(page);
      await page.screenshot({ path: testInfo.outputPath(`admin-doctors-access-${viewport.name}.png`) });

      await navigateInApp(page, "/admin/analytics");
      await expect(page.getByRole("heading", { name: "Аналитика" })).toBeVisible();
      await expect(page.getByText("Рабочие агрегаты из базы")).toBeVisible();
      await expect(page.getByText("Создан пользователь").first()).toBeVisible();
      await expect(page.getByText("Назначена роль")).toBeVisible();
      await expect(page.getByText(/admin\.[a-z.]+/i)).toHaveCount(0);
      await expect(page.getByText(/Учебный режим|учебные агрегаты|учебный расчёт/i)).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`admin-analytics-${viewport.name}.png`), fullPage: true });

      await expectNoHorizontalOverflow(page);
      if (viewport.name.includes("mobile")) await expectMainTapTargets(page);
      expect(consoleErrors, [...consoleErrors, ...requestFailures].join("\n")).toEqual([]);
      expect(requestFailures).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  }
});
