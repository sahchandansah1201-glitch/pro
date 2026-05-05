import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const j = (...p: string[]) => p.join("");
const FORBIDDEN_TOKENS = [
  j("doctor", "Version", "Text"),
  j("diag", "nosis"),
  j("model", "Version"),
  j("heatmap", "Ref"),
  j("photo", "Ref"),
  j("storage", "Path"),
  j("shared", "Link"),
  j("external", "User", "Ref"),
  j("protected", "Analysis", "Link"),
];

const FORBIDDEN_APIS = [
  j("fet", "ch", "("),
  j("ax", "ios"),
  j("XML", "Http", "Request"),
  j("send", "Beacon"),
  j("navigator", ".", "clipboard"),
  j("media", "Devices"),
  j("local", "Storage"),
  j("session", "Storage"),
  j("Date", ".", "now", "("),
  j("window", ".", "print"),
];

const PATIENT_DIR = "src/pages/patient";

const collectFiles = (): string[] =>
  readdirSync(PATIENT_DIR)
    .filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => join(PATIENT_DIR, f));

describe("Patient pages — hygiene scan", () => {
  const files = collectFiles();

  it("source contains no forbidden tokens", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const t of FORBIDDEN_TOKENS) {
        expect(src.includes(t), `${f} contains forbidden token ${t}`).toBe(false);
      }
    }
  });

  it("source contains no network/storage/Date.now/window.print", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const a of FORBIDDEN_APIS) {
        expect(src.includes(a), `${f} contains forbidden API ${a}`).toBe(false);
      }
    }
  });
});
