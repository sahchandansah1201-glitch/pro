import { test, expect } from "@playwright/test";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

async function setDemoRole(page: import("@playwright/test").Page, role: string) {
  await page.addInitScript((r) => {
    try {
      localStorage.setItem("derma-pro:demo-role", r);
    } catch {
      // ignore
    }
  }, role);
}

test.describe("/sys/access-events", () => {
  test("system_admin can view and export safe access events", async ({ page }) => {
    await setDemoRole(page, "system_admin");
    await page.goto("/sys/access-events", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "События доступа" })).toBeVisible();
    await expect(page.getByText(/public\.access_events_admin/)).toBeVisible();
    await expect(page.getByText("report.share").first()).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(bodyText).not.toContain("Иванова Наталья");
    expect(bodyText).not.toContain("access_token");
    expect(bodyText).not.toContain("storage_object_path");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Экспортировать события доступа в CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("access-events.csv");
    await expect(page.getByText(/CSV экспортирован:/)).toBeVisible();
  });

  test("clinic_admin cannot view access events", async ({ page }) => {
    await setDemoRole(page, "clinic_admin");
    await page.goto("/sys/access-events", { waitUntil: "networkidle" });

    await expect(page.getByText(/Нет доступа в демо-режиме|только роли system_admin/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Экспортировать события доступа в CSV" })).toHaveCount(0);
    await expect(page.getByText("report.share")).toHaveCount(0);
  });
});
