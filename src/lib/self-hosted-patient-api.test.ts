import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  archiveSelfHostedPatient,
  buildSelfHostedApiUrl,
  createSelfHostedPatient,
  listSelfHostedPatients,
  selfHostedPatientToDomain,
  toSelfHostedPatientDTO,
  updateSelfHostedPatient,
} from "@/lib/self-hosted-patient-api";

const TOKEN = "local-jwt";
const BASE = "http://localhost:8080";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("self-hosted-patient-api", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds same-origin and explicit self-hosted URLs", () => {
    expect(buildSelfHostedApiUrl("", "/api/v1/patients")).toBe("/api/v1/patients");
    expect(buildSelfHostedApiUrl("http://localhost:8080/", "api/v1/patients")).toBe(
      "http://localhost:8080/api/v1/patients",
    );
  });

  it("maps backend patient DTOs into the frontend patient shape", () => {
    const dto = toSelfHostedPatientDTO({
      id: "p-1",
      code: "DP-1",
      fullName: "Иванова Наталья",
      birthDate: "1984-03-12T00:00:00.000Z",
      sex: "female",
      phototype: "II",
      imagingConsent: true,
      clinic: { id: "c-1", slug: "demo", name: "Demo" },
      storage_object_path: "must-not-leak",
      access_token: "must-not-leak",
    });

    expect(dto).toEqual({
      id: "p-1",
      code: "DP-1",
      fullName: "Иванова Наталья",
      birthDate: "1984-03-12",
      sex: "female",
      phototype: "II",
      imagingConsent: true,
      notes: null,
      clinic: { id: "c-1", slug: "demo", name: "Demo" },
      createdAt: null,
      updatedAt: null,
      deletedAt: null,
    });
    expect(JSON.stringify(dto)).not.toMatch(/storage|access_token/i);
    expect(selfHostedPatientToDomain(dto).consents.imaging).toBe(true);
  });

  it("returns not_configured without a token and does not call the network", async () => {
    const result = await listSelfHostedPatients({ apiBaseUrl: BASE, apiToken: null });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("not_configured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists patients with bearer auth and strict DTO mapping", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [
          {
            id: "p-1",
            code: "DP-1",
            fullName: "Иванова Наталья",
            birthDate: "1984-03-12",
            sex: "female",
            phototype: "II",
            imagingConsent: true,
            rawSecret: "hidden",
          },
        ],
      }),
    );

    const result = await listSelfHostedPatients({
      apiBaseUrl: BASE,
      apiToken: TOKEN,
      search: "Иванова",
    });

    expect(result.ok).toBe(true);
    expect(result.value?.[0].fullName).toBe("Иванова Наталья");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/api/v1/patients?limit=200&offset=0&search=%D0%98%D0%B2%D0%B0%D0%BD%D0%BE%D0%B2%D0%B0");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer local-jwt");
    expect(JSON.stringify(result.value)).not.toMatch(/rawSecret/);
  });

  it("creates, updates, and archives patients through Stage 4D routes", async () => {
    const item = {
      id: "11111111-1111-4111-8111-111111111111",
      code: "DP-live",
      fullName: "Петрова Анна",
      birthDate: "1990-01-02",
      sex: "female",
      phototype: "III",
      imagingConsent: false,
    };
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ item }, { status: 201 }))
      .mockResolvedValueOnce(jsonResponse({ item: { ...item, fullName: "Петрова Анна Новая" } }))
      .mockResolvedValueOnce(jsonResponse({ archived: true, item }));

    const created = await createSelfHostedPatient({
      apiBaseUrl: BASE,
      apiToken: TOKEN,
      payload: { fullName: item.fullName, birthDate: item.birthDate, sex: "female" },
    });
    const updated = await updateSelfHostedPatient({
      apiBaseUrl: BASE,
      apiToken: TOKEN,
      patientId: item.id,
      payload: { fullName: "Петрова Анна Новая" },
    });
    const archived = await archiveSelfHostedPatient({
      apiBaseUrl: BASE,
      apiToken: TOKEN,
      patientId: item.id,
    });

    expect(created.value?.code).toBe("DP-live");
    expect(updated.value?.fullName).toBe("Петрова Анна Новая");
    expect(archived.value?.id).toBe(item.id);
    expect(fetchMock.mock.calls.map((call) => [String(call[0]), (call[1] as RequestInit).method])).toEqual([
      ["http://localhost:8080/api/v1/patients", "POST"],
      [`http://localhost:8080/api/v1/patients/${item.id}`, "PATCH"],
      [`http://localhost:8080/api/v1/patients/${item.id}`, "DELETE"],
    ]);
  });

  it("maps validation errors without leaking raw response internals", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          error: {
            code: "validation_error",
            message: "Patient payload failed validation.",
            details: [{ field: "fullName", message: "Full name is required." }],
          },
          correlationId: "cid-1",
          rawToken: "must-not-leak",
        },
        { status: 422 },
      ),
    );

    const result = await createSelfHostedPatient({
      apiBaseUrl: BASE,
      apiToken: TOKEN,
      payload: { fullName: "" },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      kind: "validation",
      code: "validation_error",
      correlationId: "cid-1",
    });
    expect(JSON.stringify(result.error)).not.toMatch(/rawToken/);
  });
});
