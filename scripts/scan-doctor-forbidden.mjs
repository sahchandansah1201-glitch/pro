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

const ROOT = process.cwd();
const REPORT_DIR = join(ROOT, "reports", "doctor-hygiene");
const REPORT_JSON = join(REPORT_DIR, "scan-report.json");
const REPORT_MD = join(REPORT_DIR, "scan-report.md");
const REPORT_MD_REL = "reports/doctor-hygiene/scan-report.md";
const SCAN_TS = "2026-05-04T00:00:00Z";

const argv = process.argv.slice(2);
const explicitPaths = argv.filter((a) => !a.startsWith("--"));
const mode = argv.includes("--staged")
  ? "staged"
  : argv.includes("--changed")
    ? "changed"
    : explicitPaths.length > 0
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

// Относительные пути целей — для фильтра staged/changed/explicit.
const TARGET_FILES = new Set();
const TARGET_DIRS = [];
for (const t of SCAN_TARGETS) {
  const abs = resolve(ROOT, t);
  if (existsSync(abs) && statSync(abs).isDirectory()) {
    TARGET_DIRS.push(t.replace(/\/+$/, "") + "/");
  } else {
    TARGET_FILES.add(t);
  }
}

function inTargets(relPath) {
  if (TARGET_FILES.has(relPath)) return true;
  return TARGET_DIRS.some((d) => relPath.startsWith(d));
}

function gitFiles(args) {
  try {
    return execSync(`git ${args}`, { cwd: ROOT, encoding: "utf8" })
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function collectFiles() {
  if (mode === "full") {
    return SCAN_TARGETS.flatMap((t) => walk(join(ROOT, t)));
  }
  let candidates = [];
  if (mode === "explicit") {
    candidates = explicitPaths;
  } else if (mode === "staged") {
    candidates = gitFiles("diff --cached --name-only --diff-filter=ACMRTUXB");
  } else if (mode === "changed") {
    candidates = [
      ...gitFiles("diff --cached --name-only --diff-filter=ACMRTUXB"),
      ...gitFiles("diff --name-only --diff-filter=ACMRTUXB"),
      ...gitFiles("ls-files --others --exclude-standard"),
    ];
  }
  const uniq = Array.from(new Set(candidates));
  return uniq
    .filter((rel) => inTargets(rel) && isScannable(rel))
    .map((rel) => join(ROOT, rel))
    .filter((abs) => existsSync(abs));
}

const files = collectFiles();
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

const byFile = {};
for (const f of findings) (byFile[f.file] ||= []).push(f);

// Отчёты пишем только при полном скане, чтобы хуки/explicit не перезаписывали
// "official" артефакт.
const writeReports = mode === "full";

if (writeReports) {
  const report = {
    scannedAt: SCAN_TS,
    mode,
    targets: SCAN_TARGETS,
    filesScanned: files.map((f) => relative(ROOT, f)).sort(),
    filesScannedCount: files.length,
    tokensCount: FORBIDDEN_TOKENS.length,
    findingsCount: findings.length,
    findings,
    status: findings.length === 0 ? "clean" : "violations",
  };
  const md = [];
  md.push(`# Doctor hygiene scan`);
  md.push("");
  md.push(`- Дата сканирования: \`${SCAN_TS}\``);
  md.push(`- Режим: \`${mode}\``);
  md.push(`- Цели: ${SCAN_TARGETS.map((t) => `\`${t}\``).join(", ")}`);
  md.push(`- Файлов просканировано: **${files.length}**`);
  md.push(`- Токенов в наборе: **${FORBIDDEN_TOKENS.length}**`);
  md.push(`- Статус: ${findings.length === 0 ? "✅ **clean**" : `❌ **violations** (${findings.length})`}`);
  md.push("");
  md.push(`## Просканированные файлы`);
  md.push("");
  for (const f of report.filesScanned) md.push(`- \`${f}\``);
  md.push("");
  md.push(`## Совпадения`);
  md.push("");
  if (findings.length === 0) {
    md.push(`Совпадений не найдено.`);
    md.push("");
  } else {
    // Сводка по токенам — топ нарушаемых правил.
    const byTok = {};
    for (const f of findings) byTok[f.token] = (byTok[f.token] || 0) + 1;
    const rows = Object.entries(byTok).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    md.push(`#### Сводка по токенам`);
    md.push("");
    md.push(`| Токен | Совпадений |`);
    md.push(`| --- | ---: |`);
    for (const [tok, cnt] of rows) md.push(`| \`${tok}\` | ${cnt} |`);
    md.push("");
    for (const file of Object.keys(byFile).sort()) {
      md.push(`### \`${file}\``);
      md.push("");
      md.push(`| Строка | Токен | Контекст |`);
      md.push(`| ---: | --- | --- |`);
      for (const f of byFile[file]) {
        const safe = f.text.replace(/\|/g, "\\|");
        md.push(`| ${f.line} | \`${f.token}\` | \`${safe}\` |`);
      }
      md.push("");
    }
  }
  mkdirSync(dirname(REPORT_JSON), { recursive: true });
  writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2) + "\n", "utf8");
  writeFileSync(REPORT_MD, md.join("\n"), "utf8");
}

// Консольный вывод.
const isTTY = Boolean(process.stdout.isTTY);
const c = (code, s) => (isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const dim = (s) => c("2", s);
const bold = (s) => c("1", s);
const red = (s) => c("31", s);
const green = (s) => c("32", s);
const yellow = (s) => c("33", s);
const cyan = (s) => c("36", s);

const HR = dim("─".repeat(72));
console.log(HR);
console.log(`${bold("doctor-hygiene-scan")}  ${dim(SCAN_TS)}  ${dim("режим:")} ${bold(mode)}`);
console.log(HR);
console.log(`  ${dim("Цели        :")} ${SCAN_TARGETS.join(", ")}`);
console.log(`  ${dim("Файлов      :")} ${files.length}`);
console.log(`  ${dim("Токенов     :")} ${FORBIDDEN_TOKENS.length}`);
// file://-URL — кликабельная в большинстве терминалов и IDE.
const fileUrl = (p) => "file://" + p.replace(/\\/g, "/");
if (writeReports) {
  console.log(`  ${dim("Отчёт JSON  :")} ${relative(ROOT, REPORT_JSON)}`);
  console.log(`  ${dim("Отчёт MD    :")} ${relative(ROOT, REPORT_MD)}`);
  console.log(`  ${dim("Открыть     :")} ${cyan(fileUrl(REPORT_MD))}`);
}
console.log(HR);

if (files.length === 0) {
  console.log(`  ${green("✓ Нет файлов для сканирования в этом режиме.")}`);
  console.log(HR);
  process.exit(0);
}

if (findings.length === 0) {
  console.log(`  ${green("✓ Совпадений не найдено — doctor-контекст чист.")}`);
  console.log(HR);
  process.exit(0);
}

console.log(`  ${red(`✗ Найдено совпадений: ${findings.length}`)} в ${Object.keys(byFile).length} файл(ах)`);
console.log(HR);

const sortedFiles = Object.keys(byFile).sort();
const maxLineW = Math.max(...findings.map((f) => String(f.line).length));
const maxTokW = Math.min(28, Math.max(...findings.map((f) => f.token.length)));

for (const file of sortedFiles) {
  const items = byFile[file];
  console.log(`\n  ${cyan(file)}  ${dim(`(${items.length})`)}`);
  for (const it of items) {
    const ln = String(it.line).padStart(maxLineW);
    const tk = it.token.padEnd(maxTokW).slice(0, maxTokW);
    const ctx = it.text.length > 80 ? it.text.slice(0, 77) + "…" : it.text;
    console.log(`    ${dim(ln + " │")} ${yellow(tk)} ${dim("│")} ${ctx}`);
  }
}

// Сводка по токенам — какие правила чаще всего нарушаются.
const byToken = {};
for (const f of findings) byToken[f.token] = (byToken[f.token] || 0) + 1;
const tokenRows = Object.entries(byToken).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
const maxSumTokW = Math.min(28, Math.max(...tokenRows.map(([t]) => t.length)));
const maxSumCntW = String(tokenRows[0][1]).length;

console.log("");
console.log(HR);
console.log(`  ${bold("Сводка по токенам")}  ${dim(`(${tokenRows.length} уникальных)`)}`);
console.log(HR);
for (const [tok, cnt] of tokenRows) {
  const t = tok.padEnd(maxSumTokW).slice(0, maxSumTokW);
  const n = String(cnt).padStart(maxSumCntW);
  console.log(`    ${yellow(t)} ${dim("│")} ${bold(n)}`);
}

console.log("");
console.log(HR);
console.log(`  ${red("Сканирование завершено с ошибкой.")}`);
if (writeReports) {
  console.log(`  ${dim("Подробный отчёт:")} ${cyan(fileUrl(REPORT_MD))}`);
} else {
  console.log(`  ${dim("Полный скан + отчёт:")} ${bold("npm run scan:doctor")}`);
  console.log(`  ${dim("Откроется здесь    :")} ${cyan(fileUrl(REPORT_MD))}`);
}
console.log(HR);
process.exit(1);
