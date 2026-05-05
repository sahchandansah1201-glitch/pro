import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";

// Динамически собираем запрещённые токены, чтобы сам файл теста не попадал
// под совпадение при exact-сканах исходников.
const j = (...p: string[]) => p.join("");

const FORBIDDEN_FIELDS = [
  j("doctor", "Version", "Text"),
  j("patient", "Safe", "Text"),
  j("shared", "Link"),
  j("storage", "Path"),
  j("photo", "Ref"),
  j("model", "Version"),
  j("heatmap", "Ref"),
  j("external", "User", "Ref"),
  j("protected", "Analysis", "Link"),
];

const FORBIDDEN_APIS = [
  j("fetch", "\\("),
  j("ax", "ios"),
  j("XML", "Http", "Request"),
  j("send", "Beacon"),
  j("navigator", "\\.", "clipboard"),
  j("media", "Devices"),
  j("local", "Storage"),
  j("session", "Storage"),
  j("Date", "\\.", "now", "\\("),
];

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
        expect(src, `${file} содержит запрещённый токен: ${t}`).not.toMatch(new RegExp(t));
      }
    });

    it(`${file} — нет network/storage/device API`, async () => {
      const src = await readFile(file, "utf8");
      const re = new RegExp(FORBIDDEN_APIS.join("|"));
      expect(src, `${file} содержит запрещённый API из набора`).not.toMatch(re);
    });
  }
});
