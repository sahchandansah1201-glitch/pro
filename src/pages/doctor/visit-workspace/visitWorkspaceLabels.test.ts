import { describe, expect, it } from "vitest";

import { humanDisplayValue, humanFieldTerm } from "./visitWorkspaceLabels";

const OPERATIONAL_TERMS = [
  "Review",
  "Workflow",
  "Assets",
  "Device",
  "Bridge",
  "Protocol",
  "Policy",
  "Analysis",
  "Assign",
  "Second",
  "Validation",
  "Dataset",
  "Reviewer",
  "Rollback",
  "Monitoring",
  "Window",
  "Owner",
  "Sample",
  "Exceptions",
  "Open evidence",
  "Open governance",
  "File proxy",
  "Release ledger",
  "Patient copy",
] as const;

describe("visit workspace labels", () => {
  it("renders operational field terms as native Russian labels", () => {
    for (const term of OPERATIONAL_TERMS) {
      const label = humanFieldTerm(term);
      expect(label, term).not.toMatch(/[A-Za-z]/);
      expect(label, term).not.toMatch(/Назнач\.|Устр\.|Искл\.|Набл\.|Подтв\.|Ответств\.|Разногл\.|Закр\./);
      expect(label.length, term).toBeGreaterThan(2);
    }
  });

  it("keeps safe Russian values readable instead of replacing them with a service placeholder", () => {
    for (const value of ["есть", "нет", "готов", "не готов", "подтверждён", "нужна проверка", "3 дн."]) {
      expect(humanDisplayValue(value)).toBe(value);
    }
  });
});
