// Stage 1E-E · Tests for the clinical assets API adapter.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildApiReadUrl,
  buildApiWriteUrl,
  getAssetDownloadUrl,
  listVisitAssets,
  toSafeAssetDTO,
  toSignedDownloadDTO,
  uploadVisitAsset,
} from "./clinical-assets-api";

const BASE = "https://example.supabase.co";
const TOKEN = "test-token";

describe("clinical-assets-api · URL builders", () => {
  it("builds api-read URL", () => {
    expect(buildApiReadUrl(BASE, "/doctor/visits/v1/assets")).toBe(
      "https://example.supabase.co/functions/v1/api-read/doctor/visits/v1/assets",
    );
  });
  it("builds api-write URL", () => {
    expect(buildApiWriteUrl(BASE, "/doctor/visits/v1/assets/upload")).toBe(
      "https://example.supabase.co/functions/v1/api-write/doctor/visits/v1/assets/upload",
    );
  });
});

describe("clinical-assets-api · DTO mappers strip forbidden fields", () => {
  it("toSafeAssetDTO drops storage path / exif if present", () => {
    const dto = toSafeAssetDTO({
      id: "a1",
      clinicId: "c1",
      visitId: "v1",
      lesionId: null,
      kind: "dermoscopy",
      source: "device_bridge",
      capturedAt: "2026-05-09T10:00:00Z",
      deviceId: null,
      qualityScore: 0.9,
      qualityIssues: [],
      createdAt: "2026-05-09T10:00:01Z",
      // Hostile inputs that must be ignored:
      storageObjectPath: "clinics/x/visits/v1/abc.jpg",
      storage_object_path: "clinics/x/visits/v1/abc.jpg",
      exif: { gps: "x" },
      exifMeta: { gps: "x" },
    });
    const keys = Object.keys(dto).sort();
    expect(keys).toEqual(
      [
        "capturedAt",
        "clinicId",
        "createdAt",
        "deviceId",
        "id",
        "kind",
        "lesionId",
        "qualityIssues",
        "qualityScore",
        "source",
        "visitId",
      ].sort(),
    );
  });

  it("toSignedDownloadDTO returns only the safe key set", () => {
    const dto = toSignedDownloadDTO({
      assetId: "a1",
      clinicId: "c1",
      visitId: "v1",
      downloadUrl: "https://signed.example/x",
      expiresIn: 300,
      expiresAt: "2026-05-09T10:05:00Z",
      // Hostile:
      storageObjectPath: "clinics/x/visits/v1/abc.jpg",
      exif: { gps: "x" },
    });
    expect(Object.keys(dto).sort()).toEqual(
      ["assetId", "clinicId", "downloadUrl", "expiresAt", "expiresIn", "visitId"].sort(),
    );
  });
});

describe("clinical-assets-api · not_configured without token/baseUrl", () => {
  it("listVisitAssets returns not_configured if no token", async () => {
    const r = await listVisitAssets({ token: null, baseUrl: BASE, visitId: "v1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("not_configured");
  });
  it("uploadVisitAsset returns not_configured if no baseUrl", async () => {
    const r = await uploadVisitAsset({
      token: TOKEN,
      baseUrl: null,
      visitId: "v1",
      file: new File(["x"], "x.jpg", { type: "image/jpeg" }),
      kind: "overview",
      source: "file",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("not_configured");
  });
  it("getAssetDownloadUrl returns not_configured if no token", async () => {
    const r = await getAssetDownloadUrl({ token: null, baseUrl: BASE, assetId: "a1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("not_configured");
  });
});

describe("clinical-assets-api · network calls", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("listVisitAssets hits api-read URL with bearer token and strips fields", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: "a1",
            clinicId: "c1",
            visitId: "v1",
            lesionId: null,
            kind: "overview",
            source: "file",
            capturedAt: "2026-05-09T10:00:00Z",
            deviceId: null,
            qualityScore: 0.9,
            qualityIssues: [],
            createdAt: "2026-05-09T10:00:01Z",
            storageObjectPath: "should-not-leak",
            exif: { gps: "x" },
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const r = await listVisitAssets({ token: TOKEN, baseUrl: BASE, visitId: "v1" });
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://example.supabase.co/functions/v1/api-read/doctor/visits/v1/assets",
    );
    expect((init as RequestInit).method).toBe("GET");
    expect(((init as RequestInit).headers as Record<string, string>).Authorization).toBe(
      `Bearer ${TOKEN}`,
    );
    if (r.ok) {
      const json = JSON.stringify(r.value);
      expect(json).not.toMatch(/storageObjectPath/);
      expect(json).not.toMatch(/exif/);
    }
  });

  it("uploadVisitAsset posts FormData to api-write upload URL", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "a1",
          clinicId: "c1",
          visitId: "v1",
          lesionId: null,
          kind: "dermoscopy",
          source: "file",
          capturedAt: "2026-05-09T10:00:00Z",
          deviceId: null,
          qualityScore: 0.9,
          qualityIssues: [],
          createdAt: "2026-05-09T10:00:01Z",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    const r = await uploadVisitAsset({
      token: TOKEN,
      baseUrl: BASE,
      visitId: "v1",
      file: new File(["x"], "x.jpg", { type: "image/jpeg" }),
      kind: "dermoscopy",
      source: "file",
    });
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://example.supabase.co/functions/v1/api-write/doctor/visits/v1/assets/upload",
    );
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBeInstanceOf(FormData);
  });

  it("uploadVisitAsset passes AbortSignal to fetch", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: "a1",
          clinicId: "c1",
          visitId: "v1",
          lesionId: null,
          kind: "overview",
          source: "file",
          capturedAt: "2026-05-09T10:00:00Z",
          deviceId: null,
          qualityScore: 0.9,
          qualityIssues: [],
          createdAt: "2026-05-09T10:00:01Z",
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ),
    );
    const controller = new AbortController();
    await uploadVisitAsset({
      token: TOKEN,
      baseUrl: BASE,
      visitId: "v1",
      file: new File(["x"], "x.jpg", { type: "image/jpeg" }),
      kind: "overview",
      source: "file",
      signal: controller.signal,
    });

    const [, init] = fetchMock.mock.calls[0];
    expect((init as RequestInit).signal).toBe(controller.signal);
  });

  it("getAssetDownloadUrl includes expiresIn query and bearer", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          assetId: "a1",
          clinicId: "c1",
          visitId: "v1",
          downloadUrl: "https://signed.example/x",
          expiresIn: 300,
          expiresAt: "2026-05-09T10:05:00Z",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const r = await getAssetDownloadUrl({
      token: TOKEN,
      baseUrl: BASE,
      assetId: "a1",
      expiresIn: 300,
    });
    expect(r.ok).toBe(true);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://example.supabase.co/functions/v1/api-read/doctor/assets/a1/download-url?expiresIn=300",
    );
  });

  it("maps non-2xx to http error with status", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "forbidden" }), { status: 403 }),
    );
    const r = await listVisitAssets({ token: TOKEN, baseUrl: BASE, visitId: "v1" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("http");
      expect(r.error.status).toBe(403);
    }
  });

  it("maps thrown fetch to network error", async () => {
    fetchMock.mockRejectedValueOnce(new Error("boom"));
    const r = await listVisitAssets({ token: TOKEN, baseUrl: BASE, visitId: "v1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("network");
  });
});
