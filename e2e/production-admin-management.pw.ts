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
  await page.goto("/login");
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
    },
    { roles, tokenKey: TOKEN_KEY, userKey: USER_KEY, baseUrlKey: BASE_URL_KEY },
  );
}

test.describe("Production admin management journey", () => {
  for (const viewport of VIEWPORTS) {
    test(`system admin creates clinic, clinic admin, doctor, and analytics @ ${viewport.name}`, async ({ page }, testInfo) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));

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
      const users: any[] = [
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
      const doctors: any[] = [];
      const auditEvents: any[] = [];

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
          const item = {
            id: "10000000-0000-4000-8000-000000000401",
            email: body.email,
            displayName: body.displayName,
            active: true,
            disabledAt: null,
            createdAt: "2026-06-22T00:00:00.000Z",
            roles: [{ role: body.role, clinicId: clinic.id, clinicName: clinic.name, clinicSlug: clinic.slug }],
          };
          users.unshift(item);
          auditEvents.unshift({ id: "audit-user", action: "admin.user.create", actorName: "Системный администратор", clinicName: clinic.name, createdAt: item.createdAt });
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

      await page.goto("/admin/clinics", { waitUntil: "networkidle" });
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

      await page.goto("/sys/users", { waitUntil: "networkidle" });
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
      await page.goto("/admin/doctors", { waitUntil: "networkidle" });
      await expect(page.locator("h1", { hasText: "Врачи" })).toBeVisible();
      await expect(page.getByText(/Учебный режим/i)).toHaveCount(0);
      await page.getByLabel("ФИО врача").fill("Дерматолог Тестовый");
      await page.getByLabel("Эл. почта").fill("doctor@example.test");
      await page.getByLabel("Временный пароль").fill("long-password-1");
      await page.getByLabel("Тип врача").selectOption("private_doctor");
      await page.getByLabel("Клиника", { exact: true }).selectOption("10000000-0000-4000-8000-000000000301");
      await page.getByRole("button", { name: "Добавить врача" }).click();
      await expect(page.getByText("Врач добавлен: Дерматолог Тестовый")).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath(`admin-doctors-${viewport.name}.png`), fullPage: true });

      await page.goto("/admin/analytics", { waitUntil: "networkidle" });
      await expect(page.getByRole("heading", { name: "Аналитика" })).toBeVisible();
      await expect(page.getByText("Рабочие агрегаты из базы")).toBeVisible();
      await expect(page.getByText("Создан пользователь").first()).toBeVisible();
      await expect(page.getByText("Назначена роль")).toBeVisible();
      await expect(page.getByText(/admin\.[a-z.]+/i)).toHaveCount(0);
      await expect(page.getByText(/Учебный режим|учебные агрегаты|учебный расчёт/i)).toHaveCount(0);
      await page.screenshot({ path: testInfo.outputPath(`admin-analytics-${viewport.name}.png`), fullPage: true });

      await expectNoHorizontalOverflow(page);
      if (viewport.name.includes("mobile")) await expectMainTapTargets(page);
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  }
});
