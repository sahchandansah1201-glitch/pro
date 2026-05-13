#!/usr/bin/env node
// Stage 4A · Guard the self-hosted frontend+backend product direction.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ARCH_DOC = "docs/architecture/stage-4a-self-hosted-product.md";
const PACKAGE_JSON = "package.json";
const PRODUCT = "PRODUCT.md";
const DESIGN = "DESIGN.md";
const PREFLIGHT_ALL = "scripts/preflight-all.mjs";
const SELF_CHECK = "scripts/check-self-hosted-product.mjs";
const SELF_TEST = "scripts/check-self-hosted-product.test.mjs";
const WORKFLOW = ".github/workflows/self-hosted-product.yml";
const STAGE_1I = "docs/frontend/stage-1i-auth-assets-readiness.md";
const STAGE_3I = "docs/frontend/stage-3i-final-documentation-index.md";
const STAGE_3M = "docs/frontend/stage-3m-release-operations-dashboard.md";

const REQUIRED_FILES = [
  PRODUCT,
  DESIGN,
  ARCH_DOC,
  PACKAGE_JSON,
  PREFLIGHT_ALL,
  SELF_CHECK,
  SELF_TEST,
  WORKFLOW,
  STAGE_1I,
  STAGE_3I,
  STAGE_3M,
];

const REQUIRED_TEXT = {
  [PRODUCT]: [
    "self-hosted",
    "frontend + backend + database + file storage",
    "Supabase Cloud **не считается** целевой зависимостью",
    "новые компоненты не должны добавлять",
    "зависимость от Supabase Cloud",
    "docs/architecture/stage-4a-self-hosted-product.md",
    "npm run check:self-hosted-product",
    "npm run preflight:all",
  ],
  [DESIGN]: [
    "Продуктовый клинический UI",
    "React + TypeScript",
    "Никаких hero-секций",
    "Контраст AA",
  ],
  [ARCH_DOC]: [
    "# Stage 4A - Self-hosted product architecture guardrail",
    "## 1. Purpose",
    "## 2. Target deployment shape",
    "## 3. Required runtime components",
    "## 4. Supabase transition rule",
    "## 5. Backend ownership rules",
    "## 6. Frontend integration rules",
    "## 7. Verification commands",
    "## 8. Lovable and Codex working rule",
    "## 9. Acceptance criteria",
    "frontend + backend API",
    "object storage",
    "PostgreSQL-compatible relational database",
    "S3-compatible or local object storage",
    "Supabase Cloud is not the target architecture",
    "npm run check:self-hosted-product",
    "npm run test:self-hosted-product",
    "npm run preflight:all",
  ],
  [PREFLIGHT_ALL]: [
    "self-hosted product guard",
    "check:self-hosted-product",
  ],
  [WORKFLOW]: [
    "name: self-hosted-product",
    "npm run test:self-hosted-product",
    "npm run check:self-hosted-product",
    "docs/architecture/**",
    "PRODUCT.md",
    "DESIGN.md",
  ],
  [STAGE_1I]: [
    "npm run check:self-hosted-product",
    "docs/architecture/stage-4a-self-hosted-product.md",
  ],
  [STAGE_3I]: [
    "npm run test:self-hosted-product",
    "npm run check:self-hosted-product",
    "Stage 4A self-hosted product guard",
    "PR #78",
  ],
  [STAGE_3M]: [
    "### 12.4 Self-hosted product guard",
    "docs/architecture/stage-4a-self-hosted-product.md",
    "npm run test:self-hosted-product",
    "npm run check:self-hosted-product",
    ".github/workflows/self-hosted-product.yml",
  ],
};

const REQUIRED_PACKAGE_SCRIPTS = {
  "check:self-hosted-product": "node scripts/check-self-hosted-product.mjs",
  "test:self-hosted-product": "node --test scripts/check-self-hosted-product.test.mjs",
};

const FRONTEND_SECRET_ENV_PATTERNS = [
  {
    label: "frontend reads SUPABASE_SERVICE_ROLE_KEY from import.meta.env",
    re: /import\.meta\.env\.[A-Z0-9_]*SUPABASE_SERVICE_ROLE_KEY\b/g,
  },
  {
    label: "frontend reads SUPABASE_SERVICE_ROLE_KEY from process.env",
    re: /process\.env\.[A-Z0-9_]*SUPABASE_SERVICE_ROLE_KEY\b/g,
  },
  {
    label: "frontend uses a Supabase service-role secret key literal",
    re: /\bsb_secret_[A-Za-z0-9_-]+\b/g,
  },
];

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

function extensionOf(path) {
  const dot = path.lastIndexOf(".");
  return dot >= 0 ? path.slice(dot) : "";
}

function defaultReadFile(path) {
  return readFileSync(path, "utf8");
}

function defaultExists(path) {
  return existsSync(path);
}

function listSourceFiles(root = "src") {
  const files = [];

  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (stat.isFile() && SOURCE_EXTENSIONS.has(extensionOf(full))) {
        files.push(relative(process.cwd(), full));
      }
    }
  }

  walk(root);
  return files.sort();
}

function readJson(path, readFile) {
  return JSON.parse(readFile(path));
}

function includesAll(content, texts) {
  return texts.every((text) => content.includes(text));
}

function checkFilePresence({ exists = defaultExists } = {}) {
  return REQUIRED_FILES.map((file) => ({
    label: `${file} exists`,
    ok: exists(file),
  }));
}

function checkRequiredText({ readFile = defaultReadFile, exists = defaultExists } = {}) {
  const checks = [];
  for (const [file, texts] of Object.entries(REQUIRED_TEXT)) {
    if (!exists(file)) {
      checks.push({ label: `${file} required text`, ok: false, detail: "missing file" });
      continue;
    }
    const content = readFile(file);
    for (const text of texts) {
      checks.push({
        label: `${file} contains ${text}`,
        ok: content.includes(text),
      });
    }
  }
  return checks;
}

function checkPackageScripts({ readFile = defaultReadFile } = {}) {
  const pkg = readJson(PACKAGE_JSON, readFile);
  return Object.entries(REQUIRED_PACKAGE_SCRIPTS).map(([name, command]) => ({
    label: `package script ${name}`,
    ok: pkg.scripts?.[name] === command,
  }));
}

function checkFrontendSecrets({
  readFile = defaultReadFile,
  sourceFiles = listSourceFiles(),
} = {}) {
  const checks = [];
  for (const file of sourceFiles) {
    if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
    const content = readFile(file);
    for (const pattern of FRONTEND_SECRET_ENV_PATTERNS) {
      pattern.re.lastIndex = 0;
      checks.push({
        label: `${file}: ${pattern.label}`,
        ok: !pattern.re.test(content),
      });
    }
  }
  return checks;
}

export function collectSelfHostedProductChecks(options = {}) {
  return [
    ...checkFilePresence(options),
    ...checkRequiredText(options),
    ...checkPackageScripts(options),
    ...checkFrontendSecrets(options),
  ];
}

export function summarizeSelfHostedProductChecks(checks) {
  const failed = checks.filter((check) => !check.ok);
  return {
    ok: failed.length === 0,
    total: checks.length,
    failed,
  };
}

export function renderSelfHostedProductReport(checks) {
  const summary = summarizeSelfHostedProductChecks(checks);
  const lines = [
    "## Self-hosted product guard",
    "",
    `- Status: \`${summary.ok ? "ok" : "fail"}\``,
    `- Checks: ${summary.total}`,
    "",
  ];

  if (!summary.ok) {
    lines.push("### Failed checks", "");
    for (const check of summary.failed) {
      lines.push(`- ${check.label}${check.detail ? ` (${check.detail})` : ""}`);
    }
    lines.push("");
  }

  lines.push("### Contract", "");
  lines.push("- Target: frontend + backend API + PostgreSQL-compatible DB + object storage.");
  lines.push("- Supabase Cloud: legacy transition artifact, not the target runtime dependency.");
  lines.push("- Frontend: no service-role env reads or privileged storage credentials.");
  lines.push("");

  return lines.join("\n");
}

export function main() {
  const checks = collectSelfHostedProductChecks();
  const report = renderSelfHostedProductReport(checks);
  const summary = summarizeSelfHostedProductChecks(checks);

  process.stdout.write(report);
  if (!summary.ok) process.exit(1);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}
