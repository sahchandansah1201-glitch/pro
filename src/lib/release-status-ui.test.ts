import { describe, expect, it } from "vitest";

import {
  buildReleaseStatusExportBundle,
  buildReleaseBaselineOptions,
  buildReleaseHistoryJsonl,
  buildReleaseStatusHtml,
  buildReleaseStatusJson,
  buildReleaseStatusMarkdown,
  compareReleaseStatusSnapshots,
  detectReleaseStatusUiPrivacyLeaks,
  parseReleaseHistoryJsonl,
  RELEASE_STATUS_DEMO_SNAPSHOT,
  RELEASE_STATUS_DEMO_HISTORY_JSONL,
  RELEASE_STATUS_PREVIOUS_DEMO_SNAPSHOT,
  RELEASE_STATUS_PRIVACY_CATEGORIES,
  releaseSnapshotFromHistoryRecord,
  releaseStatusFilename,
  releaseStatusLevel,
  summarizeReleaseHistoryPreview,
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

  it("parses safe release history jsonl into baseline snapshots", () => {
    const result = parseReleaseHistoryJsonl(RELEASE_STATUS_DEMO_HISTORY_JSONL);
    const preview = summarizeReleaseHistoryPreview(result);

    expect(result.privacy.findingCount).toBe(0);
    expect(result.status).toBe("safe");
    expect(result.acceptedCount).toBe(2);
    expect(result.skippedCount).toBe(0);
    expect(result.records.length).toBe(2);
    expect(result.records[0]?.currentSha).toBe(RELEASE_STATUS_DEMO_SNAPSHOT.shortSha);
    expect(result.message).toMatch(/privacy-проверка пройдена/);
    expect(preview.latestSha).toBe(RELEASE_STATUS_DEMO_SNAPSHOT.shortSha);
    expect(preview.workflowNames).toContain("e2e-smoke");

    const importedSnapshot = releaseSnapshotFromHistoryRecord(result.records[1]!);
    expect(importedSnapshot.shortSha).toBe(RELEASE_STATUS_PREVIOUS_DEMO_SNAPSHOT.shortSha);
    expect(importedSnapshot.artifactPath).toBe("history-import");
    expect(importedSnapshot.workflows.some((workflow) => workflow.conclusion === "failure")).toBe(true);

    const options = buildReleaseBaselineOptions(
      RELEASE_STATUS_DEMO_SNAPSHOT,
      RELEASE_STATUS_PREVIOUS_DEMO_SNAPSHOT,
      result.records,
    );
    expect(options[0]).toEqual(expect.objectContaining({ id: "demo-previous", source: "demo" }));
    expect(options.some((option) => option.source === "imported")).toBe(true);
  });

  it("rejects release history imports that contain private values", () => {
    const result = parseReleaseHistoryJsonl(
      `${RELEASE_STATUS_DEMO_HISTORY_JSONL}\n{"actor_email":"doctor@example.com","currentSha":"abcdef1"}`,
    );
    const preview = summarizeReleaseHistoryPreview(result);

    expect(result.status).toBe("blocked");
    expect(result.records).toEqual([]);
    expect(result.skippedCount).toBeGreaterThan(0);
    expect(result.message).toMatch(/privacy detector/);
    expect(result.privacy.labels).toEqual(expect.arrayContaining(["email address"]));
    expect(preview.privacyFindingCount).toBeGreaterThan(0);
  });
});
