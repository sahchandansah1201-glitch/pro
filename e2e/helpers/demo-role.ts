import type { Page } from "@playwright/test";

export const DEMO_ROLE_STORAGE_KEY = "derma-pro:demo-role";

export type DemoRole =
  | "doctor"
  | "clinic_admin"
  | "system_admin"
  | "operator"
  | "patient";

export async function setDemoRole(page: Page, role: DemoRole): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Demo-role persistence is best-effort in browser startup hooks.
      }
    },
    { key: DEMO_ROLE_STORAGE_KEY, value: role },
  );
}
