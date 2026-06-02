import { beforeEach, describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LESION_COMPARISON_DRAFTS_STORAGE_KEY } from "@/lib/lesion-comparison-drafts";
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

describe("LesionDetailPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("p-004/l-008: показывает образование, снимки и ссылку на визит", () => {
    renderAt("/patients/p-004/lesions/l-008");
    expect(screen.getByText(/Очаг B/)).toBeInTheDocument();
    // три снимка в визите v-005? l-008 имеет 2 снимка (i-011, i-012).
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
    expect(screen.getByText(/без устройства/)).toBeInTheDocument();
    expect(screen.getByText(/С предупреждением/)).toBeInTheDocument();
    expect(screen.getByText(/Нужен переснимок/)).toBeInTheDocument();

    const compareButtons = screen.getAllByRole("button", { name: /Сравнить/ });
    fireEvent.click(compareButtons[0]);
    fireEvent.click(compareButtons[1]);

    expect(screen.getByText(/Сравнение по датам/)).toBeInTheDocument();
    expect(screen.getByText(/условия съёмки не сопоставимы/i)).toBeInTheDocument();
  });

  it("shows a richer Comparison Matrix with capture-condition differences and safety boundary", () => {
    renderAt("/patients/p-004/lesions/l-008");

    const compareButtons = screen.getAllByRole("button", { name: /Сравнить/ });
    fireEvent.click(compareButtons[0]);
    fireEvent.click(compareButtons[1]);

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

    const compareButtons = screen.getAllByRole("button", { name: /Сравнить/ });
    fireEvent.click(compareButtons[0]);
    fireEvent.click(compareButtons[1]);

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

    const compareButtons = screen.getAllByRole("button", { name: /Сравнить/ });
    fireEvent.click(compareButtons[0]);
    fireEvent.click(compareButtons[1]);

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

  it("persists a structured doctor comparison draft without patient delivery", () => {
    const { unmount } = renderAt("/patients/p-004/lesions/l-008");

    const compareButtons = screen.getAllByRole("button", { name: /Сравнить/ });
    fireEvent.click(compareButtons[0]);
    fireEvent.click(compareButtons[1]);

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

    const restoredCompareButtons = screen.getAllByRole("button", { name: /Сравнить/ });
    fireEvent.click(restoredCompareButtons[0]);
    fireEvent.click(restoredCompareButtons[1]);

    const restoredReview = screen.getByRole("region", { name: /Рабочий разбор пары/ });
    expect(within(restoredReview).getByText(/Черновик решения загружен/)).toBeInTheDocument();
    expect(within(restoredReview).getAllByText(/Переснимок запрошен/).length).toBeGreaterThan(0);
    expect(within(restoredReview).getByText(/Выдача пациенту: выключена/)).toBeInTheDocument();
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
