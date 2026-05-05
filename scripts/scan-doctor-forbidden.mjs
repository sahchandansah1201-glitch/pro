#!/usr/bin/env node
/**
 * Сканер запрещённых паттернов для doctor-контекста.
 * Список токенов и цели заданы в scrip
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

// ───────────────────────── Консольный вывод ─────────────────────────
// Структурированный, человекочитаемый отчёт. ANSI-цвета — только в TTY.
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
console.log(`${bold("doctor-hygiene-scan")}  ${dim(SCAN_TS)}`);
console.log(HR);
console.log(`  ${dim("Цели        :")} ${SCAN_TARGETS.join(", ")}`);
console.log(`  ${dim("Файлов      :")} ${files.length}`);
console.log(`  ${dim("Токенов     :")} ${FORBIDDEN_TOKENS.length}`);
console.log(`  ${dim("Отчёт JSON  :")} ${relative(ROOT, REPORT_JSON)}`);
console.log(`  ${dim("Отчёт MD    :")} ${relative(ROOT, REPORT_MD)}`);
console.log(HR);

if (findings.length === 0) {
  console.log(`  ${green("✓ Совпадений не найдено — doctor-контекст чист.")}`);
  console.log(HR);
  process.exit(0);
}

console.log(`  ${red(`✗ Найдено совпадений: ${findings.length}`)} в ${Object.keys(byFile).length} файл(ах)`);
console.log(HR);

// Группированный вывод: файл → строки.
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

console.log("");
console.log(HR);
console.log(`  ${red("Сканирование завершено с ошибкой.")} Подробности: ${relative(ROOT, REPORT_MD)}`);
console.log(HR);
process.exit(1);

