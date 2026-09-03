import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSelfHostedAssetUploadIdentity,
  getSelfHostedAssetDownloadUrl,
  listSelfHostedVisitAssets,
  uploadSelfHostedVisitAsset,
} from "@/lib/self-hosted-asset-api";
import { TECHNICAL_QUALITY_NOT_ASSESSED } from "@/lib/safe-clinical-image-adapter";

const BASE = "http://localhost:3001";
const TOKEN = "local-token";
const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const ASSET_ID = "10000000-0000-4000-8000-000000000901";
const IDEMPOTENCY_KEY = "asset-upload-0000000000000001";
const CAPTURED_AT = "2026-05-12T09:00:00.000Z";

describe("self-hosted-asset-api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates one secure idempotency key and timestamp for a retryable upload", () => {
    const identity = createSelfHostedAssetUploadIdentity();
    expect(identity.idempotencyKey).toMatch(/^[A-Za-z0-9._:-]{16,128}$/);
    expect(new Date(identity.capturedAt).toISOString()).toBe(identity.capturedAt);
  });

  it("lists safe visit assets through self-hosted backend", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [
            {
              id: ASSET_ID,
              clinicId: "clinic-1",
              visitId: VISIT_ID,
              lesionId: null,
              kind: "dermoscopy",
              contentType: "image/jpeg",
              byteSize: 1024,
              capturedAt: "2026-05-12T09:00:00.000Z",
              createdAt: "2026-05-12T09:00:01.000Z",
              captureSource: "device_bridge",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await listSelfHostedVisitAssets({
      token: TOKEN,
      baseUrl: BASE,
      visitId: VISIT_ID,
    });

    expect(result.ok).toBe(true);
    expect(result.value?.[0]).toMatchObject({
      id: ASSET_ID,
      kind: "dermoscopy",
      source: "device_bridge",
      qualityScore: 0,
      qualityIssues: [TECHNICAL_QUALITY_NOT_ASSESSED],
    });
    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/visits/${VISIT_ID}/assets`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("uploads asset bytes as base64 JSON without exposing object keys", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          item: {
            id: ASSET_ID,
            clinicId: "clinic-1",
            visitId: VISIT_ID,
            kind: "overview_photo",
            contentType: "image/png",
            byteSize: 2048,
            createdAt: "2026-05-12T09:00:01.000Z",
          },
        }),
        { status: 201 },
      ),
    );
    const file = new File(["x"], "spot.png", { type: "image/png" });
    Object.defineProperty(file, "arrayBuffer", {
      configurable: true,
      value: async () => new Uint8Array([120]).buffer,
    });

    const result = await uploadSelfHostedVisitAsset({
      token: TOKEN,
      baseUrl: BASE,
      visitId: VISIT_ID,
      file,
      kind: "overview",
      source: "file",
      idempotencyKey: IDEMPOTENCY_KEY,
      capturedAt: CAPTURED_AT,
    });

    expect(result.ok).toBe(true);
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual(expect.objectContaining({ "Idempotency-Key": IDEMPOTENCY_KEY }));
    expect(init.body).toEqual(expect.any(String));
    expect(JSON.parse(String(init.body)).capturedAt).toBe(CAPTURED_AT);
    expect(String(init.body)).toContain('"contentType":"image/png"');
    expect(String(init.body)).toContain('"dataBase64":"eA=="');
    expect(String(init.body)).not.toContain("object_key");
  });

  it("fetches backend-relative download URL with bearer token and returns object URL", async () => {
    const createObjectURL = vi.fn(() => "blob:self-hosted-asset");
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          item: {
            assetId: ASSET_ID,
            clinicId: "clinic-1",
            visitId: VISIT_ID,
            downloadUrl: `/api/v1/assets/${ASSET_ID}/download`,
            expiresIn: 120,
            expiresAt: "2026-05-12T09:02:00.000Z",
          },
        }),
        { status: 200 },
      ),
    );
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(new Blob(["asset-bytes"], { type: "image/png" }), {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );

    const result = await getSelfHostedAssetDownloadUrl({
      token: TOKEN,
      baseUrl: BASE,
      assetId: ASSET_ID,
      expiresIn: 120,
    });

    expect(result.ok).toBe(true);
    expect(result.value?.downloadUrl).toBe("blob:self-hosted-asset");
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      `${BASE}/api/v1/assets/${ASSET_ID}/download`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      }),
    );
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result.value)).not.toMatch(/object_key|storage_object_path|access_token/);
  });
});
