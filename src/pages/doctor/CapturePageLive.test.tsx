import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import CapturePageLive from "@/pages/doctor/CapturePageLive";

vi.mock("@/lib/self-hosted-api-session", () => ({
  isSelfHostedApiConfigured: (session: { status: string; apiToken: string | null }) =>
    session.status === "configured" && Boolean(session.apiToken),
  useSelfHostedApiSession: () => ({
    apiBaseUrl: "https://clinic.local",
    apiToken: "assistant-token",
    status: "configured",
    user: {
      id: "assistant-1",
      displayName: "Анна Ассистент",
      roles: ["assistant"],
    },
  }),
}));

const visit = {
  id: "visit-1",
  clinicId: "clinic-1",
  patientId: "patient-1",
  doctorUserId: "doctor-1",
  status: "in_progress",
  startedAt: "2026-06-29T10:00:00.000Z",
  signedAt: null,
  chiefComplaint: "Плановая съёмка",
  createdAt: "2026-06-29T09:00:00.000Z",
  updatedAt: "2026-06-29T09:00:00.000Z",
  patient: {
    id: "patient-1",
    fullName: "Ирина Пациент",
    code: "DP-2026-0001",
  },
  clinic: {
    id: "clinic-1",
    slug: "clinic",
    name: "Клиника Яблоко",
  },
};

const lesion = {
  id: "lesion-1",
  clinicId: "clinic-1",
  patientId: "patient-1",
  visitId: "visit-1",
  label: "Очаг A",
  bodyZone: "предплечье",
  bodySurface: "front",
  status: "active",
  riskLevel: null,
  createdAt: "2026-06-29T09:00:00.000Z",
  updatedAt: "2026-06-29T09:00:00.000Z",
};

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

function renderCapture() {
  return render(
    <MemoryRouter>
      <CapturePageLive />
    </MemoryRouter>,
  );
}

describe("CapturePageLive · assistant production capture", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads real visit context and uploads a photo without demo or protected storage text", async () => {
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/v1/visits?limit=25")) {
        return json({ items: [visit], count: 1, limit: 25, offset: 0, filters: { status: "all" } });
      }
      if (href.endsWith("/api/v1/visits/visit-1") && !href.endsWith("/assets") && !href.endsWith("/lesions")) {
        return json({ item: visit });
      }
      if (href.endsWith("/api/v1/visits/visit-1/lesions")) {
        return json({ items: [lesion] });
      }
      if (href.endsWith("/api/v1/visits/visit-1/assets") && init?.method === "POST") {
        return json(
          {
            item: {
              id: "asset-1",
              clinicId: "clinic-1",
              patientId: "patient-1",
              visitId: "visit-1",
              lesionId: "lesion-1",
              kind: "dermoscopy",
              contentType: "image/png",
              byteSize: 9,
              capturedAt: "2026-06-29T10:05:00.000Z",
              uploadedBy: "assistant-1",
              createdAt: "2026-06-29T10:05:00.000Z",
            },
          },
          201,
        );
      }
      if (href.endsWith("/api/v1/visits/visit-1/assets")) {
        return json({ items: [] });
      }
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderCapture();

    expect(await screen.findByRole("heading", { name: "Съёмка" })).toBeInTheDocument();
    expect(await screen.findByText("Ирина Пациент")).toBeInTheDocument();
    expect((await screen.findAllByText(/Очаг A · предплечье/)).length).toBeGreaterThan(0);

    const file = new File(["image"], "capture.png", { type: "image/png" });
    Object.defineProperty(file, "arrayBuffer", {
      configurable: true,
      value: async () => new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]).buffer,
    });
    fireEvent.change(screen.getByLabelText("Файл снимка"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить снимок" }));

    expect(await screen.findByText("Снимок сохранён в системе клиники.")).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://clinic.local/api/v1/visits/visit-1/assets",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer assistant-token",
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    const postBody = String(fetchMock.mock.calls.find((call) => String(call[0]).endsWith("/assets") && call[1]?.method === "POST")?.[1]?.body ?? "");
    expect(postBody).toContain('"kind":"dermoscopy"');
    expect(postBody).toContain('"lesionId":"lesion-1"');

    expect(document.body).not.toHaveTextContent(/Учебный режим|демо|mock|backend|self-hosted|PostgreSQL|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i);
  });

  it("shows an RDS-3 imported asset as a device capture in the assistant queue", async () => {
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const href = String(url);
      if (href.endsWith("/api/v1/visits?limit=25")) {
        return json({ items: [visit], count: 1, limit: 25, offset: 0, filters: { status: "all" } });
      }
      if (href.endsWith("/api/v1/visits/visit-1") && !href.endsWith("/assets") && !href.endsWith("/lesions")) {
        return json({ item: visit });
      }
      if (href.endsWith("/api/v1/visits/visit-1/lesions")) return json({ items: [lesion] });
      if (href.endsWith("/api/v1/visits/visit-1/assets")) {
        return json({ items: [{
          id: "asset-rds3",
          clinicId: "clinic-1",
          patientId: "patient-1",
          visitId: "visit-1",
          lesionId: "lesion-1",
          kind: "dermoscopy",
          contentType: "image/jpeg",
          byteSize: 2048,
          captureSource: "device_bridge",
          capturedAt: "2026-07-10T10:00:00.000Z",
          uploadedBy: "assistant-1",
          createdAt: "2026-07-10T10:00:01.000Z",
        }] });
      }
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderCapture();

    expect(await screen.findByText("Дерматоскопия · Прибор")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/device_bridge|storagePath|signedUrl|checksumSha256/);
  });
});
