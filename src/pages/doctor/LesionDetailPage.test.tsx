import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LESION_COMPARISON_DRAFTS_STORAGE_KEY } from "@/lib/lesion-comparison-drafts";
import {
  SELF_HOSTED_API_BASE_URL_KEY,
  SELF_HOSTED_API_TOKEN_KEY,
} from "@/lib/self-hosted-api-session";
import LesionDetailPage from "./LesionDetailPage";

const j = (...p: string[]) => p.join("");
const FORBIDDEN = [
  j("doctor", "Version", "Text"),
  j("patient", "Safe", "Text"),
  j("shared", "Link"),
  j("storage", "Path"),
  j("photo", "Ref"),
  j("model", "Version"),
  j("heatmap", "Ref"),
  j("external", "User", "Ref"),
  j("protected", "Analysis", "Link"),
];

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/patients/:id/lesions/:lesionId" element={<LesionDetailPage />} />
        <Route path="*" element={<div>fallback</div>} />
      </Routes>
    </MemoryRouter>,
  );

const selectComparePair = (...imageIds: string[]) => {
  for (const imageId of imageIds) {
    const row = screen.getByText(imageId).closest("li");
    if (!row) throw new Error(`Image row not found: ${imageId}`);
    fireEvent.click(within(row).getByRole("button", { name: /Сравнить/ }));
  }
};

describe("LesionDetailPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("p-004/l-008: показывает образование, снимки и ссылку на визит", () => {
    renderAt("/patients/p-004/lesions/l-008");
    expect(screen.getByText(/Очаг B/)).toBeInTheDocument();
    // Текущий визит содержит пару i-011/i-012; Batch AV добавляет предыдущий визит.
    expect(screen.getByText("i-011")).toBeInTheDocument();
    expect(screen.getByText("i-012")).toBeInTheDocument();
    // оценка a-005
    expect(screen.getByText("a-005")).toBeInTheDocument();
    // ссылка на визит
    const link = screen.getAllByRole("link", { name: /визит/i }).find((a) =>
      a.getAttribute("href")?.includes("/patients/p-004/visits/v-005"),
    );
    expect(link).toBeTruthy();
    expect(screen.queryByText(/таймлайн снимков, сравнение/i)).toBeNull();
  });

  it("shows a longitudinal lesion history across visits with technical comparison boundaries", () => {
    renderAt("/patients/p-004/lesions/l-008");

    const history = screen.getByRole("region", { name: /Продольная история очага/ });
    expect(within(history).getByText(/Визитов с фото: 2/)).toBeInTheDocument();
    expect(within(history).getByText(/Снимков: 4/)).toBeInTheDocument();
    expect(within(history).getByText(/Сопоставимых пар: 1/)).toBeInTheDocument();
    expect(within(history).getByText(/Ограничений: 1/)).toBeInTheDocument();
    expect(within(history).getByText(/v-011/)).toBeInTheDocument();
    expect(within(history).getByText(/v-005/)).toBeInTheDocument();
    expect(within(history).getByText(/i-021 → i-011/)).toBeInTheDocument();
    expect(within(history).getByText(/i-022 → i-012/)).toBeInTheDocument();
    expect(within(history).getByText(/Сопоставимо с предупреждением/)).toBeInTheDocument();
    expect(within(history).getByText(/Не сопоставимо/)).toBeInTheDocument();
    expect(within(history).getByText(/Не является оценкой динамики или клиническим выводом/)).toBeInTheDocument();
    expect(history.textContent ?? "").not.toMatch(
      /storagePath|photoRef|heatmapRef|modelVersion|sharedLink|token|session|меланома|рак кожи|вероятность/i,
    );
  });

  it("p-004/l-007: снимок есть, но структурированной оценки нет", () => {
    renderAt("/patients/p-004/lesions/l-007");
    expect(screen.getByText(/Послеоперационная зона/)).toBeInTheDocument();
    expect(screen.getByText("i-010")).toBeInTheDocument();
    expect(
      screen.getByText(/Структурированная оценка не зафиксирована/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Оценок по образованию пока нет/)).toBeInTheDocument();
  });

  it("неизвестный lesionId — безопасный not-found", () => {
    renderAt("/patients/p-004/lesions/l-zzz");
    expect(screen.getByText(/Образование не найдено/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /К карточке пациента/i }),
    ).toBeInTheDocument();
  });

  it("неизвестный пациент — not-found", () => {
    renderAt("/patients/p-zzz/lesions/l-008");
    expect(screen.getByText(/Пациент не найден/)).toBeInTheDocument();
  });

  it("кнопки демо-действий меняют только локальное состояние", () => {
    renderAt("/patients/p-004/lesions/l-008");
    const row = screen.getByText("i-011").closest("li")!;
    const openBtn = within(row).getByRole("button", { name: /Открыть снимок/ });
    fireEvent.click(openBtn);
    expect(openBtn).toHaveAttribute("aria-pressed", "true");
    expect(within(row).getByText(/Открыт в просмотрщике/)).toBeInTheDocument();

    const compareBtn = within(row).getByRole("button", { name: /Сравнить/ });
    fireEvent.click(compareBtn);
    expect(compareBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("показывает stable lesion ID, date strip и предупреждение о несопоставимых снимках", () => {
    renderAt("/patients/p-004/lesions/l-008");

    expect(screen.getByText(/ID очага/)).toBeInTheDocument();
    expect(screen.getByText("l-008")).toBeInTheDocument();
    expect(screen.getByText(/Лента дат очага/)).toBeInTheDocument();
    expect(screen.getAllByText(/d-003/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/без устройства/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/С предупреждением/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Нужен переснимок/).length).toBeGreaterThan(0);

    selectComparePair("i-011", "i-012");

    expect(screen.getByText(/Сравнение по датам/)).toBeInTheDocument();
    expect(screen.getByText(/условия съёмки не сопоставимы/i)).toBeInTheDocument();
  });

  it("shows a richer Comparison Matrix with capture-condition differences and safety boundary", () => {
    renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");

    const matrix = screen.getByRole("table", { name: /Матрица сравнения/ });
    expect(within(matrix).getByText(/Снимок A/)).toBeInTheDocument();
    expect(within(matrix).getByText(/Снимок B/)).toBeInTheDocument();
    expect(within(matrix).getByText("i-011")).toBeInTheDocument();
    expect(within(matrix).getByText("i-012")).toBeInTheDocument();
    expect(within(matrix).getByText(/Дата/)).toBeInTheDocument();
    expect(within(matrix).getByText(/Тип снимка/)).toBeInTheDocument();
    expect(within(matrix).getByText(/Источник/)).toBeInTheDocument();
    expect(within(matrix).getByText(/Устройство/)).toBeInTheDocument();
    expect(within(matrix).getByText(/Качество/)).toBeInTheDocument();
    expect(within(matrix).getByText(/Сопоставимость/)).toBeInTheDocument();
    expect(within(matrix).getByText(/Разные условия съёмки/)).toBeInTheDocument();
    expect(screen.getByText(/Нельзя оценивать динамику без врачебной проверки/i)).toBeInTheDocument();
  });

  it("turns a non-comparable image pair into doctor actions without unsafe copy", () => {
    renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");

    const review = screen.getByRole("region", { name: /Рабочий разбор пары/ });
    expect(within(review).getByText(/Техническая сопоставимость/)).toBeInTheDocument();
    expect(within(review).getAllByText(/Не сопоставимо/).length).toBeGreaterThan(0);
    expect(within(review).getByText(/Разные условия съёмки/)).toBeInTheDocument();
    expect(within(review).getByText(/Есть технические замечания/)).toBeInTheDocument();
    expect(within(review).getByText(/Не оценивайте динамику/i)).toBeInTheDocument();

    fireEvent.click(within(review).getByRole("button", { name: /Запросить переснимок/ }));
    expect(within(review).getAllByText(/Переснимок запрошен/).length).toBeGreaterThan(0);

    fireEvent.click(within(review).getByRole("button", { name: /Исключить из сравнения/ }));
    expect(within(review).getAllByText(/Пара исключена из сравнения/).length).toBeGreaterThan(0);

    fireEvent.click(within(review).getByRole("button", { name: /Добавить ограничение в отчёт/ }));
    expect(within(review).getAllByText(/Ограничение добавлено в черновик отчёта/).length).toBeGreaterThan(0);

    expect(review.textContent ?? "").not.toMatch(/меланома|рак кожи|вероятность меланомы|token|storage/i);
  });

  it("opens a full-screen comparison view for the selected pair", () => {
    renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");

    fireEvent.click(screen.getByRole("button", { name: /Открыть полноэкранное сравнение/ }));

    const dialog = screen.getByRole("dialog", { name: /Полноэкранное сравнение/ });
    expect(within(dialog).getByText(/Снимок A/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Снимок B/)).toBeInTheDocument();
    expect(within(dialog).getByText("i-011")).toBeInTheDocument();
    expect(within(dialog).getByText("i-012")).toBeInTheDocument();
    expect(within(dialog).getByText(/Условия съёмки/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Техническая сопоставимость/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Не сопоставимо/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Не оценивайте динамику/)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: /Запросить переснимок/ }));
    expect(within(dialog).getByText(/Переснимок запрошен/)).toBeInTheDocument();

    expect(dialog.textContent ?? "").not.toMatch(/меланома|рак кожи|вероятность меланомы|token|storage/i);
  });

  it("supports local zoom, pan and technical annotation in full-screen comparison without patient delivery", () => {
    renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");

    fireEvent.click(screen.getByRole("button", { name: /Открыть полноэкранное сравнение/ }));

    const dialog = screen.getByRole("dialog", { name: /Полноэкранное сравнение/ });
    const tools = within(dialog).getByRole("region", { name: /Инструменты просмотра/ });
    expect(within(tools).getByText(/Масштаб 100%/)).toBeInTheDocument();
    expect(within(tools).getByText(/Смещение x0 \/ y0/)).toBeInTheDocument();
    expect(within(tools).getByText(/Измерения отключены/)).toBeInTheDocument();

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
    expect(within(tools).getByText(/Выдача пациенту: выключена/)).toBeInTheDocument();

    expect(dialog.textContent ?? "").not.toMatch(
      /меланома|рак кожи|вероятность меланомы|лечение|token|storage|signedUrl|photoRef|modelVersion/i,
    );
  });

  it("persists a structured doctor comparison draft without patient delivery", () => {
    const { unmount } = renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");

    const review = screen.getByRole("region", { name: /Рабочий разбор пары/ });
    fireEvent.click(within(review).getByRole("button", { name: /Запросить переснимок/ }));
    fireEvent.click(within(review).getByRole("button", { name: /Сохранить черновик решения/ }));

    expect(within(review).getByText(/Черновик решения сохранён/)).toBeInTheDocument();
    expect(within(review).getByText(/Выдача пациенту: выключена/)).toBeInTheDocument();
    expect(window.localStorage.getItem(LESION_COMPARISON_DRAFTS_STORAGE_KEY)).toContain("retake");
    expect(window.localStorage.getItem(LESION_COMPARISON_DRAFTS_STORAGE_KEY) ?? "").not.toMatch(
      /storagePath|photoRef|heatmapRef|modelVersion|sharedLink|token|session|меланома|рак кожи/i,
    );

    unmount();
    renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");

    const restoredReview = screen.getByRole("region", { name: /Рабочий разбор пары/ });
    expect(within(restoredReview).getByText(/Черновик решения загружен/)).toBeInTheDocument();
    expect(within(restoredReview).getAllByText(/Переснимок запрошен/).length).toBeGreaterThan(0);
    expect(within(restoredReview).getByText(/Выдача пациенту: выключена/)).toBeInTheDocument();
  });

  it("saves the comparison draft to self-hosted backend when the doctor session is configured", async () => {
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:3001");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt");
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          item: {
            id: "draft-1",
            visitId: "v-005",
            lesionId: "l-008",
            pairKey: "l-008:i-011+i-012",
            imageIds: ["i-011", "i-012"],
            action: "retake",
            comparability: "not_comparable",
            reasons: ["Разные условия съёмки"],
            patientDeliveryAllowed: false,
            protectedFieldsExposed: false,
            savedAt: "2026-06-02T00:00:00.000Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderAt("/patients/p-004/lesions/l-008");

    selectComparePair("i-011", "i-012");

    const review = screen.getByRole("region", { name: /Рабочий разбор пары/ });
    fireEvent.click(within(review).getByRole("button", { name: /Запросить переснимок/ }));
    fireEvent.click(within(review).getByRole("button", { name: /Сохранить черновик решения/ }));

    expect(await within(review).findByText(/Backend audit сохранён/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/v-005/lesion-comparison-draft",
      expect.objectContaining({ method: "PATCH" }),
    );
    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(JSON.stringify(requestInit)).not.toMatch(
      /storagePath|photoRef|heatmapRef|modelVersion|sharedLink|token|session|меланома|рак кожи/i,
    );
  });

  it("links the lesion to the full Body Map in the source visit", () => {
    renderAt("/patients/p-004/lesions/l-008");

    const bodyMapLink = screen.getByRole("link", { name: /Открыть на карте тела/ });
    expect(bodyMapLink).toHaveAttribute(
      "href",
      "/patients/p-004/visits/v-005?tab=bodymap&lesion=l-008",
    );
  });

  it("в DOM нет запрещённых токенов", () => {
    const { container } = renderAt("/patients/p-004/lesions/l-008");
    const html = container.innerHTML;
    for (const t of FORBIDDEN) {
      expect(html, `forbidden token ${t}`).not.toContain(t);
    }
    expect(html).not.toMatch(/mock:\/\//);
  });
});
