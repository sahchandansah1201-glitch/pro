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

export function releaseStatusLevelLabel(level: ReleaseStatusLevel): string {
  if (level === "ok") return "Готово";
  if (level === "fail") return "Блокер";
  return "Нужно проверить";
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

export function buildReleaseStatusOutput(
  snapshot: ReleaseStatusSnapshot,
  format: ReleaseStatusFormat,
): string {
  if (format === "markdown") return buildReleaseStatusMarkdown(snapshot);
  if (format === "json") return buildReleaseStatusJson(snapshot);
  if (format === "html") return buildReleaseStatusHtml(snapshot);
  return buildReleaseHistoryJsonl(snapshot);
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
