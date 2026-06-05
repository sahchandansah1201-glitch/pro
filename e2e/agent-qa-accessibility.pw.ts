import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { setDemoRole, type DemoRole } from "./helpers/demo-role";

const PAGES: Array<{ route: string; role: DemoRole; name: string }> = [
  { route: "/cockpit", role: "doctor", name: "doctor workplace" },
  { route: "/patients/p-004/visits/v-005?tab=report", role: "doctor", name: "visit report workspace" },
  { route: "/patients/p-004/lesions/l-008", role: "doctor", name: "lesion comparison" },
  { route: "/admin/governance", role: "clinic_admin", name: "admin governance" },
];

test.describe("Agent-QA accessibility smoke", () => {
  for (const pageSpec of PAGES) {
    test(`${pageSpec.name} has no serious/critical automated a11y violations`, async ({ page }) => {
      await setDemoRole(page, pageSpec.role);
      await page.goto(pageSpec.route, { waitUntil: "networkidle" });
      expect(page.url()).not.toMatch(/\/login(?:\?|$)/);
      await expect(page.locator("body")).toBeVisible();

      const results = await new AxeBuilder({ page })
        .disableRules(["color-contrast"])
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      const blockingViolations = results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      );

      expect(
        blockingViolations,
        `${pageSpec.route} serious/critical a11y violations: ${JSON.stringify(blockingViolations, null, 2)}`,
      ).toEqual([]);
    });
  }
});
