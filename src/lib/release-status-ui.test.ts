import { describe, expect, it } from "vitest";

import {
  buildReleaseStatusExportBundle,
  buildReleaseHistoryJsonl,
  buildReleaseStatusHtml,
  buildReleaseStatusJson,
  buildReleaseStatusMarkdown,
  compareReleaseStatusSnapshots,
  detectReleaseStatusUiPrivacyLeaks,
  RELEASE_STATUS_DEMO_SNAPSHOT,
  RELEASE_STATUS_PREVIOUS_DEMO_SNAPSHOT,
  RELEASE_STATUS_PRIVACY_CATEGORIES,
  releaseStatusFilename,
  releaseStatusLevel,
  summarizeReleasePrivacy,
} from "./release-status-ui";

describe("release-status-ui", () => {
  it("builds safe markdown/json/html/history outputs", () => {
    const markdown = buildReleaseStatusMarkdown(RELEASE_STATUS_DEMO_SNAPSHOT);
    const json = buildReleaseStatusJson(RELEASE_STATUS_DEMO_SNAPSHOT);
    const html = buildReleaseStatusHtml(RELEASE_STATUS_DEMO_SNAPSHOT);
    const history = buildReleaseHistoryJsonl(RELEASE_STATUS_DEMO_SNAPSHOT);
    const combined = `${markdown}\n${json}\n${html}\n${history}`;

    expect(markdown).toContain("## Release operations dashboard");
    expect(JSON.parse(json).overallStatus).toBe("ok");
    expect(html).toMatch(/<!doctype html>/i);
    expect(JSON.parse(history).currentSha).toBe("5ce9cf1");
    expect(detectReleaseStatusUiPrivacyLeaks(combined)).toEqual([]);
    expect(combined).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(combined).not.toContain("storage_object_path");
    expect(combined).not.toContain("SUPABASE_SERVICE_ROLE_KEY=");
  });

  it("detects privacy leaks before UI export", () => {
    const findings = detectReleaseStatusUiPrivacyLeaks(`
Authorization: Bearer abc.def.ghi123456789
Cookie: session=secret
https://example.test/file?access_token=secret&sig=secret
patient_full_name=Jane Patient
actor_email=doctor@example.com
storage_object_path=clinic/a/file.png
SUPABASE_SERVICE_ROLE_KEY=service-secret
eyJabcdefghi.eyJklmnopq.eyJrstuvwx
`);

    expect(findings.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        "bearer token",
        "cookie header",
        "url token parameter",
        "email address",
        "patient full-name field",
        "storage object path",
        "service role env",
        "jwt-shaped value",
      ]),
    );
  });

  it("keeps status level and filenames deterministic enough for UI assertions", () => {
    expect(releaseStatusLevel(RELEASE_STATUS_DEMO_SNAPSHOT)).toBe("ok");
    expect(releaseStatusFilename("markdown")).toMatch(/^release-status-\d{4}-\d{2}-\d{2}\.md$/);
    expect(releaseStatusFilename("json")).toMatch(/^release-status-\d{4}-\d{2}-\d{2}\.json$/);
    expect(releaseStatusFilename("html")).toMatch(/^release-status-\d{4}-\d{2}-\d{2}\.html$/);
    expect(releaseStatusFilename("history")).toMatch(/^release-history-\d{4}-\d{2}-\d{2}\.jsonl$/);
  });

  it("builds a unified safe export bundle for all release-status formats", () => {
    const bundle = buildReleaseStatusExportBundle(RELEASE_STATUS_DEMO_SNAPSHOT);

    expect(bundle.map((item) => item.format)).toEqual(["markdown", "json", "html", "history"]);
    expect(bundle.every((item) => item.privacy.findingCount === 0)).toBe(true);
    expect(bundle.find((item) => item.format === "html")?.mime).toBe("text/html;charset=utf-8");
    expect(bundle.find((item) => item.format === "markdown")?.filename).toMatch(
      /^release-status-\d{4}-\d{2}-\d{2}\.md$/,
    );
  });

  it("summarizes privacy categories and compares release snapshots", () => {
    const summary = summarizeReleasePrivacy("safe\nactor_email=doctor@example.com");
    const comparison = compareReleaseStatusSnapshots(
      RELEASE_STATUS_PREVIOUS_DEMO_SNAPSHOT,
      RELEASE_STATUS_DEMO_SNAPSHOT,
    );

    expect(RELEASE_STATUS_PRIVACY_CATEGORIES).toContain("service role env");
    expect(summary.findingCount).toBeGreaterThan(0);
    expect(summary.labels).toEqual(expect.arrayContaining(["actor email field", "email address"]));
    expect(comparison.previousLevel).toBe("fail");
    expect(comparison.currentLevel).toBe("ok");
    expect(comparison.improved).toBe(true);
    expect(comparison.workflowChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "e2e-smoke", previous: "failure", current: "success" }),
      ]),
    );
  });
});
