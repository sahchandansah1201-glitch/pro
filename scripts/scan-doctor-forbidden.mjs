#!/usr/bin/env node
/**
 * Сканер запрещённых паттернов для doctor-контекста.
 * Список токенов и цели заданы в scripts/forbidden-patterns.mjs (единый источник).
 *
 * Запуск:
 *   node scripts/scan-doctor-forbidden.mjs
 *
 * Артефакты отчёта (всегда перезаписываются):
 *   reports/doctor-hygiene/scan-report.json — машиночитаемый
 *   reports/doctor-hygiene/scan-report.md   — для удобного просмотра
 */
import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import {
  FORBIDDEN_TOKENS,
  SCAN_TARGETS,
} from "./forbidden-patterns.mjs";

const ROOT = process.cwd();
const REPORT_DIR = join(ROOT, "reports", "doctor-hygiene");
const REPORT_JSON = join(REPORT_DIR, "scan-report.json");
const REPORT_MD = join(REPORT_DIR, "scan-report.md");
// Детерминированный таймстамп — соответствует DEMO_NOW проекта.
const SCAN_TS = "2026-05-04T00:00:00Z";

function walk(path, out = []) {
  const st = statSync(path);
  if (st.isDirectory()) {
    for (const name of readdirSync(path)) walk(join(path, name), out);
  } else if (
    st.isFile() &&
    /\.(ts|tsx|js|jsx)$/.test(path) &&
    !/\.test\.(ts|tsx)$/.test(path) &&
    !/\.hygiene\.test\./.test(path)
  ) {
    out.push(path);
  }
  return out;
}

const files = SCAN_TARGETS.flatMap((t) => walk(join(ROOT, t)));
const findings = [];

for (const file of files) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const token of FORBIDDEN_TOKENS) {
      if (line.includes(token)) {
        findings.push({
          file: relative(ROOT, file),
          line: i + 1,
          token,
          text: line.trim(),
        });
      }
    }
  });
}

// Группировка для отчёта.
const byFile = {};
for (const f of findings) {
  (byFile[f.file] ||= []).push(f);
}

const report = {
  scannedAt: SCAN_TS,
  targets: SCAN_TARGETS,
  filesScanned: files.map((f) => relative(ROOT, f)).sort(),
  filesScannedCount: files.length,
  tokensCount: FORBIDDEN_TOKENS.length,
  findingsCount: findings.length,
  findings,
  status: findings.length === 0 ? "clean" : "violations",
};

// Markdown-версия — для людей.
const mdLines = [];
mdLines.push(`# Doctor hygiene scan`);
mdLines.push("");
mdLines.push(`- Дата сканирования: \`${SCAN_TS}\``);
mdLines.push(`- Цели: ${SCAN_TARGETS.map((t) => `\`${t}\``).join(", ")}`);
mdLines.push(`- Файлов просканировано: **${files.length}**`);
mdLines.push(`- Токенов в наборе: **${FORBIDDEN_TOKENS.length}**`);
mdLines.push(
  `- Статус: ${findings.length === 0 ? "✅ **clean**" : `❌ **violations** (${findings.length})`}`,
);
mdLines.push("");
mdLines.push(`## Просканированные файлы`);
mdLines.push("");
for (const f of report.filesScanned) mdLines.push(`- \`${f}\``);
mdLines.push("");
if (findings.length > 0) {
  mdLines.push(`## Совпадения`);
  mdLines.push("");
  for (const file of Object.keys(byFile).sort()) {
    mdLines.push(`### \`${file}\``);
    mdLines.push("");
    mdLines.push(`| Строка | Токен | Контекст |`);
    mdLines.push(`| ---: | --- | --- |`);
    for (const f of byFile[file]) {
      const safe = f.text.replace(/\|/g, "\\|");
      mdLines.push(`| ${f.line} | \`${f.token}\` | \`${safe}\` |`);
    }
    mdLines.push("");
  }
} else {
  mdLines.push(`## Совпадения`);
  mdLines.push("");
  mdLines.push(`Совпадений не найдено.`);
  mdLines.push("");
}

mkdirSync(dirname(REPORT_JSON), { recursive: true });
writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");
writeFileSync(REPORT_MD, mdLines.join("\n"), "utf8");

console.log(`[doctor-hygiene-scan] ${SCAN_TS}`);
console.log(`[doctor-hygiene-scan] просканировано файлов: ${files.length}`);
console.log(`[doctor-hygiene-scan] запрещённых токенов: ${FORBIDDEN_TOKENS.length}`);
console.log(`[doctor-hygiene-scan] отчёт: ${relative(ROOT, REPORT_JSON)}`);
console.log(`[doctor-hygiene-scan] отчёт: ${relative(ROOT, REPORT_MD)}`);

if (findings.length === 0) {
  console.log("[doctor-hygiene-scan] ✓ совпадений не найдено");
  process.exit(0);
}

console.log(`[doctor-hygiene-scan] ✗ найдено совпадений: ${findings.length}`);
for (const f of findings) {
  console.log(`  ${f.file}:${f.line}  [${f.token}]  ${f.text}`);
}
process.exit(1);
