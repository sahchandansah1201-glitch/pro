import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const j = (...p: string[]) => p.join("");

const FORBIDDEN_TOKENS = [
  j("doctor", "Version", "Text"),
  j("patient", "Safe", "Text"),
  j("shared", "Link"),
  j("storage", "Path"),
  j("photo", "Ref"),
  j("model", "Version"),
  j("heatmap", "Ref"),
  j("external", "User", "Ref"),
  j("protected", "Analysis", "Link"),
  j("diag", "nosis"),
  j("xai", "Notes"),
  j("uncertainty", "Notes"),
  j("suspected", "Features"),
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

const DIRS = ["src/pages/public"];

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) yield p;
  }
}

describe("Public pages — hygiene scan", () => {
  const files: string[] = [];
  for (const d of DIRS) for (const f of walk(d)) files.push(f);

  it("исходники не содержат запрещённых клинических токенов", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const t of FORBIDDEN_TOKENS) {
        expect(src.includes(t), `${f} contains ${t}`).toBe(false);
      }
    }
  });

  it("исходники не содержат запрещённых сетевых/storage/timing/print API", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const a of FORBIDDEN_APIS) {
        expect(src.includes(a), `${f} contains ${a}`).toBe(false);
      }
    }
  });
});
