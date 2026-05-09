// Stage 1E-E · UI tests for the API assets panel inside VisitImagingTab.
// The component preserves demo behaviour and only activates the API
// surface when an explicit token + baseUrl are passed via props.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { VisitImagingTab } from "./VisitImagingTab";
import { LESIONS, VISITS, getLesionsByPatientId } from "@/lib/mock-data";

const visit = VISITS[0];
const patientId = visit.patientId;
const lesions = getLesionsByPatientId(patientId).length > 0
  ? getLesionsByPatientId(patientId)
  : LESIONS.slice(0, 1);

function renderTab(extra: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter>
      <VisitImagingTab
        visit={visit}
        patientId={patientId}
        lesions={lesions}
        {...extra}
      />
    </MemoryRouter>,
  );
}

describe("VisitImagingTab · existing imaging surface preserved", () => {
  it("renders capture toolbar and the API assets section", () => {
    renderTab();
    expect(screen.getByText(/Захват/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /API ассеты визита/i })).toBeInTheDocument();
  });

  it("never renders a delete control on doctor imaging surface", () => {
    renderTab();
    const buttons = screen.getAllByRole("button");
    for (const b of buttons) {
      const label = (b.getAttribute("aria-label") ?? "") + " " + (b.textContent ?? "");
      expect(label.toLowerCase()).not.toMatch(/удал|delete|remove/);
    }
  });

  it("does not render raw storage path / exif labels", () => {
    const { container } = renderTab();
    const html = container.innerHTML;
    expect(html).not.toMatch(/storageObjectPath/);
    expect(html).not.toMatch(/storage_object_path/);
    expect(html).not.toMatch(/\bexif\b/i);
  });
});

describe("VisitImagingTab · API panel · demo (no token) mode", () => {
  it("shows demo-mode notice and upload click surfaces a non-blocking status", async () => {
    renderTab();
    const region = screen.getByRole("region", { name: /API ассеты визита/i });
    expect(within(region).getAllByText(/демо-режим/i).length).toBeGreaterThan(0);
    expect(within(region).getByText(/API клинических ассетов не сконфигурирован/i))
      .toBeInTheDocument();

    const uploadBtn = within(region).getByRole("button", { name: /Загрузить снимок/i });
    await userEvent.click(uploadBtn);

    expect(within(region).getByRole("status")).toHaveTextContent(
      /требует авторизованной сессии API/i,
    );
  });
});

describe("VisitImagingTab · API panel · with token", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls api-read on mount and shows empty state without leaking forbidden fields", async () => {
    renderTab({ apiToken: "tok", apiBaseUrl: "https://x.supabase.co" });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(
      /\/functions\/v1\/api-read\/doctor\/visits\/[^/]+\/assets$/,
    );
    expect((init as RequestInit).method).toBe("GET");

    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await waitFor(() => {
      expect(within(region).getByText(/В API ещё нет ассетов/i)).toBeInTheDocument();
    });
  });
});

// Stage 1I-A · Asset row rendering + signed download flow.
describe("VisitImagingTab · API panel · asset row + signed download", () => {
  const sampleAsset = {
    id: "a-1",
    clinicId: "c-1",
    visitId: visit.id,
    lesionId: null,
    kind: "dermoscopy",
    source: "device_bridge",
    capturedAt: "2026-05-09T10:00:00Z",
    deviceId: null,
    qualityScore: 0.92,
    qualityIssues: [],
    createdAt: "2026-05-09T10:00:01Z",
  };

  let fetchMock: ReturnType<typeof vi.fn>;
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/download-url")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              assetId: "a-1",
              clinicId: "c-1",
              visitId: visit.id,
              downloadUrl: "https://signed.example/asset-1?sig=xyz",
              expiresIn: 300,
              expiresAt: "2026-05-09T10:05:00Z",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify([sampleAsset]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    openSpy.mockRestore();
  });

  it("renders the asset row from api-read without leaking storage path / exif", async () => {
    const { container } = renderTab({
      apiToken: "doctor-jwt",
      apiBaseUrl: "https://abc.supabase.co",
    });

    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await waitFor(() => {
      expect(
        within(region).getByRole("button", { name: /Открыть снимок a-1/i }),
      ).toBeInTheDocument();
    });

    const html = container.innerHTML;
    expect(html).not.toMatch(/storageObjectPath/);
    expect(html).not.toMatch(/storage_object_path/);
    expect(html).not.toMatch(/\bexif\b/i);
  });

  it("clicking 'Открыть' calls download-url endpoint and opens the signed URL", async () => {
    renderTab({
      apiToken: "doctor-jwt",
      apiBaseUrl: "https://abc.supabase.co",
    });

    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    const openBtn = await within(region).findByRole("button", {
      name: /Открыть снимок a-1/i,
    });
    await userEvent.click(openBtn);

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("/api-read/doctor/assets/a-1/download-url"))).toBe(true);
    });

    const dlCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("/download-url"),
    )!;
    const headers = (dlCall[1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer doctor-jwt");

    // Stage 1K-A: success now opens an in-app preview dialog rather than
    // calling window.open directly. The signed URL is the img src.
    const dialog = await screen.findByRole("dialog");
    const img = within(dialog).getByRole("img", {
      name: /Клинический снимок Дерматоскопия/i,
    }) as HTMLImageElement;
    expect(img.src).toBe("https://signed.example/asset-1?sig=xyz");
    expect(openSpy).not.toHaveBeenCalled();
  });
});

// Stage 1I-B · Error UX for list / download / upload.
describe("VisitImagingTab · API panel · error UX", () => {
  const sampleAsset = {
    id: "a-1",
    clinicId: "c-1",
    visitId: visit.id,
    lesionId: null,
    kind: "dermoscopy",
    source: "device_bridge",
    capturedAt: "2026-05-09T10:00:00Z",
    deviceId: null,
    qualityScore: 0.92,
    qualityIssues: [],
    createdAt: "2026-05-09T10:00:01Z",
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("list 403 shows 'Недостаточно прав для просмотра ассетов.'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: "forbidden" }), { status: 403 }),
      ),
    );
    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await waitFor(() => {
      expect(within(region).getByRole("alert")).toHaveTextContent(
        /Недостаточно прав для просмотра ассетов\./,
      );
    });
  });

  it("list network failure shows 'Сбой сети при загрузке ассетов.'", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await waitFor(() => {
      expect(within(region).getByRole("alert")).toHaveTextContent(
        /Сбой сети при загрузке ассетов\./,
      );
    });
  });

  it("download 404 shows 'Снимок не найден.' and does not open a window", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/download-url")) {
        return Promise.resolve(
          new Response(JSON.stringify({ message: "missing" }), { status: 404 }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify([sampleAsset]), { status: 200 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    const openBtn = await within(region).findByRole("button", {
      name: /Открыть снимок a-1/i,
    });
    await userEvent.click(openBtn);

    await waitFor(() => {
      expect(within(region).getByRole("alert")).toHaveTextContent(/Снимок не найден\./);
    });
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("upload 422 shows hint and keeps existing asset row visible", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ message: "invalid" }), { status: 422 }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify([sampleAsset]), { status: 200 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderTab({
      apiToken: "t",
      apiBaseUrl: "https://x.supabase.co",
    });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await within(region).findByRole("button", { name: /Открыть снимок a-1/i });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "x.jpg", { type: "image/jpeg" });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(within(region).getByRole("alert")).toHaveTextContent(
        /Проверьте файл и параметры снимка\./,
      );
    });
    // Asset row still rendered.
    expect(
      within(region).getByRole("button", { name: /Открыть снимок a-1/i }),
    ).toBeInTheDocument();
  });

  it("hostile error body containing storage path / exif tokens is not rendered", async () => {
    const hostile =
      "leak storageObjectPath=clinic/c-1/visit/v-1/file.jpg exif metadata";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: hostile }), { status: 400 }),
      ),
    );
    const { container } = renderTab({
      apiToken: "t",
      apiBaseUrl: "https://x.supabase.co",
    });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await waitFor(() => {
      expect(within(region).getByRole("alert")).toBeInTheDocument();
    });
    const html = container.innerHTML;
    expect(html).not.toMatch(/storageObjectPath/);
    expect(html).not.toMatch(/storage_object_path/);
    expect(html).not.toMatch(/\bexif\b/i);
    expect(html).not.toMatch(/clinic\/[a-z0-9-]+\/visit/i);
  });
});

// Stage 1I-C · Retry UX for list errors only.
describe("VisitImagingTab · API panel · retry UX", () => {
  const sampleAsset = {
    id: "a-1",
    clinicId: "c-1",
    visitId: visit.id,
    lesionId: null,
    kind: "dermoscopy",
    source: "device_bridge",
    capturedAt: "2026-05-09T10:00:00Z",
    deviceId: null,
    qualityScore: 0.92,
    qualityIssues: [],
    createdAt: "2026-05-09T10:00:01Z",
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("list 403 then retry success renders asset row and clears error", async () => {
    let calls = 0;
    const fetchMock = vi.fn(() => {
      calls += 1;
      if (calls === 1) {
        return Promise.resolve(
          new Response(JSON.stringify({ message: "forbidden" }), { status: 403 }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify([sampleAsset]), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    const alert = await within(region).findByRole("alert");
    expect(alert).toHaveTextContent(/Недостаточно прав для просмотра ассетов\./);

    const retry = within(region).getByRole("button", { name: /Повторить$/ });
    await userEvent.click(retry);

    await waitFor(() => {
      expect(within(region).queryByRole("alert")).not.toBeInTheDocument();
    });
    expect(
      within(region).getByRole("button", { name: /Открыть снимок a-1/i }),
    ).toBeInTheDocument();
  });

  it("list network failure then retry empty success shows empty state", async () => {
    let calls = 0;
    const fetchMock = vi.fn(() => {
      calls += 1;
      if (calls === 1) return Promise.reject(new Error("boom"));
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await within(region).findByRole("alert");

    const retry = within(region).getByRole("button", { name: /Повторить$/ });
    await userEvent.click(retry);

    await waitFor(() => {
      expect(within(region).queryByRole("alert")).not.toBeInTheDocument();
    });
    expect(within(region).getByText(/В API ещё нет ассетов/i)).toBeInTheDocument();
  });

  it("download 404 error does NOT render Повторить", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/download-url")) {
        return Promise.resolve(
          new Response(JSON.stringify({ message: "missing" }), { status: 404 }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify([sampleAsset]), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "open").mockImplementation(() => null);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    const openBtn = await within(region).findByRole("button", {
      name: /Открыть снимок a-1/i,
    });
    await userEvent.click(openBtn);

    await within(region).findByRole("alert");
    expect(within(region).queryByRole("button", { name: /Повторить$/ })).not.toBeInTheDocument();
  });

  it("upload 422 error does NOT render Повторить", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ message: "invalid" }), { status: 422 }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify([sampleAsset]), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderTab({
      apiToken: "t",
      apiBaseUrl: "https://x.supabase.co",
    });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await within(region).findByRole("button", { name: /Открыть снимок a-1/i });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, new File(["x"], "x.jpg", { type: "image/jpeg" }));

    await within(region).findByRole("alert");
    expect(within(region).queryByRole("button", { name: /Повторить$/ })).not.toBeInTheDocument();
  });
});

// Stage 1K-A · Signed image preview dialog.
describe("VisitImagingTab · API panel · preview dialog", () => {
  const sampleAsset = {
    id: "a-1",
    clinicId: "c-1",
    visitId: visit.id,
    lesionId: null,
    kind: "dermoscopy",
    source: "device_bridge",
    capturedAt: "2026-05-09T10:00:00Z",
    deviceId: null,
    qualityScore: 0.92,
    qualityIssues: [],
    createdAt: "2026-05-09T10:00:01Z",
  };
  const SIGNED_URL = "https://signed.example/asset-1?sig=xyz";

  function makeOkFetch() {
    return vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/download-url")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              assetId: "a-1",
              clinicId: "c-1",
              visitId: visit.id,
              downloadUrl: SIGNED_URL,
              expiresIn: 300,
              expiresAt: "2026-05-09T10:05:00Z",
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify([sampleAsset]), { status: 200 }));
    });
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens an in-app preview dialog with the signed URL as img src", async () => {
    vi.stubGlobal("fetch", makeOkFetch());
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    const openBtn = await within(region).findByRole("button", {
      name: /Открыть снимок a-1/i,
    });
    await userEvent.click(openBtn);

    const dialog = await screen.findByRole("dialog");
    const img = within(dialog).getByRole("img", { name: /Клинический снимок Дерматоскопия/i }) as HTMLImageElement;
    expect(img.src).toBe(SIGNED_URL);
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("clicking 'Открыть в новой вкладке' calls window.open with the signed URL", async () => {
    vi.stubGlobal("fetch", makeOkFetch());
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await userEvent.click(
      await within(region).findByRole("button", { name: /Открыть снимок a-1/i }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: /Открыть в новой вкладке/i }),
    );

    expect(openSpy).toHaveBeenCalledWith(SIGNED_URL, "_blank", "noopener,noreferrer");
    openSpy.mockRestore();
  });

  it("closing the dialog removes the preview but keeps the asset row", async () => {
    vi.stubGlobal("fetch", makeOkFetch());
    vi.spyOn(window, "open").mockImplementation(() => null);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await userEvent.click(
      await within(region).findByRole("button", { name: /Открыть снимок a-1/i }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /Закрыть/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(
      within(region).getByRole("button", { name: /Открыть снимок a-1/i }),
    ).toBeInTheDocument();
  });

  it("download 404 still shows 'Снимок не найден.' and does not open dialog or window.open", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/download-url")) {
        return Promise.resolve(
          new Response(JSON.stringify({ message: "missing" }), { status: 404 }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify([sampleAsset]), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await userEvent.click(
      await within(region).findByRole("button", { name: /Открыть снимок a-1/i }),
    );

    await waitFor(() => {
      expect(within(region).getByRole("alert")).toHaveTextContent(/Снимок не найден\./);
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("dialog visible text does not contain storageObjectPath / exif tokens", async () => {
    vi.stubGlobal("fetch", makeOkFetch());
    vi.spyOn(window, "open").mockImplementation(() => null);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await userEvent.click(
      await within(region).findByRole("button", { name: /Открыть снимок a-1/i }),
    );
    const dialog = await screen.findByRole("dialog");
    const text = dialog.textContent ?? "";
    expect(text).not.toMatch(/storageObjectPath/);
    expect(text).not.toMatch(/storage_object_path/);
    expect(text).not.toMatch(/\bexif\b/i);
  });
});

// Stage 1K-B · A11y + image-load fallback for the preview dialog.
describe("VisitImagingTab · API panel · preview dialog a11y + fallback", () => {
  const sampleAsset = {
    id: "a-1",
    clinicId: "c-1",
    visitId: visit.id,
    lesionId: null,
    kind: "dermoscopy",
    source: "device_bridge",
    capturedAt: "2026-05-09T10:00:00Z",
    deviceId: null,
    qualityScore: 0.92,
    qualityIssues: [],
    createdAt: "2026-05-09T10:00:01Z",
  };
  const SIGNED_URL = "https://signed.example/asset-1?sig=secret-token";

  function makeOkFetch() {
    return vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/download-url")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              assetId: "a-1",
              clinicId: "c-1",
              visitId: visit.id,
              downloadUrl: SIGNED_URL,
              expiresIn: 300,
              expiresAt: "2026-05-09T10:05:00Z",
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify([sampleAsset]), { status: 200 }));
    });
  }

  async function openDialog() {
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    const openBtn = await within(region).findByRole("button", {
      name: /Открыть снимок a-1/i,
    });
    await userEvent.click(openBtn);
    return await screen.findByRole("dialog");
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dialog has accessible title and image alt", async () => {
    vi.stubGlobal("fetch", makeOkFetch());
    vi.spyOn(window, "open").mockImplementation(() => null);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const dialog = await openDialog();

    expect(within(dialog).getByText("Просмотр снимка")).toBeInTheDocument();
    const img = within(dialog).getByRole("img", {
      name: /Клинический снимок Дерматоскопия/i,
    });
    expect(img).toBeInTheDocument();
  });

  it("Escape closes the dialog and the asset row remains", async () => {
    vi.stubGlobal("fetch", makeOkFetch());
    vi.spyOn(window, "open").mockImplementation(() => null);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    await openDialog();
    await userEvent.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    expect(
      within(region).getByRole("button", { name: /Открыть снимок a-1/i }),
    ).toBeInTheDocument();
  });

  it("image onError shows the fallback message and keeps 'Открыть в новой вкладке'", async () => {
    vi.stubGlobal("fetch", makeOkFetch());
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const dialog = await openDialog();
    const img = within(dialog).getByRole("img", {
      name: /Клинический снимок Дерматоскопия/i,
    });
    fireEvent.error(img);

    const fallback = await within(dialog).findByText(
      /Не удалось отобразить изображение\. Откройте его в новой вкладке\./,
    );
    expect(fallback).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole("button", { name: /Открыть в новой вкладке/i }),
    );
    expect(openSpy).toHaveBeenCalledWith(SIGNED_URL, "_blank", "noopener,noreferrer");
    openSpy.mockRestore();
  });

  it("dialog visible text never contains the signed URL or forbidden tokens", async () => {
    vi.stubGlobal("fetch", makeOkFetch());
    vi.spyOn(window, "open").mockImplementation(() => null);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const dialog = await openDialog();
    const text = dialog.textContent ?? "";
    expect(text).not.toContain(SIGNED_URL);
    expect(text).not.toContain("signed.example");
    expect(text).not.toMatch(/storageObjectPath/);
    expect(text).not.toMatch(/storage_object_path/);
    expect(text).not.toMatch(/\bexif\b/i);
    expect(text).not.toMatch(/clinic\/[a-z0-9-]+\/visit/i);
  });
});

describe("VisitImagingTab · API panel · preview dialog loading state", () => {
  const sampleAsset = {
    id: "a-1",
    clinicId: "c-1",
    visitId: visit.id,
    lesionId: null,
    kind: "dermoscopy",
    source: "device_bridge",
    capturedAt: "2026-05-09T10:00:00Z",
    deviceId: null,
    qualityScore: 0.92,
    qualityIssues: [],
    createdAt: "2026-05-09T10:00:01Z",
  };
  const SIGNED_URL = "https://signed.example/asset-1?sig=secret-token";

  function makeOkFetch() {
    return vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/download-url")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              assetId: "a-1",
              clinicId: "c-1",
              visitId: visit.id,
              downloadUrl: SIGNED_URL,
              expiresIn: 300,
              expiresAt: "2026-05-09T10:05:00Z",
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify([sampleAsset]), { status: 200 }));
    });
  }

  async function openDialog() {
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    const openBtn = await within(region).findByRole("button", {
      name: /Открыть снимок a-1/i,
    });
    await userEvent.click(openBtn);
    return await screen.findByRole("dialog");
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows loading indicator while the signed image is loading", async () => {
    vi.stubGlobal("fetch", makeOkFetch());
    vi.spyOn(window, "open").mockImplementation(() => null);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const dialog = await openDialog();

    const loader = await within(dialog).findByTestId("preview-loading");
    expect(loader).toBeInTheDocument();
    expect(loader).toHaveAttribute("role", "status");
    expect(within(dialog).getByText(/Загружаем изображение…/)).toBeInTheDocument();
    // "Открыть в новой вкладке" remains available while loading.
    expect(
      within(dialog).getByRole("button", { name: /Открыть в новой вкладке/i }),
    ).toBeInTheDocument();
  });

  it("hides the loading indicator after the image loads", async () => {
    vi.stubGlobal("fetch", makeOkFetch());
    vi.spyOn(window, "open").mockImplementation(() => null);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const dialog = await openDialog();
    const img = within(dialog).getByRole("img", {
      name: /Клинический снимок Дерматоскопия/i,
    });
    fireEvent.load(img);

    await waitFor(() => {
      expect(within(dialog).queryByTestId("preview-loading")).not.toBeInTheDocument();
    });
  });

  it("hides the loading indicator and shows fallback on image error", async () => {
    vi.stubGlobal("fetch", makeOkFetch());
    vi.spyOn(window, "open").mockImplementation(() => null);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const dialog = await openDialog();
    const img = within(dialog).getByRole("img", {
      name: /Клинический снимок Дерматоскопия/i,
    });
    fireEvent.error(img);

    await waitFor(() => {
      expect(within(dialog).queryByTestId("preview-loading")).not.toBeInTheDocument();
    });
    expect(
      within(dialog).getByText(/Не удалось отобразить изображение/),
    ).toBeInTheDocument();
  });

  it("reopening the preview resets prior image error/loading state", async () => {
    vi.stubGlobal("fetch", makeOkFetch());
    vi.spyOn(window, "open").mockImplementation(() => null);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });

    // First open: trigger an image error.
    let dialog = await openDialog();
    fireEvent.error(
      within(dialog).getByRole("img", { name: /Клинический снимок Дерматоскопия/i }),
    );
    await within(dialog).findByText(/Не удалось отобразить изображение/);

    // Close the dialog.
    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    // Reopen: prior error gone, loading state visible again.
    dialog = await openDialog();
    expect(
      within(dialog).queryByText(/Не удалось отобразить изображение/),
    ).not.toBeInTheDocument();
    expect(await within(dialog).findByTestId("preview-loading")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("img", { name: /Клинический снимок Дерматоскопия/i }),
    ).toBeInTheDocument();
  });

  it("dialog visible text never contains the signed URL while loading", async () => {
    vi.stubGlobal("fetch", makeOkFetch());
    vi.spyOn(window, "open").mockImplementation(() => null);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const dialog = await openDialog();
    await within(dialog).findByTestId("preview-loading");
    const text = dialog.textContent ?? "";
    expect(text).not.toContain(SIGNED_URL);
    expect(text).not.toContain("signed.example");
    expect(text).not.toMatch(/storageObjectPath/);
    expect(text).not.toMatch(/storage_object_path/);
    expect(text).not.toMatch(/\bexif\b/i);
  });
});

// Stage 2E-A · Upload UX polish.
describe("VisitImagingTab · API panel · upload UX polish", () => {
  const sampleAsset = {
    id: "a-1",
    clinicId: "c-1",
    visitId: visit.id,
    lesionId: null,
    kind: "dermoscopy",
    source: "device_bridge",
    capturedAt: "2026-05-09T10:00:00Z",
    deviceId: null,
    qualityScore: 0.92,
    qualityIssues: [],
    createdAt: "2026-05-09T10:00:01Z",
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the accepted file format hint near the upload control", async () => {
    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    expect(within(region).getByText(/JPEG, PNG, WebP или HEIC/)).toBeInTheDocument();
  });

  it("rejects non-image files client-side without calling the upload endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderTab({
      apiToken: "t",
      apiBaseUrl: "https://x.supabase.co",
    });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fetchMock.mockClear();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });
    await userEvent.upload(fileInput, pdf, { applyAccept: false });

    expect(await within(region).findByRole("status")).toHaveTextContent(
      /Выберите файл изображения: JPEG, PNG, WebP или HEIC\./,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("accepts image/png, shows 'Загружаем: <filename>' and disables the upload button while pending", async () => {
    let resolveUpload: ((res: Response) => void) | null = null;
    const uploadPromise = new Promise<Response>((r) => {
      resolveUpload = r;
    });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") {
        return uploadPromise;
      }
      return Promise.resolve(
        new Response(JSON.stringify([sampleAsset]), { status: 200 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderTab({
      apiToken: "t",
      apiBaseUrl: "https://x.supabase.co",
    });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await within(region).findByRole("button", { name: /Открыть снимок a-1/i });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const png = new File(["x"], "lesion.png", { type: "image/png" });
    await userEvent.upload(fileInput, png);

    await waitFor(() => {
      expect(within(region).getByRole("status")).toHaveTextContent(
        /Загружаем: lesion\.png/,
      );
    });
    const uploadBtn = within(region).getByRole("button", { name: /Загрузить снимок/i });
    expect(uploadBtn).toBeDisabled();
    // Existing asset row remains visible while pending.
    expect(
      within(region).getByRole("button", { name: /Открыть снимок a-1/i }),
    ).toBeInTheDocument();

    resolveUpload!(
      new Response(JSON.stringify({ ...sampleAsset, id: "a-2" }), { status: 201 }),
    );

    await waitFor(() => {
      expect(within(region).getByRole("status")).toHaveTextContent(/Снимок загружен\./);
    });
    expect(within(region).getByRole("button", { name: /Загрузить снимок/i })).not.toBeDisabled();
  });
});

// Stage 2E-B · Upload edge hardening.
describe("VisitImagingTab · API panel · upload edge hardening", () => {
  const sampleAsset = {
    id: "a-1",
    clinicId: "c-1",
    visitId: visit.id,
    lesionId: null,
    kind: "dermoscopy",
    source: "device_bridge",
    capturedAt: "2026-05-09T10:00:00Z",
    deviceId: null,
    qualityScore: 0.92,
    qualityIssues: [],
    createdAt: "2026-05-09T10:00:01Z",
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hidden file input has the explicit accept attribute", async () => {
    const { container } = renderTab({
      apiToken: "t",
      apiBaseUrl: "https://x.supabase.co",
    });
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput.getAttribute("accept")).toBe(
      "image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif",
    );
  });

  it("after rejecting an invalid file, selecting a valid image still uploads normally", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ ...sampleAsset, id: "a-2" }), { status: 201 }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderTab({
      apiToken: "t",
      apiBaseUrl: "https://x.supabase.co",
    });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fetchMock.mockClear();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(
      fileInput,
      new File(["x"], "doc.pdf", { type: "application/pdf" }),
      { applyAccept: false },
    );
    expect(await within(region).findByRole("status")).toHaveTextContent(
      /Выберите файл изображения/,
    );
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.upload(
      fileInput,
      new File(["x"], "lesion.jpg", { type: "image/jpeg" }),
    );
    await waitFor(() => {
      const posts = fetchMock.mock.calls.filter(
        (c) => ((c[1] as RequestInit)?.method ?? "GET") === "POST",
      );
      expect(posts.length).toBe(1);
    });
    await waitFor(() => {
      expect(within(region).getByRole("status")).toHaveTextContent(/Снимок загружен\./);
    });
  });

  it("selecting the same filename again after a failed upload triggers a new upload (input value reset)", async () => {
    let postCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") {
        postCalls += 1;
        if (postCalls === 1) {
          return Promise.resolve(
            new Response(JSON.stringify({ message: "invalid" }), { status: 422 }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ ...sampleAsset, id: "a-2" }), { status: 201 }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify([sampleAsset]), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderTab({
      apiToken: "t",
      apiBaseUrl: "https://x.supabase.co",
    });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await within(region).findByRole("button", { name: /Открыть снимок a-1/i });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const sameName = () => new File(["x"], "lesion.jpg", { type: "image/jpeg" });

    await userEvent.upload(fileInput, sameName());
    await within(region).findByRole("alert");
    expect(fileInput.value).toBe("");

    await userEvent.upload(fileInput, sameName());
    await waitFor(() => expect(postCalls).toBe(2));
    await waitFor(() => {
      expect(within(region).getByRole("status")).toHaveTextContent(/Снимок загружен\./);
    });
  });

  it("upload failure keeps the existing asset row visible and shows the mapped upload error", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ message: "invalid" }), { status: 422 }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify([sampleAsset]), { status: 200 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderTab({
      apiToken: "t",
      apiBaseUrl: "https://x.supabase.co",
    });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await within(region).findByRole("button", { name: /Открыть снимок a-1/i });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(
      fileInput,
      new File(["x"], "lesion.jpg", { type: "image/jpeg" }),
    );

    await waitFor(() => {
      expect(within(region).getByRole("alert")).toHaveTextContent(
        /Проверьте файл и параметры снимка\./,
      );
    });
    expect(
      within(region).getByRole("button", { name: /Открыть снимок a-1/i }),
    ).toBeInTheDocument();
  });

  it("upload pending state prevents duplicate upload calls", async () => {
    let resolveUpload: ((res: Response) => void) | null = null;
    const uploadPromise = new Promise<Response>((r) => {
      resolveUpload = r;
    });
    let postCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") {
        postCalls += 1;
        return uploadPromise;
      }
      return Promise.resolve(
        new Response(JSON.stringify([sampleAsset]), { status: 200 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = renderTab({
      apiToken: "t",
      apiBaseUrl: "https://x.supabase.co",
    });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await within(region).findByRole("button", { name: /Открыть снимок a-1/i });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(
      fileInput,
      new File(["x"], "lesion.png", { type: "image/png" }),
    );

    const uploadBtn = await within(region).findByRole("button", {
      name: /Загрузить снимок/i,
    });
    await waitFor(() => expect(uploadBtn).toBeDisabled());

    // Attempting to click again while pending must not enqueue another POST.
    await userEvent.click(uploadBtn);
    await userEvent.click(uploadBtn);
    expect(postCalls).toBe(1);

    resolveUpload!(
      new Response(JSON.stringify({ ...sampleAsset, id: "a-2" }), { status: 201 }),
    );
    await waitFor(() => {
      expect(within(region).getByRole("button", { name: /Загрузить снимок/i })).not.toBeDisabled();
    });
  });
});

// Stage 2E-C · Drag-and-drop upload.
describe("VisitImagingTab · API panel · drag-and-drop upload", () => {
  const sampleAsset = {
    id: "a-1",
    clinicId: "c-1",
    visitId: visit.id,
    lesionId: null,
    kind: "dermoscopy",
    source: "device_bridge",
    capturedAt: "2026-05-09T10:00:00Z",
    deviceId: null,
    qualityScore: 0.92,
    qualityIssues: [],
    createdAt: "2026-05-09T10:00:01Z",
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function getDropZone(region: HTMLElement) {
    return within(region).getByRole("button", {
      name: /Перетащите снимок сюда для загрузки/i,
    });
  }

  function makeDataTransfer(files: File[]) {
    return {
      files: Object.assign(files, {
        item: (i: number) => files[i] ?? null,
      }) as unknown as FileList,
      types: ["Files"],
      items: [],
    } as unknown as DataTransfer;
  }

  it("shows the drop target text and helper text", async () => {
    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    expect(within(region).getByText(/Перетащите снимок сюда/)).toBeInTheDocument();
    expect(within(region).getByText(/JPEG, PNG, WebP или HEIC/)).toBeInTheDocument();
  });

  it("drag over marks the drop target active", async () => {
    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    const zone = getDropZone(region);
    expect(zone.getAttribute("data-active")).toBe("false");
    fireEvent.dragOver(zone, { dataTransfer: makeDataTransfer([]) });
    expect(zone.getAttribute("data-active")).toBe("true");
  });

  it("dropping application/pdf shows client-side validation and does not POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    fetchMock.mockClear();

    const zone = getDropZone(region);
    fireEvent.drop(zone, {
      dataTransfer: makeDataTransfer([
        new File(["x"], "doc.pdf", { type: "application/pdf" }),
      ]),
    });

    await waitFor(() => {
      expect(within(region).getByRole("status")).toHaveTextContent(
        /Выберите файл изображения/,
      );
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dropping image/heic uploads normally and shows pending status", async () => {
    let resolveUpload: ((res: Response) => void) | null = null;
    const uploadPromise = new Promise<Response>((r) => {
      resolveUpload = r;
    });
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") return uploadPromise;
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const zone = getDropZone(region);
    fireEvent.drop(zone, {
      dataTransfer: makeDataTransfer([
        new File(["x"], "lesion.heic", { type: "image/heic" }),
      ]),
    });

    await waitFor(() => {
      expect(within(region).getByRole("status")).toHaveTextContent(
        /Загружаем: lesion\.heic/,
      );
    });
    resolveUpload!(
      new Response(JSON.stringify({ ...sampleAsset, id: "a-2" }), { status: 201 }),
    );
    await waitFor(() => {
      expect(within(region).getByRole("status")).toHaveTextContent(/Снимок загружен\./);
    });
  });

  it("dropping multiple valid images uploads only the first file", async () => {
    let postCalls = 0;
    const uploadedNames: string[] = [];
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") {
        postCalls += 1;
        const fd = (init?.body as FormData) ?? null;
        const f = fd?.get("file") as File | null;
        if (f) uploadedNames.push(f.name);
        return Promise.resolve(
          new Response(JSON.stringify({ ...sampleAsset, id: `a-${postCalls}` }), {
            status: 201,
          }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const zone = getDropZone(region);
    fireEvent.drop(zone, {
      dataTransfer: makeDataTransfer([
        new File(["a"], "first.png", { type: "image/png" }),
        new File(["b"], "second.png", { type: "image/png" }),
      ]),
    });

    await waitFor(() => {
      expect(within(region).getByRole("status")).toHaveTextContent(/Снимок загружен\./);
    });
    expect(postCalls).toBe(1);
    expect(uploadedNames).toEqual(["first.png"]);
  });

  it("dropping while upload is pending does not create a second POST", async () => {
    let resolveUpload: ((res: Response) => void) | null = null;
    const uploadPromise = new Promise<Response>((r) => {
      resolveUpload = r;
    });
    let postCalls = 0;
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") {
        postCalls += 1;
        return uploadPromise;
      }
      return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const zone = getDropZone(region);
    fireEvent.drop(zone, {
      dataTransfer: makeDataTransfer([
        new File(["a"], "first.png", { type: "image/png" }),
      ]),
    });
    await waitFor(() => {
      expect(within(region).getByRole("status")).toHaveTextContent(/Загружаем: first\.png/);
    });

    fireEvent.drop(zone, {
      dataTransfer: makeDataTransfer([
        new File(["b"], "second.png", { type: "image/png" }),
      ]),
    });
    // No second POST despite the drop.
    expect(postCalls).toBe(1);
    expect(within(region).getByRole("status")).toHaveTextContent(/Загружаем: first\.png/);

    resolveUpload!(
      new Response(JSON.stringify({ ...sampleAsset, id: "a-2" }), { status: 201 }),
    );
    await waitFor(() => {
      expect(within(region).getByRole("status")).toHaveTextContent(/Снимок загружен\./);
    });
    expect(postCalls).toBe(1);
  });

  it("upload failure from drop keeps existing asset row visible and shows mapped upload error", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "POST") {
        return Promise.resolve(
          new Response(JSON.stringify({ message: "invalid" }), { status: 422 }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify([sampleAsset]), { status: 200 }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    renderTab({ apiToken: "t", apiBaseUrl: "https://x.supabase.co" });
    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await within(region).findByRole("button", { name: /Открыть снимок a-1/i });

    const zone = getDropZone(region);
    fireEvent.drop(zone, {
      dataTransfer: makeDataTransfer([
        new File(["x"], "lesion.png", { type: "image/png" }),
      ]),
    });

    await waitFor(() => {
      expect(within(region).getByRole("alert")).toHaveTextContent(
        /Проверьте файл и параметры снимка\./,
      );
    });
    expect(
      within(region).getByRole("button", { name: /Открыть снимок a-1/i }),
    ).toBeInTheDocument();
  });
});
