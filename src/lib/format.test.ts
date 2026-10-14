import { afterEach, describe, expect, it, vi } from "vitest";

import { consentLabel, formatAge, formatLocalIsoDate, sexShort } from "@/lib/format";

afterEach(() => { vi.useRealTimers(); });

describe("clinical display formatters", () => {
  it("formats a supplied local calendar date without converting it to UTC", () => {
    expect(formatLocalIsoDate(new Date(2026, 0, 2, 0, 15))).toBe("2026-01-02");
  });

  it("uses the current local day by default and follows the clock across midnight", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59));
    expect(formatLocalIsoDate()).toBe("2026-12-31");
    vi.setSystemTime(new Date(2027, 0, 1, 0, 1));
    expect(formatLocalIsoDate()).toBe("2027-01-01");
  });

  it("renders missing demographic and consent values without guessing", () => {
    expect(formatAge(null)).toBe("Возраст не указан");
    expect(formatAge("not-a-date")).toBe("Возраст не указан");
    expect(formatAge("2024-02-30")).toBe("Возраст не указан");
    expect(formatAge("2999-01-01")).toBe("Возраст не указан");
    expect(sexShort(null)).toBe("Не указан");
    expect(consentLabel(null)).toBe("Не зафиксировано");
  });
});
