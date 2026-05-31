import { describe, it, expect } from "vitest";
import { render, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminAnalyticsPage from "./AdminAnalyticsPage";
import {
  getLeads,
  getAppointments,
  getAnalysisCards,
  getDialogs,
  getClinics,
} from "@/lib/mock-data";

/**
 * Контракт страницы /admin/analytics:
 *   1) В DOM не появляются запрещённые токены (PHI/фото/AI-XAI/ссылки/
 *      внешние идентификаторы пользователей мессенджера).
 *   2) Агрегаты считаются и рендерятся корректно (KPI, источники,
 *      клиники, риск, качество фото, состояния диалогов).
 *   3) Сегментированный фильтр периода меняет KPI.
 *   4) Demo-кнопка «Сформировать отчёт» показывает безопасный JSON
 *      только с агрегатами.
 */

const FORBIDDEN_TOKENS = [
  "fullName",
  "birthDate",
  "phone",
  "email",
  "photoRef",
  "storagePath",
  "diagnosis",
  "doctorVersionText",
  "patientSafeText",
  "sharedLink",
  "features",
  "modelVersion",
  "heatmapRef",
  "externalUserRef",
];

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminAnalyticsPage />
    </MemoryRouter>,
  );
}

describe("AdminAnalyticsPage — безопасность DOM", () => {
  it("в DOM нет ни одного запрещённого токена (имена/контакты/PHI/AI-XAI)", () => {
    const { container } = renderPage();
    const html = container.innerHTML;
    for (const t of FORBIDDEN_TOKENS) {
      expect(html, `forbidden token "${t}" leaked into DOM`).not.toMatch(
        new RegExp(t),
      );
    }
  });

  it("в DOM не появляются конкретные пациент-уровневые значения из моков", () => {
    const { container } = renderPage();
    const text = container.textContent ?? "";
    // Реальные ФИО/телефоны/email из mock-data не должны утекать.
    expect(text).not.toMatch(/Иван|Петров|Сидор|@/);
    expect(text).not.toMatch(/\+7\s?\(?\d/);
    // Внешние идентификаторы в мессенджерах из BotDialog.
    expect(text).not.toMatch(/tg:\d+|wa:\d+|web:\d+/);
    // Пути к фото и токены защищённых ссылок.
    expect(text).not.toMatch(/mock:\/\/bot/);
    expect(text).not.toMatch(/pal-tok-/);
  });
});

describe("AdminAnalyticsPage — заголовок и баннер", () => {
  it("показывает корректный заголовок, подзаголовок и safety-баннер", () => {
    const { getByText } = renderPage();
    expect(getByText("Аналитика")).toBeInTheDocument();
    expect(
      getByText(/Воронка лидов, запись, маршрутизация и качество фото/),
    ).toBeInTheDocument();
    expect(
      getByText(
        /Только агрегаты\. Без PHI, фото, диагнозов и AI\/XAI деталей\./,
      ),
    ).toBeInTheDocument();
  });
});

describe("AdminAnalyticsPage — KPI и агрегаты", () => {
  it("KPI совпадают с агрегатами по мокам в режиме «Все данные»", () => {
    const { container } = renderPage();

    const leads = getLeads();
    const totalLeads = leads.length;
    const qualified = leads.filter(
      (l) => l.status === "qualified" || l.status === "booked",
    ).length;
    const booked = leads.filter((l) => l.status === "booked").length;
    const visits = getAppointments().filter((a) => a.status === "completed")
      .length;
    const conv = Math.round((booked / totalLeads) * 100);
    const cards = getAnalysisCards();
    const highOrUrgent = cards.filter(
      (c) => c.routingRisk === "high" || c.routingRisk === "urgent",
    ).length;

    // KPI карточки помечены классом "uppercase tracking-wide" у label.
    const kpiLabels = Array.from(
      container.querySelectorAll(".uppercase.tracking-wide"),
    ) as HTMLElement[];
    const kpiByLabel = new Map<string, string>();
    for (const el of kpiLabels) {
      const card = el.parentElement!;
      kpiByLabel.set(el.textContent?.trim() ?? "", card.textContent ?? "");
    }
    const expectKpi = (label: string, value: string | number) => {
      const txt = kpiByLabel.get(label);
      expect(txt, `KPI "${label}" not found`).toBeTruthy();
      expect(txt!).toContain(String(value));
    };
    expectKpi("Лиды", totalLeads);
    expectKpi("Квалифицированы", qualified);
    expectKpi("Записаны", booked);
    expectKpi("Визиты", visits);
    expectKpi("Конверсия лид → запись", `${conv}%`);
    expectKpi("Высокий / срочный маршрут", highOrUrgent);
  });

  it("раздел «Источники лидов» агрегирует все лиды и не показывает messenger-id", () => {
    const { getByText } = renderPage();
    const sectionTitle = getByText("Источники лидов");
    const card = sectionTitle.closest("div.p-4") as HTMLElement;
    expect(card).toBeTruthy();

    // Сумма count по строкам источников должна равняться общему числу лидов.
    // Считаем по числам в строках, отбирая «записан: N» отдельно.
    const totalLeads = getLeads().length;
    const rows = card.querySelectorAll(".grid");
    let sum = 0;
    rows.forEach((row) => {
      const spans = row.querySelectorAll("span");
      // Layout строки: [label] [count] [share%] [записан: N]
      if (spans.length >= 4) {
        const n = Number(spans[1].textContent);
        if (!Number.isNaN(n)) sum += n;
      }
    });
    expect(sum).toBe(totalLeads);

    // Без внешних идентификаторов мессенджера.
    expect(card.textContent ?? "").not.toMatch(/tg:|wa:|web:/);
  });

  it("раздел «Маршрутизация по клиникам» содержит все клиники и поля приоритета", () => {
    const { getByText } = renderPage();
    const card = getByText("Маршрутизация по клиникам").closest(
      "div.p-4",
    ) as HTMLElement;
    expect(card).toBeTruthy();
    for (const c of getClinics()) {
      expect(within(card).getByText(c.name)).toBeInTheDocument();
    }
    expect(card.textContent ?? "").toMatch(/приоритет:/);
    expect(card.textContent ?? "").toMatch(/конверсия:/);
  });

  it("распределение по риску содержит все четыре уровня с текстовыми подписями", () => {
    const { getByText } = renderPage();
    const card = getByText("Распределение по риску").closest(
      "div.p-4",
    ) as HTMLElement;
    for (const label of ["Низкий", "Умеренный", "Высокий", "Срочный"]) {
      expect(within(card).getByText(label)).toBeInTheDocument();
    }
  });

  it("блок «Качество фото» показывает passed/needs-repeat/средний балл/CTA", () => {
    const { getByText } = renderPage();
    const card = getByText("Качество фото").closest("div.p-4") as HTMLElement;
    const cards = getAnalysisCards();
    const passed = cards.filter((c) => c.qualityGate.passed).length;
    const needsRepeat = cards.length - passed;
    const repeatCta = cards.filter((c) => c.ctaType === "repeat_photo").length;

    expect(within(card).getByText("Прошли проверку").parentElement!.textContent)
      .toContain(String(passed));
    expect(within(card).getByText("Нужен повтор").parentElement!.textContent)
      .toContain(String(needsRepeat));
    expect(
      within(card).getByText("CTA «повторить фото»").parentElement!.textContent,
    ).toContain(String(repeatCta));
    // Подпись «техническое качество, не диагноз» обязательна.
    expect(card.textContent ?? "").toMatch(/техническое качество.*не диагноз/);
  });

  it("блок «Состояния бот-диалогов» показывает 7 состояний и не содержит payload-ов", () => {
    const { getByText } = renderPage();
    const card = getByText("Состояния бот-диалогов").closest(
      "div.p-4",
    ) as HTMLElement;
    for (const label of [
      "Новый",
      "Ожидает фото",
      "Ожидает качества",
      "Рекомендация отправлена",
      "У оператора",
      "Записан",
      "Закрыт",
    ]) {
      expect(within(card).getByText(label)).toBeInTheDocument();
    }
    // Проверяем, что суммарное число диалогов в блоке совпадает с моками.
    const total = getDialogs().length;
    const numbers = Array.from(card.querySelectorAll("span"))
      .map((s) => Number(s.textContent))
      .filter((n) => !Number.isNaN(n));
    expect(numbers.reduce((a, b) => a + b, 0)).toBe(total);
  });

  it("Batch K: показывает финансовую ценность как демо-оценку, не бухгалтерскую выручку", () => {
    const { getByText } = renderPage();
    const card = getByText("Финансовый контур").closest("div.p-4") as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.textContent ?? "").toMatch(/оценка вклада/i);
    expect(card.textContent ?? "").toMatch(/не бухгалтерская выручка/i);

    const appointments = getAppointments();
    const completedValue = appointments.filter((a) => a.status === "completed").length * 3200;
    const bookedPotential = appointments.filter((a) => a.status === "planned" || a.status === "confirmed").length * 2800;
    const lostPotential = getLeads().filter((l) => l.status === "lost").length * 1800;
    const rub = (value: number) => `${value.toLocaleString("ru-RU")} ₽`;

    expect(card.textContent ?? "").toContain(rub(completedValue));
    expect(card.textContent ?? "").toContain(rub(bookedPotential));
    expect(card.textContent ?? "").toContain(rub(lostPotential));
    expect(card.textContent ?? "").toMatch(/методика требует проверки/i);
  });

  it("Batch K: показывает ценность по филиалам агрегатами без пациентских данных", () => {
    const { getByText } = renderPage();
    const card = getByText("Ценность по филиалам").closest("div.p-4") as HTMLElement;
    expect(card).toBeTruthy();
    for (const c of getClinics()) {
      expect(within(card).getByText(c.name)).toBeInTheDocument();
    }
    expect(card.textContent ?? "").toMatch(/завершено:/);
    expect(card.textContent ?? "").toMatch(/план:/);
    expect(card.textContent ?? "").toMatch(/оценка:/);
    expect(card.textContent ?? "").not.toMatch(/Иван|Петров|Сидор|@|\+7\s?\(?\d/);
  });

  it("Batch L: показывает агрегатный срез периода без пациентских строк", () => {
    const { getByText } = renderPage();
    const card = getByText("Срез периода").closest("div.p-4") as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.textContent ?? "").toContain("Все данные");
    expect(card.textContent ?? "").toMatch(/лиды:/i);
    expect(card.textContent ?? "").toMatch(/записи:/i);
    expect(card.textContent ?? "").toMatch(/карточки:/i);
    expect(card.textContent ?? "").toMatch(/диалоги:/i);
    expect(card.textContent ?? "").toMatch(/только агрегаты/i);
    expect(card.textContent ?? "").not.toMatch(/Иван|Петров|Сидор|@|\+7\s?\(?\d/);
  });

  it("Batch L: показывает операционный разбор по узким местам", () => {
    const { getByText } = renderPage();
    const card = getByText("Операционный разбор").closest("div.p-4") as HTMLElement;
    expect(card).toBeTruthy();

    const cards = getAnalysisCards();
    const dialogs = getDialogs();
    const leads = getLeads();
    const needsRepeat = cards.filter((c) => !c.qualityGate.passed).length;
    const handoff = dialogs.filter((d) => d.state === "with_operator").length;
    const lost = leads.filter((l) => l.status === "lost").length;
    const highUrgent = cards.filter((c) => c.routingRisk === "high" || c.routingRisk === "urgent").length;

    expect(card.textContent ?? "").toMatch(/Повтор фото/);
    expect(card.textContent ?? "").toMatch(/Передача оператору/);
    expect(card.textContent ?? "").toMatch(/Потерянные лиды/);
    expect(card.textContent ?? "").toMatch(/Высокий\/срочный маршрут/);
    for (const n of [needsRepeat, handoff, lost, highUrgent]) {
      expect(card.textContent ?? "").toContain(String(n));
    }
    expect(card.textContent ?? "").toMatch(/без персональных строк/i);
  });

  it("Batch N: показывает проверку финансовой методики перед production", () => {
    const { getByText } = renderPage();
    const card = getByText("Проверка методики").closest("div.p-4") as HTMLElement;
    expect(card).toBeTruthy();
    expect(card.textContent ?? "").toMatch(/методика не утверждена/i);
    expect(card.textContent ?? "").toMatch(/Интервью с клиникой/);
    expect(card.textContent ?? "").toMatch(/Стоимость услуги/);
    expect(card.textContent ?? "").toMatch(/Стоимость сервиса/);
    expect(card.textContent ?? "").toMatch(/Сверка с записью\/оплатой/);
    expect(card.textContent ?? "").toMatch(/Утверждение методики/);
    expect(card.textContent ?? "").toMatch(/только агрегаты/i);
    expect(card.textContent ?? "").toMatch(/без пациентских строк/i);
    expect(card.textContent ?? "").not.toMatch(/Иван|Петров|Сидор|@|\+7\s?\(?\d/);
  });
});

describe("AdminAnalyticsPage — фильтр периода", () => {
  it("переключение на «Март 2026» меняет KPI «Лиды» на агрегат по марту", () => {
    const { container, getByRole } = renderPage();

    const leadsAll = getLeads().length;
    const leadsMarch = getLeads().filter((l) => {
      const t = Date.parse(l.createdAt);
      return (
        t >= Date.parse("2026-03-01T00:00:00Z") &&
        t < Date.parse("2026-04-01T00:00:00Z")
      );
    }).length;

    const leadsKpi = (): string => {
      const labels = Array.from(
        container.querySelectorAll(".uppercase.tracking-wide"),
      ) as HTMLElement[];
      const label = labels.find((el) => el.textContent?.trim() === "Лиды");
      return label?.parentElement?.textContent ?? "";
    };

    expect(leadsKpi()).toContain(String(leadsAll));

    fireEvent.click(getByRole("tab", { name: "Март 2026" }));

    expect(leadsKpi()).toContain(String(leadsMarch));
    // sanity: значения отличаются (иначе фильтр не работает)
    expect(leadsAll).not.toBe(leadsMarch);
  });
});

describe("AdminAnalyticsPage — демо-действия", () => {
  it("«Экспорт CSV (демо, отключено)» кнопка disabled", () => {
    const { getByRole } = renderPage();
    const btn = getByRole("button", {
      name: /Экспорт CSV \(демо, отключено\)/,
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("«Сформировать отчёт (демо)» показывает безопасный JSON только с агрегатами", () => {
    const { getByRole, getByLabelText } = renderPage();
    fireEvent.click(getByRole("button", { name: /Сформировать отчёт/ }));

    const pre = getByLabelText(
      "Безопасный агрегатный предпросмотр отчёта",
    ) as HTMLElement;
    const json = pre.textContent ?? "";
    expect(json).toMatch(/"kpi"/);
    expect(json).toMatch(/"funnel"/);
    expect(json).toMatch(/"sources"/);
    expect(json).toMatch(/"clinics"/);
    expect(json).toMatch(/"risk"/);
    expect(json).toMatch(/"imageQuality"/);
    expect(json).toMatch(/"botDialogStates"/);
    expect(json).toMatch(/"financialValue"/);
    expect(json).toMatch(/"financeAssumptions"/);
    expect(json).toMatch(/"clinicValue"/);
    expect(json).toMatch(/"methodologyStatus": "demo_needs_validation"/);
    expect(json).toMatch(/"periodSlice"/);
    expect(json).toMatch(/"operationalBottlenecks"/);
    expect(json).toMatch(/"financeMethodologyValidation"/);
    expect(json).toMatch(/"methodologyStatus": "needs_clinic_validation"/);
    expect(json).toMatch(/"brainstormTask": "SD-MF-048"/);
    expect(json).toMatch(/"blockedUntil": "clinic_methodology_approved"/);
    expect(json).toMatch(/"scope": "aggregate_only"/);

    // Запрещённые токены не должны утечь и в JSON.
    for (const t of FORBIDDEN_TOKENS) {
      expect(json, `forbidden token "${t}" leaked into report JSON`).not.toMatch(
        new RegExp(t),
      );
    }
    expect(json).not.toMatch(/tg:|wa:|web:|mock:\/\/|pal-tok-/);
  });
});
