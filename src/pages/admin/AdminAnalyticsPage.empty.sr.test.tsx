import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  ANALYTICS_EMPTY_COPY,
  resolveEmptyCopy,
  type EmptyStateKey,
} from "./analytics-empty-copy";

/**
 * Тесты доступности текстов empty-states на /admin/analytics.
 *
 * Цель — гарантировать, что скринридер услышит:
 *   1) сам факт пустого состояния (контейнер role="status" + aria-live="polite");
 *   2) заголовок (title) из словаря ANALYTICS_EMPTY_COPY;
 *   3) подсказку (hint), включая её динамическую часть с названием периода.
 *
 * Проверяем именно через textContent контейнера (так его «прочтёт» NVDA/VoiceOver
 * при aria-live="polite") и через aria-атрибуты, без визуальных селекторов.
 */

const ALL_EMPTY_KEYS: EmptyStateKey[] = [
  "leads",
  "sources",
  "clinics",
  "analysisCards",
  "imageQuality",
  "botDialogs",
];

function renderPage(Comp: React.ComponentType) {
  return render(
    <MemoryRouter>
      <Comp />
    </MemoryRouter>,
  );
}

function getEmpties(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-empty="true"]'),
  );
}

/** Нормализация пробелов/неразрывных пробелов для сравнения текста. */
function norm(s: string | null | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").replace(/\u00a0/g, " ").trim();
}

describe("AdminAnalyticsPage · empty-states · screen reader text", () => {
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

  afterEach(() => {
    vi.doUnmock("@/lib/mock-data");
  });

  it("каждый из 6 empty-state контейнеров содержит ровно свой title и hint из словаря", () => {
    const { container } = renderPage(AdminAnalyticsPage);
    const empties = getEmpties(container);
    expect(empties).toHaveLength(6);

    // Маппинг ключей словаря → title (для проверки полного покрытия).
    const expectedByKey = ALL_EMPTY_KEYS.map((k) =>
      resolveEmptyCopy(k, "Все данные"),
    );

    // Каждый title из словаря должен встречаться ровно в одном контейнере.
    for (const exp of expectedByKey) {
      const matches = empties.filter((el) =>
        norm(el.textContent).includes(exp.title),
      );
      expect(matches, `title не найден или дублируется: «${exp.title}»`).toHaveLength(1);
      const el = matches[0];
      // hint в том же самом контейнере — иначе скринридер не свяжет их вместе.
      expect(norm(el.textContent), `hint отсутствует у title «${exp.title}»`).toContain(
        norm(exp.hint),
      );
    }
  });

  it("aria-атрибуты empty-state позволяют скринридеру озвучить весь блок целиком", () => {
    const { container } = renderPage(AdminAnalyticsPage);
    for (const el of getEmpties(container)) {
      // Контейнер озвучивается «вежливо» при появлении.
      expect(el.getAttribute("role")).toBe("status");
      expect(el.getAttribute("aria-live")).toBe("polite");
      // Внутри нет aria-hidden на тексте (иконка hidden — это ОК, она с aria-hidden).
      const textNodes = el.querySelectorAll("div");
      for (const t of Array.from(textNodes)) {
        expect(t.getAttribute("aria-hidden")).not.toBe("true");
      }
      // Иконка-декорация скрыта от скринридера.
      const svg = el.querySelector("svg");
      if (svg) {
        expect(svg.getAttribute("aria-hidden")).not.toBeNull();
      }
    }
  });

  it("динамический hint обновляется при смене периода и читается из контейнера", () => {
    const { container, getByRole } = renderPage(AdminAnalyticsPage);

    // На «Все данные» — hint для leads содержит «Все данные».
    const findByTitle = (title: string) =>
      getEmpties(container).find((el) => norm(el.textContent).includes(title))!;

    const leadsAll = findByTitle("Нет лидов");
    expect(norm(leadsAll.textContent)).toContain("Все данные");

    // Переключаемся на «Март 2026» — hint должен сразу обновиться.
    fireEvent.click(getByRole("tab", { name: "Март 2026" }));
    const leadsMarch = findByTitle("Нет лидов");
    expect(norm(leadsMarch.textContent)).toContain("Март 2026");
    expect(norm(leadsMarch.textContent)).not.toContain("Все данные");

    // А «клиники» не зависят от периода — справочный текст без названия диапазона.
    const clinics = findByTitle("Нет клиник");
    expect(norm(clinics.textContent)).not.toContain("Март 2026");
    expect(norm(clinics.textContent)).toContain("справочнике");
  });

  it("CTA-кнопка empty-state имеет осмысленное доступное имя (aria-label) с упоминанием периода", () => {
    const { container, getByRole } = renderPage(AdminAnalyticsPage);
    fireEvent.click(getByRole("tab", { name: "Март 2026" }));

    for (const el of getEmpties(container)) {
      const btn = within(el).queryByRole("button");
      // У клиник CTA нет — это норм; у остальных — должна быть.
      const isClinic = /Нет клиник/.test(norm(el.textContent));
      if (isClinic) {
        expect(btn).toBeNull();
        continue;
      }
      expect(btn).not.toBeNull();
      const label = btn!.getAttribute("aria-label") ?? norm(btn!.textContent);
      expect(label).toMatch(/Март 2026|Все данные/);
    }
  });

  it("снапшот словаря empty-copy зафиксирован — изменение формулировок требует осознанного обновления", () => {
    // Защищает от случайной правки формулировок без апдейта тестов/переводов.
    expect(ANALYTICS_EMPTY_COPY).toMatchInlineSnapshot(`
      {
        "analysisCards": {
          "hint": [Function],
          "title": "Нет карточек предварительной оценки",
        },
        "botDialogs": {
          "hint": [Function],
          "title": "Нет диалогов",
        },
        "clinics": {
          "hint": "Добавьте клиники в справочнике, чтобы увидеть маршрутизацию.",
          "title": "Нет клиник",
        },
        "imageQuality": {
          "hint": [Function],
          "title": "Нет снимков",
        },
        "leads": {
          "hint": [Function],
          "title": "Нет лидов",
        },
        "sources": {
          "hint": [Function],
          "title": "Нет источников",
        },
      }
    `);
  });
});
