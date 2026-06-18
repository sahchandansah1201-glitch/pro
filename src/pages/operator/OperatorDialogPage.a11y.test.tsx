import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import OperatorDialogPage from "./OperatorDialogPage";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/operator/dialogs/:id" element={<OperatorDialogPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("OperatorDialogPage a11y", () => {
  it("имеет единственный h1 с названием обращения", () => {
    renderAt("/operator/dialogs/bd-001");
    const h1s = screen.getAllByRole("heading", { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(/Обращение 001/);
  });

  it("кнопка отключённой передачи записи имеет disabled-состояние, доступное скринридерам", () => {
    renderAt("/operator/dialogs/bd-001");
    const btn = screen.getByRole("button", { name: /Передача записи отключена/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("disabled");
  });

  it("ссылка 'К очереди' имеет role=link и href", () => {
    renderAt("/operator/dialogs/bd-001");
    const links = screen.getAllByRole("link", { name: /К очереди/ });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/operator");
  });

  it("все интерактивные кнопки доступны клавишно (tabIndex >= 0)", () => {
    renderAt("/operator/dialogs/bd-001");
    const buttons = screen.getAllByRole("button");
    for (const b of buttons) {
      const ti = b.getAttribute("tabindex");
      expect(ti === null || Number(ti) >= 0).toBe(true);
    }
  });

  it("Tab последовательно фокусирует кнопки учебных действий", async () => {
    const user = userEvent.setup();
    renderAt("/operator/dialogs/bd-001");
    const take = screen.getByRole("button", { name: /^Взять в работу$/ });
    take.focus();
    expect(document.activeElement).toBe(take);
    await user.tab();
    const escalate = screen.getByRole("button", { name: /Передать врачу/ });
    expect(document.activeElement).toBe(escalate);
  });

  it("fallback по неизвестному id содержит h1 'Диалог не найден' и навигацию", () => {
    renderAt("/operator/dialogs/unknown-zzz");
    expect(screen.getByRole("heading", { level: 1, name: /Диалог не найден/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /К очереди/ })).toBeInTheDocument();
  });
});
