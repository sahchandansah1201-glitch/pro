import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import SysReleaseStatusPage from "./SysReleaseStatusPage";

describe("SysReleaseStatusPage", () => {
  beforeEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:release-status"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a safe visual release-status preview", () => {
    const { container } = render(<SysReleaseStatusPage />);

    expect(screen.getByRole("heading", { name: "Релиз-статус" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Предпросмотр release status" })).toHaveTextContent(
      /Main workflows: 6 из 6 success/,
    );
    expect(screen.getByText("Готово")).toBeInTheDocument();
    expect(screen.getByText("npm run preflight:release-status")).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(container.innerHTML).not.toContain("storage_object_path");
    expect(container.innerHTML).not.toContain("access_token=");
    expect(container.innerHTML).not.toContain("SUPABASE_SERVICE_ROLE_KEY=");
  });

  it("switches preview format and reports privacy scan status", () => {
    render(<SysReleaseStatusPage />);

    fireEvent.change(screen.getByLabelText("Формат предпросмотра релиз-статуса"), {
      target: { value: "json" },
    });
    expect(
      (screen.getByLabelText("Предпросмотр файла release status") as HTMLTextAreaElement).value,
    ).toMatch(/"overallStatus": "ok"/);

    fireEvent.click(screen.getByRole("button", { name: "Проверить предпросмотр" }));
    expect(screen.getByRole("status", { name: "Статус релиз-дашборда" })).toHaveTextContent(
      /Проверка приватности пройдена для JSON/,
    );
  });

  it("exports markdown, json, html, and history files and logs them", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<SysReleaseStatusPage />);

    fireEvent.click(screen.getByRole("button", { name: "Экспортировать release status в Markdown" }));
    fireEvent.click(screen.getByRole("button", { name: "Экспортировать release status в JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "Экспортировать release status в HTML" }));
    fireEvent.click(screen.getByRole("button", { name: "Экспортировать release status в History JSONL" }));

    expect(click).toHaveBeenCalledTimes(4);
    expect(screen.getByRole("status", { name: "Статус релиз-дашборда" })).toHaveTextContent(
      /History JSONL экспорт готов: release-history-\d{4}-\d{2}-\d{2}\.jsonl/,
    );
    const log = screen.getByRole("region", { name: "Журнал экспортов релиз-статуса" });
    expect(within(log).getByText(/release-status-\d{4}-\d{2}-\d{2}\.md/)).toBeInTheDocument();
    expect(within(log).getByText(/release-status-\d{4}-\d{2}-\d{2}\.json/)).toBeInTheDocument();
    expect(within(log).getByText(/release-status-\d{4}-\d{2}-\d{2}\.html/)).toBeInTheDocument();
    expect(within(log).getByText(/release-history-\d{4}-\d{2}-\d{2}\.jsonl/)).toBeInTheDocument();
  });

  it("prepares the local preflight command without running shell commands", () => {
    render(<SysReleaseStatusPage />);

    fireEvent.click(screen.getByRole("button", { name: "Подготовить локальный запуск" }));

    expect(screen.getByRole("status", { name: "Статус релиз-дашборда" })).toHaveTextContent(
      /npm run preflight:release-status/,
    );
  });
});
