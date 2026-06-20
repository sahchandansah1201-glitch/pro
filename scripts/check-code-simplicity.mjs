#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DEFAULT_SCAN_DIRS = ["src", "backend/self-hosted"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".mjs"]);
const ROOT = process.env.SIMPLICITY_ROOT || process.cwd();
const SCAN_DIRS = (process.env.SIMPLICITY_SCAN_DIRS || DEFAULT_SCAN_DIRS.join(","))
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const LEDGER_PATH = join(ROOT, "reports", "agent-qa", "simplicity-ledger.json");
const KNOWN_BASELINE_GROWTH_LIMIT = 50;

const KNOWN_OVERSIZED_BASELINE = {
  "backend/self-hosted/clinical-workspace-repository.mjs": 10603,
  "backend/self-hosted/routes.test.mjs": 9732,
  "backend/self-hosted/routes.mjs": 7299,
  "backend/self-hosted/clinical-workspace-service.mjs": 6452,
  "backend/self-hosted/clinical-followup-repository.mjs": 5548,
  "src/pages/doctor/VisitWorkspacePage.tsx": 5308,
  "src/lib/self-hosted-clinical-workspace-api.ts": 4723,
  "backend/self-hosted/clinical-workspace-service.test.mjs": 4590,
  "src/lib/self-hosted-clinical-workspace-api.test.ts": 3975,
  "src/pages/doctor/LesionDetailPage.tsx": 3692,
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": 3208,
  "backend/self-hosted/clinical-followup-service.mjs": 3054,
  "src/pages/sys/SysReleaseStatusPage.tsx": 2969,
  "src/lib/self-hosted-follow-up-api.ts": 2567,
  "src/pages/sys/SysAccessEventsPage.tsx": 2257,
  "src/lib/release-status-ui.ts": 2027,
  "src/pages/doctor/VisitImagingTab.tsx": 1921,
};

const FILE_BUDGETS = {
  frontendPage: 1800,
  frontendClient: 2200,
  backendCore: 3000,
  test: 3500,
  default: 1600,
};

function toPosixPath(path) {
  return path.split(sep).join("/");
}

function extensionOf(path) {
  const match = path.match(/\.[^.]+$/);
  return match ? match[0] : "";
}

function isIgnoredDir(name) {
  return name === "node_modules" || name === "dist" || name === "build" || name === "coverage" || name === "reports";
}

function collectSourceFiles(root, scanDirs = DEFAULT_SCAN_DIRS) {
  const files = [];

  function visit(path) {
    const stats = statSync(path);
    if (stats.isDirectory()) {
      const name = path.split(sep).at(-1);
      if (isIgnoredDir(name)) return;
      for (const child of readdirSync(path)) visit(join(path, child));
      return;
    }

    if (!stats.isFile()) return;
    const extension = extensionOf(path);
    if (!SOURCE_EXTENSIONS.has(extension)) return;
    files.push(path);
  }

  for (const scanDir of scanDirs) {
    const path = join(root, scanDir);
    try {
      visit(path);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  return files.sort();
}

function countLines(path) {
  const text = readFileSync(path, "utf8");
  if (text.length === 0) return 0;
  return text.split(/\r?\n/).length;
}

function isTestFile(relativePath) {
  return /\.(test|spec)\.(ts|tsx|mjs)$/.test(relativePath);
}

function fileBudget(relativePath) {
  if (isTestFile(relativePath)) return FILE_BUDGETS.test;
  if (relativePath.startsWith("src/pages/")) return FILE_BUDGETS.frontendPage;
  if (relativePath.startsWith("src/lib/self-hosted-")) return FILE_BUDGETS.frontendClient;
  if (relativePath.startsWith("backend/self-hosted/")) return FILE_BUDGETS.backendCore;
  return FILE_BUDGETS.default;
}

export function analyzeSimplicity({ root = ROOT, scanDirs = SCAN_DIRS } = {}) {
  const files = collectSourceFiles(root, scanDirs);
  const analyzedFiles = files.map((file) => {
    const relativePath = toPosixPath(relative(root, file));
    const lines = countLines(file);
    const baseline = KNOWN_OVERSIZED_BASELINE[relativePath] || null;
    const budget = baseline ? baseline + KNOWN_BASELINE_GROWTH_LIMIT : fileBudget(relativePath);
    const knownOversized = Boolean(baseline);
    const violation =
      knownOversized && lines > budget
        ? "known_file_growth"
        : !knownOversized && lines > budget
          ? "new_oversized_file"
          : null;

    return {
      path: relativePath,
      lines,
      budget,
      knownOversized,
      baseline,
      violation,
    };
  });

  const violations = analyzedFiles.filter((file) => file.violation);
  const knownOversizedFiles = analyzedFiles.filter((file) => file.knownOversized);
  const largestFiles = [...analyzedFiles].sort((a, b) => b.lines - a.lines).slice(0, 15);

  return {
    generatedAt: new Date().toISOString(),
    status: violations.length === 0 ? "passed" : "failed",
    policy: {
      type: "baseline_ratchet",
      knownBaselineGrowthLimit: KNOWN_BASELINE_GROWTH_LIMIT,
      budgets: FILE_BUDGETS,
      scanDirs,
      note: "Existing oversized files are tracked debt. The gate fails on growth beyond baseline or new oversized files.",
    },
    metrics: {
      scannedFileCount: analyzedFiles.length,
      knownOversizedFileCount: knownOversizedFiles.length,
      newOversizedFileCount: violations.filter((file) => file.violation === "new_oversized_file").length,
      knownFileGrowthViolationCount: violations.filter((file) => file.violation === "known_file_growth").length,
      violationCount: violations.length,
    },
    violations,
    largestFiles,
  };
}

export function writeSimplicityLedger(result, path = LEDGER_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(result, null, 2)}\n`);
}

function runCli() {
  const result = analyzeSimplicity();
  writeSimplicityLedger(result);

  const summary = `scanned=${result.metrics.scannedFileCount} knownOversized=${result.metrics.knownOversizedFileCount} violations=${result.metrics.violationCount}`;
  if (result.status === "passed") {
    console.log(`[qa:simplicity] OK ${summary}; ledger=reports/agent-qa/simplicity-ledger.json`);
    return;
  }

  console.error(`[qa:simplicity] FAILED ${summary}`);
  for (const file of result.violations) {
    console.error(`- ${file.violation}: ${file.path} has ${file.lines} lines, budget ${file.budget}`);
  }
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli();
}
