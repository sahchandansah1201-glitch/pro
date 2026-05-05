import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import {
  FORBIDDEN_FIELDS,
  FORBIDDEN_APIS,
  escapeRegex,
} from "../../../scripts/forbidden-patterns.mjs";

// Единый источник запрещённых паттернов — scripts/forbidden-patterns.mjs.
// Здесь только применяем их к подмножеству файлов.

const FILES = [
  "src/pages/doctor/VisitImagingTab.tsx",
  "src/pages/doctor/VisitWorkspacePage.tsx",
  "src/pages/doctor/body-map-model.ts",
];

describe("Source hygiene · VisitImagingTab и связанные страницы", () => {
  for (const file of FILES) {
    it(`${file} — нет запрещённых полей`, async () => {
      const src = await readFile(file, "utf8");
      for (const t of FORBIDDEN_FIELDS) {
        expect(src, `${file} содержит запрещённый токен: ${t}`).not.toMatch(
          new RegExp(escapeRegex(t)),
        );
      }
    });

    it(`${file} — нет network/storage/device API`, async () => {
      const src = await readFile(file, "utf8");
      const re = new RegExp(FORBIDDEN_APIS.map(escapeRegex).join("|"));
      expect(src, `${file} содержит запрещённый API из набора`).not.toMatch(re);
    });
  }
});
