import { describe, it, expect } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminHomePage from "./AdminHomePage";
import AdminDoctorsPage from "./AdminDoctorsPage";
import AdminServicesPage from "./AdminServicesPage";
import AdminClinicsPage from "./AdminClinicsPage";
import AdminBotSettingsPage from "./AdminBotSettingsPage";
import AdminGovernancePage from "./AdminGovernancePage";
import AdminIntegrationsPage from "./AdminIntegrationsPage";

const FORBIDDEN = [
  "birthDate",
  "photoRef",
  "storagePath",
  "diagnosis",
  "doctorVersionText",
  "patientSafeText",
  "sharedLink",
  "modelVersion",
  "heatmapRef",
  "externalUserRef",
];

const renderRouted = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Admin clinic core pages — render & safety", () => {
  it("AdminHomePage renders the admin operating dashboard, action queue and quick links", () => {
    renderRouted(<AdminHomePage />);
    expect(screen.getByRole("heading", { name: /Операционный центр клиники/ })).toBeInTheDocument();
    expect(screen.getByText(/MVP: данные демонстрационные/)).toBeInTheDocument();
    expect(screen.getByText("Очередь решений администратора")).toBeInTheDocument();
    expect(screen.getByText(/МИС отключена/)).toBeInTheDocument();
    expect(screen.getByText(/Бот ждёт фото лучшего качества/)).toBeInTheDocument();
    expect(screen.getByText("Операционный день")).toBeInTheDocument();
    expect(screen.getByText("Готовность интеграций")).toBeInTheDocument();
    expect(screen.getByText("Бот и лиды")).toBeInTheDocument();
    expect(screen.getByText("Услуги и филиалы")).toBeInTheDocument();
    expect(screen.getByText("Финансовый контур")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Разобрать интеграции/ })[0]).toHaveAttribute(
      "href",
      "/admin/integrations",
    );
    expect(screen.getAllByRole("link", { name: /Настроить бот/ })[0]).toHaveAttribute(
      "href",
      "/admin/bot",
    );
    expect(screen.getByRole("link", { name: /Открыть аналитику/ })).toHaveAttribute(
      "href",
      "/admin/analytics",
    );
    // Не плейсхолдер
    expect(
      screen.queryByText(/Раздел будет реализован в следующих задачах/),
    ).not.toBeInTheDocument();
  });

  it("AdminHomePage keeps the operating dashboard aggregate-only", () => {
    renderRouted(<AdminHomePage />);
    const html = document.body.innerHTML;
    for (const patientName of ["Иванова", "Кузнецов", "Новиков", "Григорьева"]) {
      expect(html).not.toContain(patientName);
    }
    expect(screen.getByText(/Только агрегаты/)).toBeInTheDocument();
    expect(screen.getByText(/фото и диагнозы не выводятся/)).toBeInTheDocument();
  });

  it("AdminBotSettingsPage renders the bot control center with queues, scripts and audit", () => {
    renderRouted(<AdminBotSettingsPage />);
    expect(screen.getByRole("heading", { name: /Центр управления ботом/ })).toBeInTheDocument();
    expect(screen.getByText(/сбор данных, маршрутизация, качество фото, передача оператору и журнал/)).toBeInTheDocument();
    expect(screen.getByText("Операционный статус бота")).toBeInTheDocument();
    expect(screen.getByText("Контроль качества фото")).toBeInTheDocument();
    expect(screen.getAllByText("Передача оператору").length).toBeGreaterThan(0);
    expect(screen.getByText("Сценарии сбора данных")).toBeInTheDocument();
    expect(screen.getByText("Безопасные шаблоны")).toBeInTheDocument();
    expect(screen.getByText("Пробная проверка и журнал")).toBeInTheDocument();
    expect(screen.getByText(/бот не ставит диагноз/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Запросить повтор фото/ })[0]).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Передать оператору/ })[0]).toBeInTheDocument();
  });

  it("AdminBotSettingsPage records local retake and operator handoff actions without sending messages", () => {
    renderRouted(<AdminBotSettingsPage />);
    fireEvent.click(screen.getAllByRole("button", { name: /Запросить повтор фото/ })[0]);
    expect(screen.getAllByText(/Запрос повторного фото сформирован локально/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: /Передать оператору/ })[0]);
    expect(screen.getAllByText(/Передача оператору подготовлена локально/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/сообщения не отправляются/).length).toBeGreaterThan(0);
  });

  it("AdminGovernancePage renders aggregate access governance and local review actions", () => {
    renderRouted(<AdminGovernancePage />);
    expect(screen.getByRole("heading", { name: /Управление доступом/ })).toBeInTheDocument();
    expect(screen.getByText(/Только агрегаты/)).toBeInTheDocument();
    expect(screen.getByText("Правила выдачи")).toBeInTheDocument();
    expect(screen.getAllByText("Сеансы пациента").length).toBeGreaterThan(0);
    expect(screen.getByText("Работа с доступом")).toBeInTheDocument();
    expect(screen.getByText("Разбор хранения")).toBeInTheDocument();
    expect(screen.getByText("Отзыв доступа")).toBeInTheDocument();
    expect(screen.getByText("Сеансы доступа")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Заблокировать без правил/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Заблокировать без срока/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Заблокировать временные коды/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Подготовить замену доступа/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Подготовить ключ доступа/ })).toBeInTheDocument();
    expect(screen.getByText("Обмен нужен")).toBeInTheDocument();
    expect(screen.getByText("Сессия подтверждена")).toBeInTheDocument();
    expect(screen.getByText("Отказы обмена")).toBeInTheDocument();
    expect(screen.getByText("Очередь утверждений")).toBeInTheDocument();
    expect(screen.getByText("Безопасность данных")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Подготовить разбор хранения/ }));
    expect(screen.getByText(/Разбор хранения подготовлен локально/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Отозвать истёкшие окна/ }));
    expect(screen.getByText(/Учебный режим: отзыв истёкших окон подготовлен локально/)).toBeInTheDocument();
    expect(screen.getByText("Последнее действие системы")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Заблокировать без правил/ }));
    expect(screen.getByText(/Учебный режим: окна без правил хранения заблокированы локально/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Заблокировать без срока/ }));
    expect(screen.getByText(/Учебный режим: окна без срока заблокированы локально/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Заблокировать временные коды/ }));
    expect(screen.getByText(/Учебный режим: небезопасные временные коды заблокированы локально/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Подготовить замену доступа/ }));
    expect(screen.getByText(/Учебный режим: замена доступа подготовлена локально/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Подготовить ключ доступа/ }));
    expect(screen.getByText(/Учебный режим: ключ доступа подготовлен локально/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Зафиксировать разбор/ })[0]);
    expect(screen.getByText(/Разбор правил подготовлен локально/)).toBeInTheDocument();
  });

  it("AdminGovernancePage keeps release governance aggregate-only and native Russian", () => {
    const { container } = renderRouted(<AdminGovernancePage />);
    const html = container.innerHTML;
    const visible = container.textContent ?? "";
    for (const token of [
      ...FORBIDDEN,
      "patientId",
      "visitId",
      "releaseId",
      "objectBucket",
      "objectKey",
      "signedUrl",
      "accessToken",
      "revokeReason",
      "Иванова",
      "Кузнецов",
    ]) {
      expect(html, `forbidden token ${token}`).not.toContain(token);
    }
    expect(html).not.toMatch(/меланома|рак кожи|вероятность меланомы/i);
    expect(visible).not.toMatch(
      /self-hosted|backend|metadata-only|raw id|file proxy|production|credential|hash|fingerprint|session id|demo|unsafe/i,
    );
  });

  it("AdminIntegrationsPage uses native Russian admin copy without technical transfer terms", () => {
    const { container } = renderRouted(<AdminIntegrationsPage />);
    const visible = container.textContent ?? "";

    expect(screen.getByRole("heading", { name: "Интеграции" })).toBeInTheDocument();
    expect(screen.getAllByText("Клиентская база").length).toBeGreaterThan(0);
    expect(screen.getAllByText("учёт").length).toBeGreaterThan(0);
    expect(screen.getAllByText("МИС").length).toBeGreaterThan(0);
    expect(screen.getByText(/Учебный режим: внешние системы не получают фото/)).toBeInTheDocument();
    expect(screen.getAllByText("Краткое резюме и защищённая ссылка").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Клиентская база" })).toBeInTheDocument();
    expect(visible).not.toMatch(/MVP|AI|XAI|PHI|safeSummary|protectedLink|DryRun|JSON|Telegram Bot API|Demo MIS/i);
  });

  it("AdminBotSettingsPage keeps bot control safe and hides raw bot internals", () => {
    renderRouted(<AdminBotSettingsPage />);
    const html = document.body.innerHTML;
    for (const token of [
      ...FORBIDDEN,
      "pal-tok",
      "mock://",
      "triage-v",
      "tg:100",
      "wa:200",
      "web:300",
    ]) {
      expect(html, `forbidden token ${token}`).not.toContain(token);
    }
    expect(html).not.toMatch(/меланома|рак кожи|вероятность меланомы/i);
    expect(screen.getAllByText(/не является диагнозом/i).length).toBeGreaterThan(0);
  });

  it("AdminDoctorsPage filters narrow visible rows", () => {
    renderRouted(<AdminDoctorsPage />);
    expect(screen.getByText(/Состав, специализации/)).toBeInTheDocument();
    const before = screen.getAllByText(/Соколова|Морозов|Кузнецов|Никитина|Рябов/i).length;
    fireEvent.click(screen.getByRole("tab", { name: "Проверить лицензию" }));
    const after = screen.getAllByText(/Соколова|Морозов|Кузнецов|Никитина|Рябов/i).length;
    expect(after).toBeLessThan(before);
    // Никитина имеет needs_check
    expect(screen.getAllByText(/Никитина/).length).toBeGreaterThan(0);
  });

  it("AdminDoctorsPage exposes an admin-ready doctors schedule and role-readiness cockpit", () => {
    renderRouted(<AdminDoctorsPage />);
    expect(screen.getByRole("heading", { name: "Готовность врачей" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "MIS-style расписание" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Права и роли" })).toBeInTheDocument();
    expect(screen.getByText("Колонки по врачам")).toBeInTheDocument();
    expect(screen.getByText("Лицензии и профили")).toBeInTheDocument();
    expect(screen.getByText(/Только операционная готовность/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Проверить готовность врачей" }));
    expect(screen.getByText(/Проверка готовности врачей подготовлена локально/)).toBeInTheDocument();
  });

  it("AdminServicesPage search narrows rows and main button is tap-target friendly", () => {
    renderRouted(<AdminServicesPage />);
    expect(screen.getByText("Услуги и тарифы")).toBeInTheDocument();
    const input = screen.getByLabelText("Поиск услуг");
    fireEvent.change(input, { target: { value: "дерматоск" } });
    expect(screen.getAllByText(/Дерматоскопия/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Удаление образования/)).not.toBeInTheDocument();
    // Хотя бы одна кнопка действия имеет min-h-[44px]
    const btn = screen.getAllByRole("button", { name: /Редактировать \(демо\)/ })[0];
    expect(btn.className).toMatch(/min-h-\[44px\]/);
  });

  it("AdminServicesPage exposes manual service creation, MIS import and pre-publish checks", () => {
    renderRouted(<AdminServicesPage />);
    expect(screen.getByRole("heading", { name: "Создание услуги" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Импорт из МИС" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Проверка перед публикацией" })).toBeInTheDocument();
    expect(screen.getByText(/название, категория, длительность, цена/)).toBeInTheDocument();
    expect(screen.getByText(/ручные правки не перетирают импорт/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Создать услугу вручную (демо)" }));
    expect(screen.getByText(/Черновик ручной услуги создан локально/)).toBeInTheDocument();
  });

  it("AdminClinicsPage filter and sort change visible cards", () => {
    renderRouted(<AdminClinicsPage />);
    expect(screen.getByText("Клиники и филиалы")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Партнёрские" }));
    expect(screen.getByText(/Кабинет Морозова/)).toBeInTheDocument();
    expect(screen.queryByText(/Дерма-Про · Центр/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Все" }));
    fireEvent.click(screen.getByRole("tab", { name: "По конверсии" }));
    expect(screen.getByText(/Дерма-Про · Центр/)).toBeInTheDocument();
  });

  it("AdminClinicsPage exposes branch readiness, routing and data-boundary controls", () => {
    renderRouted(<AdminClinicsPage />);
    expect(screen.getByRole("heading", { name: "Готовность филиалов" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Связь с врачами и услугами" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Маршрутизация заявок" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ограничения передачи данных" })).toBeInTheDocument();
    expect(screen.getByText(/без фото, диагнозов и внутренних кодов/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Открыть интеграции" })).toHaveAttribute(
      "href",
      "/admin/integrations",
    );
    fireEvent.click(screen.getByRole("button", { name: "Проверить филиалы" }));
    expect(screen.getByText(/Проверка филиалов подготовлена локально/)).toBeInTheDocument();
  });

  it("UX Batch 15: bot and clinics pages use native Russian visible copy", () => {
    const forbiddenVisible =
      /MVP|DryRun|JSON|intake|routing|escalation|quality gate|demo|Demo|демо|raw ID|raw токен|Device Bridge|Bridge|backend|бэкенд|user refs|patient-visible|MVP boundary|aggregate\/config|Telegram Bot API|PHI|AI\/XAI|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|лиды|лидов|лидам/i;

    for (const ui of [<AdminBotSettingsPage />, <AdminClinicsPage />]) {
      const { container, unmount } = renderRouted(ui);
      const visible = container.textContent ?? "";
      expect(visible).not.toMatch(forbiddenVisible);
      expect(visible).not.toMatch(/меланома|рак кожи|вероятность меланомы/i);
      expect(visible).not.toMatch(/storagePath|signedUrl|accessToken|qrToken|sessionId/i);
      expect(visible).not.toMatch(/lead-\d|tg:|wa:|TELEGRAM|WHATSAPP/i);
      unmount();
    }
  });

  it("none of the new admin pages render forbidden patient-level tokens", () => {
    for (const ui of [
      <AdminHomePage />,
      <AdminDoctorsPage />,
      <AdminServicesPage />,
      <AdminClinicsPage />,
      <AdminBotSettingsPage />,
      <AdminGovernancePage />,
    ]) {
      const { container, unmount } = renderRouted(ui);
      const html = container.innerHTML;
      for (const token of FORBIDDEN) {
        expect(html, `forbidden token ${token}`).not.toContain(token);
      }
      // Доп. защита: явно не показываем телефон клиники в clinics (по требованию)
      if (ui.type === AdminClinicsPage) {
        expect(html).not.toMatch(/\+7 \(\d{3}\)/);
      }
      unmount();
    }
    // Используем within чтобы не сорить unused import warnings.
    expect(within(document.body)).toBeDefined();
  });

  it("AdminDoctorsPage shows empty state with active query chip and reset", () => {
    renderRouted(<AdminDoctorsPage />);
    const input = screen.getByLabelText("Поиск врачей");
    fireEvent.change(input, { target: { value: "ZZZZнетсовпадений" } });
    expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
    expect(screen.getByText(/поиск:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Сбросить поиск и фильтры/ }));
    expect(screen.queryByText("Ничего не найдено")).not.toBeInTheDocument();
    expect((screen.getByLabelText("Поиск врачей") as HTMLInputElement).value).toBe("");
  });

  it("AdminServicesPage shows empty state with filter chip", () => {
    renderRouted(<AdminServicesPage />);
    fireEvent.change(screen.getByLabelText("Поиск услуг"), {
      target: { value: "ZZZнет" },
    });
    expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
    expect(screen.getByText(/поиск:/)).toBeInTheDocument();
  });

  it("AdminClinicsPage shows empty state when filter has no matches", () => {
    renderRouted(<AdminClinicsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Внешние" }));
    expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
    expect(screen.getByText(/фильтр:/)).toBeInTheDocument();
  });

  it("AdminClinicsPage reads sort from ?sort=conversion in URL", () => {
    render(
      <MemoryRouter initialEntries={["/admin/clinics?sort=conversion"]}>
        <AdminClinicsPage />
      </MemoryRouter>,
    );
    const sortTab = screen.getByRole("tab", { name: "По конверсии" });
    expect(sortTab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText(/Сортировка: По конверсии/)).toBeInTheDocument();
  });

  it("AdminClinicsPage ignores invalid ?sort= value and falls back to priority", () => {
    render(
      <MemoryRouter initialEntries={["/admin/clinics?sort=BOGUS"]}>
        <AdminClinicsPage />
      </MemoryRouter>,
    );
    const sortTab = screen.getByRole("tab", { name: "По приоритету" });
    expect(sortTab.getAttribute("aria-selected")).toBe("true");
  });
});
