import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import {
  SELF_HOSTED_API_BASE_URL_KEY,
  SELF_HOSTED_API_TOKEN_KEY,
  SELF_HOSTED_API_USER_KEY,
} from "@/lib/self-hosted-api-session";
import SysSelfHostedOpsPage from "./SysSelfHostedOpsPage";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

const OPS_STATUS_BODY = {
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
  correlationId: "corr-4o",
};

const RUNTIME_CHECKS_BODY = {
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
  correlationId: "corr-4p",
};

const PRODUCT_READINESS_BODY = {
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
  correlationId: "corr-4z",
};

function renderPage() {
  return render(
    <MemoryRouter>
      <SysSelfHostedOpsPage />
    </MemoryRouter>,
  );
}

function seedSession(roles = ["system_admin"]) {
  window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:8080");
  window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt-ops");
  window.localStorage.setItem(
    SELF_HOSTED_API_USER_KEY,
    JSON.stringify({
      id: "u-1",
      displayName: "System Admin",
      roles,
    }),
  );
}

describe("SysSelfHostedOpsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:stage4o"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders a session gate without calling the backend when token is missing", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    expect(screen.getByRole("heading", { name: "Рабочий контур" })).toBeInTheDocument();
    expect(
      screen.getByRole("note", { name: "Граница рабочего контура" }),
    ).toHaveTextContent(/только служебные проверки продукта/);
    expect(
      screen.getByRole("region", { name: "Подключение рабочего контура" }),
    ).toHaveTextContent(/Рабочая сессия не подключена/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads ops status for system_admin and never renders unsafe values", async () => {
    seedSession();
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        ...OPS_STATUS_BODY,
        access_token: "secret",
        patient_full_name: "Ivanova Natalia",
        storage_object_path: "bucket/key",
      }),
    ).mockResolvedValueOnce(jsonResponse({
      ...RUNTIME_CHECKS_BODY,
      access_token: "secret",
      patient_full_name: "Ivanova Natalia",
      storage_object_path: "bucket/key",
    })).mockResolvedValueOnce(jsonResponse({
      ...PRODUCT_READINESS_BODY,
      access_token: "secret",
      patient_full_name: "Ivanova Natalia",
      storage_object_path: "bucket/key",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderPage();

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Система" })).toHaveTextContent("Готов");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/ops/status",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer jwt-ops" }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/ops/runtime-checks",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer jwt-ops" }),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/product/readiness",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer jwt-ops" }),
      }),
    );
    expect(screen.getByRole("region", { name: "Зависимости рабочего контура" })).toHaveTextContent("База данных");
    expect(screen.getByRole("region", { name: "Проверки рабочей среды" })).toHaveTextContent(
      "Связь с базой данных",
    );
    expect(screen.getByRole("region", { name: "Планы операций" })).toHaveTextContent(
      "Служебная команда скрыта с экрана",
    );
    expect(screen.getByRole("region", { name: "Договор наблюдаемости" })).toHaveTextContent(
      "Структурированные журналы",
    );
    expect(screen.getAllByRole("region", { name: "Готовность продукта" })[1]).toHaveTextContent(
      "Служебная команда скрыта",
    );
    expect(screen.getAllByRole("region", { name: "Готовность продукта" })[1]).toHaveTextContent(
      "Управляемая среда",
    );
    expect(screen.getByLabelText("Предпросмотр экспорта аудита")).toHaveTextContent(
      "команда скрыта",
    );
    expect(container.innerHTML).not.toContain("dry-run");
    expect(container.innerHTML).not.toContain("npm run");
    expect(container.innerHTML).not.toContain("secret");
    expect(container.innerHTML).not.toContain("Ivanova Natalia");
    expect(container.innerHTML).not.toContain("bucket/key");
    expect(container.innerHTML).not.toContain("storage_object_path");
    expect(container.innerHTML).not.toContain("access_token");
  });

  it("shows role warning and backend 403 message for non-system-admin session", async () => {
    seedSession(["doctor"]);
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: "forbidden",
            message: "The authenticated user does not have access to this resource.",
          },
          correlationId: "corr-denied",
        },
        { status: 403 },
      ),
    ).mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: "forbidden",
            message: "The authenticated user does not have access to this resource.",
          },
          correlationId: "corr-denied",
        },
        { status: 403 },
      ),
    ).mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: "forbidden",
            message: "The authenticated user does not have access to this resource.",
          },
          correlationId: "corr-denied",
        },
        { status: 403 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    expect(
      screen.getByRole("region", { name: "Недостаточно прав рабочего контура" }),
    ).toHaveTextContent(/Нужна роль системного администратора/);
    await waitFor(() => {
      expect(screen.getByRole("alert", { name: "Ошибка рабочего контура" })).toHaveTextContent(
        /does not have access/,
      );
    });
  });

  it("downloads a safe audit export preview", async () => {
    seedSession();
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse(OPS_STATUS_BODY))
        .mockResolvedValueOnce(jsonResponse(RUNTIME_CHECKS_BODY))
        .mockResolvedValueOnce(jsonResponse(PRODUCT_READINESS_BODY)),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Система" })).toHaveTextContent("Готов");
    });
    await userEvent.click(screen.getByRole("button", { name: "Скачать предпросмотр" }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status", { name: "Статус рабочего контура" })).toHaveTextContent(
      /Предпросмотр экспорта аудита скачан/,
    );
  });

  it("downloads a safe operations dry-run preview", async () => {
    seedSession();
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse(OPS_STATUS_BODY))
        .mockResolvedValueOnce(jsonResponse(RUNTIME_CHECKS_BODY))
        .mockResolvedValueOnce(jsonResponse(PRODUCT_READINESS_BODY)),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Проверки рабочей среды" })).toHaveTextContent(
        "Пакет обновлений",
      );
    });
    await userEvent.click(screen.getByRole("button", { name: "Скачать план" }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status", { name: "Статус рабочего контура" })).toHaveTextContent(
      /Предпросмотр операционного плана скачан/,
    );
  });

  it("downloads a safe product readiness preview", async () => {
    seedSession();
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(jsonResponse(OPS_STATUS_BODY))
        .mockResolvedValueOnce(jsonResponse(RUNTIME_CHECKS_BODY))
        .mockResolvedValueOnce(jsonResponse(PRODUCT_READINESS_BODY)),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    renderPage();
    await waitFor(() => {
      expect(screen.getAllByRole("region", { name: "Готовность продукта" })[1]).toHaveTextContent(
        "Проверка состава системы",
      );
    });
    await userEvent.click(screen.getByRole("button", { name: "Скачать готовность" }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status", { name: "Статус рабочего контура" })).toHaveTextContent(
      /Предпросмотр готовности продукта скачан/,
    );
  });
});
