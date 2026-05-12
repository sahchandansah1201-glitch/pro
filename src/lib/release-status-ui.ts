export type ReleaseStatusLevel = "ok" | "incomplete" | "fail";
export type ReleaseStatusFormat = "markdown" | "json" | "html" | "history";

export interface ReleaseWorkflowStatus {
  name: string;
  conclusion: "success" | "failure" | "in_progress" | "unknown";
  runUrl: string;
}

export interface ReleaseStatusSnapshot {
  repo: string;
  branch: string;
  shortSha: string;
  shaUrl: string;
  workingTree: "clean" | "dirty";
  changedCount: number;
  denoLockOk: boolean;
  artifactPresent: boolean;
  artifactPath: string;
  generatedAt: string;
  workflows: ReleaseWorkflowStatus[];
}

export interface ReleasePrivacyFinding {
  label: string;
  line: number;
}

export interface ReleasePrivacySummary {
  lineCount: number;
  findingCount: number;
  labels: string[];
  findings: ReleasePrivacyFinding[];
}

export interface ReleaseStatusExportFile {
  format: ReleaseStatusFormat;
  filename: string;
  mime: string;
  content: string;
  privacy: ReleasePrivacySummary;
}

export interface ReleaseWorkflowComparison {
  name: string;
  previous: ReleaseWorkflowStatus["conclusion"] | "missing";
  current: ReleaseWorkflowStatus["conclusion"] | "missing";
}

export interface ReleaseComparisonSummary {
  previousLevel: ReleaseStatusLevel;
  currentLevel: ReleaseStatusLevel;
  improved: boolean;
  worsened: boolean;
  artifactChanged: boolean;
  dirtyCountDelta: number;
  workflowChanges: ReleaseWorkflowComparison[];
}

export interface ReleaseHistoryRecord {
  recordedAt: string;
  repo: string;
  branch: string;
  currentSha: string;
  overallStatus: ReleaseStatusLevel;
  dirtyCount: number;
  denoLockOk: boolean;
  artifactPresent: boolean;
  workflows: Array<{
    name: string;
    conclusion: ReleaseWorkflowStatus["conclusion"];
  }>;
}

export interface ReleaseHistoryParseResult {
  records: ReleaseHistoryRecord[];
  skippedCount: number;
  privacy: ReleasePrivacySummary;
}

export interface ReleaseBaselineOption {
  id: string;
  label: string;
  detail: string;
  source: "demo" | "imported";
  snapshot: ReleaseStatusSnapshot;
}

const TOKEN_PARAM_NAMES = [
  "access_token",
  "refresh_token",
  "id_token",
  "jwt",
  "sig",
  "signature",
  "token",
  "apikey",
  "api_key",
  "password",
  "signed_url",
  "download_url",
];

export const RELEASE_STATUS_PREFLIGHT_COMMAND = "npm run preflight:release-status";
export const RELEASE_STATUS_ALLOWED_ROLES = ["system_admin"] as const;
export const RELEASE_STATUS_PRIVACY_CATEGORIES = [
  "bearer token",
  "cookie header",
  "url token parameter",
  "email address",
  "patient full-name field",
  "actor email field",
  "storage object path",
  "supabase key",
  "service role env",
  "jwt-shaped value",
] as const;

export const RELEASE_STATUS_DEMO_SNAPSHOT: ReleaseStatusSnapshot = {
  repo: "sahchandansah1201-glitch/pro",
  branch: "main",
  shortSha: "5ce9cf1",
  shaUrl: "https://github.com/sahchandansah1201-glitch/pro/commit/5ce9cf1",
  workingTree: "clean",
  changedCount: 0,
  denoLockOk: true,
  artifactPresent: true,
  artifactPath: "test-results/release-status.html",
  generatedAt: "2026-05-12T14:41:16.000Z",
  workflows: [
    {
      name: "release-status",
      conclusion: "success",
      runUrl: "https://github.com/sahchandansah1201-glitch/pro/actions/runs/25741807286",
    },
    {
      name: "no-deno-locks",
      conclusion: "success",
      runUrl: "https://github.com/sahchandansah1201-glitch/pro/actions/runs/25741808258",
    },
    {
      name: "frontend-auth-assets",
      conclusion: "success",
      runUrl: "https://github.com/sahchandansah1201-glitch/pro/actions/runs/25741807337",
    },
    {
      name: "e2e-smoke",
      conclusion: "success",
      runUrl: "https://github.com/sahchandansah1201-glitch/pro/actions/runs/25741807293",
    },
    {
      name: "auth-assets-smoke-skip",
      conclusion: "success",
      runUrl: "https://github.com/sahchandansah1201-glitch/pro/actions/runs/25741807579",
    },
    {
      name: "backend-guardrails",
      conclusion: "success",
      runUrl: "https://github.com/sahchandansah1201-glitch/pro/actions/runs/25741807239",
    },
  ],
};

export const RELEASE_STATUS_PREVIOUS_DEMO_SNAPSHOT: ReleaseStatusSnapshot = {
  ...RELEASE_STATUS_DEMO_SNAPSHOT,
  shortSha: "c3d2d18",
  shaUrl: "https://github.com/sahchandansah1201-glitch/pro/commit/c3d2d18",
  artifactPresent: false,
  generatedAt: "2026-05-12T13:58:00.000Z",
  workflows: RELEASE_STATUS_DEMO_SNAPSHOT.workflows.map((workflow) =>
    workflow.name === "e2e-smoke"
      ? { ...workflow, conclusion: "failure" }
      : workflow.name === "release-status"
        ? { ...workflow, conclusion: "in_progress" }
        : workflow,
  ),
};

export function releaseStatusLevel(snapshot: ReleaseStatusSnapshot): ReleaseStatusLevel {
  if (!snapshot.denoLockOk || snapshot.workflows.some((workflow) => workflow.conclusion === "failure")) {
    return "fail";
  }
  if (
    snapshot.workingTree !== "clean" ||
    !snapshot.artifactPresent ||
    snapshot.workflows.some((workflow) => workflow.conclusion !== "success")
  ) {
    return "incomplete";
  }
  return "ok";
}

function releaseStatusRank(level: ReleaseStatusLevel): number {
  if (level === "fail") return 0;
  if (level === "incomplete") return 1;
  return 2;
}

export function releaseStatusLevelLabel(level: ReleaseStatusLevel): string {
  if (level === "ok") return "Готово";
  if (level === "fail") return "Блокер";
  return "Нужно проверить";
}

export function releaseStatusMime(format: ReleaseStatusFormat): string {
  if (format === "html") return "text/html;charset=utf-8";
  if (format === "json" || format === "history") return "application/json;charset=utf-8";
  return "text/markdown;charset=utf-8";
}

export function releaseStatusFormatLabel(format: ReleaseStatusFormat): string {
  if (format === "markdown") return "Markdown";
  if (format === "json") return "JSON";
  if (format === "html") return "HTML";
  return "History JSONL";
}

function htmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function releaseStatusFilename(format: ReleaseStatusFormat): string {
  const date = today();
  if (format === "markdown") return `release-status-${date}.md`;
  if (format === "json") return `release-status-${date}.json`;
  if (format === "html") return `release-status-${date}.html`;
  return `release-history-${date}.jsonl`;
}

export function buildReleaseStatusMarkdown(snapshot: ReleaseStatusSnapshot): string {
  const level = releaseStatusLevel(snapshot);
  const lines = [
    "## Release operations dashboard",
    "",
    `- Repo: \`${snapshot.repo}\``,
    `- Branch: \`${snapshot.branch}\``,
    `- Current SHA: \`${snapshot.shortSha}\` — ${snapshot.shaUrl}`,
    `- Working tree: ${snapshot.workingTree === "clean" ? "clean" : `${snapshot.changedCount} changed file(s)`}`,
    "",
    "### Latest main workflow runs",
    "",
    ...snapshot.workflows.map(
      (workflow) => `- ${workflow.conclusion === "success" ? "✓" : "?"} \`${workflow.name}\`: ${workflow.conclusion} — ${workflow.runUrl}`,
    ),
    "",
    "### Deno lock guard",
    "",
    `- ${snapshot.denoLockOk ? "✓ no deno.lock files" : "✗ deno.lock guard failed"}`,
    "",
    "### E2E artifact summary",
    "",
    `- Path: \`${snapshot.artifactPath}\``,
    `- Present: ${snapshot.artifactPresent ? "yes" : "no"}`,
    "",
    "### Overall",
    "",
    `- Status: \`${level}\``,
    "",
    "### Privacy",
    "",
    "- Output is sanitized; tokens, cookies, signed URLs, emails, patient names, storage paths, and raw env values are not printed.",
    "",
  ];
  return lines.join("\n");
}

export function buildReleaseStatusJson(snapshot: ReleaseStatusSnapshot): string {
  return `${JSON.stringify(
    {
      title: "Release operations dashboard",
      repo: snapshot.repo,
      branch: snapshot.branch,
      currentSha: {
        short: snapshot.shortSha,
        link: snapshot.shaUrl,
      },
      workingTree: {
        state: snapshot.workingTree,
        dirtyCount: snapshot.changedCount,
      },
      workflows: snapshot.workflows,
      denoLockGuard: {
        ok: snapshot.denoLockOk,
        note: snapshot.denoLockOk ? "no deno.lock files" : "guard failed",
      },
      artifact: {
        present: snapshot.artifactPresent,
        path: snapshot.artifactPath,
      },
      overallStatus: releaseStatusLevel(snapshot),
      generatedAt: snapshot.generatedAt,
      privacy: "sanitized; no tokens, cookies, signed URLs, emails, patient names, storage paths, or raw env values",
    },
    null,
    2,
  )}\n`;
}

export function buildReleaseStatusHtml(snapshot: ReleaseStatusSnapshot): string {
  const level = releaseStatusLevel(snapshot);
  const rows = snapshot.workflows
    .map(
      (workflow) => `<tr><td>${htmlEscape(workflow.name)}</td><td>${htmlEscape(workflow.conclusion)}</td><td><a href="${htmlEscape(workflow.runUrl)}">${htmlEscape(workflow.runUrl)}</a></td></tr>`,
    )
    .join("");
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <title>Release operations dashboard</title>
  <style>
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #f6f8fb; color: #17202c; }
    main { max-width: 920px; margin: 0 auto; padding: 32px 20px; }
    section { border: 1px solid #d8e0ea; border-radius: 8px; background: #fbfcfe; padding: 16px; margin-top: 14px; }
    .status { display: inline-flex; border-radius: 999px; padding: 4px 10px; font-weight: 700; background: #dcfce7; color: #166534; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-top: 1px solid #e4eaf2; padding: 8px; text-align: left; }
  </style>
</head>
<body>
  <main>
    <h1>Release operations dashboard</h1>
    <p>Sanitized release snapshot. No tokens, cookies, signed URLs, emails, patient names, storage paths, or raw env values are printed.</p>
    <section>
      <h2>Overall</h2>
      <p><span class="status">${htmlEscape(level)}</span></p>
      <p>Repo: <code>${htmlEscape(snapshot.repo)}</code></p>
      <p>Branch: <code>${htmlEscape(snapshot.branch)}</code></p>
      <p>Current SHA: <a href="${htmlEscape(snapshot.shaUrl)}">${htmlEscape(snapshot.shortSha)}</a></p>
    </section>
    <section>
      <h2>Guards</h2>
      <p>Deno lock guard: ${snapshot.denoLockOk ? "ok" : "failed"}</p>
      <p>Artifact: ${snapshot.artifactPresent ? "present" : "missing"} (${htmlEscape(snapshot.artifactPath)})</p>
    </section>
    <section>
      <h2>Latest workflow runs</h2>
      <table><thead><tr><th>Workflow</th><th>Conclusion</th><th>Run</th></tr></thead><tbody>${rows}</tbody></table>
    </section>
  </main>
</body>
</html>
`;
}

export function buildReleaseHistoryJsonl(snapshot: ReleaseStatusSnapshot): string {
  return `${JSON.stringify({
    recordedAt: snapshot.generatedAt,
    repo: snapshot.repo,
    branch: snapshot.branch,
    currentSha: snapshot.shortSha,
    overallStatus: releaseStatusLevel(snapshot),
    dirtyCount: snapshot.changedCount,
    denoLockOk: snapshot.denoLockOk,
    artifactPresent: snapshot.artifactPresent,
    workflows: snapshot.workflows.map((workflow) => ({
      name: workflow.name,
      conclusion: workflow.conclusion,
    })),
  })}\n`;
}

export const RELEASE_STATUS_DEMO_HISTORY_JSONL = `${buildReleaseHistoryJsonl(
  RELEASE_STATUS_PREVIOUS_DEMO_SNAPSHOT,
)}${buildReleaseHistoryJsonl(RELEASE_STATUS_DEMO_SNAPSHOT)}`;

function isReleaseStatusLevel(value: unknown): value is ReleaseStatusLevel {
  return value === "ok" || value === "incomplete" || value === "fail";
}

function isWorkflowConclusion(value: unknown): value is ReleaseWorkflowStatus["conclusion"] {
  return value === "success" || value === "failure" || value === "in_progress" || value === "unknown";
}

function safeShortSha(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^[a-f0-9]{7,40}$/i.test(trimmed)) return null;
  return trimmed.slice(0, 13);
}

function safeRepo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmed)) return null;
  return trimmed;
}

function safeBranch(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._/-]{1,80}$/.test(trimmed)) return null;
  return trimmed;
}

function safeIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function safeWorkflowName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(trimmed)) return null;
  return trimmed;
}

function toHistoryRecord(raw: unknown): ReleaseHistoryRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const recordedAt = safeIsoDate(item.recordedAt);
  const repo = safeRepo(item.repo);
  const branch = safeBranch(item.branch);
  const currentSha = safeShortSha(item.currentSha);
  const overallStatus = item.overallStatus;
  if (!recordedAt || !repo || !branch || !currentSha || !isReleaseStatusLevel(overallStatus)) {
    return null;
  }

  const workflows = Array.isArray(item.workflows)
    ? item.workflows
        .map((workflow) => {
          if (!workflow || typeof workflow !== "object") return null;
          const wf = workflow as Record<string, unknown>;
          const name = safeWorkflowName(wf.name);
          const conclusion = wf.conclusion;
          if (!name || !isWorkflowConclusion(conclusion)) return null;
          return { name, conclusion };
        })
        .filter((workflow): workflow is ReleaseHistoryRecord["workflows"][number] => workflow != null)
    : [];

  if (workflows.length === 0) return null;

  const dirtyCount = typeof item.dirtyCount === "number" && Number.isFinite(item.dirtyCount)
    ? Math.max(0, Math.floor(item.dirtyCount))
    : 0;

  return {
    recordedAt,
    repo,
    branch,
    currentSha,
    overallStatus,
    dirtyCount,
    denoLockOk: item.denoLockOk === true,
    artifactPresent: item.artifactPresent === true,
    workflows,
  };
}

export function parseReleaseHistoryJsonl(input: string, maxRecords = 12): ReleaseHistoryParseResult {
  const privacy = summarizeReleasePrivacy(input);
  if (privacy.findingCount > 0) {
    return { records: [], skippedCount: input.split(/\r?\n/).filter(Boolean).length, privacy };
  }

  const records: ReleaseHistoryRecord[] = [];
  let skippedCount = 0;
  for (const line of input.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const record = toHistoryRecord(JSON.parse(trimmed));
      if (record) {
        records.push(record);
      } else {
        skippedCount += 1;
      }
    } catch {
      skippedCount += 1;
    }
  }

  records.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
  return {
    records: records.slice(0, Math.max(1, maxRecords)),
    skippedCount,
    privacy,
  };
}

export function releaseSnapshotFromHistoryRecord(record: ReleaseHistoryRecord): ReleaseStatusSnapshot {
  return {
    repo: record.repo,
    branch: record.branch,
    shortSha: record.currentSha,
    shaUrl: `https://github.com/${record.repo}/commit/${record.currentSha}`,
    workingTree: record.dirtyCount === 0 ? "clean" : "dirty",
    changedCount: record.dirtyCount,
    denoLockOk: record.denoLockOk,
    artifactPresent: record.artifactPresent,
    artifactPath: "history-import",
    generatedAt: record.recordedAt,
    workflows: record.workflows.map((workflow) => ({
      name: workflow.name,
      conclusion: workflow.conclusion,
      runUrl: `https://github.com/${record.repo}/actions?query=workflow%3A${encodeURIComponent(workflow.name)}`,
    })),
  };
}

export function buildReleaseBaselineOptions(
  current: ReleaseStatusSnapshot,
  demoPrevious: ReleaseStatusSnapshot,
  importedRecords: ReleaseHistoryRecord[],
): ReleaseBaselineOption[] {
  const imported = importedRecords
    .filter((record) => record.currentSha !== current.shortSha)
    .map((record, index) => {
      const snapshot = releaseSnapshotFromHistoryRecord(record);
      return {
        id: `imported-${record.currentSha}-${index}`,
        label: `Импорт: ${record.currentSha}`,
        detail: `${record.branch}, ${record.recordedAt.slice(0, 10)}, ${releaseStatusLevelLabel(releaseStatusLevel(snapshot))}`,
        source: "imported" as const,
        snapshot,
      };
    });

  return [
    {
      id: "demo-previous",
      label: `Сохранённый baseline: ${demoPrevious.shortSha}`,
      detail: `${demoPrevious.branch}, ${demoPrevious.generatedAt.slice(0, 10)}, ${releaseStatusLevelLabel(releaseStatusLevel(demoPrevious))}`,
      source: "demo",
      snapshot: demoPrevious,
    },
    ...imported,
  ].slice(0, 8);
}

export function buildReleaseStatusOutput(
  snapshot: ReleaseStatusSnapshot,
  format: ReleaseStatusFormat,
): string {
  if (format === "markdown") return buildReleaseStatusMarkdown(snapshot);
  if (format === "json") return buildReleaseStatusJson(snapshot);
  if (format === "html") return buildReleaseStatusHtml(snapshot);
  return buildReleaseHistoryJsonl(snapshot);
}

export function buildReleaseStatusExportFile(
  snapshot: ReleaseStatusSnapshot,
  format: ReleaseStatusFormat,
): ReleaseStatusExportFile {
  const content = buildReleaseStatusOutput(snapshot, format);
  return {
    format,
    filename: releaseStatusFilename(format),
    mime: releaseStatusMime(format),
    content,
    privacy: summarizeReleasePrivacy(content),
  };
}

export function buildReleaseStatusExportBundle(snapshot: ReleaseStatusSnapshot): ReleaseStatusExportFile[] {
  return (["markdown", "json", "html", "history"] as ReleaseStatusFormat[]).map((format) =>
    buildReleaseStatusExportFile(snapshot, format),
  );
}

export function compareReleaseStatusSnapshots(
  previous: ReleaseStatusSnapshot,
  current: ReleaseStatusSnapshot,
): ReleaseComparisonSummary {
  const previousLevel = releaseStatusLevel(previous);
  const currentLevel = releaseStatusLevel(current);
  const workflowNames = Array.from(
    new Set([...previous.workflows.map((workflow) => workflow.name), ...current.workflows.map((workflow) => workflow.name)]),
  ).sort();
  const workflowChanges = workflowNames
    .map((name) => {
      const previousWorkflow = previous.workflows.find((workflow) => workflow.name === name);
      const currentWorkflow = current.workflows.find((workflow) => workflow.name === name);
      return {
        name,
        previous: previousWorkflow?.conclusion ?? "missing",
        current: currentWorkflow?.conclusion ?? "missing",
      };
    })
    .filter((item) => item.previous !== item.current);

  return {
    previousLevel,
    currentLevel,
    improved: releaseStatusRank(currentLevel) > releaseStatusRank(previousLevel),
    worsened: releaseStatusRank(currentLevel) < releaseStatusRank(previousLevel),
    artifactChanged: previous.artifactPresent !== current.artifactPresent,
    dirtyCountDelta: current.changedCount - previous.changedCount,
    workflowChanges,
  };
}

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split(/\r?\n/).length;
}

export function detectReleaseStatusUiPrivacyLeaks(content: string): ReleasePrivacyFinding[] {
  const tokenParamPattern = TOKEN_PARAM_NAMES.join("|");
  const patterns: { label: string; re: RegExp }[] = [
    { label: "bearer token", re: /Authorization\s*[:=]\s*Bearer\s+(?!\[redacted)[A-Za-z0-9._~+/=-]{8,}/gi },
    { label: "cookie header", re: /(?:Cookie|Set-Cookie)\s*:\s*(?!\s*\[redacted)[^\n\r]{6,}/gi },
    {
      label: "url token parameter",
      re: new RegExp("(?:".concat(tokenParamPattern, ')=((?!\\[redacted)[^\\s&"\'`<>]+)'), "gi"),
    },
    { label: "email address", re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi },
    { label: "patient full-name field", re: /patient_full_name\s*[:=]\s*(?!\[redacted)[^\n\r,;]{3,}/gi },
    { label: "actor email field", re: /actor_email\s*[:=]\s*(?!\[redacted)[^\n\r,;]{3,}/gi },
    { label: "storage object path", re: /storage_object_path\s*[:=]\s*(?!\[redacted)[^\n\r,;]{3,}/gi },
    { label: "supabase key", re: /\bsb_(?:publishable|secret)_[A-Za-z0-9_-]{8,}\b/gi },
    { label: "service role env", re: /\bSUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!\[redacted)[^\s]+/gi },
    { label: "jwt-shaped value", re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g },
  ];
  const findings: ReleasePrivacyFinding[] = [];
  for (const pattern of patterns) {
    pattern.re.lastIndex = 0;
    let match;
    while ((match = pattern.re.exec(content)) != null) {
      findings.push({ label: pattern.label, line: lineNumberAt(content, match.index) });
    }
  }
  return findings;
}

export function summarizeReleasePrivacy(content: string): ReleasePrivacySummary {
  const findings = detectReleaseStatusUiPrivacyLeaks(content);
  return {
    lineCount: content.split(/\r?\n/).length,
    findingCount: findings.length,
    labels: Array.from(new Set(findings.map((finding) => finding.label))).sort(),
    findings,
  };
}
