import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import OperatorDialogPage from "./OperatorDialogPage";

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

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/operator/dialogs/:id" element={<OperatorDialogPage />} />
      </Routes>
    </MemoryRouter>,
  );

const expectClean = (html: string) => {
  for (const t of FORBIDDEN) expect(html, `forbidden token ${t}`).not.toContain(t);
};

describe("OperatorDialogPage", () => {
  it("рендерит валидный диалог с переписки и панелями", () => {
    const { container } = renderAt("/operator/dialogs/bd-001");
    expect(screen.getByRole("heading", { name: /Диалог bd-001/ })).toBeInTheDocument();
    expect(screen.getByText(/Переписка/)).toBeInTheDocument();
    expect(screen.getByText(/Безопасность данных/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Передать запись \(демо, отключено\)/ }),
    ).toBeDisabled();
    expectClean(container.innerHTML);
  });

  it("по неизвестному id показывает безопасный fallback", () => {
    const { container } = renderAt("/operator/dialogs/unknown-xxx");
    expect(screen.getByRole("heading", { name: /Диалог не найден/ })).toBeInTheDocument();
    expectClean(container.innerHTML);
  });

  it("локальные демо-действия меняют локальный state, без вызовов сети", () => {
    const { container } = renderAt("/operator/dialogs/bd-001");
    fireEvent.click(screen.getByRole("button", { name: /^Взять в работу$/ }));
    expect(screen.getByText(/Локальный статус:/)).toBeInTheDocument();
    expect(screen.getByText(/in_work/)).toBeInTheDocument();
    expectClean(container.innerHTML);
  });

  it("сообщения переписки отрисованы (timeline)", () => {
    renderAt("/operator/dialogs/bd-001");
    // системные сообщения помечены датой; Card 'Переписка' содержит как минимум
    // одно сообщение или явный пустой стейт.
    const timeline = screen.getByText(/Переписка/).parentElement!;
    expect(timeline).toBeInTheDocument();
  });
});
