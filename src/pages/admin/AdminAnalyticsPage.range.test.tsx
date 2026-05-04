import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, within, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  getLeads,
  getAppointments,
  getAnalysisCards,
  getDialogs,
  getClinics,
} from "@/lib/mock-data";

/**
 * Контракт фильтра периода и пустых состояний на /admin/analytics.
 *
 * 1) Переключение периода («Все данные» → «Март 2026» → «Последние 90 дней»)
 *    обновляет KPI и числа в секциях: воронка, источники, клиники, риск.
 * 2) Когда отфильтрованные данные пусты, страница не падает и показывает
 *    профессиональные пустые состояния вместо разрывов разметки.
 */

function renderPage(Comp: React.ComponentType) {
  return render(
    <MemoryRouter>
      <Comp />
    </MemoryRouter>,
  );
}

function inMarch(iso: string): boolean {
  const t = Date.parse(iso);
  return (
    t >= Date.parse("2026-03-01T00:00:00Z") &&
    t < Date.parse("2026-04-01T00:00:00Z")
  );
}

function inLast90d(iso: string): boolean {
  const now = Date.parse("2026-03-13T12:00:00Z");
  const start = now - 90 * 24 * 60 * 60 * 1000;
  const t = Date.parse(iso);
  return t >= start && t <= now;
}

function getKpiText(container: HTMLElement, label: string): string {
  const labels = Array.from(
    container.querySelectorAll(".uppercase.tracking-wide"),
  ) as HTMLElement[];
  const el = labels.find((e) => e.textContent?.trim() === label);
  return el?.parentElement?.textContent ?? "";
}

function getSection(container: HTMLElement, title: string): HTMLElement {
  const titleEl = Array.from(container.querySelectorAll("div"))
    .find((d) => d.textContent?.trim() === title) as HTMLElement | undefined;
  if (!titleEl) throw new Error(`section "${title}" not found`);
  return titleEl.closest("div.p-4") as HTMLElement;
}

describe("AdminAnalyticsPage — period switching updates all sections", () => {
  let AdminAnalyticsPage: React.ComponentType;

  beforeEach(async () => {
    vi.resetModules();
    vi.doUnmock("@/lib/mock-data");
    AdminAnalyticsPage = (await import("./AdminAnalyticsPage")).default;
  });

  it("KPI «Лиды/Записаны/Визиты» меняются между «Все данные», «Март 2026» и «Последние 90 дней»", () => {
    const { container, getByRole } = renderPage(AdminAnalyticsPage);

    const allLeads = getLeads().length;
    const marchLeads = getLeads().filter((l) => inMarch(l.createdAt)).length;
    const last90Leads = getLeads().filter((l) => inLast90d(l.createdAt)).length;

    const allBooked = getLeads().filter((l) => l.status === "booked").length;
    const marchBooked = getLeads().filter(
      (l) => l.status === "booked" && inMarch(l.createdAt),
    ).length;

    const allVisits = getAppointments().filter((a) => a.status === "completed")
      .length;
    const marchVisits = getAppointments().filter(
      (a) => a.status === "completed" && inMarch(a.slotAt),
    ).length;

    expect(getKpiText(container, "Лиды")).toContain(String(allLeads));
    expect(getKpiText(container, "Записаны")).toContain(String(allBooked));
    expect(getKpiText(container, "Визиты")).toContain(String(allVisits));

    fireEvent.click(getByRole("tab", { name: "Март 2026" }));
    expect(getKpiText(container, "Лиды")).toContain(String(marchLeads));
    expect(getKpiText(container, "Записаны")).toContain(String(marchBooked));
    expect(getKpiText(container, "Визиты")).toContain(String(marchVisits));
    expect(allLeads).not.toBe(marchLeads);

    fireEvent.click(getByRole("tab", { name: "Последние 90 дней" }));
    expect(getKpiText(container, "Лиды")).toContain(String(last90Leads));
  });

  it("Воронка обновляется при смене периода (счёт лидов = totalLeads)", () => {
    const { container, getByRole } = renderPage(AdminAnalyticsPage);

    const readFunnelLeads = (): string => {
      const section = getSection(container, "Воронка");
      const row = within(section).getByText("Лиды").parentElement!.parentElement!;
      return row.textContent ?? "";
    };

    const allLeads = getLeads().length;
    const marchLeads = getLeads().filter((l) => inMarch(l.createdAt)).length;

    expect(readFunnelLeads()).toContain(String(allLeads));
    fireEvent.click(getByRole("tab", { name: "Март 2026" }));
    expect(readFunnelLeads()).toContain(String(marchLeads));
  });

  it("Раздел «Источники лидов»: сумма count по источникам = total в выбранном периоде", () => {
    const { container, getByRole } = renderPage(AdminAnalyticsPage);

    const sumSources = (): number => {
      const section = getSection(container, "Источники лидов");
      const rows = section.querySelectorAll(".grid");
      let s = 0;
      rows.forEach((row) => {
        const spans = row.querySelectorAll("span");
        if (spans.length >= 4) {
          const n = Number(spans[1].textContent);
          if (!Number.isNaN(n)) s += n;
        }
      });
      return s;
    };

    expect(sumSources()).toBe(getLeads().length);
    fireEvent.click(getByRole("tab", { name: "Март 2026" }));
    expect(sumSources()).toBe(
      getLeads().filter((l) => inMarch(l.createdAt)).length,
    );
  });

  it("Раздел «Маршрутизация по клиникам»: сумма лидов по клиникам = total в периоде", () => {
    const { container, getByRole } = renderPage(AdminAnalyticsPage);

    const sumClinicLeads = (): number => {
      const section = getSection(container, "Маршрутизация по клиникам");
      const rows = section.querySelectorAll(".divide-y > .grid");
      let s = 0;
      rows.forEach((row) => {
        const m = (row.textContent ?? "").match(/лидов:\s*(\d+)/);
        if (m) s += Number(m[1]);
      });
      return s;
    };

    expect(sumClinicLeads()).toBe(getLeads().length);
    fireEvent.click(getByRole("tab", { name: "Март 2026" }));
    expect(sumClinicLeads()).toBe(
      getLeads().filter((l) => inMarch(l.createdAt)).length,
    );
    // Все клиники всё ещё перечислены, даже с 0 лидов:
    const section = getSection(container, "Маршрутизация по клиникам");
    for (const c of getClinics()) {
      expect(within(section).getByText(c.name)).toBeInTheDocument();
    }
  });

  it("Раздел «Распределение по риску»: сумма count по уровням = всего AnalysisCard в периоде", () => {
    const { container, getByRole } = renderPage(AdminAnalyticsPage);

    const sumRisk = (): number => {
      const section = getSection(container, "Распределение по риску");
      const items = section.querySelectorAll("li");
      let s = 0;
      items.forEach((li) => {
        const m = (li.textContent ?? "").match(/(\d+)\s*·/);
        if (m) s += Number(m[1]);
      });
      return s;
    };

    expect(sumRisk()).toBe(getAnalysisCards().length);
    fireEvent.click(getByRole("tab", { name: "Март 2026" }));
    expect(sumRisk()).toBe(
      getAnalysisCards().filter((c) => inMarch(c.createdAt)).length,
    );
  });
});

// ───────── Empty-state suite (with stubbed mock-data) ─────────

describe("AdminAnalyticsPage — пустые состояния при отсутствии данных", () => {
  let AdminAnalyticsPage: React.ComponentType;

  beforeEach(async () => {
    cleanup();
    vi.resetModules();
    vi.doMock("@/lib/mock-data", () => ({
      getLeads: () => [],
      getAppointments: () => [],
      getDialogs: () => [],
      getAnalysisCards: () => [],
      getClinics: () => [],
    }));
    AdminAnalyticsPage = (await import("./AdminAnalyticsPage")).default;
  });

  it("страница не падает и показывает все ожидаемые пустые состояния", () => {
    const { getByText, getAllByRole } = renderPage(AdminAnalyticsPage);

    // Заголовки пустых состояний во всех 6 секциях:
    expect(getByText("Нет лидов")).toBeInTheDocument();
    expect(getByText("Нет источников")).toBeInTheDocument();
    expect(getByText("Нет клиник")).toBeInTheDocument();
    expect(getByText("Нет карточек предварительной оценки")).toBeInTheDocument();
    expect(getByText("Нет снимков")).toBeInTheDocument();
    expect(getByText("Нет диалогов")).toBeInTheDocument();

    // Унифицированные пустые состояния помечены data-empty="true";
    // 6 секций без данных + 0 лишних.
    const empties = getAllByRole("status").filter(
      (el) => el.getAttribute("data-empty") === "true",
    );
    expect(empties.length).toBe(6);
  });

  it("KPI при пустых данных — нули и 0%", () => {
    const { container } = renderPage(AdminAnalyticsPage);
    expect(getKpiText(container, "Лиды")).toContain("0");
    expect(getKpiText(container, "Записаны")).toContain("0");
    expect(getKpiText(container, "Визиты")).toContain("0");
    expect(getKpiText(container, "Конверсия лид → запись")).toContain("0%");
  });
});
