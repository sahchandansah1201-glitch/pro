// Stage 4F · End-to-end self-hosted login → patients flow with mocked /api/v1.
// Не использует managed runtime: все сетевые вызовы перехвачены page.route().

import { expect, test, type Page, type Route } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const BASE_URL = "http://localhost:8080";
const TOKEN = "stage4f-mock-token";
const PATIENT_ID = "11111111-1111-4111-8111-111111111111";

interface MockPatient {
  id: string;
  code: string;
  fullName: string;
  birthDate: string;
  sex: "female" | "male";
  phototype: "I" | "II" | "III" | "IV" | "V" | "VI";
  imagingConsent: boolean;
  clinic?: { id: string; slug: string; name: string };
}

function buildLoginResponse() {
  return {
    stage: "4D",
    tokenType: "Bearer",
    accessToken: TOKEN,
    expiresInSeconds: 3600,
    user: {
      id: "u-1",
      displayName: "Демо Доктор",
      roles: [{ role: "doctor", clinicId: "c-1", clinicSlug: "demo" }],
    },
    correlationId: "stage4f-cid",
  };
}

async function installMockBackend(page: Page) {
  const state: { patients: MockPatient[] } = { patients: [] };

  function patientFromRequest(body: Record<string, unknown>): MockPatient {
    return {
      id: PATIENT_ID,
      code: "DP-LIVE-001",
      fullName: String(body.fullName ?? "Без имени"),
      birthDate: typeof body.birthDate === "string" ? body.birthDate : "1990-01-01",
      sex: body.sex === "male" ? "male" : "female",
      phototype:
        body.phototype === "I" ||
        body.phototype === "II" ||
        body.phototype === "III" ||
        body.phototype === "IV" ||
        body.phototype === "V" ||
        body.phototype === "VI"
          ? body.phototype
          : "II",
      imagingConsent: Boolean(body.imagingConsent),
      clinic: { id: "c-1", slug: "demo", name: "Demo Clinic" },
    };
  }

  await page.route(`${BASE_URL}/api/v1/**`, async (route: Route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    const path = url.pathname;
    const body = (() => {
      try {
        return JSON.parse(route.request().postData() || "{}") as Record<string, unknown>;
      } catch {
        return {} as Record<string, unknown>;
      }
    })();

    if (path === "/api/v1/auth/login" && method === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(buildLoginResponse()),
      });
      return;
    }

    if (path === "/api/v1/patients" && method === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stage: "4D",
          source: "postgres",
          items: state.patients,
          count: state.patients.length,
        }),
      });
      return;
    }

    if (path === "/api/v1/patients" && method === "POST") {
      const created = patientFromRequest(body);
      state.patients = [created, ...state.patients.filter((p) => p.id !== created.id)];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ stage: "4D", item: created }),
      });
      return;
    }

    if (path === `/api/v1/patients/${PATIENT_ID}` && method === "PATCH") {
      const existing = state.patients.find((p) => p.id === PATIENT_ID);
      const updated = {
        ...(existing ?? patientFromRequest({})),
        ...body,
        id: PATIENT_ID,
      } as MockPatient;
      state.patients = state.patients.map((p) => (p.id === PATIENT_ID ? updated : p));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ stage: "4D", item: updated }),
      });
      return;
    }

    if (path === `/api/v1/patients/${PATIENT_ID}` && method === "DELETE") {
      const archived = state.patients.find((p) => p.id === PATIENT_ID);
      state.patients = state.patients.filter((p) => p.id !== PATIENT_ID);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stage: "4D",
          archived: true,
          item: archived ?? { id: PATIENT_ID },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "not_found", message: path } }),
    });
  });
}

test.describe("Stage 4F self-hosted patient flow", () => {
  test.beforeEach(async ({ page }) => {
    await setDemoRole(page, "doctor");
    await installMockBackend(page);
  });

  test("login → list → create → edit → archive against mocked self-hosted backend", async ({ page }) => {
    await page.goto("/self-hosted/login");

    await expect(
      page.getByRole("heading", { name: "Вход в self-hosted backend" }),
    ).toBeVisible();

    await page.getByLabel("Адрес backend").fill(BASE_URL);
    await page.getByLabel("Email").fill("doctor@example.com");
    await page.getByLabel("Пароль").fill("secret");
    await page.getByRole("button", { name: /Войти в self-hosted backend/i }).click();

    await expect(page).toHaveURL(/\/patients$/);
    await expect(
      page.getByRole("note", { name: "Ограничения демо-режима пациентов" }),
    ).toContainText("Self-hosted backend подключён");

    // Create a patient via live backend
    await page.getByRole("button", { name: /Новый пациент/ }).click();
    const createDialog = page.getByRole("dialog");
    await expect(createDialog).toBeVisible();
    await createDialog.getByLabel(/ФИО/i).fill("Петрова Анна Сергеевна");
    await createDialog.getByLabel(/Дата рождения/i).fill("1990-01-02");
    await createDialog.getByRole("button", { name: /Сохранить|Создать/ }).click();

    await expect(page.getByRole("link", { name: "Петрова Анна Сергеевна" })).toBeVisible();
    await expect(page.getByText("Создан через self-hosted backend")).toBeVisible();

    // Edit the patient
    await page
      .getByRole("button", { name: /Редактировать пациента Петрова Анна Сергеевна/ })
      .click();
    const editDialog = page.getByRole("dialog");
    await editDialog.getByLabel(/ФИО/i).fill("Петрова Анна Обновлённая");
    await editDialog.getByRole("button", { name: /Сохранить/ }).click();
    await expect(
      page.getByRole("link", { name: "Петрова Анна Обновлённая" }),
    ).toBeVisible();

    // Archive (soft delete)
    await page
      .getByRole("button", { name: /Удалить пациента Петрова Анна Обновлённая/ })
      .click();
    const archiveDialog = page.getByRole("alertdialog");
    await archiveDialog.getByRole("button", { name: /Удалить|Архивировать/ }).click();
    await expect(
      page.getByRole("link", { name: "Петрова Анна Обновлённая" }),
    ).toHaveCount(0);
    await expect(page.getByText(/архивирован в self-hosted backend/i)).toBeVisible();

    // Logout from self-hosted
    await page.getByRole("button", { name: "Выйти из self-hosted backend" }).click();
    await expect(page).toHaveURL(/\/self-hosted\/login$/);
  });
});
