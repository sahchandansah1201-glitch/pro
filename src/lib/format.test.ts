import { describe, expect, it } from "vitest";

import { consentLabel, formatAge, sexShort } from "@/lib/format";

describe("clinical display formatters", () => {
  it("renders missing demographic and consent values without guessing", () => {
    expect(formatAge(null)).toBe("Возраст не указан");
    expect(formatAge("not-a-date")).toBe("Возраст не указан");
    expect(formatAge("2024-02-30")).toBe("Возраст не указан");
    expect(formatAge("2999-01-01")).toBe("Возраст не указан");
    expect(sexShort(null)).toBe("Не указан");
    expect(consentLabel(null)).toBe("Не зафиксировано");
  });
});
