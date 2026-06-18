import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PATIENTS } from "@/lib/mock-data";
import {
  SELF_HOSTED_API_BASE_URL_KEY,
  SELF_HOSTED_API_TOKEN_KEY,
} from "@/lib/self-hosted-api-session";

import PatientsPage from "./PatientsPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <PatientsPage />
    </MemoryRouter>,
  );
}

const LIVE_PATIENT_ID = "11111111-1111-4111-8111-111111111111";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

function livePatient(overrides: Record<string, unknown> = {}) {
  return {
    id: LIVE_PATIENT_ID,
    code: "DP-live-001",
    fullName: "Петрова Анна Сергеевна",
    birthDate: "1990-01-02",
    sex: "female",
    phototype: "III",
    imagingConsent: true,
    clinic: { id: "c-1", slug: "demo", name: "Demo Clinic" },
    createdAt: "2026-05-12T10:00:00.000Z",
    ...overrides,
  };
}

function configureLiveBackend() {
  window.localStorage.setItem(
    SELF_HOSTED_API_BASE_URL_KEY,
    "http://localhost:8080",
  );
  window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "local-jwt");
}

describe("PatientsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("shows a new-patient CTA on the patients page", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Пациенты" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Новый пациент/i }),
    ).toBeInTheDocument();
  });

  it("surfaces the demo-only patient action gate", () => {
    renderPage();

    const note = screen.getByRole("note", {
      name: "Режим работы списка пациентов",
    });
    expect(note).toHaveTextContent("Учебный режим");
    expect(note).toHaveTextContent(
      "новые записи и удаление не меняют данные клиники",
    );
    expect(
      screen.getByRole("button", { name: /Новый пациент/i }),
    ).toHaveAttribute("aria-describedby", note.id);
  });

  it("shows a native Russian current-action block without technical wording", () => {
    renderPage();

    const action = screen.getByRole("region", {
      name: "Что делать с пациентами сейчас",
    });
    expect(action).toHaveTextContent("Что делать сейчас");
    expect(action).toHaveTextContent("Открыть карточку пациента");
    expect(action).toHaveTextContent("активное наблюдение");
    expect(action).toHaveTextContent("без согласия на съёмку");
    expect(
      within(action).getByRole("link", { name: "Открыть карточку" }),
    ).toHaveAttribute("href", "/patients/p-007");

    expect(document.body.textContent ?? "").not.toMatch(
      /self-hosted|backend|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|raw ID|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
  });

  it("clicking new patient explains that manual creation is not available in demo mode", async () => {
    renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: /Новый пациент/i }),
    );

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      /Создание пациента доступно только после входа в систему клиники/i,
    );
    expect(status).toHaveTextContent(
      /Реальные данные пациентов здесь не вводите/i,
    );
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.getAttribute("aria-atomic")).toBe("true");
    expect(status.getAttribute("aria-label")).toBe(
      "Статус действий с пациентами",
    );
  });

  it("new-patient CTA does not add a local patient row", async () => {
    renderPage();
    const table = screen.getByRole("table");
    const rowsBefore = within(table).getAllByRole("row").length;

    await userEvent.click(
      screen.getByRole("button", { name: /Новый пациент/i }),
    );

    expect(within(table).getAllByRole("row").length).toBe(rowsBefore);
    expect(screen.getByText(/В списке: 10/)).toBeInTheDocument();
  });

  it("opens an edit dialog for an existing patient with current values", async () => {
    renderPage();
    const table = screen.getByRole("table");

    await userEvent.click(
      within(table).getByRole("button", {
        name: /Редактировать пациента Иванова Наталья Олеговна/i,
      }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Редактировать пациента",
    });
    expect(within(dialog).getByLabelText("ФИО")).toHaveValue(
      "Иванова Наталья Олеговна",
    );
    expect(within(dialog).getByLabelText("Дата рождения")).toHaveValue(
      "1984-03-12",
    );
    expect(
      within(dialog).getByText(/Изменения сохраняются только на этом экране/i),
    ).toBeInTheDocument();
  });

  it("opens quick patient preview without entering edit mode", async () => {
    renderPage();
    const table = screen.getByRole("table");

    await userEvent.click(
      within(table).getByRole("button", {
        name: /Просмотреть пациента Иванова Наталья Олеговна/i,
      }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Просмотр пациента",
    });
    expect(within(dialog).getByText("карта 0001")).toBeInTheDocument();
    expect(within(dialog).queryByText("DP-2026-0001")).not.toBeInTheDocument();
    expect(
      within(dialog).getByText("Иванова Наталья Олеговна"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("link", { name: "Открыть карточку" }),
    ).toHaveAttribute("href", "/patients/p-001");
    expect(
      within(dialog).queryByRole("button", { name: "Сохранить изменения" }),
    ).not.toBeInTheDocument();
  });

  it("saves patient edits locally and updates the row without changing total count", async () => {
    renderPage();
    const table = screen.getByRole("table");

    await userEvent.click(
      within(table).getByRole("button", {
        name: /Редактировать пациента Иванова Наталья Олеговна/i,
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Редактировать пациента",
    });
    const nameInput = within(dialog).getByLabelText("ФИО");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Иванова Наталья Тестовая");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Сохранить изменения" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getAllByText("Иванова Наталья Тестовая").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/В списке: 10/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /Изменения по пациенту Иванова Наталья Тестовая сохранены только на этом экране/i,
    );
  });

  it("records edit actions in the patient change log", async () => {
    renderPage();
    const table = screen.getByRole("table");

    await userEvent.click(
      within(table).getByRole("button", {
        name: /Редактировать пациента Иванова Наталья Олеговна/i,
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Редактировать пациента",
    });
    const nameInput = within(dialog).getByLabelText("ФИО");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Иванова Наталья Журнал");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Сохранить изменения" }),
    );

    const log = screen.getByRole("region", {
      name: "Журнал изменений пациентов",
    });
    expect(log).toHaveTextContent("карта 0001");
    expect(log).not.toHaveTextContent("DP-2026-0001");
    expect(log).toHaveTextContent("Иванова Наталья Журнал");
    expect(log).toHaveTextContent("Обновлены данные пациента на этом экране.");
  });

  it("requires a non-empty patient name before saving", async () => {
    renderPage();
    const table = screen.getByRole("table");

    await userEvent.click(
      within(table).getByRole("button", {
        name: /Редактировать пациента Иванова Наталья Олеговна/i,
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Редактировать пациента",
    });
    await userEvent.clear(within(dialog).getByLabelText("ФИО"));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Сохранить изменения" }),
    );

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Укажите ФИО пациента.",
    );
    expect(
      screen.getByRole("dialog", { name: "Редактировать пациента" }),
    ).toBeInTheDocument();
  });

  it("rejects a future birth date before saving", async () => {
    renderPage();
    const table = screen.getByRole("table");

    await userEvent.click(
      within(table).getByRole("button", {
        name: /Редактировать пациента Иванова Наталья Олеговна/i,
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Редактировать пациента",
    });
    const birthDateInput = within(dialog).getByLabelText("Дата рождения");
    await userEvent.clear(birthDateInput);
    await userEvent.type(birthDateInput, "2099-01-01");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Сохранить изменения" }),
    );

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Дата рождения не может быть в будущем.",
    );
  });

  it("editing a patient does not mutate mock patient data", async () => {
    const before = PATIENTS.find((p) => p.id === "p-001")?.fullName;
    renderPage();
    const table = screen.getByRole("table");

    await userEvent.click(
      within(table).getByRole("button", {
        name: /Редактировать пациента Иванова Наталья Олеговна/i,
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Редактировать пациента",
    });
    const nameInput = within(dialog).getByLabelText("ФИО");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Иванова Наталья Локальная");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Сохранить изменения" }),
    );

    expect(PATIENTS.find((p) => p.id === "p-001")?.fullName).toBe(before);
  });

  it("extended search filters by age range", async () => {
    renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: "Расширенный поиск пациентов" }),
    );
    await userEvent.type(screen.getByLabelText("Возраст пациента от"), "70");
    await userEvent.type(screen.getByLabelText("Возраст пациента до"), "72");

    expect(
      screen.getAllByText("Беляева Елена Сергеевна").length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText("Иванова Наталья Олеговна"),
    ).not.toBeInTheDocument();
    expect(
      screen
        .getAllByText(/Найдено:/)
        .map((node) => node.textContent)
        .join(" "),
    ).toContain("1");
  });

  it("sorts patients by age descending", async () => {
    renderPage();

    await userEvent.click(
      screen.getByRole("combobox", { name: "Сортировка пациентов" }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "Возраст по убыванию" }),
    );

    const table = screen.getByRole("table");
    const firstDataRow = within(table).getAllByRole("row")[1];
    expect(firstDataRow).toHaveTextContent("Беляева Елена Сергеевна");
    expect(firstDataRow).toHaveTextContent("71");
  });

  it("paginates the patient list", async () => {
    renderPage();

    expect(
      screen.getByRole("navigation", { name: "Пагинация пациентов" }),
    ).toHaveTextContent("Страница 1 из 3");
    expect(
      screen.queryByText("Кузнецов Павел Андреевич"),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Вперёд" }));

    expect(
      screen.getByRole("navigation", { name: "Пагинация пациентов" }),
    ).toHaveTextContent("Страница 2 из 3");
    expect(
      screen.getAllByText("Кузнецов Павел Андреевич").length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText("Иванова Наталья Олеговна"),
    ).not.toBeInTheDocument();
  });

  it("deletes a patient from the local list only and records it in the change log", async () => {
    const before = PATIENTS.length;
    renderPage();
    const table = screen.getByRole("table");

    await userEvent.click(
      within(table).getByRole("button", {
        name: /Скрыть пациента Иванова Наталья Олеговна/i,
      }),
    );
    const alert = await screen.findByRole("alertdialog", {
      name: "Скрыть пациента на этом экране?",
    });
    await userEvent.click(
      within(alert).getByRole("button", { name: "Скрыть на этом экране" }),
    );

    expect(
      within(table).queryByRole("link", { name: "Иванова Наталья Олеговна" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/В списке: 9/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /Пациент Иванова Наталья Олеговна скрыт только на этом экране/i,
    );
    const log = screen.getByRole("region", {
      name: "Журнал изменений пациентов",
    });
    expect(log).toHaveTextContent("Скрыт на этом экране.");
    expect(PATIENTS.length).toBe(before);
  });

  it("undoes the last local deletion", async () => {
    renderPage();
    const table = screen.getByRole("table");

    await userEvent.click(
      within(table).getByRole("button", {
        name: /Скрыть пациента Иванова Наталья Олеговна/i,
      }),
    );
    const alert = await screen.findByRole("alertdialog", {
      name: "Скрыть пациента на этом экране?",
    });
    await userEvent.click(
      within(alert).getByRole("button", { name: "Скрыть на этом экране" }),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Отменить скрытие" }),
    );

    expect(screen.getByText(/В списке: 10/)).toBeInTheDocument();
    expect(
      screen.getAllByText("Иванова Наталья Олеговна").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Скрытие пациента Иванова Наталья Олеговна отменено.",
    );
    expect(
      screen.getByRole("region", { name: "Журнал изменений пациентов" }),
    ).toHaveTextContent("Скрытие отменено.");
  });

  it("exports the patient change log as selectable text", async () => {
    renderPage();
    const table = screen.getByRole("table");

    await userEvent.click(
      within(table).getByRole("button", {
        name: /Редактировать пациента Иванова Наталья Олеговна/i,
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Редактировать пациента",
    });
    const nameInput = within(dialog).getByLabelText("ФИО");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Иванова Наталья Экспорт");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Сохранить изменения" }),
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Экспорт журнала" }),
    );

    const exportDialog = await screen.findByRole("dialog", {
      name: "Экспорт журнала изменений",
    });
    expect(
      within(exportDialog).getByLabelText("Текст экспорта журнала изменений"),
    ).toHaveValue(
      "1. карта 0001 Иванова Наталья Экспорт: Обновлены данные пациента на этом экране.",
    );
  });

  it("loads patients from the clinic system when a local session token is present", async () => {
    configureLiveBackend();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ items: [livePatient()] }));
    vi.stubGlobal("fetch", fetchMock);

    renderPage();

    expect(
      screen.getByRole("status", {
        name: "Статус загрузки пациентов из системы клиники",
      }),
    ).toHaveTextContent("Загружаем пациентов");
    expect(
      (await screen.findAllByText("Петрова Анна Сергеевна")).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("note", { name: "Режим работы списка пациентов" }),
    ).toHaveTextContent("Рабочий режим");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "http://localhost:8080/api/v1/patients?limit=200&offset=0",
    );
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer local-jwt",
    );
  });

  it("creates a patient through the clinic system in live mode", async () => {
    configureLiveBackend();
    const created = livePatient({
      id: "22222222-2222-4222-8222-222222222222",
      code: "DP-live-002",
      fullName: "Соколова Мария Ивановна",
      birthDate: "1992-04-03",
      phototype: "II",
      imagingConsent: false,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
      .mockResolvedValueOnce(jsonResponse({ item: created }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    renderPage();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await userEvent.click(
      screen.getByRole("button", { name: /Новый пациент/i }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Новый пациент" });
    await userEvent.type(
      within(dialog).getByLabelText("ФИО"),
      "Соколова Мария Ивановна",
    );
    await userEvent.type(
      within(dialog).getByLabelText("Дата рождения"),
      "1992-04-03",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Создать пациента" }),
    );

    expect(
      (await screen.findAllByText("Соколова Мария Ивановна")).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("status", { name: "Статус действий с пациентами" }),
    ).toHaveTextContent("создан в системе клиники");
    const [, createInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(createInit.method).toBe("POST");
    expect(JSON.parse(String(createInit.body))).toMatchObject({
      fullName: "Соколова Мария Ивановна",
      birthDate: "1992-04-03",
      sex: "female",
      phototype: "II",
      imagingConsent: false,
    });
  });

  it("updates a live patient in the clinic system instead of changing only screen state", async () => {
    configureLiveBackend();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [livePatient()] }))
      .mockResolvedValueOnce(
        jsonResponse({ item: livePatient({ fullName: "Петрова Анна Новая" }) }),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderPage();
    expect(
      (await screen.findAllByText("Петрова Анна Сергеевна")).length,
    ).toBeGreaterThan(0);
    const table = screen.getByRole("table");
    await userEvent.click(
      within(table).getByRole("button", {
        name: /Редактировать пациента Петрова Анна Сергеевна/i,
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Редактировать пациента",
    });
    expect(
      within(dialog).getByText(/сохраняются в системе клиники/i),
    ).toBeInTheDocument();
    const nameInput = within(dialog).getByLabelText("ФИО");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Петрова Анна Новая");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Сохранить изменения" }),
    );

    expect(
      (await screen.findAllByText("Петрова Анна Новая")).length,
    ).toBeGreaterThan(0);
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe(
      `http://localhost:8080/api/v1/patients/${LIVE_PATIENT_ID}`,
    );
    expect(init.method).toBe("PATCH");
  });

  it("archives a live patient without showing screen-only undo", async () => {
    configureLiveBackend();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ items: [livePatient()] }))
      .mockResolvedValueOnce(
        jsonResponse({ archived: true, item: livePatient() }),
      );
    vi.stubGlobal("fetch", fetchMock);

    renderPage();
    expect(
      (await screen.findAllByText("Петрова Анна Сергеевна")).length,
    ).toBeGreaterThan(0);
    const table = screen.getByRole("table");
    await userEvent.click(
      within(table).getByRole("button", {
        name: /Скрыть пациента Петрова Анна Сергеевна/i,
      }),
    );
    const alert = await screen.findByRole("alertdialog", {
      name: "Архивировать пациента?",
    });
    expect(alert).toHaveTextContent("Физическое удаление не выполняется");
    await userEvent.click(
      within(alert).getByRole("button", { name: "Архивировать" }),
    );

    await waitFor(() => {
      expect(
        within(table).queryByRole("link", { name: "Петрова Анна Сергеевна" }),
      ).not.toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: "Отменить скрытие" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Статус действий с пациентами" }),
    ).toHaveTextContent("архивирован в системе клиники");
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe(
      `http://localhost:8080/api/v1/patients/${LIVE_PATIENT_ID}`,
    );
    expect(init.method).toBe("DELETE");
  });

  it("surfaces access errors without hiding the safe learning fallback", async () => {
    configureLiveBackend();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: "forbidden",
              message:
                "The authenticated user does not have access to this resource.",
            },
            correlationId: "cid-403",
          },
          { status: 403 },
        ),
      ),
    );

    renderPage();

    expect(
      await screen.findByRole("status", {
        name: "Статус действий с пациентами",
      }),
    ).toHaveTextContent("Недостаточно прав");
    expect(screen.getByText(/В списке: 10/)).toBeInTheDocument();
    expect(
      screen.getAllByText("Иванова Наталья Олеговна").length,
    ).toBeGreaterThan(0);
  });

  it("does not show learning patient rows when production live loading fails", async () => {
    vi.stubEnv("VITE_APP_MODE", "production");
    configureLiveBackend();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: "forbidden",
              message:
                "The authenticated user does not have access to this resource.",
            },
            correlationId: "cid-403",
          },
          { status: 403 },
        ),
      ),
    );

    renderPage();

    expect(
      await screen.findByRole("status", {
        name: "Статус действий с пациентами",
      }),
    ).toHaveTextContent("Недостаточно прав");
    expect(
      screen.getByRole("note", { name: "Режим работы списка пациентов" }),
    ).toHaveTextContent("Рабочий режим");
    expect(screen.getByText(/Система клиники недоступна/i)).toBeInTheDocument();
    expect(
      screen.queryByText("Иванова Наталья Олеговна"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/В списке: 0/)).toBeInTheDocument();
  });
});
