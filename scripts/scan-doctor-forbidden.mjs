#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";
import { execSync } from "node:child_process";
import { FORBIDDEN_TOKENS, SCAN_TARGETS } from "./forbidden-patterns.mjs";

// Сканер запрещённых паттернов для doctor-контекста.
// Список токенов и цели — в scripts/forbidden-patterns.mjs.
//
// Режимы:
//   (по умолчанию)   — полный скан SCAN_TARGETS, пишет отчёты в reports/
//   --staged         — только git staged-файлы (pre-commit)
//   --changed        — staged + изменённые в рабочей копии (pre-push)
//   path1 path2 ...  — явный список путей
//
// Файлы вне SCAN_TARGETS, тесты (*.test.ts(x)) и *.hygiene.test.* игнорируются.

const ROOT = process.cwd();
const REPORT_DIR = join(ROOT, "reports", "doctor-hygiene");
const REPORT_JSON = join(REPORT_DIR, "scan-report.json");
const REPORT_MD = join(REPORT_DIR, "scan-report.md");
const SCAN_TS = "2026-05-04T00:00:00Z";

const args = process.argv.slice(2);
const mode = args.includes("--staged")
  ? "staged"
  : args.includes("--changed")
    ? "changed"
    : args.filter((a) => !a.startsWith("--")).length > 0
      ? "explicit"
      : "full";

function isScannable(path) {
  return (
    /\.(ts|tsx|js|jsx)$/.test(path) &&
    !/\.test\.(ts|tsx)$/.test(path) &&
    !/\.hygiene\.test\./.test(path)
  );
}

function walk(path, out = []) {
  if (!existsSync(path)) return out;
  const st = statSync(path);
  if (st.isDirectory()) {
    for (const name of readdirSync(path)) walk(join(path, name), out);
  } else if (st.isFile() && isScannable(path)) {
    out.push(path);
  }
  return out;
}

// Нормализованные относительные пути SCAN_TARGETS — для проверки попадания.
const TARGET_DIRS = SCAN_TARGET
