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

    expect(screen.getByRole("heading", { name: "Self-hosted ops" })).toBeInTheDocument();
    expect(
      screen.getByRole("note", { name: "Self-hosted ops runtime boundary" }),
    ).toHaveTextContent(/только наш backend/);
    expect(
      screen.getByRole("region", { name: "Self-hosted ops session gate" }),
    ).toHaveTextContent(/Self-hosted сессия не подключена/);
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
    );
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderPage();

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Backend" })).toHaveTextContent("Готов");
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8080/api/v1/ops/status",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer jwt-ops" }),
      }),
    );
    expect(screen.getByRole("region", { name: "Self-hosted dependencies" })).toHaveTextContent("postgres");
    expect(screen.getByRole("region", { name: "Self-hosted observability contract" })).toHaveTextContent(
      "Structured JSON logs",
    );
    expect(screen.getByLabelText("Предпросмотр audit export dry-run")).toHaveTextContent(
      "npm run ops:stage4n:audit-export:dry-run",
    );
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
    );
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    expect(
      screen.getByRole("region", { name: "Self-hosted ops role warning" }),
    ).toHaveTextContent(/Нужна роль system_admin/);
    await waitFor(() => {
      expect(screen.getByRole("alert", { name: "Ошибка self-hosted ops" })).toHaveTextContent(
        /does not have access/,
      );
    });
  });

  it("downloads a safe audit export preview", async () => {
    seedSession();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(OPS_STATUS_BODY)));
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Backend" })).toHaveTextContent("Готов");
    });
    await userEvent.click(screen.getByRole("button", { name: "Скачать preview" }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status", { name: "Статус self-hosted ops" })).toHaveTextContent(
      /Audit export dry-run preview скачан/,
    );
  });
});
