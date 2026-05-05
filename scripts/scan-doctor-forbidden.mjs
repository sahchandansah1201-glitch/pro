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
// Флаги:
//   --quiet, -q      — короткий вывод (статус, файлы, путь к отчёту)

const ROOT = process.cwd();
const REPORT_DIR = join(ROOT, "reports", "doctor-hygiene");
const REPORT_JSON = join(REPORT_DIR, "scan-report.json");
const REPORT_MD = join(REPORT_DIR, "scan-report.md");
const REPORT_HTML = join(REPORT_DIR, "scan-report.html");
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
const quiet = argv.includes("--quiet") || argv.includes("-q");

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
  writeFileSync(REPORT_HTML, renderHtml(report, byFile), "utf8");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function highlightLine(text, tokens) {
  // Подсветка всех вхождений запрещённых токенов в строке.
  const escaped = escapeHtml(text);
  const uniq = Array.from(new Set(tokens)).sort((a, b) => b.length - a.length);
  let out = escaped;
  for (const tok of uniq) {
    const escTok = escapeHtml(tok).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(escTok, "g"), (m) => `<mark>${m}</mark>`);
  }
  return out;
}

function renderHtml(report, byFile) {
  const findings = report.findings;
  const tokensInFiles = {};
  for (const f of findings) (tokensInFiles[f.file] ||= []).push(f.token);

  const byTok = {};
  for (const f of findings) byTok[f.token] = (byTok[f.token] || 0) + 1;
  const tokenRows = Object.entries(byTok).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const statusOk = findings.length === 0;
  const statusBadge = statusOk
    ? `<span class="badge badge-ok">✓ clean</span>`
    : `<span class="badge badge-bad">✗ violations: ${findings.length}</span>`;

  const filesHtml = statusOk
    ? `<p class="muted">Совпадений не найдено.</p>`
    : Object.keys(byFile).sort().map((file) => {
        const items = byFile[file];
        const rows = items.map((f) => `
          <tr>
            <td class="line">${f.line}</td>
            <td class="tok"><code>${escapeHtml(f.token)}</code></td>
            <td class="ctx"><pre><code>${highlightLine(f.text, [f.token])}</code></pre></td>
          </tr>`).join("");
        return `
        <section class="file-block">
          <h3><code>${escapeHtml(file)}</code> <span class="muted">(${items.length})</span></h3>
          <table class="findings">
            <thead><tr><th>Стр.</th><th>Токен</th><th>Контекст</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </section>`;
      }).join("");

  const summaryHtml = statusOk ? "" : `
    <section>
      <h2>Сводка по токенам</h2>
      <table class="summary">
        <thead><tr><th>Токен</th><th>Совпадений</th></tr></thead>
        <tbody>
          ${tokenRows.map(([t, n]) => `<tr><td><code>${escapeHtml(t)}</code></td><td class="num">${n}</td></tr>`).join("")}
        </tbody>
      </table>
    </section>`;

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>Doctor hygiene scan</title>
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 1100px; margin: 24px auto; padding: 0 16px; line-height: 1.45; }
  h1 { margin: 0 0 8px; font-size: 22px; }
  h2 { margin-top: 28px; font-size: 18px; border-bottom: 1px solid #8884; padding-bottom: 4px; }
  h3 { margin: 18px 0 6px; font-size: 14px; font-weight: 600; }
  code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; }
  pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
  .muted { color: #8a8a8a; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: 13px; color: #666; margin: 8px 0 16px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .badge-ok { background: #1a7f3722; color: #1a7f37; }
  .badge-bad { background: #cf222e22; color: #cf222e; }
  table { border-collapse: collapse; width: 100%; margin-top: 6px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #8882; vertical-align: top; }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: #666; font-weight: 600; }
  td.line { width: 56px; text-align: right; color: #888; font-variant-numeric: tabular-nums; }
  td.tok { width: 220px; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; width: 120px; }
  table.summary { max-width: 480px; }
  mark { background: #ffe49633; color: inherit; padding: 0 2px; border-radius: 3px; box-shadow: inset 0 -2px 0 #f0a000aa; }
  .file-block { margin-bottom: 18px; }
  .toolbar { margin: 12px 0 4px; }
  .toolbar a { font-size: 12.5px; color: #0969da; text-decoration: none; margin-right: 14px; }
  .toolbar a:hover { text-decoration: underline; }
  @media (prefers-color-scheme: dark) {
    body { background: #0d1117; color: #e6edf3; }
    .muted, th, td.line, .meta { color: #8b949e; }
    th, td { border-color: #30363d; }
    mark { background: #f2cc6044; box-shadow: inset 0 -2px 0 #f2cc60aa; color: inherit; }
    .toolbar a { color: #58a6ff; }
  }
</style>
</head>
<body>
  <h1>Doctor hygiene scan ${statusBadge}</h1>
  <div class="meta">
    <span><b>Дата:</b> ${escapeHtml(report.scannedAt)}</span>
    <span><b>Режим:</b> <code>${escapeHtml(report.mode)}</code></span>
    <span><b>Файлов:</b> ${report.filesScannedCount}</span>
    <span><b>Токенов:</b> ${report.tokensCount}</span>
    <span><b>Совпадений:</b> ${report.findingsCount}</span>
  </div>
  <div class="toolbar">
    <a href="./scan-report.md">📄 Markdown-отчёт</a>
    <a href="./scan-report.json">🧾 JSON-отчёт</a>
  </div>
  ${summaryHtml}
  <section>
    <h2>Совпадения по файлам</h2>
    ${filesHtml}
  </section>
  <section>
    <h2 class="muted" style="font-size:14px">Цели сканирования</h2>
    <p class="muted"><code>${report.targets.map(escapeHtml).join("</code>, <code>")}</code></p>
  </section>
</body>
</html>
`;
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
const fileUrl = (p) => "file://" + p.replace(/\\/g, "/");

// ── Короткий вывод (--quiet) ────────────────────────────────────────────
if (quiet) {
  const status = files.length === 0
    ? "no-files"
    : findings.length === 0
      ? "clean"
      : "violations";
  const head = status === "violations"
    ? red(`✗ violations: ${findings.length} в ${Object.keys(byFile).length} файл(ах)`)
    : status === "clean"
      ? green(`✓ clean (файлов: ${files.length})`)
      : green(`✓ no-files`);
  console.log(`[doctor-hygiene-scan] ${dim(`режим=${mode}`)} ${head}`);
  if (findings.length > 0) {
    for (const f of Object.keys(byFile).sort()) {
      console.log(`  ${cyan(f)} ${dim(`(${byFile[f].length})`)}`);
    }
    if (writeReports) {
      console.log(`  ${dim("Отчёт:")} ${cyan(fileUrl(REPORT_MD))}`);
    } else {
      console.log(`  ${dim("Подробнее:")} ${bold("npm run scan:doctor")} → ${cyan(fileUrl(REPORT_MD))}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

// ── Подробный вывод ─────────────────────────────────────────────────────
const HR = dim("─".repeat(72));
console.log(HR);
console.log(`${bold("doctor-hygiene-scan")}  ${dim(SCAN_TS)}  ${dim("режим:")} ${bold(mode)}`);
console.log(HR);
console.log(`  ${dim("Цели        :")} ${SCAN_TARGETS.join(", ")}`);
console.log(`  ${dim("Файлов      :")} ${files.length}`);
console.log(`  ${dim("Токенов     :")} ${FORBIDDEN_TOKENS.length}`);
if (writeReports) {
  console.log(`  ${dim("Отчёт JSON  :")} ${relative(ROOT, REPORT_JSON)}`);
  console.log(`  ${dim("Отчёт MD    :")} ${relative(ROOT, REPORT_MD)}`);
  console.log(`  ${dim("Отчёт HTML  :")} ${relative(ROOT, REPORT_HTML)}`);
  console.log(`  ${dim("Открыть MD  :")} ${cyan(fileUrl(REPORT_MD))}`);
  console.log(`  ${dim("Открыть HTML:")} ${cyan(fileUrl(REPORT_HTML))}`);
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
