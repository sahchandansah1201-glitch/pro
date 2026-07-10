import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSelfHostedVisit,
  listSelfHostedVisitAssets,
  listSelfHostedVisitLesions,
  listSelfHostedVisits,
  listSelfHostedVisitsByPatient,
} from "@/lib/self-hosted-visit-api";

const PATIENT_ID = "10000000-0000-4000-8000-000000000201";
const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const BASE = "http://localhost:3001";
const TOKEN = "header.payload.signature";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("self-hosted visit api client", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("fails when token missing", async () => {
    const res = await listSelfHostedVisitsByPatient({
      apiBaseUrl: BASE,
      apiToken: null,
      patientId: PATIENT_ID,
    });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("not_configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("lists visits by patient and forwards bearer token", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(200, {
        stage: "4G",
        items: [
          {
            id: VISIT_ID,
            clinicId: "c",
            patientId: PATIENT_ID,
            doctorUserId: null,
            status: "in_progress",
            startedAt: "2026-05-12T09:00:00.000Z",
            signedAt: null,
            chiefComplaint: null,
            createdAt: "2026-05-12T09:00:00.000Z",
            updatedAt: "2026-05-12T09:00:00.000Z",
          },
        ],
      }),
    );
    const res = await listSelfHostedVisitsByPatient({
      apiBaseUrl: BASE,
      apiToken: TOKEN,
      patientId: PATIENT_ID,
    });
    expect(res.ok).toBe(true);
    expect(res.value?.[0]?.id).toBe(VISIT_ID);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/api/v1/patients/${PATIENT_ID}/visits`);
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: `Bearer ${TOKEN}`,
    });
  });

  it("lists production schedule with filters and forwards bearer token", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(200, {
        stage: "5J",
        items: [
          {
            id: VISIT_ID,
            clinicId: "c",
            patientId: PATIENT_ID,
            doctorUserId: null,
            status: "draft",
            startedAt: "2026-05-15T09:00:00.000Z",
            patient: { id: PATIENT_ID, fullName: "Live Patient", code: "DP-LIVE" },
            clinic: { id: "c", slug: "main", name: "Live Clinic" },
          },
        ],
        count: 1,
        limit: 25,
        offset: 0,
        filters: { status: "draft", dateFrom: "2026-05-01", dateTo: "2026-05-31", search: "Live" },
      }),
    );

    const res = await listSelfHostedVisits({
      apiBaseUrl: BASE,
      apiToken: TOKEN,
      status: "draft",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-31",
      search: "Live",
      limit: 25,
    });

    expect(res.ok).toBe(true);
    expect(res.value?.items[0]?.patient.fullName).toBe("Live Patient");
    expect(res.value?.count).toBe(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/api/v1/visits?status=draft&dateFrom=2026-05-01&dateTo=2026-05-31&search=Live&limit=25`);
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: `Bearer ${TOKEN}`,
    });
  });

  it("returns visit detail with patient/clinic projections", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(200, {
        item: {
          id: VISIT_ID,
          status: "in_progress",
          startedAt: "2026-05-12T09:00:00.000Z",
          patient: { id: PATIENT_ID, fullName: "Demo Patient One", code: "DP-DEMO-0001" },
          clinic: { id: "c", slug: "demo-clinic", name: "Demo Clinic" },
        },
      }),
    );
    const res = await getSelfHostedVisit({ apiBaseUrl: BASE, apiToken: TOKEN, visitId: VISIT_ID });
    expect(res.ok).toBe(true);
    expect(res.value?.patient.fullName).toBe("Demo Patient One");
    expect(res.value?.clinic.slug).toBe("demo-clinic");
  });

  it("normalizes lesions and rejects unknown risk levels", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(200, {
        items: [
          { id: "l1", label: "L1", status: "active", riskLevel: "moderate" },
          { id: "l2", label: "L2", status: "monitoring", riskLevel: "weird" },
        ],
      }),
    );
    const res = await listSelfHostedVisitLesions({
      apiBaseUrl: BASE,
      apiToken: TOKEN,
      visitId: VISIT_ID,
    });
    expect(res.ok).toBe(true);
    expect(res.value?.[0]?.riskLevel).toBe("moderate");
    expect(res.value?.[1]?.riskLevel).toBeNull();
  });

  it("normalizes asset metadata and surfaces validation errors from backend", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(200, {
        items: [
          {
            id: "a1",
            kind: "dermoscopy",
            contentType: "image/jpeg",
            byteSize: 2048,
            capturedAt: "2026-05-12T09:00:00.000Z",
            captureSource: "device_bridge",
          },
        ],
      }),
    );
    const ok = await listSelfHostedVisitAssets({
      apiBaseUrl: BASE,
      apiToken: TOKEN,
      visitId: VISIT_ID,
    });
    expect(ok.ok).toBe(true);
    expect(ok.value?.[0]?.byteSize).toBe(2048);
    expect(ok.value?.[0]?.captureSource).toBe("device_bridge");

    fetchSpy.mockResolvedValueOnce(
      jsonResponse(422, {
        error: { code: "validation_error", message: "visitId must be a UUID." },
        correlationId: "abc",
      }),
    );
    const fail = await listSelfHostedVisitAssets({
      apiBaseUrl: BASE,
      apiToken: TOKEN,
      visitId: "bad",
    });
    expect(fail.ok).toBe(false);
    expect(fail.error?.code).toBe("validation_error");
    expect(fail.error?.kind).toBe("validation");
  });

  it("maps network errors to typed result", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("boom"));
    const res = await getSelfHostedVisit({ apiBaseUrl: BASE, apiToken: TOKEN, visitId: VISIT_ID });
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe("network_error");
  });
});
