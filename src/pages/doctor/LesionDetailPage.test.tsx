import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
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
