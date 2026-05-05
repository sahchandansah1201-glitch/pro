import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AnalysisPublicPage from "./AnalysisPublicPage";

// Демо-токены из mock-data:
// pal-tok-ac002-demo expires 2026-06-03 (после demo-now 2026-05-04) — валидна
// pal-tok-ac001-demo expires 2026-04-01 (до demo-now) — истекла
// "no-such-token" — не найдена
const VALID = "pal-tok-ac002-demo";
const EXPIRED = "pal-tok-ac001-demo";
const INVALID = "no-such-token";

const j = (...p: string[]) => p.join("");
const FORBIDDEN_RENDER = [
  j("patient", "Safe", "Text"),
  j("doctor", "Version", "Text"),
  j("photo", "Ref"),
  j("model", "Version"),
  j("heatmap", "Ref"),
  j("storage", "Path"),
  j("xai", "Notes"),
  j("uncertainty", "Notes"),
  j("suspected", "Features"),
  j("ABCD"),
  j("7-point"),
];

function renderAt(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/analysis/${token}`]}>
      <Routes>
        <Route path="/analysis/:token" element={<AnalysisPublicPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AnalysisPublicPage", () => {
  it("валидный токен: показывает безопасный контент и дисклеймер", () => {
    const { container } = renderAt(VALID);
    expect(
      screen.getByRole("heading", { level: 1, name: /Предварительная оценка/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/Не является диагнозом/i)).toBeInTheDocument();
    expect(
      screen.getByText(/AI не является диагнозом\. Окончательное решение принимает врач\./)
    ).toBeInTheDocument();
    expect(container.textContent || "").not.toContain(VALID);
  });

  it("валидный токен: рендер не содержит запрещённых внутренних токенов", () => {
    const { container } = renderAt(VALID);
    const html = container.innerHTML;
    for (const t of FORBIDDEN_RENDER) {
      expect(html.includes(t), `rendered html contains ${t}`).toBe(false);
    }
  });

  it("истёкший токен: показывает «Ссылка истекла» и не раскрывает токен", () => {
    const { container } = renderAt(EXPIRED);
    expect(
      screen.getByRole("heading", { level: 1, name: /Ссылка истекла/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Предварительная оценка/i)).toBeNull();
    expect(container.textContent || "").not.toContain(EXPIRED);
  });

  it("неизвестный токен: показывает «Ссылка не найдена» и не раскрывает токен", () => {
    const { container } = renderAt(INVALID);
    expect(
      screen.getByRole("heading", { level: 1, name: /Ссылка не найдена/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Предварительная оценка/i)).toBeNull();
    expect(container.textContent || "").not.toContain(INVALID);
  });

  it("действия: «Скачать PDF (демо)» и «Связаться с клиникой (демо)» disabled", () => {
    renderAt(VALID);
    const pdf = screen.getByRole("button", { name: /Скачать PDF \(демо\)/i });
    const contact = screen.getByRole("button", {
      name: /Связаться с клиникой \(демо\)/i,
    });
    expect(pdf).toBeDisabled();
    expect(contact).toBeDisabled();
    expect(pdf).toHaveAttribute("aria-disabled", "true");
    expect(contact).toHaveAttribute("aria-disabled", "true");
  });
});
