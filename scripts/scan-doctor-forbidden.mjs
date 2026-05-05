#!/usr/bin/env node
/**
 * Сканер запрещённых паттернов для doctor-контекста.
 * Список токенов и цели заданы в scripts/forbidden-patterns.mjs (единый источник).
 *
 * Запуск: node scripts/scan-doctor-forbidden.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  FORBIDDEN_TOKENS,
  SCAN_TARGETS,
} from "./forbidden-patterns.mjs";

const ROOT = process.cwd();

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
        findings.push({ file: relative(ROOT, file), line: i + 1, token, text: line.trim() });
      }
    }
  });
}

const ts = new Date("2026-05-04T00:00:00Z").toISOString();
console.log(`[doctor-hygiene-scan] ${ts}`);
console.log(`[doctor-hygiene-scan] просканировано файлов: ${files.length}`);
console.log(`[doctor-hygiene-scan] запрещённых токенов: ${FORBIDDEN_TOKENS.length}`);

if (findings.length === 0) {
  console.log("[doctor-hygiene-scan] ✓ совпадений не найдено");
  process.exit(0);
}

console.log(`[doctor-hygiene-scan] ✗ найдено совпадений: ${findings.length}`);
for (const f of findings) {
  console.log(`  ${f.file}:${f.line}  [${f.token}]  ${f.text}`);
}
process.exit(1);
