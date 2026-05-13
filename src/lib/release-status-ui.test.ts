import { describe, expect, it } from "vitest";

import {
  buildFilteredReleaseHistoryXlsxBytes,
  buildReleaseHistoryPresetExportJson,
  buildReleaseHistoryPresetAuditReport,
  buildReleaseHistoryPresetsXlsxBytes,
  buildReleaseHistoryFilterPreset,
  buildReleaseImportAuditReport,
  buildReleaseImportAuditCsv,
  buildFilteredReleaseHistoryCsv,
  buildFilteredReleaseHistoryJsonl,
  buildReleaseStatusExportBundle,
  buildReleaseBaselineOptions,
  buildReleaseHistoryJsonl,
  buildReleaseStatusHtml,
  buildReleaseStatusJson,
  buildReleaseStatusMarkdown,
  compareReleaseStatusSnapshots,
  detectReleaseStatusUiPrivacyLeaks,
  filterReleaseHistoryRecords,
  filterReleaseHistoryRecordsAdvanced,
  filterReleaseImportAuditEntries,
  DEFAULT_RELEASE_HISTORY_FILTER_PRESETS,
  normalizeReleaseHistoryFilterPreset,
  paginateReleaseHistoryRecords,
  parseReleaseHistoryJsonl,
  parseReleaseHistoryPresetExportJson,
  RELEASE_STATUS_DEMO_SNAPSHOT,
  RELEASE_STATUS_DEMO_HISTORY_JSONL,
  RELEASE_STATUS_PREVIOUS_DEMO_SNAPSHOT,
  RELEASE_STATUS_PRIVACY_CATEGORIES,
  releaseHistoryFilteredCsvFilename,
  releaseHistoryFilteredJsonlFilename,
  releaseHistoryFilteredXlsxFilename,
  releaseHistoryPresetAuditFilename,
  releaseHistoryPresetsJsonFilename,
  releaseHistoryPresetsXlsxFilename,
  releaseSnapshotFromHistoryRecord,
  releaseStatusFilename,
  releaseStatusLevel,
  summarizeReleaseHistoryIssues,
  summarizeReleaseHistoryPresetImport,
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
    expect(releaseStatusFilename("markdown")).toMatch(
      /^release-status-\d{4}-\d{2}-\d{2}\.md$/,
    );
    expect(releaseStatusFilename("json")).toMatch(
      /^release-status-\d{4}-\d{2}-\d{2}\.json$/,
    );
    expect(releaseStatusFilename("html")).toMatch(
      /^release-status-\d{4}-\d{2}-\d{2}\.html$/,
    );
    expect(releaseStatusFilename("history")).toMatch(
      /^release-history-\d{4}-\d{2}-\d{2}\.jsonl$/,
    );
  });

  it("builds a unified safe export bundle for all release-status formats", () => {
    const bundle = buildReleaseStatusExportBundle(RELEASE_STATUS_DEMO_SNAPSHOT);

    expect(bundle.map((item) => item.format)).toEqual([
      "markdown",
      "json",
      "html",
      "history",
    ]);
    expect(bundle.every((item) => item.privacy.findingCount === 0)).toBe(true);
    expect(bundle.find((item) => item.format === "html")?.mime).toBe(
      "text/html;charset=utf-8",
    );
    expect(bundle.find((item) => item.format === "markdown")?.filename).toMatch(
      /^release-status-\d{4}-\d{2}-\d{2}\.md$/,
    );
  });

  it("summarizes privacy categories and compares release snapshots", () => {
    const summary = summarizeReleasePrivacy(
      "safe\nactor_email=doctor@example.com",
    );
    const comparison = compareReleaseStatusSnapshots(
      RELEASE_STATUS_PREVIOUS_DEMO_SNAPSHOT,
      RELEASE_STATUS_DEMO_SNAPSHOT,
    );

    expect(RELEASE_STATUS_PRIVACY_CATEGORIES).toContain("service role env");
    expect(summary.findingCount).toBeGreaterThan(0);
    expect(summary.labels).toEqual(
      expect.arrayContaining(["actor email field", "email address"]),
    );
    expect(comparison.previousLevel).toBe("fail");
    expect(comparison.currentLevel).toBe("ok");
    expect(comparison.improved).toBe(true);
    expect(comparison.workflowChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "e2e-smoke",
          previous: "failure",
          current: "success",
        }),
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
    expect(result.records[0]?.currentSha).toBe(
      RELEASE_STATUS_DEMO_SNAPSHOT.shortSha,
    );
    expect(result.message).toMatch(/privacy-проверка пройдена/);
    expect(preview.latestSha).toBe(RELEASE_STATUS_DEMO_SNAPSHOT.shortSha);
    expect(preview.workflowNames).toContain("e2e-smoke");

    const importedSnapshot = releaseSnapshotFromHistoryRecord(
      result.records[1]!,
    );
    expect(importedSnapshot.shortSha).toBe(
      RELEASE_STATUS_PREVIOUS_DEMO_SNAPSHOT.shortSha,
    );
    expect(importedSnapshot.artifactPath).toBe("history-import");
    expect(
      importedSnapshot.workflows.some(
        (workflow) => workflow.conclusion === "failure",
      ),
    ).toBe(true);

    const options = buildReleaseBaselineOptions(
      RELEASE_STATUS_DEMO_SNAPSHOT,
      RELEASE_STATUS_PREVIOUS_DEMO_SNAPSHOT,
      result.records,
    );
    expect(options[0]).toEqual(
      expect.objectContaining({ id: "demo-previous", source: "demo" }),
    );
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
    expect(result.privacy.labels).toEqual(
      expect.arrayContaining(["email address"]),
    );
    expect(preview.privacyFindingCount).toBeGreaterThan(0);
    expect(result.issues[0]).toEqual(
      expect.objectContaining({ reason: "privacy_blocked" }),
    );
  });

  it("reports JSONL validation issues and filters release history records", () => {
    const validFail =
      '{"recordedAt":"2026-05-11T10:00:00Z","repo":"sahchandansah1201-glitch/pro","branch":"main","currentSha":"aaaaaaaaaaa","overallStatus":"fail","dirtyCount":2,"denoLockOk":false,"artifactPresent":false,"workflows":[{"name":"e2e-smoke","conclusion":"failure"}]}';
    const invalidSchema =
      '{"recordedAt":"2026-05-11T10:00:00Z","repo":"sahchandansah1201-glitch/pro","branch":"main","currentSha":"bbbbbbb","overallStatus":"ok","dirtyCount":0,"denoLockOk":true,"artifactPresent":true,"workflows":[]}';
    const result = parseReleaseHistoryJsonl(
      `${validFail}\n{bad json}\n${invalidSchema}`,
    );

    expect(result.status).toBe("partial");
    expect(result.acceptedCount).toBe(1);
    expect(result.skippedCount).toBe(2);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          line: 2,
          reason: "invalid_json",
          message: "invalid JSON",
        }),
        expect.objectContaining({ line: 3, reason: "invalid_schema" }),
      ]),
    );

    expect(
      filterReleaseHistoryRecords(result.records, "fail", "e2e"),
    ).toHaveLength(1);
    expect(filterReleaseHistoryRecords(result.records, "ok", "")).toHaveLength(
      0,
    );
    expect(
      filterReleaseHistoryRecords(result.records, "all", "aaaaaaaa"),
    ).toHaveLength(1);

    const page = paginateReleaseHistoryRecords(
      [
        ...result.records,
        { ...result.records[0]!, currentSha: "ccccccccccc" },
        { ...result.records[0]!, currentSha: "ddddddddddd" },
      ],
      2,
      2,
    );
    expect(page).toEqual(
      expect.objectContaining({
        page: 2,
        pageSize: 2,
        pageCount: 2,
        totalCount: 3,
        start: 3,
        end: 3,
      }),
    );
    expect(page.records[0]?.currentSha).toBe("ddddddddddd");
  });

  it("summarizes import errors and exports filtered history safely", () => {
    const safeFail =
      '{"recordedAt":"2026-05-11T10:00:00Z","repo":"sahchandansah1201-glitch/pro","branch":"main","currentSha":"aaaaaaaaaaa","overallStatus":"fail","dirtyCount":2,"denoLockOk":false,"artifactPresent":false,"workflows":[{"name":"e2e-smoke","conclusion":"failure"}]}';
    const result = parseReleaseHistoryJsonl(`${safeFail}\n{bad json}\n`);
    const issueSummary = summarizeReleaseHistoryIssues(result);
    const jsonl = buildFilteredReleaseHistoryJsonl(result.records);
    const context = {
      totalCount: 2,
      filteredCount: 1,
      filters: {
        status: "fail",
        deno: "blocked",
        artifact: "missing",
        workflow: "failure",
        query: "doctor@example.com",
      },
    } as const;
    const csv = buildFilteredReleaseHistoryCsv(result.records, {
      ...context,
    });
    const xlsx = buildFilteredReleaseHistoryXlsxBytes(result.records, context);

    expect(issueSummary).toEqual(
      expect.objectContaining({
        totalIssues: 1,
        invalidJsonCount: 1,
        invalidSchemaCount: 0,
        privacyBlockedCount: 0,
        affectedLines: [2],
      }),
    );
    expect(issueSummary.message).toContain("JSON: 1");
    expect(parseReleaseHistoryJsonl(jsonl).acceptedCount).toBe(1);
    expect(csv).toContain('"summary","filteredCount","1"');
    expect(csv).toContain('"filter","status","fail"');
    expect(csv).toContain('"recorded_at"');
    expect(csv).toContain('"e2e-smoke:failure"');
    expect(csv).not.toContain("doctor@example.com");
    expect(csv).toContain("redacted text");
    expect(detectReleaseStatusUiPrivacyLeaks(`${jsonl}\n${csv}`)).toEqual([]);
    expect(releaseHistoryFilteredJsonlFilename()).toMatch(
      /^release-history-filtered-\d{4}-\d{2}-\d{2}\.jsonl$/,
    );
    expect(releaseHistoryFilteredCsvFilename()).toMatch(
      /^release-history-filtered-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    expect(releaseHistoryFilteredXlsxFilename()).toMatch(
      /^release-history-filtered-\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
    expect(Array.from(xlsx.slice(0, 2))).toEqual([80, 75]);
    expect(xlsx.length).toBeGreaterThan(100);
  });

  it("normalizes saved release-history filter presets safely", () => {
    expect(
      DEFAULT_RELEASE_HISTORY_FILTER_PRESETS.map((preset) => preset.id),
    ).toEqual(
      expect.arrayContaining(["builtin-blockers", "builtin-e2e-failures"]),
    );

    const preset = buildReleaseHistoryFilterPreset(
      "Блокеры недели",
      {
        status: "fail",
        deno: "blocked",
        artifact: "missing",
        workflow: "failure",
        query: "e2e",
      },
      "2026-05-12T10:00:00Z",
    );

    expect(preset).toEqual(
      expect.objectContaining({
        source: "saved",
        name: "Блокеры недели",
        filters: expect.objectContaining({ query: "e2e" }),
      }),
    );
    expect(preset?.id).toMatch(/^saved-\d+-/);
    expect(
      buildReleaseHistoryFilterPreset("doctor@example.com", preset!.filters),
    ).toBeNull();
    expect(
      normalizeReleaseHistoryFilterPreset({
        id: "saved-1-safe",
        name: "Safe",
        source: "saved",
        filters: {
          status: "all",
          deno: "all",
          artifact: "all",
          workflow: "all",
          query: "doctor@example.com",
        },
      }),
    ).toEqual(
      expect.objectContaining({
        filters: expect.objectContaining({ query: "" }),
      }),
    );
  });

  it("exports and imports release-history filter presets safely", () => {
    const preset = buildReleaseHistoryFilterPreset(
      "E2E blockers",
      {
        status: "fail",
        deno: "blocked",
        artifact: "missing",
        workflow: "failure",
        query: "e2e",
      },
      "2026-05-12T10:00:00Z",
    )!;
    const json = buildReleaseHistoryPresetExportJson([preset]);
    const parsed = parseReleaseHistoryPresetExportJson(json);
    const importSummary = summarizeReleaseHistoryPresetImport(parsed);
    const xlsx = buildReleaseHistoryPresetsXlsxBytes(parsed.presets);
    const audit = buildReleaseHistoryPresetAuditReport([
      {
        at: "2026-05-12T12:00:00Z",
        action: "export_json",
        presetCount: 1,
        message: "actor_email=doctor@example.com preset exported safely",
      },
    ]);

    expect(JSON.parse(json).presetCount).toBe(1);
    expect(parsed).toEqual(
      expect.objectContaining({
        acceptedCount: 1,
        skippedCount: 0,
        status: "safe",
      }),
    );
    expect(parsed.presets[0]).toEqual(
      expect.objectContaining({
        name: "E2E blockers",
        filters: expect.objectContaining({ workflow: "failure" }),
      }),
    );
    expect(importSummary).toEqual(
      expect.objectContaining({
        acceptedCount: 1,
        skippedCount: 0,
        privacyFindingCount: 0,
        previewNames: ["E2E blockers"],
      }),
    );
    expect(Array.from(xlsx.slice(0, 2))).toEqual([80, 75]);
    expect(JSON.parse(audit)).toEqual(
      expect.objectContaining({
        title: "Release history preset audit",
        rowCount: 1,
        entries: [
          expect.objectContaining({
            action: "export_json",
            presetCount: 1,
          }),
        ],
      }),
    );
    expect(audit).not.toContain("doctor@example.com");
    expect(audit).toContain("redacted");
    expect(releaseHistoryPresetsJsonFilename()).toMatch(
      /^release-history-filter-presets-\d{4}-\d{2}-\d{2}\.json$/,
    );
    expect(releaseHistoryPresetsXlsxFilename()).toMatch(
      /^release-history-filter-presets-\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
    expect(releaseHistoryPresetAuditFilename()).toMatch(
      /^release-history-filter-presets-audit-\d{4}-\d{2}-\d{2}\.json$/,
    );

    const unsafe = parseReleaseHistoryPresetExportJson(
      '{"presets":[],"actor_email":"doctor@example.com"}',
    );
    expect(unsafe.status).toBe("blocked");
    expect(unsafe.privacy.findingCount).toBeGreaterThan(0);
  });

  it("filters release history and import audit with advanced criteria", () => {
    const records = parseReleaseHistoryJsonl(
      [
        '{"recordedAt":"2026-05-11T10:00:00Z","repo":"sahchandansah1201-glitch/pro","branch":"main","currentSha":"aaaaaaaaaaa","overallStatus":"fail","dirtyCount":2,"denoLockOk":false,"artifactPresent":false,"workflows":[{"name":"e2e-smoke","conclusion":"failure"}]}',
        '{"recordedAt":"2026-05-11T11:00:00Z","repo":"sahchandansah1201-glitch/pro","branch":"main","currentSha":"bbbbbbbbbbb","overallStatus":"ok","dirtyCount":0,"denoLockOk":true,"artifactPresent":true,"workflows":[{"name":"release-status","conclusion":"success"}]}',
      ].join("\n"),
    ).records;

    expect(
      filterReleaseHistoryRecordsAdvanced(records, {
        status: "fail",
        deno: "blocked",
        artifact: "missing",
        workflow: "failure",
        query: "e2e",
      }).map((record) => record.currentSha),
    ).toEqual(["aaaaaaaaaaa"]);
    expect(
      filterReleaseHistoryRecordsAdvanced(records, {
        status: "ok",
        deno: "ok",
        artifact: "present",
        workflow: "success",
        query: "release-status",
      }).map((record) => record.currentSha),
    ).toEqual(["bbbbbbbbbbb"]);

    const auditEntries = [
      {
        at: "2026-05-12T10:00:00Z",
        status: "dry_run",
        acceptedCount: 1,
        skippedCount: 0,
        privacyFindingCount: 0,
        message: "Dry-run импорт выполнен.",
      },
      {
        at: "2026-05-12T11:00:00Z",
        status: "blocked",
        acceptedCount: 0,
        skippedCount: 1,
        privacyFindingCount: 1,
        message: "actor_email=doctor@example.com",
      },
    ];
    expect(
      filterReleaseImportAuditEntries(auditEntries, {
        status: "dry_run",
        privacy: "clean",
        query: "dry",
      }),
    ).toHaveLength(1);
    expect(
      filterReleaseImportAuditEntries(auditEntries, {
        status: "all",
        privacy: "with_privacy",
        query: "email",
      }),
    ).toHaveLength(1);
  });

  it("builds a sanitized release history import audit report", () => {
    const report = buildReleaseImportAuditReport(
      [
        {
          at: "2026-05-12T10:00:00Z",
          status: "dry_run",
          acceptedCount: 1,
          skippedCount: 0,
          privacyFindingCount: 0,
          message: "Dry-run импорт: 1 безопасная запись.",
        },
        {
          at: "2026-05-12T11:00:00Z",
          status: "blocked",
          acceptedCount: 0,
          skippedCount: 1,
          privacyFindingCount: 1,
          message: "actor_email=doctor@example.com",
        },
      ],
      {
        selectedBaselineSha: "aaaaaaaaaaa",
        selectedBaselineSource: "imported",
        filteredHistoryCount: 3,
        historyStatusFilter: "fail",
        historyQuery: "doctor@example.com",
      },
    );

    const parsed = JSON.parse(report);
    expect(parsed.title).toBe("Release history import audit");
    expect(parsed.rowCount).toBe(2);
    expect(parsed.summary.statusCounts).toEqual({ dry_run: 1, blocked: 1 });
    expect(parsed.summary.acceptedTotal).toBe(1);
    expect(parsed.summary.skippedTotal).toBe(1);
    expect(parsed.summary.selectedBaselineSha).toBe("aaaaaaaaaaa");
    expect(parsed.summary.selectedBaselineSource).toBe("imported");
    expect(parsed.summary.filters).toEqual(
      expect.objectContaining({
        status: "fail",
        query: expect.stringContaining("redacted text"),
      }),
    );
    expect(parsed.entries[0].status).toBe("dry_run");
    expect(report).not.toContain("doctor@example.com");
    expect(report).toContain("redacted message");
  });

  it("builds a sanitized CSV audit report with summary rows", () => {
    const csv = buildReleaseImportAuditCsv(
      [
        {
          at: "2026-05-12T10:00:00Z",
          status: "blocked",
          acceptedCount: 0,
          skippedCount: 1,
          privacyFindingCount: 1,
          message: "actor_email=doctor@example.com",
        },
      ],
      {
        selectedBaselineSha: "aaaaaaaaaaa",
        selectedBaselineSource: "imported",
        visibleAuditCount: 1,
        filteredHistoryCount: 2,
        auditQuery: "doctor@example.com",
      },
    );

    expect(csv).toContain('"summary","visibleAuditCount","1"');
    expect(csv).toContain('"summary","filteredHistoryCount","2"');
    expect(csv).toContain('"status"');
    expect(csv).toContain('"blocked"');
    expect(csv).not.toContain("doctor@example.com");
    expect(csv).toContain("redacted message");
  });
});
