import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSelfHostedAssetDownloadUrl,
  listSelfHostedVisitAssets,
  uploadSelfHostedVisitAsset,
} from "@/lib/self-hosted-asset-api";

const BASE = "http://localhost:3001";
const TOKEN = "local-token";
const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const ASSET_ID = "10000000-0000-4000-8000-000000000901";

describe("self-hosted-asset-api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
      source: "file",
      qualityScore: 1,
    });
    expect(fetch).toHaveBeenCalledWith(
      `${BASE}/api/v1/visits/${VISIT_ID}/assets`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("registers upload metadata without posting binary form data", async () => {
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

    const result = await uploadSelfHostedVisitAsset({
      token: TOKEN,
      baseUrl: BASE,
      visitId: VISIT_ID,
      file,
      kind: "overview",
      source: "file",
    });

    expect(result.ok).toBe(true);
    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toEqual(expect.any(String));
    expect(String(init.body)).toContain('"contentType":"image/png"');
    expect(String(init.body)).not.toContain("object_key");
  });

  it("expands backend-relative download URL against base URL", async () => {
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

    const result = await getSelfHostedAssetDownloadUrl({
      token: TOKEN,
      baseUrl: BASE,
      assetId: ASSET_ID,
      expiresIn: 120,
    });

    expect(result.ok).toBe(true);
    expect(result.value?.downloadUrl).toBe(`${BASE}/api/v1/assets/${ASSET_ID}/download`);
    expect(JSON.stringify(result.value)).not.toMatch(/object_key|storage_object_path|access_token/);
  });
});
