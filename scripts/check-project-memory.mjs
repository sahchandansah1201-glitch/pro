#!/usr/bin/env node
// Project memory guard. Keeps the handoff "black box" factual and complete.

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";

const MEMORY_DIR = "docs/project-memory";

const REQUIRED_FILES = [
  "PROJECT_STATE.yaml",
  "HANDOFF.md",
  "WORKLOG.md",
  "NEXT_ACTIONS.md",
  "RISKS.md",
  "ARTIFACTS.md",
];

const REQUIRED_TEXT = {
  "PROJECT_STATE.yaml": [
    "generated_at:",
    "project:",
    "repository:",
    "verification:",
    "stage_evidence:",
    "hypotheses:",
    "sources:",
  ],
  "HANDOFF.md": ["# HANDOFF", "## Confirmed state", "## Hypothesis"],
  "WORKLOG.md": ["# WORKLOG", "Создан project-memory", "гипотеза"],
  "NEXT_ACTIONS.md": ["# NEXT_ACTIONS", "hypothesis", "Stage 6F"],
  "RISKS.md": ["# RISKS", "## Confirmed risks", "## Hypotheses"],
  "ARTIFACTS.md": ["# ARTIFACTS", "Stage 6 manifests", "Verification outputs"],
};

const REQUIRED_PROJECT_STATE_FIELDS = [
  /^generated_at:\s*".+"/m,
  /^project:\s*"Dermatolog Pro"/m,
  /^\s+path:\s*".*\/pro"/m,
  /^\s+branch:\s*"main"/m,
  /^\s+head_sha:\s*"[a-f0-9]{40}"/m,
  /^\s+working_tree:\s*"clean"/m,
  /^\s+command:\s*"npm run preflight:stage6e"/m,
  /^\s+status:\s*"ok"/m,
  /^\s+tests_passed:\s*12/m,
  /^\s+leak_findings:\s*0/m,
  /^\s+live_server_go_live_verified_by_report:\s*false/m,
];

function read(root, file) {
  return readFileSync(join(root, file), "utf8");
}

function memoryPath(file) {
  return join(MEMORY_DIR, file);
}

function assertRequiredFiles(errors, root) {
  for (const file of REQUIRED_FILES) {
    const path = join(root, memoryPath(file));
    if (!existsSync(path)) {
      errors.push(`Missing project-memory file: ${memoryPath(file)}`);
      continue;
    }
    const stat = statSync(path);
    if (!stat.isFile()) errors.push(`Project-memory path is not a file: ${memoryPath(file)}`);
    if (stat.size === 0) errors.push(`Project-memory file is empty: ${memoryPath(file)}`);
  }
}

function assertRequiredText(errors, root) {
  for (const [file, expectedTexts] of Object.entries(REQUIRED_TEXT)) {
    const path = memoryPath(file);
    if (!existsSync(join(root, path))) continue;
    const content = read(root, path);
    for (const text of expectedTexts) {
      if (!content.includes(text)) errors.push(`${path} missing required text: ${text}`);
    }
  }
}

function assertProjectStateShape(errors, root) {
  const path = memoryPath("PROJECT_STATE.yaml");
  if (!existsSync(join(root, path))) return;
  const content = read(root, path);
  if (content.includes("\t")) errors.push(`${path} must not contain tab indentation`);
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const indent = line.match(/^ */)?.[0].length ?? 0;
    if (indent % 2 !== 0) errors.push(`${path}:${index + 1} uses odd indentation`);
  }
  for (const pattern of REQUIRED_PROJECT_STATE_FIELDS) {
    if (!pattern.test(content)) errors.push(`${path} missing required YAML field pattern: ${pattern}`);
  }
}

function extractYamlListAfterHeading(content, heading) {
  const lines = content.split(/\r?\n/);
  const values = [];
  let active = false;
  let baseIndent = -1;
  for (const line of lines) {
    const match = line.match(/^(\s*)([a-zA-Z0-9_]+):\s*$/);
    if (match && match[2] === heading) {
      active = true;
      baseIndent = match[1].length;
      continue;
    }
    if (!active) continue;
    const indent = line.match(/^ */)?.[0].length ?? 0;
    if (line.trim() && indent <= baseIndent) break;
    const item = line.match(/^\s*-\s*"([^"]+)"\s*$/);
    if (item) values.push(item[1]);
  }
  return values;
}

function assertSourceFilesExist(errors, root) {
  const path = memoryPath("PROJECT_STATE.yaml");
  if (!existsSync(join(root, path))) return;
  const content = read(root, path);
  const listedFiles = extractYamlListAfterHeading(content, "files");
  if (listedFiles.length === 0) {
    errors.push(`${path} must list source files under sources.files`);
    return;
  }
  for (const file of listedFiles) {
    if (!existsSync(join(root, file))) errors.push(`${path} source file does not exist: ${file}`);
  }
}

function assertHypothesesAreExplicit(errors, root) {
  const statePath = memoryPath("PROJECT_STATE.yaml");
  if (existsSync(join(root, statePath))) {
    const state = read(root, statePath);
    if (!state.includes("hypotheses:")) errors.push(`${statePath} must include hypotheses section`);
  }
  for (const file of ["HANDOFF.md", "NEXT_ACTIONS.md", "RISKS.md"]) {
    const path = memoryPath(file);
    if (!existsSync(join(root, path))) continue;
    const content = read(root, path);
    if (content.includes("Stage 6F") && !/hypothesis|Hypothesis|Hypotheses/.test(content)) {
      errors.push(`${path} mentions Stage 6F without marking it as a hypothesis`);
    }
  }
}

function extractMarkdownLinks(content) {
  const links = [];
  const pattern = /\[[^\]]+\]\(([^)]+)\)/g;
  let match;
  while ((match = pattern.exec(content))) links.push(match[1]);
  return links;
}

function normalizeArtifactLinkTarget(target) {
  const cleanTarget = target.replace(/^<|>$/g, "").split("#")[0];
  const lineSuffix = cleanTarget.match(/^(.+):\d+(?::\d+)?$/);
  return lineSuffix ? lineSuffix[1] : cleanTarget;
}

function artifactLinkExists(root, artifactPath, target) {
  const cleanTarget = normalizeArtifactLinkTarget(target);
  if (!cleanTarget) return true;
  if (isAbsolute(cleanTarget)) return existsSync(cleanTarget);

  const artifactRelativePath = join(root, dirname(artifactPath), cleanTarget);
  if (existsSync(artifactRelativePath)) return true;

  return existsSync(join(root, cleanTarget));
}

function assertArtifactLinksExist(errors, root) {
  const path = memoryPath("ARTIFACTS.md");
  if (!existsSync(join(root, path))) return;
  const content = read(root, path);
  const links = extractMarkdownLinks(content).filter((target) => !target.startsWith("http"));
  if (links.length === 0) errors.push(`${path} must contain artifact links`);
  for (const target of links) {
    if (!artifactLinkExists(root, path, target)) errors.push(`${path} links to missing artifact: ${target}`);
  }
}

export function collectProjectMemoryChecks({ root = process.cwd() } = {}) {
  const errors = [];
  assertRequiredFiles(errors, root);
  assertRequiredText(errors, root);
  assertProjectStateShape(errors, root);
  assertSourceFilesExist(errors, root);
  assertHypothesesAreExplicit(errors, root);
  assertArtifactLinksExist(errors, root);
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

export function main() {
  const result = collectProjectMemoryChecks();
  if (!result.ok) {
    console.error("[project-memory] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[project-memory] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
