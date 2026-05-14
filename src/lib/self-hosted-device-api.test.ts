import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listSelfHostedDeviceBridges,
  listSelfHostedDevices,
  toSelfHostedDeviceBridgeDTO,
  toSelfHostedDeviceDTO,
} from "./self-hosted-device-api";

describe("self-hosted-device-api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes bridge and device DTOs without exposing unsafe fields", () => {
    const bridge = toSelfHostedDeviceBridgeDTO({
      id: "br-1",
      bridgeCode: "br-msk-01",
      hostName: "bridge-host",
      lanStatus: "online",
      version: "1.0.0",
      pairedCount: 2,
      lastHeartbeatAt: "2026-05-14T08:00:00Z",
      metadata_json: { secret: true },
    });
    const device = toSelfHostedDeviceDTO({
      id: "d-1",
      model: "DermLite DL5",
      serial: "DL5-AX-1042",
      firmware: "2.4.1",
      magnification: "x10",
      polarization: "polarized",
      calibrationProfile: "DL5-std-A",
      calibrationDueAt: "2026-05-20",
      status: "connected",
      lastSeenAt: "2026-05-14T08:00:00Z",
      bridgeId: "br-1",
      bridge: { code: "br-msk-01", hostName: "bridge-host", lanStatus: "online" },
      object_key: "hidden",
      storage_object_path: "hidden",
    });

    expect(bridge?.bridgeCode).toBe("br-msk-01");
    expect(device?.serial).toBe("DL5-AX-1042");
    expect(JSON.stringify({ bridge, device })).not.toContain("metadata_json");
    expect(JSON.stringify({ bridge, device })).not.toContain("storage_object_path");
  });

  it("returns not_configured before network calls when token is missing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await listSelfHostedDevices({
      apiBaseUrl: "http://localhost:8080",
      apiToken: null,
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("not_configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls backend endpoints with bearer auth and query filters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/v1/device-bridges")) {
        return new Response(
          JSON.stringify({
            items: [{ id: "br-1", bridgeCode: "br-msk-01", hostName: "host", lanStatus: "online" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          items: [{ id: "d-1", model: "DermLite", serial: "DL5", status: "connected" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const bridges = await listSelfHostedDeviceBridges({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "jwt",
      bridgeStatus: "online",
    });
    const devices = await listSelfHostedDevices({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "jwt",
      search: "DL5",
      status: "connected",
      needsCalibration: true,
    });

    expect(bridges.value?.[0].bridgeCode).toBe("br-msk-01");
    expect(devices.value?.[0].serial).toBe("DL5");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v1/device-bridges?bridgeStatus=online");
    expect(String(fetchMock.mock.calls[1][0])).toContain("needsCalibration=true");
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer jwt");
  });
});
