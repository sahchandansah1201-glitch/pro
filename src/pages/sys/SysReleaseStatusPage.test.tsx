import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import SysReleaseStatusPage from "./SysReleaseStatusPage";

function historyLine(
  currentSha: string,
  overallStatus: "ok" | "incomplete" | "fail",
  workflowConclusion: "success" | "failure" | "in_progress" | "unknown",
  hour: string,
): string {
  return JSON.stringify({
    recordedAt: `2026-05-11T${hour}:00:00Z`,
    repo: "sahchandansah1201-glitch/pro",
    branch: "main",
    currentSha,
    overallStatus,
    dirtyCount: overallStatus === "ok" ? 0 : 2,
    denoLockOk: overallStatus !== "fail",
    artifactPresent: overallStatus === "ok",
    workflows: [{ name: "e2e-smoke", conclusion: workflowConclusion }],
  });
}

describe("SysReleaseStatusPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
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

    expect(screen.getAllByRole("heading", { name: "Готовность релиза" }).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("region", { name: "Предпросмотр готовности релиза" }),
    ).toHaveTextContent(/Проверки основной ветки: 9 из 9 пройдены/);
    expect(
      screen.getByRole("region", { name: "Готовность релиза" }),
    ).toHaveTextContent(/Готовность релиза/);
    expect(
      screen.getByRole("status", { name: "Уведомление о готовности релиза" }),
    ).toHaveTextContent(/Ссылку на отчёт можно публиковать/);
    expect(
      screen.getByRole("list", { name: "Проверки готовности релиза" }),
    ).toHaveTextContent(/Набор проверок/);
    expect(
      screen.getByRole("status", { name: "Сводка проверок" }),
    ).toHaveTextContent(/Проверки: 9 из 9 пройдены/);
    expect(
      screen.getByRole("list", { name: "Проверки релиза" }),
    ).toHaveTextContent(/Предварительная проверка/);
    expect(
      screen.getByRole("link", {
        name: "Открыть опубликованный отчёт готовности релиза",
      }),
    ).toHaveAttribute("href", expect.stringContaining("#artifacts"));
    fireEvent.click(
      screen.getByRole("button", { name: "Скопировать ссылку" }),
    );
    expect(
      screen.getByRole("status", { name: "Статус готовности релиза" }),
    ).toHaveTextContent(/отчёт/);
    expect(screen.getAllByText("Готово").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Доступ к разделу открыт только роли системного администратора/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Команды скрыты с экрана/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Сверка синхронизации релиза" }),
    ).toHaveTextContent(/Полный служебный блок скрыт/);
    expect(
      screen.getByRole("status", { name: "Статус сверки записи отчётов" }),
    ).toHaveTextContent(/Отчёты не записываются/);
    expect(
      screen.getByRole("region", { name: "Проверка записи отчётов релиза" }),
    ).toHaveTextContent(/Проверка пройдена/);
    expect(
      screen.getByRole("status", { name: "Статус проверки записи отчётов" }),
    ).toHaveTextContent(/Запись отчётов разрешена/);
    fireEvent.change(screen.getByLabelText("Сценарий проверки записи отчётов"), {
      target: { value: "fail" },
    });
    expect(
      screen.getByRole("status", { name: "Статус проверки записи отчётов" }),
    ).toHaveTextContent(/Запись отчётов заблокирована/);
    expect(
      screen.getByRole("alert", {
        name: "Уведомление о блокере релиза",
      }),
    ).toHaveTextContent(/Проверка не пройдена/i);
    expect(
      screen.getByRole("alert", {
        name: "Уведомление о блокере релиза",
      }),
    ).toHaveTextContent(/Отчёты не записываются/i);
    expect(
      screen.getByRole("list", { name: "Проверки записи отчётов" }),
    ).toHaveTextContent(/Условие успешной проверки/);
    expect(
      screen.getByRole("region", { name: "Сверка синхронизации релиза" }),
    ).toHaveTextContent(/Скопировать блок/);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Скопировать полный блок сверки",
      }),
    );
    expect(
      screen.getByRole("status", { name: "Статус готовности релиза" }),
    ).toHaveTextContent(/Полный блок сверки/);
    expect(
      screen.getByRole("region", { name: "Сравнение релизов" }),
    ).toHaveTextContent(/Статус улучшился/);
    expect(container.innerHTML).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(container.innerHTML).not.toContain("storage_object_path");
    expect(container.innerHTML).not.toContain("access_token=");
    expect(container.innerHTML).not.toContain("SUPABASE_SERVICE_ROLE_KEY=");
  });

  it("switches preview format and reports privacy scan status", () => {
    render(<SysReleaseStatusPage />);

    fireEvent.change(
      screen.getByLabelText("Формат предпросмотра релиз-статуса"),
      {
        target: { value: "json" },
      },
    );
    expect(
      (
        screen.getByLabelText(
          "Предпросмотр файла готовности релиза",
        ) as HTMLTextAreaElement
      ).value,
    ).toMatch(/Готовность релиза: Готово/);

    fireEvent.click(
      screen.getByRole("button", { name: "Проверить предпросмотр" }),
    );
    expect(
      screen.getByRole("status", { name: "Статус готовности релиза" }),
    ).toHaveTextContent(/Проверка приватности пройдена для Структурный отчёт/);
    expect(screen.getByText(/Проверено строк:/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Показать категории приватности"));
    expect(
      screen.getByRole("list", { name: "Категории проверки приватности" }),
    ).toHaveTextContent(/Служебная переменная/);
  });

  it("imports safe release history baselines and blocks unsafe history input", async () => {
    render(<SysReleaseStatusPage />);

    const historyInput = screen.getByLabelText(
      "Вставить журнал истории релиза",
    );
    expect(screen.getByText("Предпросмотр истории")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Сбросить пример" }));
    expect(
      screen.getByRole("list", {
        name: "Предпросмотр записей журнала релиза",
      }),
    ).toHaveTextContent(/код версии скрыт/);

    fireEvent.change(historyInput, {
      target: {
        value:
          '{"recordedAt":"2026-05-11T10:00:00Z","repo":"sahchandansah1201-glitch/pro","branch":"main","currentSha":"aaaaaaaaaaa","overallStatus":"fail","dirtyCount":2,"denoLockOk":false,"artifactPresent":false,"workflows":[{"name":"e2e-smoke","conclusion":"failure"}]}\n',
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Импортировать журнал" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Статус импорта журнала релиза" }),
      ).toHaveTextContent(/Импортировано 1 эталонных записей/),
    );
    expect(
      screen.getByRole("status", {
        name: "Статус проверки данных импорта журнала релиза",
      }),
    ).toHaveTextContent(/Проверка данных импорта пройдена/);
    fireEvent.change(screen.getByLabelText("Выбрать эталон готовности релиза"), {
      target: { value: "imported-aaaaaaaaaaa-0" },
    });
    expect(
      screen.getByRole("region", { name: "Сравнение релизов" }),
    ).toHaveTextContent("код версии скрыт");
    expect(screen.getByText("Импортированная история")).toBeInTheDocument();

    fireEvent.change(historyInput, {
      target: {
        value:
          'actor_email=doctor@example.com\n{"recordedAt":"2026-05-11T10:00:00Z","repo":"sahchandansah1201-glitch/pro","branch":"main","currentSha":"bbbbbbb","overallStatus":"ok","dirtyCount":0,"denoLockOk":true,"artifactPresent":true,"workflows":[{"name":"e2e-smoke","conclusion":"success"}]}\n',
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Импортировать журнал" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Статус импорта журнала релиза" }),
      ).toHaveTextContent(/Импорт заблокирован/),
    );
    expect(
      screen.getByRole("status", {
        name: "Статус проверки данных импорта журнала релиза",
      }),
    ).toHaveTextContent(/Проверка данных импорта: блокер/);
    const importAudit = screen.getByRole("region", {
      name: "Аудит импортов журнала релиза",
    });
    expect(importAudit).toHaveTextContent(/Импорт обработан/);
    expect(importAudit).toHaveTextContent(/Импорт заблокирован/);
    expect(
      screen.getByRole("status", { name: "Статус готовности релиза" }),
    ).toHaveTextContent(/Журнал истории не импортирован/);
  });

  it("exports filtered release history and exposes accessible import errors", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    render(<SysReleaseStatusPage />);

    const historyInput = screen.getByLabelText(
      "Вставить журнал истории релиза",
    );
    expect(historyInput).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining("release-history-import-error-summary"),
    );

    fireEvent.change(historyInput, {
      target: {
        value: [
          historyLine("aaaaaaaaaaa", "fail", "failure", "10"),
          historyLine("bbbbbbbbbbb", "ok", "success", "09"),
        ].join("\n"),
      },
    });
    fireEvent.change(screen.getByLabelText("Фильтр статуса истории"), {
      target: { value: "fail" },
    });
    expect(
      screen.getByRole("status", { name: "Сводка фильтров журнала релиза" }),
    ).toHaveTextContent("1 из 2");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Экспортировать отфильтрованный журнал релиза",
      }),
    );
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(
      screen.getByRole("status", { name: "Статус готовности релиза" }),
    ).toHaveTextContent(/Экспорт журнала готов/);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Экспортировать отфильтрованный журнал релиза таблицей",
      }),
    );
    await waitFor(() => expect(click).toHaveBeenCalledTimes(2));
    expect(
      screen.getByRole("status", { name: "Статус готовности релиза" }),
    ).toHaveTextContent(/Табличный экспорт журнала готов/);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Экспортировать отфильтрованный журнал релиза книгой",
      }),
    );
    await waitFor(() => expect(click).toHaveBeenCalledTimes(3));
    expect(
      screen.getByRole("status", { name: "Статус готовности релиза" }),
    ).toHaveTextContent(/Книга журнала готова/);

    fireEvent.change(screen.getByLabelText("Поиск по журналу релиза"), {
      target: { value: "not-present" },
    });
    expect(
      screen.getByRole("button", {
        name: "Экспортировать отфильтрованный журнал релиза",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Экспортировать отфильтрованный журнал релиза таблицей",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "Экспортировать отфильтрованный журнал релиза книгой",
      }),
    ).toBeDisabled();

    fireEvent.change(historyInput, { target: { value: "{bad json}\n" } });
    expect(historyInput).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByRole("status", {
        name: "Сводка ошибок импорта журнала релиза",
      }),
    ).toHaveTextContent(/Первая ошибка: строка 1/);
    expect(
      screen.getByRole("list", { name: "Ошибки формата журнала релиза" }),
    ).toHaveTextContent(/строка 1: данные некорректны/);
    expect(
      screen.getByRole("list", {
        name: "Подсказки исправления журнала релиза",
      }),
    ).toHaveTextContent(/Проверьте структуру данных/);
    fireEvent.click(
      screen.getByRole("button", { name: "Фокус на журнале с ошибкой" }),
    );
    expect(historyInput).toHaveFocus();
    expect((historyInput as HTMLTextAreaElement).selectionEnd).toBeGreaterThan(
      (historyInput as HTMLTextAreaElement).selectionStart,
    );
  });

  it("applies, saves, renames, duplicates, imports, exports, and deletes release-history filter presets", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const view = render(<SysReleaseStatusPage />);
    fireEvent.click(screen.getByRole("button", { name: "Сбросить пример" }));

    fireEvent.change(
      screen.getByLabelText("Пресет фильтров журнала релиза"),
      {
        target: { value: "builtin-e2e-failures" },
      },
    );
    expect(
      screen.getByLabelText("Фильтр результата проверок истории"),
    ).toHaveValue("failure");
    expect(screen.getByLabelText("Поиск по журналу релиза")).toHaveValue(
      "e2e",
    );
    expect(
      screen.getByRole("status", { name: "Сводка пресетов журнала релиза" }),
    ).toHaveTextContent(/Выбран: Ошибки сквозных проверок/);

    fireEvent.change(screen.getByLabelText("Название пресета журнала релиза"), {
      target: { value: "Мой E2E фильтр" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Сохранить текущие фильтры журнала релиза как пресет",
      }),
    );
    expect(
      screen.getByRole("status", { name: "Сводка пресетов журнала релиза" }),
    ).toHaveTextContent(/Сохранено: 1\/8/);
    expect(
      window.localStorage.getItem(
        "derma-pro:sys-release-status:history-filter-presets",
      ),
    ).toContain("Мой E2E фильтр");

    view.unmount();
    render(<SysReleaseStatusPage />);
    const savedOption = screen.getByRole("option", {
      name: "Мой E2E фильтр",
    }) as HTMLOptionElement;
    fireEvent.change(
      screen.getByLabelText("Пресет фильтров журнала релиза"),
      {
        target: { value: savedOption.value },
      },
    );
    expect(
      screen.getByRole("status", { name: "Сводка пресетов журнала релиза" }),
    ).toHaveTextContent(/Мой E2E фильтр/);
    fireEvent.change(screen.getByLabelText("Название пресета журнала релиза"), {
      target: { value: "Мой E2E фильтр v2" },
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Переименовать сохранённый пресет журнала релиза",
      }),
    );
    expect(
      screen.getByRole("status", { name: "Статус готовности релиза" }),
    ).toHaveTextContent(/переименован/);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Дублировать выбранный пресет журнала релиза",
      }),
    );
    expect(
      screen.getByRole("status", { name: "Сводка пресетов журнала релиза" }),
    ).toHaveTextContent(/Сохранено: 2\/8/);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Экспортировать пресеты журнала релиза в служебный файл",
      }),
    );
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Экспортировать пресеты журнала релиза в книгу",
      }),
    );
    await waitFor(() => expect(click).toHaveBeenCalledTimes(2));
    fireEvent.change(
      screen.getByLabelText("Вставить пресеты журнала релиза"),
      {
        target: {
          value: JSON.stringify({
            presets: [
              {
                id: "saved-imported-safe",
                name: "Безопасный импорт",
                source: "saved",
                createdAt: "2026-05-12T10:00:00Z",
                filters: {
                  status: "ok",
                  deno: "ok",
                  artifact: "present",
                  workflow: "success",
                  query: "готовность",
                },
              },
            ],
          }),
        },
      },
    );
    expect(
      screen.getByRole("status", {
        name: "Предпросмотр импорта пресетов журнала релиза",
      }),
    ).toHaveTextContent(/принято: 1/i);
    expect(
      screen.getByRole("status", {
        name: "Предпросмотр импорта пресетов журнала релиза",
      }),
    ).toHaveTextContent(/Безопасный импорт/);
    expect(
      screen.getByRole("status", {
        name: "План импорта пресетов журнала релиза",
      }),
    ).toHaveTextContent(/Будет импортировано: 1/);
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Импортировать пресеты журнала релиза",
        }),
      ).toBeEnabled(),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Импортировать пресеты журнала релиза",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("status", {
          name: "Статус импорта пресетов журнала релиза",
        }),
      ).toHaveTextContent(/1 принято/),
    );
    expect(
      screen.getByRole("option", { name: "Безопасный импорт" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Аудит пресетов журнала релиза" }),
    ).toHaveTextContent(/import/);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Удалить сохранённый пресет журнала релиза",
      }),
    );
    expect(
      screen.getByRole("status", { name: "Сводка пресетов журнала релиза" }),
    ).toHaveTextContent(/Сохранено: 2\/8/);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Очистить сохранённые пресеты журнала релиза",
      }),
    );
    expect(
      screen.getByRole("status", { name: "Сводка пресетов журнала релиза" }),
    ).toHaveTextContent(/Сохранено: 0\/8/);
    expect(
      screen.queryByRole("option", { name: "Мой E2E фильтр v2" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Восстановить очищенные пресеты журнала релиза",
      }),
    );
    expect(
      screen.getByRole("status", { name: "Сводка пресетов журнала релиза" }),
    ).toHaveTextContent(/Сохранено: 2\/8/);
    expect(
      screen.getByRole("option", { name: "Мой E2E фильтр v2" }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Скачать аудит пресетов журнала релиза",
      }),
    );
    await waitFor(() => expect(click).toHaveBeenCalledTimes(3));
    expect(
      screen.getByRole("status", { name: "Статус готовности релиза" }),
    ).toHaveTextContent(/Аудит пресетов скачан/);

    const presetImportInput = screen.getByLabelText(
      "Вставить пресеты журнала релиза",
    ) as HTMLTextAreaElement;
    fireEvent.change(presetImportInput, { target: { value: "{bad json" } });
    expect(presetImportInput).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByRole("status", {
        name: "План импорта пресетов журнала релиза",
      }),
    ).toHaveTextContent(/данные некорректны|не выполнен/i);
    expect(
      screen.getByRole("list", {
        name: "Подсказки исправления импорта пресетов журнала релиза",
      }),
    ).toHaveTextContent(/Проверьте данные|Проверьте структуру данных/);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Фокус на пресетах с ошибкой",
      }),
    );
    expect(presetImportInput).toHaveFocus();
    expect(presetImportInput.selectionEnd).toBeGreaterThan(
      presetImportInput.selectionStart,
    );
  });

  it("supports dry-run import, history filters, delete import, audit download, and JSONL validation", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    render(<SysReleaseStatusPage />);

    const historyInput = screen.getByLabelText(
      "Вставить журнал истории релиза",
    );
    fireEvent.change(historyInput, {
      target: {
        value: [
          historyLine("aaaaaaaaaaa", "fail", "failure", "10"),
          historyLine("bbbbbbbbbbb", "fail", "failure", "09"),
          historyLine("ccccccccccc", "fail", "failure", "08"),
          historyLine("ddddddddddd", "fail", "failure", "07"),
          historyLine("eeeeeeeeeee", "fail", "failure", "06"),
        ].join("\n"),
      },
    });
    fireEvent.change(screen.getByLabelText("Фильтр статуса истории"), {
      target: { value: "fail" },
    });
    fireEvent.change(screen.getByLabelText("Фильтр служебных файлов истории"), {
      target: { value: "blocked" },
    });
    fireEvent.change(screen.getByLabelText("Фильтр отчёта истории"), {
      target: { value: "missing" },
    });
    fireEvent.change(
      screen.getByLabelText("Фильтр результата проверок истории"),
      { target: { value: "failure" } },
    );
    fireEvent.change(screen.getByLabelText("Поиск по журналу релиза"), {
      target: { value: "e2e-smoke" },
    });
    expect(
      screen.getByRole("list", {
        name: "Предпросмотр записей журнала релиза",
      }),
    ).toHaveTextContent("код версии скрыт");
    expect(
      screen.getByRole("status", { name: "Сводка фильтров журнала релиза" }),
    ).toHaveTextContent("5 из 5");
    expect(
      screen.getByRole("region", { name: "Пагинация журнала релиза" }),
    ).toHaveTextContent("1-3 из 5");
    fireEvent.click(
      screen.getByRole("button", { name: "Следующая страница истории" }),
    );
    const historyPreviewList = screen.getByRole("list", {
      name: "Предпросмотр записей журнала релиза",
    });
    expect(historyPreviewList).toHaveTextContent("код версии скрыт");
    expect(historyPreviewList).toHaveTextContent("код версии скрыт");
    expect(
      screen.getByRole("region", { name: "Пагинация журнала релиза" }),
    ).toHaveTextContent("4-5 из 5");
    fireEvent.click(
      screen.getByRole("button", { name: "Предыдущая страница истории" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Проверить импорт" }));
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Статус импорта журнала релиза" }),
      ).toHaveTextContent(/Проверка импорта выполнена/),
    );
    expect(screen.getByText("Учебный эталон")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Удалить импортированные эталоны" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("region", { name: "Аудит импортов журнала релиза" }),
    ).toHaveTextContent(/Проверка импорта/);

    fireEvent.click(
      screen.getByRole("button", { name: "Импортировать журнал" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Удалить импортированные эталоны",
        }),
      ).not.toBeDisabled(),
    );
    fireEvent.change(screen.getByLabelText("Выбрать эталон готовности релиза"), {
      target: { value: "imported-aaaaaaaaaaa-0" },
    });
    expect(
      screen.getByRole("region", { name: "Сравнение релизов" }),
    ).toHaveTextContent("код версии скрыт");
    const baselinePreview = screen.getByRole("region", {
      name: "Предпросмотр выбранного эталона",
    });
    expect(baselinePreview).toHaveTextContent("код скрыт");
    expect(baselinePreview).toHaveTextContent("Блокер");
    expect(
      within(baselinePreview).getByRole("list", {
        name: "Проверки выбранного эталона",
      }),
    ).toHaveTextContent("Быстрая проверка интерфейса");

    fireEvent.click(
      screen.getByRole("button", { name: "Удалить импортированные эталоны" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Статус готовности релиза" }),
      ).toHaveTextContent(/Импортированные эталоны удалены/),
    );
    expect(
      screen.getByRole("region", { name: "Аудит импортов журнала релиза" }),
    ).toHaveTextContent(/Импорт удалён/);

    fireEvent.change(screen.getByLabelText("Фильтр статуса аудита импортов"), {
      target: { value: "deleted" },
    });
    expect(
      screen.getByRole("status", { name: "Сводка фильтров аудита импортов" }),
    ).toHaveTextContent("1 из 3");
    fireEvent.change(screen.getByLabelText("Поиск по аудиту импортов"), {
      target: { value: "очищено" },
    });
    expect(
      screen.getByRole("region", { name: "Аудит импортов журнала релиза" }),
    ).toHaveTextContent(/Импорт удалён/);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Скачать служебный отчёт аудита импортов журнала релиза",
      }),
    );
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(
      screen.getByRole("status", { name: "Статус готовности релиза" }),
    ).toHaveTextContent(/Отчёт аудита импортов скачан/);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Скачать табличный отчёт аудита импортов журнала релиза",
      }),
    );
    await waitFor(() => expect(click).toHaveBeenCalledTimes(2));
    expect(
      screen.getByRole("status", { name: "Статус готовности релиза" }),
    ).toHaveTextContent(/Отчёт аудита импортов скачан/);
    fireEvent.change(
      screen.getByLabelText("Фильтр проверки данных аудита импортов"),
      { target: { value: "with_privacy" } },
    );
    expect(
      screen.getByRole("status", { name: "Сводка фильтров аудита импортов" }),
    ).toHaveTextContent("0 из 5");
    expect(
      screen.getByText("По выбранным фильтрам аудита записей нет."),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Сбросить фильтры аудита импортов" }),
    );
    expect(
      screen.getByRole("status", { name: "Сводка фильтров аудита импортов" }),
    ).toHaveTextContent("5 из 5");
    fireEvent.click(
      screen.getByRole("button", { name: "Сбросить фильтры журнала релиза" }),
    );
    expect(
      screen.getByRole("status", { name: "Сводка фильтров журнала релиза" }),
    ).toHaveTextContent("5 из 5");

    fireEvent.change(historyInput, { target: { value: "{bad json}\n" } });
    expect(
      screen.getByRole("list", { name: "Ошибки формата журнала релиза" }),
    ).toHaveTextContent(/строка 1: данные некорректны/);
    fireEvent.click(
      screen.getByRole("button", { name: "Импортировать журнал" }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Статус импорта журнала релиза" }),
      ).toHaveTextContent(/Импорт не содержит валидных эталонных записей/),
    );
  });

  it("exports bundle, markdown, json, html, and history files and logs them", async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    render(<SysReleaseStatusPage />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Экспортировать единый пакет готовности релиза",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Статус готовности релиза" }),
      ).toHaveTextContent(/Пакетный экспорт готов/),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Экспортировать готовность релиза: Текстовый отчёт",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Статус готовности релиза" }),
      ).toHaveTextContent(/Текстовый отчёт готов/),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Экспортировать готовность релиза: Структурный отчёт",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Статус готовности релиза" }),
      ).toHaveTextContent(/Структурный отчёт готов/),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Экспортировать готовность релиза: Веб-страница",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Статус готовности релиза" }),
      ).toHaveTextContent(/Веб-страница готов/),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Экспортировать готовность релиза: Журнал истории",
      }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("status", { name: "Статус готовности релиза" }),
      ).toHaveTextContent(
        /Журнал истории готов: release-history-\d{4}-\d{2}-\d{2}\.jsonl/,
      ),
    );
    expect(click).toHaveBeenCalledTimes(8);
    const log = screen.getByRole("region", {
      name: "Журнал экспортов релиз-статуса",
    });
    expect(within(log).getByText("Единый пакет")).toBeInTheDocument();
    expect(within(log).getByText("Файлов: 4")).toBeInTheDocument();
    expect(
      within(log).getByText(/release-status-\d{4}-\d{2}-\d{2}\.md/),
    ).toBeInTheDocument();
    expect(
      within(log).getByText(/release-status-\d{4}-\d{2}-\d{2}\.json/),
    ).toBeInTheDocument();
    expect(
      within(log).getByText(/release-status-\d{4}-\d{2}-\d{2}\.html/),
    ).toBeInTheDocument();
    expect(
      within(log).getByText(/release-history-\d{4}-\d{2}-\d{2}\.jsonl/),
    ).toBeInTheDocument();
  });

  it("prepares the local preflight command without running shell commands", () => {
    render(<SysReleaseStatusPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Подготовить локальный запуск" }),
    );

    expect(
      screen.getByRole("status", { name: "Статус готовности релиза" }),
    ).toHaveTextContent(/Команду предварительной проверки/);
  });
});
