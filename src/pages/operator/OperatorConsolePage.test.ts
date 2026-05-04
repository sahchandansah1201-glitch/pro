import { describe, it, expect } from "vitest";
import { getLeads, getProtectedAnalysisLinkById } from "@/lib/mock-data";

/**
 * Зеркалирует расчёт selectedLinkActive из OperatorConsolePage:
 * ссылка активна, если её expiresAt > DEMO_NOW.
 */
const DEMO_NOW = new Date("2026-05-04T00:00:00Z");

function linkActiveForDialog(dialogId: string): boolean {
  const lead = getLeads().find((l) => l.dialogId === dialogId);
  if (!lead?.protectedAnalysisLinkId) {
    throw new Error(`no lead/link for dialog ${dialogId}`);
  }
  const link = getProtectedAnalysisLinkById(lead.protectedAnalysisLinkId);
  if (!link) throw new Error(`no link ${lead.protectedAnalysisLinkId}`);
  return new Date(link.expiresAt).getTime() > DEMO_NOW.getTime();
}

describe("OperatorConsolePage selectedLinkActive vs DEMO_NOW", () => {
  it("bd-001: ссылка истекла (expiresAt < DEMO_NOW)", () => {
    expect(linkActiveForDialog("bd-001")).toBe(false);
  });

  it("bd-002: ссылка активна (expiresAt > DEMO_NOW)", () => {
    expect(linkActiveForDialog("bd-002")).toBe(true);
  });

  it("bd-004: ссылка активна (expiresAt > DEMO_NOW)", () => {
    expect(linkActiveForDialog("bd-004")).toBe(true);
  });
});
