import { describe, it, expect } from "vitest";
import {
  ANALYTICS_EMPTY_COPY,
  resolveEmptyCopy,
  type EmptyStateKey,
} from "./analytics-empty-copy";

const ALL_KEYS: EmptyStateKey[] = [
  "leads",
  "sources",
  "clinics",
  "analysisCards",
  "imageQuality",
  "botDialogs",
];

describe("analytics-empty-copy — словарь текстов empty states", () => {
  it("содержит запись для каждого ожидаемого ключа", () => {
    for (const k of ALL_KEYS) {
      expect(ANALYTICS_EMPTY_COPY).toHaveProperty(k);
      expect(ANALYTICS_EMPTY_COPY[k].title).toBeTruthy();
      expect(ANALYTICS_EMPTY_COPY[k].hint).toBeTruthy();
    }
  });

  it("resolveEmptyCopy возвращает строки для всех ключей и подставляет период", () => {
    for (const k of ALL_KEYS) {
      const c = resolveEmptyCopy(k, "Март 2026");
      expect(typeof c.title).toBe("string");
      expect(typeof c.hint).toBe("string");
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.hint.length).toBeGreaterThan(0);
    }
  });

  it("динамические подсказки содержат лейбл периода, статические — нет", () => {
    expect(resolveEmptyCopy("leads", "Март 2026").hint).toContain("Март 2026");
    expect(resolveEmptyCopy("sources", "Все данные").hint).toContain(
      "Все данные",
    );
    expect(resolveEmptyCopy("analysisCards", "Q1").hint).toContain("Q1");
    expect(resolveEmptyCopy("imageQuality", "Q1").hint).toContain("Q1");
    expect(resolveEmptyCopy("botDialogs", "Q1").hint).toContain("Q1");

    // Клиники не зависят от периода — подсказка стабильная.
    expect(resolveEmptyCopy("clinics", "Q1").hint).not.toContain("Q1");
    expect(resolveEmptyCopy("clinics", "Март 2026").hint).toBe(
      resolveEmptyCopy("clinics", "Q2").hint,
    );
  });

  it("заголовки уникальны (один словарь — одно сообщение на секцию)", () => {
    const titles = ALL_KEYS.map((k) => ANALYTICS_EMPTY_COPY[k].title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
