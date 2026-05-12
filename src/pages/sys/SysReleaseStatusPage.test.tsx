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
    expect(screen.getAllByText("Готово").length).toBeGreaterThan(0);
    expect(screen.getByText(/Доступ к разделу открыт только роли system_admin/)).toBeInTheDocument();
    expect(screen.getByText("npm run preflight:release-status")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Сравнение релизов" })).toHaveTextContent(
      /Статус улучшился/,
    );
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
    expect(screen.getByText(/Проверено строк:/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Показать категории приватности"));
    expect(screen.getByRole("list", { name: "Категории проверки приватности" })).toHaveTextContent(
      /service role env/,
    );
  });

  it("imports safe release history baselines and blocks unsafe history input", () => {
    render(<SysReleaseStatusPage />);

    const historyInput = screen.getByLabelText("Вставить release-history JSONL");
    expect(screen.getByText("Предпросмотр истории")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Предпросмотр записей release history" })).toHaveTextContent(
      /c3d2d18/,
    );

    fireEvent.change(historyInput, {
      target: {
        value:
          '{"recordedAt":"2026-05-11T10:00:00Z","repo":"sahchandansah1201-glitch/pro","branch":"main","currentSha":"aaaaaaaaaaa","overallStatus":"fail","dirtyCount":2,"denoLockOk":false,"artifactPresent":false,"workflows":[{"name":"e2e-smoke","conclusion":"failure"}]}\n',
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Импортировать history JSONL" }));

    expect(screen.getByRole("status", { name: "Статус импорта release history" })).toHaveTextContent(
      /Импортировано 1 baseline-записей/,
    );
    expect(screen.getByRole("status", { name: "Privacy статус импорта release history" })).toHaveTextContent(
      /Privacy-проверка импорта пройдена/,
    );
    fireEvent.change(screen.getByLabelText("Выбрать baseline release status"), {
      target: { value: "imported-aaaaaaaaaaa-0" },
    });
    expect(screen.getByRole("region", { name: "Сравнение релизов" })).toHaveTextContent("aaaaaaaaaaa");
    expect(screen.getByText("Импортированный history")).toBeInTheDocument();

    fireEvent.change(historyInput, {
      target: {
        value:
          'actor_email=doctor@example.com\n{"recordedAt":"2026-05-11T10:00:00Z","repo":"sahchandansah1201-glitch/pro","branch":"main","currentSha":"bbbbbbb","overallStatus":"ok","dirtyCount":0,"denoLockOk":true,"artifactPresent":true,"workflows":[{"name":"e2e-smoke","conclusion":"success"}]}\n',
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Импортировать history JSONL" }));
    expect(screen.getByRole("status", { name: "Статус импорта release history" })).toHaveTextContent(
      /Импорт заблокирован/,
    );
    expect(screen.getByRole("status", { name: "Privacy статус импорта release history" })).toHaveTextContent(
      /Privacy-проверка импорта: блокер/,
    );
    const importAudit = screen.getByRole("region", { name: "Аудит импортов release history" });
    expect(importAudit).toHaveTextContent(/Импорт обработан/);
    expect(importAudit).toHaveTextContent(/Импорт заблокирован/);
    expect(screen.getByRole("status", { name: "Статус релиз-дашборда" })).toHaveTextContent(
      /History JSONL не импортирован/,
    );
  });

  it("supports dry-run import, history filters, delete import, audit download, and JSONL validation", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<SysReleaseStatusPage />);

    const historyInput = screen.getByLabelText("Вставить release-history JSONL");
    fireEvent.change(historyInput, {
      target: {
        value:
          '{"recordedAt":"2026-05-11T10:00:00Z","repo":"sahchandansah1201-glitch/pro","branch":"main","currentSha":"aaaaaaaaaaa","overallStatus":"fail","dirtyCount":2,"denoLockOk":false,"artifactPresent":false,"workflows":[{"name":"e2e-smoke","conclusion":"failure"}]}\n',
      },
    });
    fireEvent.change(screen.getByLabelText("Фильтр статуса истории"), { target: { value: "fail" } });
    fireEvent.change(screen.getByLabelText("Поиск по release history"), { target: { value: "aaaaaaaa" } });
    expect(screen.getByRole("list", { name: "Предпросмотр записей release history" })).toHaveTextContent(
      "aaaaaaaaaaa",
    );

    fireEvent.click(screen.getByRole("button", { name: "Dry-run импорт" }));
    expect(screen.getByRole("status", { name: "Статус импорта release history" })).toHaveTextContent(
      /Dry-run импорт выполнен/,
    );
    expect(screen.getByText("Демо-baseline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Удалить импортированные baseline" })).toBeDisabled();
    expect(screen.getByRole("region", { name: "Аудит импортов release history" })).toHaveTextContent(
      /Dry-run импорт/,
    );

    fireEvent.click(screen.getByRole("button", { name: "Импортировать history JSONL" }));
    expect(screen.getByRole("button", { name: "Удалить импортированные baseline" })).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText("Выбрать baseline release status"), {
      target: { value: "imported-aaaaaaaaaaa-0" },
    });
    expect(screen.getByRole("region", { name: "Сравнение релизов" })).toHaveTextContent("aaaaaaaaaaa");

    fireEvent.click(screen.getByRole("button", { name: "Удалить импортированные baseline" }));
    expect(screen.getByRole("status", { name: "Статус релиз-дашборда" })).toHaveTextContent(
      /Импортированные baseline удалены/,
    );
    expect(screen.getByRole("region", { name: "Аудит импортов release history" })).toHaveTextContent(
      /Импорт удалён/,
    );

    fireEvent.click(screen.getByRole("button", { name: "Скачать отчет аудита импортов release history" }));
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status", { name: "Статус релиз-дашборда" })).toHaveTextContent(
      /Отчет аудита импортов скачан/,
    );

    fireEvent.change(historyInput, { target: { value: "{bad json}\n" } });
    expect(screen.getByRole("list", { name: "Ошибки формата release history" })).toHaveTextContent(
      /строка 1: invalid JSON/,
    );
    fireEvent.click(screen.getByRole("button", { name: "Импортировать history JSONL" }));
    expect(screen.getByRole("status", { name: "Статус импорта release history" })).toHaveTextContent(
      /Импорт не содержит валидных baseline-записей/,
    );
  });

  it("exports bundle, markdown, json, html, and history files and logs them", () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<SysReleaseStatusPage />);

    fireEvent.click(screen.getByRole("button", { name: "Экспортировать единый пакет release status" }));
    fireEvent.click(screen.getByRole("button", { name: "Экспортировать release status в Markdown" }));
    fireEvent.click(screen.getByRole("button", { name: "Экспортировать release status в JSON" }));
    fireEvent.click(screen.getByRole("button", { name: "Экспортировать release status в HTML" }));
    fireEvent.click(screen.getByRole("button", { name: "Экспортировать release status в History JSONL" }));

    expect(click).toHaveBeenCalledTimes(8);
    expect(screen.getByRole("status", { name: "Статус релиз-дашборда" })).toHaveTextContent(
      /History JSONL экспорт готов: release-history-\d{4}-\d{2}-\d{2}\.jsonl/,
    );
    const log = screen.getByRole("region", { name: "Журнал экспортов релиз-статуса" });
    expect(within(log).getByText("Единый пакет")).toBeInTheDocument();
    expect(within(log).getByText("Файлов: 4")).toBeInTheDocument();
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
