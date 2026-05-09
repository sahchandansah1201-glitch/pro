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
});

