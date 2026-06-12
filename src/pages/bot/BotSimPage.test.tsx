import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BotSimPage from "./BotSimPage";
import { ANALYSIS_CARDS, getDialogs, getLeads } from "@/lib/mock-data";

beforeAll(() => {
  // jsdom не реализует Element.scrollTo
  if (!Element.prototype.scrollTo) {
    Object.defineProperty(Element.prototype, "scrollTo", {
      value: () => {},
      writable: true,
    });
  }
});

const j = (...p: string[]) => p.join("");
const FORBIDDEN = [
  j("doctor", "Version", "Text"),
  j("patient", "Safe", "Text"),
  j("model", "Version"),
  j("heatmap", "Ref"),
  j("photo", "Ref"),
  j("storage", "Path"),
  j("shared", "Link"),
  j("diag", "nosis"),
  j("external", "User", "Ref"),
];

const FORBIDDEN_VISIBLE =
  /\b(MVP|AI|XAI|Demo|demo|backend|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|governance|readiness|Mini App|Telegram|Lead ID|lead|quality gate|CTA)\b|демо|бэкенд|лид/i;

const renderPage = () =>
  render(
    <MemoryRouter>
      <BotSimPage />
    </MemoryRouter>,
  );

describe("BotSimPage", () => {
  it("рендерит симулятор и стартовое сообщение бота", () => {
    const { container } = renderPage();
    expect(screen.getByText(/Помощник записи/)).toBeInTheDocument();
    expect(screen.getByText(/помогу подготовить фото/)).toBeInTheDocument();
    for (const t of FORBIDDEN) expect(container.innerHTML).not.toContain(t);
    expect(container.textContent ?? "").not.toMatch(FORBIDDEN_VISIBLE);
  });

  it("проводит локальный сценарий: новое фото → инструкция → фото → подсказка", () => {
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Новое фото/ })[0]);
    fireEvent.click(
      screen.getByRole("button", { name: /Сымитировать отправку фото/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Показать подсказку/ }));
    expect(screen.getByText(/Безопасная подсказка/)).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(FORBIDDEN_VISIBLE);
  });

  it("не мутирует глобальные mock-данные", () => {
    const beforeDialogs = getDialogs().length;
    const beforeLeads = getLeads().length;
    const beforeCards = ANALYSIS_CARDS.length;
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Новое фото/ })[0]);
    fireEvent.click(
      screen.getByRole("button", { name: /Сымитировать отправку фото/ }),
    );
    expect(getDialogs().length).toBe(beforeDialogs);
    expect(getLeads().length).toBe(beforeLeads);
    expect(ANALYSIS_CARDS.length).toBe(beforeCards);
  });
});
