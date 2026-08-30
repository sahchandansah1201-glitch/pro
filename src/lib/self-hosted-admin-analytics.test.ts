import { afterEach, expect, it, vi } from "vitest";
import { getAdminAnalytics } from "./self-hosted-admin-api";

const period = { dateFrom: "2026-08-01", dateTo: "2026-08-30", timeZone: "Europe/Moscow" as const };
const counters = { ...period, patientsCreated: 1, visitsCreated: 2, photosAdded: 3, reportsSigned: 4 };
afterEach(() => vi.unstubAllGlobals());

it("keeps the no-query request compatible with AdminHome", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ item: { visits: 90 } })));
  vi.stubGlobal("fetch", fetchMock);
  const result = await getAdminAnalytics({ apiBaseUrl: "https://synthetic.invalid", apiToken: "synthetic" });
  expect(fetchMock.mock.calls[0][0]).toBe("https://synthetic.invalid/api/v1/admin/analytics");
  expect(result.ok).toBe(true);
  expect(result.value?.visits).toBe(90);
  expect(result.value).not.toHaveProperty("period");
});

it("sends a period and preserves both period counters and legacy totals", async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ item: { visits: 90, period: counters } })));
  vi.stubGlobal("fetch", fetchMock);
  const result = await getAdminAnalytics({ apiBaseUrl: "https://synthetic.invalid", apiToken: "synthetic", period });
  expect(String(fetchMock.mock.calls[0][0])).toBe(`https://synthetic.invalid/api/v1/admin/analytics?${new URLSearchParams(period)}`);
  expect(result.value?.visits).toBe(90);
  expect(result.value?.period).toEqual(counters);
});

it("refuses a missing, mismatched or malformed period instead of showing totals as period data", async () => {
  for (const value of [undefined, { ...counters, dateFrom: "2026-07-01" }, { ...counters, timeZone: "UTC" }, { ...counters, visitsCreated: -1 }, { ...counters, photosAdded: null }, { ...counters, reportsSigned: "NaN" }]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ item: { visits: 90, period: value } }))));
    const result = await getAdminAnalytics({ apiBaseUrl: "https://synthetic.invalid", apiToken: "synthetic", period });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("analytics_period_unavailable");
  }
});
