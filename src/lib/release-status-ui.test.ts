import { describe, expect, it } from "vitest";

import {
  buildReleaseHistoryJsonl,
  buildReleaseStatusHtml,
  buildReleaseStatusJson,
  buildReleaseStatusMarkdown,
  detectReleaseStatusUiPrivacyLeaks,
  RELEASE_STATUS_DEMO_SNAPSHOT,
  releaseStatusFilename,
  releaseStatusLevel,
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
});
