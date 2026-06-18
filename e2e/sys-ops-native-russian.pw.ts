import { expect, test, type Page } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

const FORBIDDEN_VISIBLE =
  /self-hosted|backend|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|readiness|governance|Device Bridge|PostgreSQL|dry-run|stage4|raw ID|storagePath|signedUrl|accessToken|qrToken|sessionId|credential|MVP|demo|mock|сервер/i;

const OPS_STATUS = {
  stage: "4N",
  source: "self-hosted",
  ready: true,
  status: "ready",
  dependencies: [
    { name: "postgres", configured: true, connected: true, status: "connected" },
    { name: "jwt-signing-key", configured: true, connected: false, status: "configured" },
    { name: "object-storage", configured: true, connected: false, status: "configured" },
  ],
  observability: {
    structuredJsonLogs: true,
    correlationHeader: "x-correlation-id",
    redaction: "enabled",
    requestPathLogging: "path-only",
  },
  audit: {
    mode: "append-only",
    safeExport: "scripts/stage4n-audit-export.mjs --dry-run",
    exportedFields: ["created_at", "action", "entity_type", "entity_id", "correlation_id"],
  },
  auth: { userId: "u-1", roles: ["system_admin"] },
  generatedAt: "2026-05-14T00:00:00.000Z",
  correlationId: "corr-e2e",
};

const RUNTIME_CHECKS = {
  stage: "4P",
  source: "self-hosted",
  ready: true,
  status: "ready",
  checks: [
    {
      key: "postgres_connectivity",
      label: "PostgreSQL connectivity",
      status: "ready",
      detail: "PostgreSQL connection verified",
      connected: true,
    },
    {
      key: "migration_bundle",
      label: "Migration bundle",
      status: "ready",
      detail: "Self-hosted PostgreSQL migration bundle is present",
      count: 10,
      expectedCount: 10,
      latest: "0010_stage4s_device_bridge_worker_contract.sql",
    },
  ],
  commands: [
    {
      key: "backup_dry_run",
      label: "Backup dry-run",
      command: "npm run ops:stage4l:backup:dry-run",
      description: "Plan backup",
      status: "ready",
      dryRunOnly: true,
    },
    {
      key: "deploy_smoke_dry_run",
      label: "Deploy smoke dry-run",
      command: "npm run smoke:stage4k:dry-run",
      description: "Plan smoke",
      status: "ready",
      dryRunOnly: true,
    },
  ],
  auth: { userId: "u-1", roles: ["system_admin"] },
  generatedAt: "2026-05-14T00:00:00.000Z",
  correlationId: "corr-e2e-runtime",
};

const PRODUCT_READINESS = {
  stage: "4Z",
  source: "self-hosted",
  status: "ready_for_server_deploy",
  productBoundary: {
    deployment: "single self-hosted product",
    frontend: "static React build served by nginx",
    backend: "Node self-hosted API",
    database: "operator-owned PostgreSQL",
    objectStorage: "operator-owned object storage",
    managedRuntime: "none",
    managedDatabase: "none",
    supabaseRuntimeCoupling: false,
    browserHardwareApis: false,
  },
  capabilities: [
    { key: "frontend", label: "React frontend", status: "ready", evidence: ["dist build"] },
    { key: "device_bridge", label: "Device Bridge worker operations", status: "ready", evidence: ["audit export"] },
  ],
  gates: [
    { key: "full_preflight", label: "Full deterministic preflight", command: "npm run preflight:all", required: true },
    { key: "compose_smoke", label: "Self-hosted compose smoke", command: "npm run smoke:stage4k", required: true },
  ],
  openapi: ["/openapi.stage4y.json", "/openapi.stage4z.json"],
  privacy: {
    redaction: "enabled",
    exportedData: "metadata-only operational readiness",
    excluded: ["tokens", "passwords", "patient names", "storage paths"],
  },
  auth: { userId: "u-1", roles: ["system_admin"] },
  generatedAt: "2026-05-14T00:00:00.000Z",
  correlationId: "corr-e2e-product",
};

async function seedSystemSession(page: Page) {
  await setDemoRole(page, "system_admin");
  await page.addInitScript(() => {
    localStorage.setItem("derma-pro:self-hosted-api-base-url", "http://localhost:8080");
    localStorage.setItem("derma-pro:self-hosted-api-token", "jwt-e2e");
    localStorage.setItem(
      "derma-pro:self-hosted-api-user",
      JSON.stringify({ id: "u-1", displayName: "System Admin", roles: ["system_admin"] }),
    );
  });
  await page.route("http://localhost:8080/api/v1/ops/status", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(OPS_STATUS) });
  });
  await page.route("http://localhost:8080/api/v1/ops/runtime-checks", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(RUNTIME_CHECKS) });
  });
  await page.route("http://localhost:8080/api/v1/product/readiness", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(PRODUCT_READINESS) });
  });
}

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollWidth,
    docClient: document.documentElement.clientWidth,
    bodyScroll: document.body.scrollWidth,
    bodyClient: document.body.clientWidth,
  }));
  expect(overflow.docScroll, `${label}: document overflow`).toBeLessThanOrEqual(overflow.docClient + 1);
  expect(overflow.bodyScroll, `${label}: body overflow`).toBeLessThanOrEqual(overflow.bodyClient + 1);
}

async function expectMobileTapTargets(page: Page, label: string) {
  const offenders = await page.evaluate(() => {
    const root = document.querySelector("main") ?? document.body;
    return Array.from(root.querySelectorAll<HTMLElement>('button, a[href], input:not([type="hidden"]), select'))
      .flatMap((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return [];
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") return [];
        if (rect.height >= 44) return [];
        return [`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim()}" ${Math.round(rect.width)}x${Math.round(rect.height)}`];
      });
  });
  expect(offenders, `${label}: targets under 44px`).toEqual([]);
}

test.describe("System operations — native Russian UI", () => {
  for (const viewport of VIEWPORTS) {
    test(`/sys/self-hosted-ops @ ${viewport.name}`, async ({ page }) => {
      const pageErrors = collectPageErrors(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await seedSystemSession(page);
      await page.goto("/sys/self-hosted-ops", { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("heading", { name: "Рабочий контур" })).toBeVisible();
      await expect(page.getByRole("region", { name: "Сводка рабочего контура" })).toContainText("Система");
      await expect(page.getByRole("region", { name: "Зависимости рабочего контура" })).toContainText("База данных");
      await expect(page.getByRole("region", { name: "Проверки рабочей среды" })).toContainText("Связь с базой данных");
      await expect(page.getByRole("region", { name: "Планы операций" })).toContainText("План резервной копии");

      const visible = await page.locator("body").innerText();
      expect(visible, `${viewport.name}: forbidden technical term`).not.toMatch(FORBIDDEN_VISIBLE);
      expect(visible, `${viewport.name}: unsafe medical copy`).not.toMatch(/диагноз|риск|прогноз|лечение|меланома|рак кожи/i);
      await expectNoHorizontalOverflow(page, `/sys/self-hosted-ops @ ${viewport.name}`);
      if (viewport.width < 640) {
        await expectMobileTapTargets(page, `/sys/self-hosted-ops @ ${viewport.name}`);
      }
      expect(pageErrors, `/sys/self-hosted-ops @ ${viewport.name}: console/page errors`).toEqual([]);

      await page.evaluate(() => window.scrollTo({ top: 0, left: 0 }));
      await page.screenshot({
        path: `test-results/ux-batch-29-sys-ops-${viewport.name}.png`,
        fullPage: viewport.width >= 640,
        timeout: 15_000,
      });
    });
  }
});
