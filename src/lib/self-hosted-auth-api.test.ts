import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchSelfHostedMe,
  loginToSelfHostedBackend,
} from "@/lib/self-hosted-auth-api";

const BASE = "http://localhost:8080";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("self-hosted-auth-api", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects empty credentials without a network call", async () => {
    const result = await loginToSelfHostedBackend({
      apiBaseUrl: BASE,
      email: "",
      password: "",
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("credentials_required");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid base URL without a network call", async () => {
    const result = await loginToSelfHostedBackend({
      apiBaseUrl: "ftp://wrong",
      email: "doctor@example.com",
      password: "secret",
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("base_url_invalid");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs in via /api/v1/auth/login and returns a normalized session user", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        stage: "4D",
        tokenType: "Bearer",
        accessToken: "jwt-token",
        expiresInSeconds: 1800,
        user: {
          id: "u-1",
          displayName: "Демо Доктор",
          roles: [
            { role: "doctor", clinicId: "c-1", clinicName: "Клиника 1", clinicSlug: "demo" },
            { role: "doctor", clinicId: "c-2", clinicName: "Клиника 2", clinicSlug: "demo-2" },
          ],
        },
        correlationId: "cid-1",
      }),
    );

    const result = await loginToSelfHostedBackend({
      apiBaseUrl: BASE,
      email: " doctor@example.com ",
      password: "secret",
    });

    expect(result.ok).toBe(true);
    expect(result.value?.accessToken).toBe("jwt-token");
    expect(result.value?.tokenType).toBe("Bearer");
    expect(result.value?.expiresInSeconds).toBe(1800);
    expect(result.value?.user).toEqual({
      id: "u-1",
      displayName: "Демо Доктор",
      roles: ["doctor"],
      roleBindings: [
        { role: "doctor", clinicId: "c-1", clinicName: "Клиника 1", clinicSlug: "demo" },
        { role: "doctor", clinicId: "c-2", clinicName: "Клиника 2", clinicSlug: "demo-2" },
      ],
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/api/v1/auth/login");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      email: "doctor@example.com",
      password: "secret",
    });
  });

  it("maps invalid_credentials errors", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: { code: "invalid_credentials", message: "Invalid credentials." },
          correlationId: "cid-2",
        },
        { status: 401 },
      ),
    );

    const result = await loginToSelfHostedBackend({
      apiBaseUrl: BASE,
      email: "doctor@example.com",
      password: "wrong",
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("invalid_credentials");
    expect(result.error?.status).toBe(401);
    expect(result.error?.correlationId).toBe("cid-2");
  });

  it("fetches /api/v1/auth/me with bearer auth", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        stage: "4D",
        user: {
          id: "u-1",
          displayName: "Демо Доктор",
          roles: [{ role: "doctor", clinicId: "c-1", clinicName: "Клиника 1", clinicSlug: "demo" }],
        },
      }),
    );

    const result = await fetchSelfHostedMe({ apiBaseUrl: BASE, apiToken: "jwt-token" });
    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      id: "u-1",
      displayName: "Демо Доктор",
      roles: ["doctor"],
      roleBindings: [{ role: "doctor", clinicId: "c-1", clinicName: "Клиника 1", clinicSlug: "demo" }],
    });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-token");
  });

  it("returns not_configured for /me when no token", async () => {
    const result = await fetchSelfHostedMe({ apiBaseUrl: BASE, apiToken: null });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
