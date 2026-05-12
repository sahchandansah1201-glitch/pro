import {
  buildTableXlsxBytes,
  type XlsxCellValue,
} from "./admin-access-events";

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

export type ReleaseHistoryParseIssueReason =
  | "invalid_json"
  | "invalid_schema"
  | "privacy_blocked";

export interface ReleaseHistoryParseIssue {
  line: number;
  reason: ReleaseHistoryParseIssueReason;
  message: string;
}

export interface ReleaseHistoryParseResult {
  records: ReleaseHistoryRecord[];
  skippedCount: number;
  privacy: ReleasePrivacySummary;
  status: "safe" | "blocked" | "empty" | "partial";
  lineCount: number;
  acceptedCount: number;
  message: string;
  previewRecords: ReleaseHistoryRecord[];
  issues: ReleaseHistoryParseIssue[];
}

export interface ReleaseBaselineOption {
  id: string;
  label: string;
  detail: string;
  source: "demo" | "imported";
  snapshot: ReleaseStatusSnapshot;
}

export interface ReleaseHistoryPreviewSummary {
  status: ReleaseHistoryParseResult["status"];
  totalLines: number;
  acceptedCount: number;
  skippedCount: number;
  privacyFindingCount: number;
  privacyLabels: string[];
  latestSha: string | null;
  latestStatus: ReleaseStatusLevel | null;
  workflowNames: string[];
}

export type ReleaseHistoryStatusFilter = "all" | ReleaseStatusLevel;
export type ReleaseHistoryDenoFilter = "all" | "ok" | "blocked";
export type ReleaseHistoryArtifactFilter = "all" | "present" | "missing";
export type ReleaseHistoryWorkflowFilter =
  | "all"
  | ReleaseWorkflowStatus["conclusion"];

export interface ReleaseHistoryFilterState {
  status: ReleaseHistoryStatusFilter;
  deno: ReleaseHistoryDenoFilter;
  artifact: ReleaseHistoryArtifactFilter;
  workflow: ReleaseHistoryWorkflowFilter;
  query: string;
}

export interface ReleaseHistoryAuditReportEntry {
  at: string;
  status: string;
  acceptedCount: number;
  skippedCount: number;
  privacyFindingCount: number;
  message: string;
}

export interface ReleaseHistoryAuditReportContext {
  selectedBaselineSha?: string;
  selectedBaselineSource?: string;
  filteredHistoryCount?: number;
  visibleAuditCount?: number;
  historyStatusFilter?: ReleaseHistoryStatusFilter;
  historyDenoFilter?: ReleaseHistoryDenoFilter;
  historyArtifactFilter?: ReleaseHistoryArtifactFilter;
  historyWorkflowFilter?: ReleaseHistoryWorkflowFilter;
  historyQuery?: string;
  auditStatusFilter?: string;
  auditPrivacyFilter?: ReleaseImportAuditPrivacyFilter;
  auditQuery?: string;
}

export type ReleaseImportAuditPrivacyFilter = "all" | "clean" | "with_privacy";

export interface ReleaseImportAuditFilterState {
  status: string;
  privacy: ReleaseImportAuditPrivacyFilter;
  query: string;
}

export interface ReleaseHistoryPage {
  page: number;
  pageSize: number;
  pageCount: number;
  totalCount: number;
  start: number;
  end: number;
  records: ReleaseHistoryRecord[];
}

export interface ReleaseHistoryIssueSummary {
  totalIssues: number;
  invalidJsonCount: number;
  invalidSchemaCount: number;
  privacyBlockedCount: number;
  affectedLines: number[];
  message: string;
}

export interface ReleaseHistoryExportContext {
  totalCount?: number;
  filteredCount?: number;
  filters?: Partial<ReleaseHistoryFilterState>;
}

export interface ReleaseHistoryFilterPreset {
  id: string;
  name: string;
  filters: ReleaseHistoryFilterState;
  source: "built_in" | "saved";
  createdAt?: string;
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

export const RELEASE_STATUS_PREFLIGHT_COMMAND =
  "npm run preflight:release-status";
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

export const RELEASE_HISTORY_FILTER_PRESET_LIMIT = 8;

export const DEFAULT_RELEASE_HISTORY_FILTER_PRESETS: ReleaseHistoryFilterPreset[] =
  [
    {
      id: "builtin-all",
      name: "Все записи",
      source: "built_in",
      filters: {
        status: "all",
        deno: "all",
        artifact: "all",
        workflow: "all",
        query: "",
      },
    },
    {
      id: "builtin-blockers",
      name: "Блокеры релиза",
      source: "built_in",
      filters: {
        status: "fail",
        deno: "blocked",
        artifact: "missing",
        workflow: "failure",
        query: "",
      },
    },
    {
      id: "builtin-ready",
      name: "Готовые релизы",
      source: "built_in",
      filters: {
        status: "ok",
        deno: "ok",
        artifact: "present",
        workflow: "success",
        query: "",
      },
    },
    {
      id: "builtin-e2e-failures",
      name: "E2E failures",
      source: "built_in",
      filters: {
        status: "all",
        deno: "all",
        artifact: "all",
        workflow: "failure",
        query: "e2e",
      },
    },
  ];

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
      runUrl:
        "https://github.com/sahchandansah1201-glitch/pro/actions/runs/25741807286",
    },
    {
      name: "no-deno-locks",
      conclusion: "success",
      runUrl:
        "https://github.com/sahchandansah1201-glitch/pro/actions/runs/25741808258",
    },
    {
      name: "frontend-auth-assets",
      conclusion: "success",
      runUrl:
        "https://github.com/sahchandansah1201-glitch/pro/actions/runs/25741807337",
    },
    {
      name: "e2e-smoke",
      conclusion: "success",
      runUrl:
        "https://github.com/sahchandansah1201-glitch/pro/actions/runs/25741807293",
    },
    {
      name: "auth-assets-smoke-skip",
      conclusion: "success",
      runUrl:
        "https://github.com/sahchandansah1201-glitch/pro/actions/runs/25741807579",
    },
    {
      name: "backend-guardrails",
      conclusion: "success",
      runUrl:
        "https://github.com/sahchandansah1201-glitch/pro/actions/runs/25741807239",
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

export function releaseStatusLevel(
  snapshot: ReleaseStatusSnapshot,
): ReleaseStatusLevel {
  if (
    !snapshot.denoLockOk ||
    snapshot.workflows.some((workflow) => workflow.conclusion === "failure")
  ) {
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
  if (format === "json" || format === "history")
    return "application/json;charset=utf-8";
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

export function buildReleaseStatusMarkdown(
  snapshot: ReleaseStatusSnapshot,
): string {
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
      (workflow) =>
        `- ${workflow.conclusion === "success" ? "✓" : "?"} \`${workflow.name}\`: ${workflow.conclusion} — ${workflow.runUrl}`,
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

export function buildReleaseStatusJson(
  snapshot: ReleaseStatusSnapshot,
): string {
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
      privacy:
        "sanitized; no tokens, cookies, signed URLs, emails, patient names, storage paths, or raw env values",
    },
    null,
    2,
  )}\n`;
}

export function buildReleaseStatusHtml(
  snapshot: ReleaseStatusSnapshot,
): string {
  const level = releaseStatusLevel(snapshot);
  const rows = snapshot.workflows
    .map(
      (workflow) =>
        `<tr><td>${htmlEscape(workflow.name)}</td><td>${htmlEscape(workflow.conclusion)}</td><td><a href="${htmlEscape(workflow.runUrl)}">${htmlEscape(workflow.runUrl)}</a></td></tr>`,
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

export function buildReleaseHistoryJsonl(
  snapshot: ReleaseStatusSnapshot,
): string {
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

function isWorkflowConclusion(
  value: unknown,
): value is ReleaseWorkflowStatus["conclusion"] {
  return (
    value === "success" ||
    value === "failure" ||
    value === "in_progress" ||
    value === "unknown"
  );
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

function safePresetName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.replace(/\s+/g, " ").trim().slice(0, 48);
  if (compact.length < 2) return null;
  if (summarizeReleasePrivacy(compact).findingCount > 0) return null;
  return compact;
}

function safePresetId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.trim();
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(compact)) return null;
  return compact;
}

function normalizeHistoryFilterState(
  value: unknown,
): ReleaseHistoryFilterState | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const status = item.status;
  const deno = item.deno;
  const artifact = item.artifact;
  const workflow = item.workflow;
  const query = typeof item.query === "string" ? item.query : "";
  const safeQuery = sanitizeAuditText(query).slice(0, 80);

  if (
    status !== "all" &&
    status !== "ok" &&
    status !== "incomplete" &&
    status !== "fail"
  ) {
    return null;
  }
  if (deno !== "all" && deno !== "ok" && deno !== "blocked") return null;
  if (artifact !== "all" && artifact !== "present" && artifact !== "missing")
    return null;
  if (workflow !== "all" && !isWorkflowConclusion(workflow)) return null;

  return {
    status,
    deno,
    artifact,
    workflow,
    query: safeQuery.startsWith("redacted text") ? "" : safeQuery,
  };
}

export function buildReleaseHistoryFilterPreset(
  name: string,
  filters: ReleaseHistoryFilterState,
  createdAt = new Date().toISOString(),
): ReleaseHistoryFilterPreset | null {
  const safeName = safePresetName(name);
  const safeFilters = normalizeHistoryFilterState(filters);
  const safeCreatedAt = safeIsoDate(createdAt) ?? new Date(0).toISOString();
  if (!safeName || !safeFilters) return null;
  const slug = safeName
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return {
    id: `saved-${Date.parse(safeCreatedAt)}-${slug || "preset"}`,
    name: safeName,
    filters: safeFilters,
    source: "saved",
    createdAt: safeCreatedAt,
  };
}

export function normalizeReleaseHistoryFilterPreset(
  value: unknown,
): ReleaseHistoryFilterPreset | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const source = item.source === "built_in" ? "built_in" : "saved";
  const id = safePresetId(item.id);
  const name = safePresetName(item.name);
  const filters = normalizeHistoryFilterState(item.filters);
  const createdAt = safeIsoDate(item.createdAt);
  if (!id || !name || !filters) return null;
  return {
    id,
    name,
    filters,
    source,
    ...(createdAt ? { createdAt } : {}),
  };
}

function toHistoryRecord(raw: unknown): ReleaseHistoryRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const recordedAt = safeIsoDate(item.recordedAt);
  const repo = safeRepo(item.repo);
  const branch = safeBranch(item.branch);
  const currentSha = safeShortSha(item.currentSha);
  const overallStatus = item.overallStatus;
  if (
    !recordedAt ||
    !repo ||
    !branch ||
    !currentSha ||
    !isReleaseStatusLevel(overallStatus)
  ) {
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
        .filter(
          (workflow): workflow is ReleaseHistoryRecord["workflows"][number] =>
            workflow != null,
        )
    : [];

  if (workflows.length === 0) return null;

  const dirtyCount =
    typeof item.dirtyCount === "number" && Number.isFinite(item.dirtyCount)
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

export function parseReleaseHistoryJsonl(
  input: string,
  maxRecords = 12,
): ReleaseHistoryParseResult {
  const privacy = summarizeReleasePrivacy(input);
  const lineCount = input
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0).length;
  if (privacy.findingCount > 0) {
    const issues = privacy.findings.slice(0, 8).map((finding) => ({
      line: finding.line,
      reason: "privacy_blocked" as const,
      message: `privacy: ${finding.label}`,
    }));
    return {
      records: [],
      skippedCount: lineCount,
      privacy,
      status: "blocked",
      lineCount,
      acceptedCount: 0,
      message: `Импорт заблокирован: privacy detector нашёл ${privacy.findingCount} совпадений (${privacy.labels.join(", ")}).`,
      previewRecords: [],
      issues,
    };
  }

  const records: ReleaseHistoryRecord[] = [];
  const issues: ReleaseHistoryParseIssue[] = [];
  let skippedCount = 0;
  for (const [index, line] of input.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const lineNumber = index + 1;
    try {
      const record = toHistoryRecord(JSON.parse(trimmed));
      if (record) {
        records.push(record);
      } else {
        skippedCount += 1;
        issues.push({
          line: lineNumber,
          reason: "invalid_schema",
          message: "строка не соответствует release-history schema",
        });
      }
    } catch {
      skippedCount += 1;
      issues.push({
        line: lineNumber,
        reason: "invalid_json",
        message: "invalid JSON",
      });
    }
  }

  records.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
  const accepted = records.slice(0, Math.max(1, maxRecords));
  const status: ReleaseHistoryParseResult["status"] =
    accepted.length === 0 ? "empty" : skippedCount > 0 ? "partial" : "safe";
  return {
    records: accepted,
    skippedCount,
    privacy,
    status,
    lineCount,
    acceptedCount: accepted.length,
    message:
      accepted.length === 0
        ? "Импорт не содержит валидных baseline-записей."
        : skippedCount > 0
          ? `Импортировано ${accepted.length} baseline-записей; пропущено строк: ${skippedCount}.`
          : `Импортировано ${accepted.length} baseline-записей; privacy-проверка пройдена.`,
    previewRecords: accepted.slice(0, 4),
    issues,
  };
}

export function summarizeReleaseHistoryPreview(
  result: ReleaseHistoryParseResult,
): ReleaseHistoryPreviewSummary {
  return {
    status: result.status,
    totalLines: result.lineCount,
    acceptedCount: result.acceptedCount,
    skippedCount: result.skippedCount,
    privacyFindingCount: result.privacy.findingCount,
    privacyLabels: result.privacy.labels,
    latestSha: result.records[0]?.currentSha ?? null,
    latestStatus: result.records[0]?.overallStatus ?? null,
    workflowNames: Array.from(
      new Set(
        result.records.flatMap((record) =>
          record.workflows.map((workflow) => workflow.name),
        ),
      ),
    ).sort(),
  };
}

export function summarizeReleaseHistoryIssues(
  result: ReleaseHistoryParseResult,
): ReleaseHistoryIssueSummary {
  const invalidJsonCount = result.issues.filter(
    (issue) => issue.reason === "invalid_json",
  ).length;
  const invalidSchemaCount = result.issues.filter(
    (issue) => issue.reason === "invalid_schema",
  ).length;
  const privacyBlockedCount = result.issues.filter(
    (issue) => issue.reason === "privacy_blocked",
  ).length;
  const affectedLines = Array.from(
    new Set(result.issues.map((issue) => issue.line).filter((line) => line > 0)),
  ).slice(0, 8);
  const totalIssues =
    invalidJsonCount + invalidSchemaCount + privacyBlockedCount;

  return {
    totalIssues,
    invalidJsonCount,
    invalidSchemaCount,
    privacyBlockedCount,
    affectedLines,
    message:
      totalIssues === 0
        ? "Ошибок импорта не найдено."
        : `Ошибок импорта: ${totalIssues}. JSON: ${invalidJsonCount}, schema: ${invalidSchemaCount}, privacy: ${privacyBlockedCount}. Строки: ${affectedLines.join(", ") || "нет"}.`,
  };
}

export function filterReleaseHistoryRecords(
  records: ReleaseHistoryRecord[],
  statusFilter: ReleaseHistoryStatusFilter,
  query: string,
): ReleaseHistoryRecord[] {
  return filterReleaseHistoryRecordsAdvanced(records, {
    status: statusFilter,
    deno: "all",
    artifact: "all",
    workflow: "all",
    query,
  });
}

export function filterReleaseHistoryRecordsAdvanced(
  records: ReleaseHistoryRecord[],
  filters: ReleaseHistoryFilterState,
): ReleaseHistoryRecord[] {
  return records.filter((record) => {
    if (filters.status !== "all" && record.overallStatus !== filters.status)
      return false;
    if (filters.deno === "ok" && !record.denoLockOk) return false;
    if (filters.deno === "blocked" && record.denoLockOk) return false;
    if (filters.artifact === "present" && !record.artifactPresent) return false;
    if (filters.artifact === "missing" && record.artifactPresent) return false;
    if (
      filters.workflow !== "all" &&
      !record.workflows.some(
        (workflow) => workflow.conclusion === filters.workflow,
      )
    ) {
      return false;
    }
    const normalizedQuery = filters.query.trim().toLowerCase();
    if (!normalizedQuery) return true;
    const haystack = [
      record.currentSha,
      record.repo,
      record.branch,
      record.recordedAt,
      releaseStatusLevelLabel(record.overallStatus),
      ...record.workflows.flatMap((workflow) => [
        workflow.name,
        workflow.conclusion,
      ]),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function paginateReleaseHistoryRecords(
  records: ReleaseHistoryRecord[],
  page: number,
  pageSize: number,
): ReleaseHistoryPage {
  const safePageSize = Math.max(1, Math.floor(pageSize || 1));
  const pageCount = Math.max(1, Math.ceil(records.length / safePageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page || 1)), pageCount);
  const start = records.length === 0 ? 0 : (safePage - 1) * safePageSize + 1;
  const end = Math.min(records.length, safePage * safePageSize);
  return {
    page: safePage,
    pageSize: safePageSize,
    pageCount,
    totalCount: records.length,
    start,
    end,
    records: records.slice(
      (safePage - 1) * safePageSize,
      safePage * safePageSize,
    ),
  };
}

export function releaseHistoryAuditFilename(): string {
  return `release-history-import-audit-${today()}.json`;
}

export function releaseHistoryAuditCsvFilename(): string {
  return `release-history-import-audit-${today()}.csv`;
}

export function releaseHistoryFilteredJsonlFilename(): string {
  return `release-history-filtered-${today()}.jsonl`;
}

export function releaseHistoryFilteredCsvFilename(): string {
  return `release-history-filtered-${today()}.csv`;
}

export function releaseHistoryFilteredXlsxFilename(): string {
  return `release-history-filtered-${today()}.xlsx`;
}

function sanitizeAuditText(value: string): string {
  const compact = value.replace(/\s+/g, " ").slice(0, 240);
  const privacy = summarizeReleasePrivacy(compact);
  if (privacy.findingCount === 0) return compact;
  return `redacted text; privacy categories: ${privacy.labels.join(", ")}`;
}

export function buildReleaseImportAuditReport(
  entries: ReleaseHistoryAuditReportEntry[],
  context: ReleaseHistoryAuditReportContext = {},
): string {
  const safeEntries = entries.map((entry) => ({
    at: safeIsoDate(entry.at) ?? new Date(0).toISOString(),
    status: /^[a-z_]{1,24}$/i.test(entry.status) ? entry.status : "unknown",
    acceptedCount: Math.max(0, Math.floor(entry.acceptedCount || 0)),
    skippedCount: Math.max(0, Math.floor(entry.skippedCount || 0)),
    privacyFindingCount: Math.max(
      0,
      Math.floor(entry.privacyFindingCount || 0),
    ),
    message: sanitizeAuditText(entry.message).replace(
      /^redacted text;/,
      "redacted message;",
    ),
  }));
  const statusCounts = safeEntries.reduce<Record<string, number>>(
    (acc, entry) => {
      acc[entry.status] = (acc[entry.status] ?? 0) + 1;
      return acc;
    },
    {},
  );
  const safeBaselineSha =
    safeShortSha(context.selectedBaselineSha) ?? "unknown";
  const safeBaselineSource = /^[a-z_ -]{1,40}$/i.test(
    context.selectedBaselineSource ?? "",
  )
    ? context.selectedBaselineSource
    : "unknown";

  return `${JSON.stringify(
    {
      title: "Release history import audit",
      generatedAt: new Date().toISOString(),
      rowCount: safeEntries.length,
      privacy:
        "sanitized; report stores counts and generated status messages only",
      summary: {
        totalAttempts: safeEntries.length,
        statusCounts,
        acceptedTotal: safeEntries.reduce(
          (sum, entry) => sum + entry.acceptedCount,
          0,
        ),
        skippedTotal: safeEntries.reduce(
          (sum, entry) => sum + entry.skippedCount,
          0,
        ),
        privacyFindingTotal: safeEntries.reduce(
          (sum, entry) => sum + entry.privacyFindingCount,
          0,
        ),
        filteredHistoryCount: Math.max(
          0,
          Math.floor(context.filteredHistoryCount ?? 0),
        ),
        visibleAuditCount: Math.max(
          0,
          Math.floor(context.visibleAuditCount ?? safeEntries.length),
        ),
        selectedBaselineSha: safeBaselineSha,
        selectedBaselineSource: safeBaselineSource,
        filters: {
          status: context.historyStatusFilter ?? "all",
          deno: context.historyDenoFilter ?? "all",
          artifact: context.historyArtifactFilter ?? "all",
          workflow: context.historyWorkflowFilter ?? "all",
          query: sanitizeAuditText(context.historyQuery ?? ""),
          auditStatus: sanitizeAuditText(context.auditStatusFilter ?? "all"),
          auditPrivacy: context.auditPrivacyFilter ?? "all",
          auditQuery: sanitizeAuditText(context.auditQuery ?? ""),
        },
      },
      entries: safeEntries,
    },
    null,
    2,
  )}\n`;
}

function csvEscape(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function safeHistoryExportRecord(
  record: ReleaseHistoryRecord,
): ReleaseHistoryRecord {
  return {
    recordedAt: safeIsoDate(record.recordedAt) ?? new Date(0).toISOString(),
    repo: safeRepo(record.repo) ?? RELEASE_STATUS_DEMO_SNAPSHOT.repo,
    branch: safeBranch(record.branch) ?? "main",
    currentSha: safeShortSha(record.currentSha) ?? "0000000",
    overallStatus: isReleaseStatusLevel(record.overallStatus)
      ? record.overallStatus
      : "incomplete",
    dirtyCount: Math.max(0, Math.floor(record.dirtyCount || 0)),
    denoLockOk: record.denoLockOk === true,
    artifactPresent: record.artifactPresent === true,
    workflows: record.workflows
      .map((workflow) => {
        const name = safeWorkflowName(workflow.name);
        const conclusion = workflow.conclusion;
        if (!name || !isWorkflowConclusion(conclusion)) return null;
        return { name, conclusion };
      })
      .filter(
        (workflow): workflow is ReleaseHistoryRecord["workflows"][number] =>
          workflow != null,
      ),
  };
}

export function buildFilteredReleaseHistoryJsonl(
  records: ReleaseHistoryRecord[],
): string {
  if (records.length === 0) return "";
  return `${records
    .map((record) => JSON.stringify(safeHistoryExportRecord(record)))
    .join("\n")}\n`;
}

export function buildFilteredReleaseHistoryCsv(
  records: ReleaseHistoryRecord[],
  context: ReleaseHistoryExportContext = {},
): string {
  return `${buildFilteredReleaseHistoryMatrix(records, context)
    .map((row) => row.map((value) => csvEscape(String(value ?? "—"))).join(","))
    .join("\n")}\n`;
}

export function buildFilteredReleaseHistoryMatrix(
  records: ReleaseHistoryRecord[],
  context: ReleaseHistoryExportContext = {},
): XlsxCellValue[][] {
  const safeRecords = records.map(safeHistoryExportRecord);
  const filters = context.filters ?? {};
  const matrix: XlsxCellValue[][] = [
    ["section", "key", "value"],
    ["summary", "filteredCount", String(context.filteredCount ?? safeRecords.length)],
    ["summary", "totalCount", String(context.totalCount ?? safeRecords.length)],
    ["filter", "status", String(filters.status ?? "all")],
    ["filter", "deno", String(filters.deno ?? "all")],
    ["filter", "artifact", String(filters.artifact ?? "all")],
    ["filter", "workflow", String(filters.workflow ?? "all")],
    ["filter", "query", sanitizeAuditText(String(filters.query ?? ""))],
    [],
    [
      "recorded_at",
      "repo",
      "branch",
      "current_sha",
      "overall_status",
      "dirty_count",
      "deno_lock_ok",
      "artifact_present",
      "workflows",
    ],
  ];

  for (const record of safeRecords) {
    matrix.push([
      record.recordedAt,
      record.repo,
      record.branch,
      record.currentSha,
      record.overallStatus,
      String(record.dirtyCount),
      record.denoLockOk ? "yes" : "no",
      record.artifactPresent ? "yes" : "no",
      record.workflows
        .map((workflow) => `${workflow.name}:${workflow.conclusion}`)
        .join("; "),
    ]);
  }

  return matrix;
}

export function buildFilteredReleaseHistoryXlsxBytes(
  records: ReleaseHistoryRecord[],
  context: ReleaseHistoryExportContext = {},
): Uint8Array {
  return buildTableXlsxBytes(
    buildFilteredReleaseHistoryMatrix(records, context),
    "Release history",
  );
}

export function filterReleaseImportAuditEntries(
  entries: ReleaseHistoryAuditReportEntry[],
  filters: ReleaseImportAuditFilterState,
): ReleaseHistoryAuditReportEntry[] {
  const normalizedQuery = filters.query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filters.status !== "all" && entry.status !== filters.status)
      return false;
    if (filters.privacy === "clean" && entry.privacyFindingCount !== 0)
      return false;
    if (filters.privacy === "with_privacy" && entry.privacyFindingCount === 0)
      return false;
    if (!normalizedQuery) return true;
    const haystack = [
      entry.at,
      entry.status,
      String(entry.acceptedCount),
      String(entry.skippedCount),
      String(entry.privacyFindingCount),
      sanitizeAuditText(entry.message),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

export function buildReleaseImportAuditCsv(
  entries: ReleaseHistoryAuditReportEntry[],
  context: ReleaseHistoryAuditReportContext = {},
): string {
  const report = JSON.parse(
    buildReleaseImportAuditReport(entries, context),
  ) as {
    summary: Record<string, unknown>;
    entries: Array<Record<string, unknown>>;
  };
  const lines = [
    ["section", "key", "value"].map(csvEscape).join(","),
    ["summary", "totalAttempts", String(report.summary.totalAttempts ?? 0)]
      .map(csvEscape)
      .join(","),
    [
      "summary",
      "visibleAuditCount",
      String(report.summary.visibleAuditCount ?? 0),
    ]
      .map(csvEscape)
      .join(","),
    [
      "summary",
      "filteredHistoryCount",
      String(report.summary.filteredHistoryCount ?? 0),
    ]
      .map(csvEscape)
      .join(","),
    [
      "summary",
      "selectedBaselineSha",
      String(report.summary.selectedBaselineSha ?? "unknown"),
    ]
      .map(csvEscape)
      .join(","),
    [
      "summary",
      "selectedBaselineSource",
      String(report.summary.selectedBaselineSource ?? "unknown"),
    ]
      .map(csvEscape)
      .join(","),
    "",
    [
      "at",
      "status",
      "accepted_count",
      "skipped_count",
      "privacy_finding_count",
      "message",
    ]
      .map(csvEscape)
      .join(","),
  ];

  for (const entry of report.entries) {
    lines.push(
      [
        String(entry.at ?? ""),
        String(entry.status ?? "unknown"),
        String(entry.acceptedCount ?? 0),
        String(entry.skippedCount ?? 0),
        String(entry.privacyFindingCount ?? 0),
        String(entry.message ?? ""),
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  return `${lines.join("\n")}\n`;
}

export function releaseSnapshotFromHistoryRecord(
  record: ReleaseHistoryRecord,
): ReleaseStatusSnapshot {
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

export function buildReleaseStatusExportBundle(
  snapshot: ReleaseStatusSnapshot,
): ReleaseStatusExportFile[] {
  return (["markdown", "json", "html", "history"] as ReleaseStatusFormat[]).map(
    (format) => buildReleaseStatusExportFile(snapshot, format),
  );
}

export function compareReleaseStatusSnapshots(
  previous: ReleaseStatusSnapshot,
  current: ReleaseStatusSnapshot,
): ReleaseComparisonSummary {
  const previousLevel = releaseStatusLevel(previous);
  const currentLevel = releaseStatusLevel(current);
  const workflowNames = Array.from(
    new Set([
      ...previous.workflows.map((workflow) => workflow.name),
      ...current.workflows.map((workflow) => workflow.name),
    ]),
  ).sort();
  const workflowChanges = workflowNames
    .map((name) => {
      const previousWorkflow = previous.workflows.find(
        (workflow) => workflow.name === name,
      );
      const currentWorkflow = current.workflows.find(
        (workflow) => workflow.name === name,
      );
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
    improved:
      releaseStatusRank(currentLevel) > releaseStatusRank(previousLevel),
    worsened:
      releaseStatusRank(currentLevel) < releaseStatusRank(previousLevel),
    artifactChanged: previous.artifactPresent !== current.artifactPresent,
    dirtyCountDelta: current.changedCount - previous.changedCount,
    workflowChanges,
  };
}

function lineNumberAt(content: string, index: number): number {
  return content.slice(0, index).split(/\r?\n/).length;
}

export function detectReleaseStatusUiPrivacyLeaks(
  content: string,
): ReleasePrivacyFinding[] {
  const tokenParamPattern = TOKEN_PARAM_NAMES.join("|");
  const patterns: { label: string; re: RegExp }[] = [
    {
      label: "bearer token",
      re: /Authorization\s*[:=]\s*Bearer\s+(?!\[redacted)[A-Za-z0-9._~+/=-]{8,}/gi,
    },
    {
      label: "cookie header",
      re: /(?:Cookie|Set-Cookie)\s*:\s*(?!\s*\[redacted)[^\n\r]{6,}/gi,
    },
    {
      label: "url token parameter",
      re: new RegExp(
        "(?:".concat(tokenParamPattern, ")=((?!\\[redacted)[^\\s&\"'`<>]+)"),
        "gi",
      ),
    },
    {
      label: "email address",
      re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    },
    {
      label: "patient full-name field",
      re: /patient_full_name\s*[:=]\s*(?!\[redacted)[^\n\r,;]{3,}/gi,
    },
    {
      label: "actor email field",
      re: /actor_email\s*[:=]\s*(?!\[redacted)[^\n\r,;]{3,}/gi,
    },
    {
      label: "storage object path",
      re: /storage_object_path\s*[:=]\s*(?!\[redacted)[^\n\r,;]{3,}/gi,
    },
    {
      label: "supabase key",
      re: /\bsb_(?:publishable|secret)_[A-Za-z0-9_-]{8,}\b/gi,
    },
    {
      label: "service role env",
      re: /\bSUPABASE_SERVICE_ROLE_KEY\s*=\s*(?!\[redacted)[^\s]+/gi,
    },
    {
      label: "jwt-shaped value",
      re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g,
    },
  ];
  const findings: ReleasePrivacyFinding[] = [];
  for (const pattern of patterns) {
    pattern.re.lastIndex = 0;
    let match;
    while ((match = pattern.re.exec(content)) != null) {
      findings.push({
        label: pattern.label,
        line: lineNumberAt(content, match.index),
      });
    }
  }
  return findings;
}

export function summarizeReleasePrivacy(
  content: string,
): ReleasePrivacySummary {
  const findings = detectReleaseStatusUiPrivacyLeaks(content);
  return {
    lineCount: content.split(/\r?\n/).length,
    findingCount: findings.length,
    labels: Array.from(
      new Set(findings.map((finding) => finding.label)),
    ).sort(),
    findings,
  };
}
