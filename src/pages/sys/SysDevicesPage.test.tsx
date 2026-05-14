import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import SysDevicesPage from "./SysDevicesPage";
import {
  SELF_HOSTED_API_BASE_URL_KEY,
  SELF_HOSTED_API_TOKEN_KEY,
  SELF_HOSTED_API_USER_KEY,
} from "@/lib/self-hosted-api-session";

function renderPage() {
  return render(
    <MemoryRouter>
      <SysDevicesPage />
    </MemoryRouter>,
  );
}

function writeLiveSession() {
  window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:8080");
  window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt-device-test");
  window.localStorage.setItem(
    SELF_HOSTED_API_USER_KEY,
    JSON.stringify({ id: "u-sys", displayName: "System Admin", roles: ["system_admin"] }),
  );
}

describe("SysDevicesPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders demo registry without backend calls when self-hosted session is missing", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    renderPage();

    expect(screen.getByText(/Демо-режим\. Реальные роли, RLS, аудит, ключи и Device Bridge/)).toBeInTheDocument();
    expect(screen.getAllByText("DermLite DL5").length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("loads self-hosted bridge and device registry with bearer token", async () => {
    writeLiveSession();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer jwt-device-test");
      if (url.includes("/api/v1/device-bridges")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "br-uuid",
                bridgeCode: "br-live-01",
                hostName: "live-bridge",
                lanStatus: "online",
                version: "1.2.3",
                pairedCount: 1,
                lastHeartbeatAt: "2026-05-14T08:00:00Z",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          items: [
            {
              id: "dev-uuid",
              model: "LiveScope 20",
              serial: "LS-200",
              firmware: "4.0.0",
              magnification: "x20",
              polarization: "both",
              calibrationProfile: "LS-live",
              calibrationDueAt: "2026-05-10",
              status: "connected",
              lastSeenAt: "2026-05-14T08:01:00Z",
              bridgeId: "br-uuid",
              bridge: { id: "br-uuid", code: "br-live-01", hostName: "live-bridge", lanStatus: "online" },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    renderPage();

    expect(await screen.findByText(/Self-hosted backend подключён/)).toBeInTheDocument();
    expect((await screen.findAllByText("LiveScope 20")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("br-live-01").length).toBeGreaterThan(0);
    expect(screen.getByText("Реестр устройств загружен из backend.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("tab", { name: "Нужна калибровка" }));
    expect(screen.getAllByText("LiveScope 20").length).toBeGreaterThan(0);
  });

  it("shows a safe live error without rendering backend internals", async () => {
    writeLiveSession();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "database_unavailable",
            message: "Database unavailable",
          },
          storage_object_path: "bucket/private",
        }),
        { status: 503, headers: { "content-type": "application/json" } },
      ),
    );

    const { container } = renderPage();

    expect(await screen.findByText("Database unavailable")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("storage_object_path");
    expect(container.innerHTML).not.toContain("bucket/private");
  });
});
