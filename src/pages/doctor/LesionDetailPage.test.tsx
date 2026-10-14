import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { SELF_HOSTED_API_BASE_URL_KEY, SELF_HOSTED_API_TOKEN_KEY, writeSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import LesionDetailPage from "./LesionDetailPage";
import { LESION_COMPARISON_DRAFTS_STORAGE_KEY } from "@/lib/lesion-comparison-drafts";

const patientId = "a1111111-1111-4111-8111-111111111111";
const lesionId = "a2222222-2222-4222-8222-222222222222";
const previousImageId = "a3333333-3333-4333-8333-333333333333";
const currentImageId = "a4444444-4444-4444-8444-444444444444";
const visitId = "a7777777-7777-4777-8777-777777777777";
const route = `/patients/${patientId}/lesions/${lesionId}`;
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});
function writeSession(token = "synthetic-lesion-token") {
  writeSelfHostedApiSession({ apiBaseUrl: "http://localhost:3001", apiToken: token,
    user: { id: token, displayName: "Тестовый врач", roles: ["doctor"] } });
}
function history(label = "Контрольный очаг") {
  return {
    clinicId: "a5555555-5555-4555-8555-555555555555", patientId, lesionId,
    label, bodyZone: "Кисть правой руки", bodySurface: "front", status: "monitoring",
    summary: { visitCount: 2, imageCount: 2, candidatePairCount: 1, comparablePairCount: 1, warningPairCount: 0, blockedPairCount: 0, assessmentCount: 0 },
    visits: [
      { visitId: "a6666666-6666-4666-8666-666666666666", startedAt: "2026-08-01T08:00:00Z", status: "signed", signedAt: "2026-08-01T09:00:00Z", imageCount: 1 },
      { visitId, startedAt: "2026-09-01T08:00:00Z", status: "in_progress", signedAt: null, imageCount: 1 },
    ],
    images: [
      { id: previousImageId, visitId: "a6666666-6666-4666-8666-666666666666", kind: "dermoscopy", capturedAt: "2026-08-01T08:20:00Z" },
      { id: currentImageId, visitId, kind: "dermoscopy", capturedAt: "2026-09-01T08:20:00Z" },
    ],
    candidatePairs: [{ previousVisitId: "a6666666-6666-4666-8666-666666666666", currentVisitId: visitId,
      previousImageId, currentImageId, kind: "dermoscopy", status: "ready", reasons: [] }],
    boundaries: {},
  };
}
function liveResponse(input: RequestInfo | URL, label = "Контрольный очаг") {
  const url = String(input);
  if (url.endsWith("/longitudinal-history")) return jsonResponse({ item: history(label) });
  if (url.endsWith(`/patients/${patientId}`)) return jsonResponse({ item: {
    id: patientId, code: "TEST-001", fullName: "Тестовый пациент", birthDate: "1985-04-10",
    sex: "female", phototype: "II", imagingConsent: true, createdAt: "2026-09-01T08:00:00Z",
  } });
  return jsonResponse({ error: { code: "not_found" } }, 404);
}
function RouteActions() {
  const navigate = useNavigate();
  return <button onClick={() => navigate("/patients/p-004/lesions/l-008")}>Неверная ссылка</button>;
}
const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><RouteActions /><Routes>
  <Route path="/patients/:id/lesions/:lesionId" element={<LesionDetailPage />} />
  <Route path="*" element={<div>fallback</div>} />
</Routes></MemoryRouter>);
const selectComparePair = (...imageIds: string[]) => {
  for (const id of imageIds) {
    const row = document.querySelector<HTMLElement>(`[data-image-id="${id}"]`);
    if (!row) throw new Error("Image row not found");
    fireEvent.click(within(row).getByRole("button", { name: /Сравнить/ }));
  }
};
async function renderLive(handler?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response) {
  writeSession();
  const fetchMock = vi.fn(handler ?? ((input) => liveResponse(input)));
  vi.stubGlobal("fetch", fetchMock);
  const rendered = renderAt(route);
  await screen.findByText(/Контрольный очаг/);
  return { ...rendered, fetchMock };
}
async function openComparison(handler?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> | Response) {
  const rendered = await renderLive(handler);
  selectComparePair(previousImageId, currentImageId);
  fireEvent.click(screen.getByRole("button", { name: /Открыть полноэкранное сравнение/ }));
  return { ...rendered, dialog: screen.getByRole("dialog", { name: /Полноэкранное сравнение/ }) };
}
beforeEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); window.localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("LesionDetailPage", () => {
  it("stops a pending QA review chain before a second write after the account changes", async () => {
    let finishSave: () => void = () => {};
    const pending = new Promise<void>((resolve) => { finishSave = resolve; });
    const { dialog, fetchMock } = await openComparison(async (input, init) => {
      if (init?.method === "PATCH") {
        await pending;
        return jsonResponse({ item: { ...JSON.parse(String(init.body)), id: "synthetic-qa", visitId } });
      }
      return liveResponse(input);
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Нужен переснимок" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(1));
    await act(async () => { writeSession("synthetic-next-doctor"); });
    await screen.findByText(/Контрольный очаг/);
    await act(async () => { finishSave(); });
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(1);
    expect(screen.queryByText(/Технический разбор просмотра сохранён в системе клиники/)).not.toBeInTheDocument();
  });

  it("persists a recapture review only after saving technical QA through real endpoints", async () => {
    const { dialog, fetchMock } = await openComparison((input, init) => {
      if (init?.method === "PATCH") return jsonResponse({ item: {
        ...JSON.parse(String(init.body)), id: "synthetic-qa", visitId,
        review: { status: String(input).endsWith("/review") ? "needs_recapture" : "unreviewed", reasons: ["repeat_capture_required"] },
        patientDeliveryAllowed: false, medicalMeasurementAllowed: false, protectedFieldsExposed: false,
      } });
      return liveResponse(input);
    });
    const review = within(dialog).getByRole("region", { name: "Технический разбор просмотра" });
    fireEvent.click(within(review).getByRole("button", { name: "Нужен переснимок" }));
    await within(review).findByText(/Технический разбор просмотра сохранён в системе клиники/);
    const writes = fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
    expect(writes).toHaveLength(2);
    expect(String(writes[0][0])).toMatch(/\/lesion-comparison-viewer-qa$/);
    expect(String(writes[1][0])).toMatch(/\/lesion-comparison-viewer-qa\/review$/);
    expect(String(writes[1][1]?.body)).toContain("needs_recapture");
    expect(dialog).toHaveTextContent("Выдача пациенту: выключена");
  });

  it("retains a structured comparison draft for a real image pair without patient delivery", async () => {
    const handler = (input: RequestInfo | URL, init?: RequestInit) => init?.method === "PATCH"
      ? jsonResponse({ item: { ...JSON.parse(String(init.body)), id: "synthetic-draft", visitId, patientDeliveryAllowed: false, protectedFieldsExposed: false } }) : liveResponse(input);
    const { unmount } = await renderLive(handler);
    selectComparePair(previousImageId, currentImageId);
    const review = screen.getByRole("region", { name: "Рабочий разбор пары" });
    fireEvent.click(within(review).getByRole("button", { name: "Запросить переснимок" }));
    fireEvent.click(within(review).getByRole("button", { name: "Сохранить черновик решения" }));
    await within(review).findByText(/Журнал проверки сохранён в системе клиники/);
    expect(window.localStorage.getItem(LESION_COMPARISON_DRAFTS_STORAGE_KEY)).toContain("retake");
    expect(window.localStorage.getItem(LESION_COMPARISON_DRAFTS_STORAGE_KEY)).not.toMatch(/storagePath|signedUrl|patientSafeText/);
    unmount();
    await renderLive(handler);
    selectComparePair(previousImageId, currentImageId);
    expect(screen.getByRole("region", { name: "Рабочий разбор пары" })).toHaveTextContent("Черновик решения загружен");
  });

  it("hides the ready patient and image record immediately after navigation to a legacy ID", async () => {
    await renderLive();
    expect(document.querySelector("[data-image-id]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Неверная ссылка" }));
    expect(screen.getByText("Образование не найдено")).toBeInTheDocument();
    expect(screen.queryByText(/Контрольный очаг|Тестовый пациент/)).not.toBeInTheDocument();
    expect(document.querySelector("[data-image-id]")).toBeNull();
  });
  it("keeps calibration and reviewer approval blocked when real image metadata is unknown", async () => {
    const { dialog } = await openComparison();
    const calibration = within(dialog).getByRole("region", { name: "Калибровка просмотра" });
    expect(calibration).toHaveTextContent("Калибровка: не готова");
    expect(calibration).not.toHaveTextContent(/FotoFinder|2048×2048|3000×2000/);
    expect(within(dialog).getByText(/Измерения отключены/)).toBeInTheDocument();
    const review = within(dialog).getByRole("region", { name: "Технический разбор просмотра" });
    expect(within(review).getByRole("button", { name: "Технически готово" })).toBeDisabled();
    expect(dialog).toHaveTextContent("Выдача пациенту: выключена");
    expect(dialog).not.toHaveTextContent(/signedUrl|storagePath|меланома|рак кожи/);
  });

  it("loads protected previews only through the authenticated proxy and revokes their URLs", async () => {
    let count = 0;
    const createObjectURL = vi.fn(() => `blob:synthetic-preview-${++count}`);
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    const { dialog, unmount, fetchMock } = await openComparison((input) => String(input).endsWith("/render")
      ? new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } }) : liveResponse(input));
    fireEvent.click(within(dialog).getByRole("button", { name: "Подготовить защищённые превью" }));
    await within(dialog).findByText(/Защищённые превью загружены через систему клиники/);
    expect(within(dialog).getByAltText("Защищённый снимок A")).toHaveAttribute("src", "blob:synthetic-preview-1");
    const renderCalls = fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/render"));
    expect(renderCalls).toHaveLength(2);
    for (const [input, init] of renderCalls) {
      expect(String(input)).toContain(`/patients/${patientId}/lesions/${lesionId}/images/`);
      expect(init).toEqual(expect.objectContaining({ method: "GET", credentials: "include" }));
    }
    unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:synthetic-preview-1");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:synthetic-preview-2");
  });

  it("saves technical geometry and calibration restrictions through the real QA API contract", async () => {
    const { dialog, fetchMock } = await openComparison((input, init) => {
      if (init?.method === "PATCH") return jsonResponse({ item: { ...JSON.parse(String(init.body)), id: "synthetic-qa", visitId, patientDeliveryAllowed: false, protectedFieldsExposed: false } });
      return liveResponse(input);
    });
    const geometry = within(dialog).getByRole("region", { name: "Техническая геометрия" });
    fireEvent.click(within(geometry).getByRole("button", { name: "Поставить маркер A" }));
    const calibration = within(dialog).getByRole("region", { name: "Калибровка просмотра" });
    fireEvent.click(within(calibration).getByRole("button", { name: "Зафиксировать ограничение калибровки" }));
    await within(calibration).findByText(/Проверка просмотра сохранена в системе клиники/);
    const write = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(String(write?.[0])).toBe("http://localhost:3001/api/v1/visits/a6666666-6666-4666-8666-666666666666/lesion-comparison-viewer-qa");
    expect(String(write?.[1]?.body)).toContain("technicalMarkers");
    expect(String(write?.[1]?.body)).not.toMatch(/storagePath|signedUrl|patientSafeText/);
  });
  it.each([401, 403, 500])("shows a safe working error for HTTP %s without patient fixtures", async (status) => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { code: "unavailable", message: "internal-secret" } }, status)));
    renderAt(route);
    expect(await screen.findByText("Не удалось загрузить образование")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Очаг B|internal-secret|Новиков/);
    expect(document.querySelector("[data-image-id]")).toBeNull();
  });

  it("retries real patient and history APIs after network failure", async () => {
    writeSession();
    let failed = true;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => { if (failed) throw new Error("synthetic network failure"); return liveResponse(input); }));
    renderAt(route);
    await screen.findByText("Не удалось загрузить образование");
    failed = false;
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByText(/Контрольный очаг/)).toBeInTheDocument();
    expect(screen.queryByText(/Очаг B/)).not.toBeInTheDocument();
  });

  it("keeps a valid pending request empty and discards its result after navigation to an invalid ID", async () => {
    writeSession();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => { await gate; return liveResponse(input); }));
    renderAt(route);
    expect(screen.getByText("Загружаем карточку образования")).toBeInTheDocument();
    expect(document.querySelector("[data-image-id]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Неверная ссылка" }));
    expect(screen.getByText("Образование не найдено")).toBeInTheDocument();
    await act(async () => { release(); });
    expect(screen.queryByText(/Контрольный очаг|Тестовый пациент/)).not.toBeInTheDocument();
  });

  it.each([`/patients/${patientId}/lesions/l-008`, `/patients/p-004/lesions/${lesionId}`, "/patients/bad/lesions/bad"])("rejects malformed or mixed route %s without any lookup", (path) => {
    writeSession();
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    renderAt(path);
    expect(screen.getByText("Образование не найдено")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.querySelector("[data-image-id]")).toBeNull();
  });

  it("does not substitute an empty successful payload with a training record", async () => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ item: null })));
    renderAt(route);
    expect(await screen.findByText("Не удалось загрузить образование")).toBeInTheDocument();
    expect(document.querySelector("[data-image-id]")).toBeNull();
  });
  it("discards late protected previews after the working account changes", async () => {
    let resolveImages: (response: Response) => void = () => {};
    const pendingImages = new Promise<Response>((resolve) => { resolveImages = resolve; });
    const createObjectURL = vi.fn(() => "blob:synthetic-old-preview");
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const { dialog } = await openComparison((input) => String(input).endsWith("/render") ? pendingImages.then((r) => r.clone()) : liveResponse(input));
    fireEvent.click(within(dialog).getByRole("button", { name: "Подготовить защищённые превью" }));
    await act(async () => { writeSession("synthetic-other-account"); });
    await screen.findByText(/Контрольный очаг/);
    await act(async () => { resolveImages(new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "Content-Type": "image/png" } })); });
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(document.querySelector('img[src="blob:synthetic-old-preview"]')).toBeNull();
  });
  it("discards a late QA response after the working account changes on the same route", async () => {
    let resolveQa: (response: Response) => void = () => {};
    const pendingQa = new Promise<Response>((resolve) => { resolveQa = resolve; });
    await renderLive((input) => String(input).endsWith("/longitudinal-qa") ? pendingQa : liveResponse(input));
    fireEvent.click(screen.getByRole("button", { name: "Обновить рабочую проверку" }));
    expect(screen.getByText("Рабочая проверка обновляется из системы клиники.")).toBeInTheDocument();
    await act(async () => { writeSession("synthetic-other-account"); });
    await screen.findByText(/Контрольный очаг/);
    await act(async () => { resolveQa(jsonResponse({ item: {
      patientId, lesionId, blockers: [{ code: "old", label: "Старый результат проверки", count: 1, nextAction: "review" }],
    } })); });
    expect(screen.queryByText("Старый результат проверки")).not.toBeInTheDocument();
    expect(screen.queryByText("Рабочая проверка обновлена. Выдача пациенту: выключена.")).not.toBeInTheDocument();
  });
  it("rejects legacy training IDs without looking up a fixture or calling the backend", () => {
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "synthetic-lesion-token");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderAt("/patients/p-004/lesions/l-008");
    expect(screen.getByText("Образование не найдено")).toBeInTheDocument();
    expect(screen.queryByText(/Очаг B|Соколова|Новиков/)).not.toBeInTheDocument();
    expect(document.querySelector('[data-image-id="i-011"]')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });


  it("requires a working session for valid lesion IDs without showing patient data", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderAt("/patients/a1111111-1111-4111-8111-111111111111/lesions/a2222222-2222-4222-8222-222222222222");
    expect(screen.getByText("Войдите в систему клиники, чтобы открыть образование.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Войти в систему клиники" })).toHaveAttribute("href", "/self-hosted/login");
    expect(screen.queryByRole("button", { name: /Сравнить/ })).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });


  it("loads a real UUID lesion route from the clinic system and exposes its comparable pair", async () => {
    const patientId = "a1111111-1111-4111-8111-111111111111";
    const lesionId = "a2222222-2222-4222-8222-222222222222";
    const previousImageId = "a3333333-3333-4333-8333-333333333333";
    const currentImageId = "a4444444-4444-4444-8444-444444444444";
    const blockedPreviousImageId = "b3333333-3333-4333-8333-333333333333";
    const blockedCurrentImageId = "b4444444-4444-4444-8444-444444444444";
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:3001");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith(`/api/v1/patients/${patientId}`)) {
        return new Response(JSON.stringify({ item: {
          id: patientId,
          code: "TEST-001",
          fullName: "Тестовый пациент",
          birthDate: "1985-04-10",
          sex: "female",
          phototype: "II",
          imagingConsent: true,
          createdAt: "2026-09-01T08:00:00.000Z",
        } }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ item: {
        clinicId: "a5555555-5555-4555-8555-555555555555",
        patientId,
        lesionId,
        label: "Контрольный очаг",
        bodyZone: "Кисть правой руки",
        bodySurface: "front",
        status: "monitoring",
        summary: {
          visitCount: 2,
          imageCount: 4,
          candidatePairCount: 2,
          comparablePairCount: 1,
          warningPairCount: 0,
          blockedPairCount: 1,
          assessmentCount: 0,
        },
        visits: [
          {
            visitId: "a6666666-6666-4666-8666-666666666666",
            startedAt: "2026-08-01T08:00:00.000Z",
            signedAt: "2026-08-01T09:00:00.000Z",
            status: "signed",
            imageCount: 2,
            dermoscopyCount: 1,
            overviewCount: 1,
            assessmentCount: 0,
            capturedAtFirst: "2026-08-01T08:20:00.000Z",
            capturedAtLast: "2026-08-01T08:20:00.000Z",
          },
          {
            visitId: "a7777777-7777-4777-8777-777777777777",
            startedAt: "2026-09-01T08:00:00.000Z",
            signedAt: null,
            status: "in_progress",
            imageCount: 2,
            dermoscopyCount: 1,
            overviewCount: 1,
            assessmentCount: 0,
            capturedAtFirst: "2026-09-01T08:20:00.000Z",
            capturedAtLast: "2026-09-01T08:20:00.000Z",
          },
        ],
        images: [
          {
            id: previousImageId,
            visitId: "a6666666-6666-4666-8666-666666666666",
            kind: "dermoscopy",
            capturedAt: "2026-08-01T08:20:00.000Z",
          },
          {
            id: blockedPreviousImageId,
            visitId: "a6666666-6666-4666-8666-666666666666",
            kind: "overview_photo",
            capturedAt: "2026-08-01T08:25:00.000Z",
          },
          {
            id: currentImageId,
            visitId: "a7777777-7777-4777-8777-777777777777",
            kind: "dermoscopy",
            capturedAt: "2026-09-01T08:20:00.000Z",
          },
          {
            id: blockedCurrentImageId,
            visitId: "a7777777-7777-4777-8777-777777777777",
            kind: "overview_photo",
            capturedAt: "2026-09-01T08:25:00.000Z",
          },
        ],
        candidatePairs: [
          {
            previousVisitId: "a6666666-6666-4666-8666-666666666666",
            currentVisitId: "a7777777-7777-4777-8777-777777777777",
            previousImageId,
            currentImageId,
            kind: "dermoscopy",
            status: "ready",
            reasons: [],
          },
          {
            previousVisitId: "a6666666-6666-4666-8666-666666666666",
            currentVisitId: "a7777777-7777-4777-8777-777777777777",
            previousImageId: blockedPreviousImageId,
            currentImageId: blockedCurrentImageId,
            kind: "dermoscopy",
            status: "blocked",
            reasons: ["Нет подтверждённых условий съёмки"],
          },
        ],
        boundaries: {},
      } }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAt(`/patients/${patientId}/lesions/${lesionId}`);

    expect(await screen.findByText(/Контрольный очаг/)).toBeInTheDocument();
    await waitFor(() => {
      expect(document.querySelector(`[data-image-id="${previousImageId}"]`)).toBeTruthy();
      expect(document.querySelector(`[data-image-id="${currentImageId}"]`)).toBeTruthy();
    });
    expect(screen.getByRole("region", { name: /Продольная история очага/ }))
      .toHaveTextContent(/Сопоставимых пар: 0/);
    expect(screen.getByRole("region", { name: /Продольная история очага/ }))
      .toHaveTextContent(/Нужна техническая проверка/);
    const liveHistory = screen.getByRole("region", { name: /Продольная история очага/ });
    expect(liveHistory).toHaveTextContent(/Техническая оценка качества не выполнена/);
    expect(liveHistory).not.toHaveTextContent(/Качество ниже порога/);
    const liveQaGate = screen.getByRole("region", { name: /Готовность продольной проверки/ });
    expect(liveQaGate).toHaveTextContent(/Нужен технический разбор/);
    expect(liveQaGate).not.toHaveTextContent(/Нужен переснимок|Калибровка не готова|Не хватает технических маркеров/);
    expect(document.body).not.toHaveTextContent(/0×0/);
    const blockedPreviousRow = document.querySelector<HTMLElement>(`[data-image-id="${blockedPreviousImageId}"]`);
    const blockedCurrentRow = document.querySelector<HTMLElement>(`[data-image-id="${blockedCurrentImageId}"]`);
    expect(blockedPreviousRow).toBeTruthy();
    expect(blockedCurrentRow).toBeTruthy();
    expect(within(blockedPreviousRow!).getByRole("button", { name: "Нет пары для сравнения" })).toBeDisabled();
    expect(within(blockedCurrentRow!).getByRole("button", { name: "Нет пары для сравнения" })).toBeDisabled();
    expect(screen.getByText("Точная точка на карте тела не сохранена")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Открыть увеличенную карту тела" })).toBeNull();
    selectComparePair(previousImageId, currentImageId);
    const liveReview = screen.getByRole("region", { name: /Рабочий разбор пары/ });
    expect(document.body).toHaveTextContent(/Источник не указан/);
    expect(document.body).toHaveTextContent(/Устройство не указано/);
    expect(liveReview).toHaveTextContent(/Сначала выполните техническую оценку пары/);
    expect(liveReview).not.toHaveTextContent(
      /один источник|Источник совпадает|одно устройство|Устройство совпадает|или запросите переснимок/,
    );
    expect(document.body).toHaveTextContent(/Качество не оценено/);
    expect(document.body).not.toHaveTextContent(/Качество:\s*0%|без устройства/);
    expect(document.body.textContent ?? "").not.toMatch(/storagePath|signedUrl|rawToken/i);
  });


  it("fails closed when the clinic response belongs to another lesion route", async () => {
    const patientId = "c1111111-1111-4111-8111-111111111111";
    const lesionId = "c2222222-2222-4222-8222-222222222222";
    const otherLesionId = "c3333333-3333-4333-8333-333333333333";
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:3001");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith(`/api/v1/patients/${patientId}`)) {
        return new Response(JSON.stringify({ item: {
          id: patientId,
          code: "TEST-002",
          fullName: "Маршрутный пациент",
          birthDate: "1985-04-10",
          sex: "female",
          phototype: "II",
          imagingConsent: true,
          createdAt: "2026-09-01T08:00:00.000Z",
        } }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ item: {
        clinicId: "c5555555-5555-4555-8555-555555555555",
        patientId,
        lesionId: otherLesionId,
        label: "Чужая карточка",
        bodyZone: "Кисть правой руки",
        bodySurface: "front",
        status: "monitoring",
        summary: {
          visitCount: 0,
          imageCount: 0,
          candidatePairCount: 0,
          comparablePairCount: 0,
          warningPairCount: 0,
          blockedPairCount: 0,
          assessmentCount: 0,
        },
        visits: [],
        candidatePairs: [],
        boundaries: {},
      } }), { status: 200, headers: { "Content-Type": "application/json" } });
    }));

    renderAt(`/patients/${patientId}/lesions/${lesionId}`);

    expect(await screen.findByText(/Система клиники вернула данные другой карточки/)).toBeInTheDocument();
    expect(screen.queryByText("Маршрутный пациент")).toBeNull();
    expect(screen.queryByText("Чужая карточка")).toBeNull();
  });


  it("shows not-found for a missing working record without retrying a fixture lookup", async () => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: { code: "not_found" } }, 404)));
    renderAt(route);
    expect(await screen.findByText("Образование не найдено")).toBeInTheDocument();
    expect(screen.queryByText(/Очаг B|Тестовый пациент/)).not.toBeInTheDocument();
    expect(document.querySelector("[data-image-id]")).toBeNull();
  });
  it("supports local zoom, pan and technical annotation in full-screen comparison without patient delivery", async () => {
    await renderLive();

    selectComparePair(previousImageId, currentImageId);

    fireEvent.click(screen.getByRole("button", { name: /Открыть полноэкранное сравнение/ }));

    const dialog = screen.getByRole("dialog", { name: /Полноэкранное сравнение/ });
    const tools = within(dialog).getByRole("region", { name: /Инструменты просмотра/ });
    expect(within(tools).getByText(/Масштаб 100%/)).toBeInTheDocument();
    expect(within(tools).getByText(/Смещение x0 \/ y0/)).toBeInTheDocument();
    expect(within(tools).getByText(/Измерения отключены/)).toBeInTheDocument();
    expect(within(tools).getByText(/Защищённые превью врача/)).toBeInTheDocument();
    expect(within(tools).getByRole("button", { name: /Подготовить защищённые превью/ })).not.toBeDisabled();
    expect(within(tools).getByText(/вход настроен/)).toBeInTheDocument();

    fireEvent.click(within(tools).getByRole("button", { name: /Увеличить/ }));
    fireEvent.click(within(tools).getByRole("button", { name: /Сместить вправо/ }));
    expect(within(tools).getByText(/Масштаб 125%/)).toBeInTheDocument();
    expect(within(tools).getByText(/Смещение x\+12 \/ y0/)).toBeInTheDocument();

    fireEvent.click(within(tools).getByRole("button", { name: /Показать центр/ }));
    expect(within(tools).getByText(/Разметка: центр/)).toBeInTheDocument();

    const note = within(tools).getByLabelText(/Техническая заметка/);
    fireEvent.change(note, { target: { value: "Разный угол и мягкий фокус, нужна повторяемая съёмка." } });
    fireEvent.click(within(tools).getByRole("button", { name: /Зафиксировать техническую заметку/ }));
    expect(within(tools).getByText(/Техническая заметка зафиксирована локально/)).toBeInTheDocument();
    expect(within(tools).getAllByText(/Выдача пациенту: выключена/).length).toBeGreaterThan(0);

    expect(dialog.textContent ?? "").not.toMatch(
      /меланома|рак кожи|вероятность меланомы|лечение|token|storage|signedUrl|photoRef|modelVersion/i,
    );
  });

  it("supports normalized technical geometry markers without medical measurement", async () => {
    await renderLive();

    selectComparePair(previousImageId, currentImageId);
    fireEvent.click(screen.getByRole("button", { name: /Открыть полноэкранное сравнение/ }));

    const dialog = screen.getByRole("dialog", { name: /Полноэкранное сравнение/ });
    const tools = within(dialog).getByRole("region", { name: /Инструменты просмотра/ });
    const geometry = within(tools).getByRole("region", { name: /Техническая геометрия/ });

    expect(within(geometry).getByText(/Маркеры: 0\/2/)).toBeInTheDocument();
    expect(within(geometry).getByText(/Координаты нормализованы: проценты кадра/)).toBeInTheDocument();

    fireEvent.click(within(geometry).getByRole("button", { name: /Поставить маркер A/ }));
    fireEvent.click(within(geometry).getByRole("button", { name: /Поставить маркер B/ }));

    expect(within(geometry).getByText(/Маркеры: 2\/2/)).toBeInTheDocument();
    expect(within(geometry).getByText(/A x48 y52/)).toBeInTheDocument();
    expect(within(geometry).getByText(/B x52 y52/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Технический маркер A · x48 y52/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Технический маркер B · x52 y52/)).toBeInTheDocument();
    expect(within(geometry).getByText(/Не является медицинским измерением/)).toBeInTheDocument();
    expect(within(geometry).getByText(/Выдача пациенту: выключена/)).toBeInTheDocument();

    fireEvent.click(within(geometry).getByRole("button", { name: /Очистить маркеры/ }));
    expect(within(geometry).getByText(/Маркеры: 0\/2/)).toBeInTheDocument();

    expect(dialog.textContent ?? "").not.toMatch(
      /меланома|рак кожи|вероятность меланомы|лечение|token|storage|signedUrl|photoRef|modelVersion|patientSafeText/i,
    );
  });


});
