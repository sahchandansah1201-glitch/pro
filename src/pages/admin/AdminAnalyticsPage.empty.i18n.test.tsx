import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * Тест: a11y-контракт empty-states (`role="status"` + `aria-live="polite"`)
 * не ломается при смене языка интерфейса.
 *
 * В проекте пока нет реальной i18n-инфраструктуры, но тексты пустых состояний
 * вынесены в словарь `analytics-empty-copy.ts` — именно его и будут заменять
 * переводы. Поэтому «смена языка» эмулируется через `vi.doMock`: подменяем
 * словарь на en/de/zh-варианты с радикально разной длиной, направлением
 * (включая RTL-арабский) и спецсимволами — и проверяем, что:
 *
 *   1) на всех языках в каждом empty-state остаются `role="status"` и `aria-live="polite"`;
 *   2) количество пустых блоков (6) не меняется;
 *   3) при смене периода контракт сохраняется на любом языке.
 *
 * SAFETY: подменяем только тексты словаря. Никаких пациент-уровневых данных.
 */

type Copy = typeof import("./analytics-empty-copy").ANALYTICS_EMPTY_COPY;
type Resolve = typeof import("./analytics-empty-copy").resolveEmptyCopy;

interface Locale {
  name: string;
  copy: Copy;
}

/** Сборка локали по карте {key: [title, hintTemplate]}. */
function makeLocale(
  name: string,
  map: Record<keyof Copy, [string, string | ((r: string) => string)]>,
): Locale {
  const copy = {} as Copy;
  for (const k of Object.keys(map) as (keyof Copy)[]) {
    const [title, hint] = map[k];
    copy[k] = { title, hint };
  }
  return { name, copy };
}

const LOCALES: Locale[] = [
  makeLocale("en", {
    leads: ["No leads", (r) => `No data for "${r}". Try another range.`],
    sources: ["No sources", (r) => `No data for "${r}".`],
    clinics: ["No clinics", "Add clinics in the directory."],
    analysisCards: ["No assessment cards", (r) => `No data for "${r}".`],
    imageQuality: ["No images", (r) => `No data for "${r}".`],
    botDialogs: ["No dialogs", (r) => `No data for "${r}".`],
  }),
  makeLocale("de", {
    leads: ["Keine Leads", (r) => `Keine Daten für „${r}".`],
    sources: ["Keine Quellen", (r) => `Keine Daten für „${r}".`],
    clinics: ["Keine Kliniken", "Bitte fügen Sie Kliniken hinzu."],
    analysisCards: ["Keine Bewertungskarten", (r) => `Keine Daten für „${r}".`],
    imageQuality: ["Keine Bilder", (r) => `Keine Daten für „${r}".`],
    botDialogs: ["Keine Dialoge", (r) => `Keine Daten für „${r}".`],
  }),
  makeLocale("zh", {
    leads: ["暂无线索", (r) => `「${r}」期间无数据。`],
    sources: ["暂无来源", (r) => `「${r}」期间无数据。`],
    clinics: ["暂无诊所", "请在目录中添加诊所。"],
    analysisCards: ["暂无评估卡", (r) => `「${r}」期间无数据。`],
    imageQuality: ["暂无图片", (r) => `「${r}」期间无数据。`],
    botDialogs: ["暂无对话", (r) => `「${r}」期间无数据。`],
  }),
  makeLocale("ar", {
    // RTL-локаль — отдельная проверка, что ARIA не зависит от направления.
    leads: ["لا توجد عملاء محتملون", (r) => `لا توجد بيانات للفترة "${r}".`],
    sources: ["لا توجد مصادر", (r) => `لا توجد بيانات للفترة "${r}".`],
    clinics: ["لا توجد عيادات", "أضف العيادات في الدليل."],
    analysisCards: ["لا توجد بطاقات تقييم", (r) => `لا توجد بيانات للفترة "${r}".`],
    imageQuality: ["لا توجد صور", (r) => `لا توجد بيانات للفترة "${r}".`],
    botDialogs: ["لا توجد محادثات", (r) => `لا توجد بيانات للفترة "${r}".`],
  }),
];

function renderPage(Comp: React.ComponentType, dir: "ltr" | "rtl" = "ltr") {
  // Эмулируем смену направления документа — это самое близкое к реальной
  // i18n-смене языка, что есть в проекте.
  document.documentElement.setAttribute("dir", dir);
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

function assertAriaContract(container: HTMLElement, ctx: string) {
  const empties = getEmpties(container);
  expect(empties, `${ctx}: количество empty-state не равно 6`).toHaveLength(6);
  for (const el of empties) {
    expect(el.getAttribute("role"), `${ctx}: role`).toBe("status");
    expect(el.getAttribute("aria-live"), `${ctx}: aria-live`).toBe("polite");
  }
}

describe("AdminAnalyticsPage · empty-states · a11y across locales", () => {
  beforeEach(() => {
    cleanup();
    vi.resetModules();
    // Полностью пустые моки, чтобы рендерились все 6 empty-state.
    vi.doMock("@/lib/mock-data", () => ({
      getLeads: () => [],
      getAppointments: () => [],
      getDialogs: () => [],
      getAnalysisCards: () => [],
      getClinics: () => [],
    }));
  });

  afterEach(() => {
    vi.doUnmock("@/lib/mock-data");
    vi.doUnmock("./analytics-empty-copy");
    document.documentElement.removeAttribute("dir");
  });

  for (const loc of LOCALES) {
    it(`[${loc.name}] role/aria-live сохраняются и тексты берутся из подменённого словаря`, async () => {
      // Подменяем словарь — это «смена языка» интерфейса.
      vi.doMock("./analytics-empty-copy", async () => {
        const actual = await vi.importActual<typeof import("./analytics-empty-copy")>(
          "./analytics-empty-copy",
        );
        const resolveEmptyCopy: Resolve = (key, rangeLabel) => {
          const c = loc.copy[key];
          return {
            title: c.title,
            hint: typeof c.hint === "function" ? c.hint(rangeLabel) : c.hint,
          };
        };
        return {
          ...actual,
          ANALYTICS_EMPTY_COPY: loc.copy,
          resolveEmptyCopy,
        };
      });

      const dir = loc.name === "ar" ? "rtl" : "ltr";
      const AdminAnalyticsPage = (await import("./AdminAnalyticsPage")).default;
      const { container, getByRole } = renderPage(AdminAnalyticsPage, dir);

      // 1) ARIA-контракт.
      assertAriaContract(container, `${loc.name} initial`);

      // 2) Тексты действительно из подменённого словаря (а не русские по умолчанию).
      const empties = getEmpties(container);
      const titles = Object.values(loc.copy).map((c) => c.title);
      for (const t of titles) {
        const found = empties.some((el) => (el.textContent ?? "").includes(t));
        expect(found, `${loc.name}: title не отрендерен — «${t}»`).toBe(true);
      }

      // 3) ARIA-контракт сохраняется при смене периода.
      fireEvent.click(getByRole("tab", { name: "Март 2026" }));
      assertAriaContract(container, `${loc.name} after period switch`);
      fireEvent.click(getByRole("tab", { name: "Последние 90 дней" }));
      assertAriaContract(container, `${loc.name} after second switch`);
    });
  }

  it("RTL-направление документа не влияет на role/aria-live empty-states", async () => {
    const ar = LOCALES.find((l) => l.name === "ar")!;
    vi.doMock("./analytics-empty-copy", async () => {
      const actual = await vi.importActual<typeof import("./analytics-empty-copy")>(
        "./analytics-empty-copy",
      );
      return {
        ...actual,
        ANALYTICS_EMPTY_COPY: ar.copy,
        resolveEmptyCopy: ((key, rangeLabel) => {
          const c = ar.copy[key];
          return {
            title: c.title,
            hint: typeof c.hint === "function" ? c.hint(rangeLabel) : c.hint,
          };
        }) as Resolve,
      };
    });

    const AdminAnalyticsPage = (await import("./AdminAnalyticsPage")).default;
    const { container } = renderPage(AdminAnalyticsPage, "rtl");
    expect(document.documentElement.getAttribute("dir")).toBe("rtl");
    assertAriaContract(container, "ar/rtl");
  });
});
