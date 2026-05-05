import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BotSimPage from "./BotSimPage";
import { ANALYSIS_CARDS, getDialogs, getLeads } from "@/lib/mock-data";

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

const renderPage = () =>
  render(
    <MemoryRouter>
      <BotSimPage />
    </MemoryRouter>,
  );

describe("BotSimPage", () => {
  it("рендерит симулятор и стартовое сообщение бота", () => {
    const { container } = renderPage();
    expect(screen.getByText(/Дерматолог Про Bot/)).toBeInTheDocument();
    expect(screen.getByText(/помогу подготовить фото/)).toBeInTheDocument();
    for (const t of FORBIDDEN) expect(container.innerHTML).not.toContain(t);
  });

  it("проводит локальный сценарий: Новый анализ → инструкция → фото → рекомендация", () => {
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Новый анализ/ })[0]);
    fireEvent.click(
      screen.getByRole("button", { name: /Сымитировать отправку фото/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Показать рекомендацию/ }));
    expect(screen.getByText(/Безопасная рекомендация/)).toBeInTheDocument();
  });

  it("не мутирует глобальные mock-данные", () => {
    const beforeDialogs = getDialogs().length;
    const beforeLeads = getLeads().length;
    const beforeCards = ANALYSIS_CARDS.length;
    renderPage();
    fireEvent.click(screen.getAllByRole("button", { name: /Новый анализ/ })[0]);
    fireEvent.click(
      screen.getByRole("button", { name: /Сымитировать отправку фото/ }),
    );
    expect(getDialogs().length).toBe(beforeDialogs);
    expect(getLeads().length).toBe(beforeLeads);
    expect(ANALYSIS_CARDS.length).toBe(beforeCards);
  });
});
