import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SELF_HOSTED_API_BASE_URL_KEY,
  SELF_HOSTED_API_TOKEN_KEY,
  SELF_HOSTED_API_USER_KEY,
} from "@/lib/self-hosted-api-session";
import { VisitWorkspaceLiveBanner } from "./VisitWorkspaceLiveBanner";

const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const BASE = "http://localhost:3001";
const TOKEN = "header.payload.signature";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function configureSession() {
  window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, BASE);
  window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, TOKEN);
  window.localStorage.setItem(
    SELF_HOSTED_API_USER_KEY,
    JSON.stringify({ id: "u", displayName: "Doc", roles: ["doctor"] }),
  );
}

describe("VisitWorkspaceLiveBanner", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders demo banner when no self-hosted token", () => {
    render(<VisitWorkspaceLiveBanner visitId={VISIT_ID} />);
    const banner = screen.getByTestId("visit-workspace-live-banner");
    expect(banner.dataset.mode).toBe("demo");
    expect(banner).toHaveTextContent(/Demo-режим/);
  });

  it("loads visit, lesions and assets in live mode and renders counts", async () => {
    configureSession();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith(`/api/v1/visits/${VISIT_ID}`)) {
        return jsonResponse({
          item: {
            id: VISIT_ID,
            status: "in_progress",
            patient: { id: "p", fullName: "Demo Patient", code: "DP-1" },
            clinic: { id: "c", slug: "demo-clinic", name: "Clinic" },
          },
        });
      }
      if (url.endsWith(`/api/v1/visits/${VISIT_ID}/lesions`)) {
        return jsonResponse({ items: [{ id: "l1", label: "L1", status: "active" }] });
      }
      if (url.endsWith(`/api/v1/visits/${VISIT_ID}/assets`)) {
        return jsonResponse({
          items: [
            { id: "a1", kind: "dermoscopy" },
            { id: "a2", kind: "overview_photo" },
          ],
        });
      }
      throw new Error(`unexpected url ${url}`);
    });

    render(<VisitWorkspaceLiveBanner visitId={VISIT_ID} />);

    await waitFor(() => {
      const banner = screen.getByTestId("visit-workspace-live-banner");
      expect(banner.dataset.mode).toBe("live");
    });
    const banner = screen.getByTestId("visit-workspace-live-banner");
    expect(banner).toHaveTextContent(/Self-hosted backend \(read-only\)/);
    expect(banner).toHaveTextContent(/Очаги: 1/);
    expect(banner).toHaveTextContent(/Снимки \(метаданные\): 2/);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it("renders error banner when backend returns visit_not_found", async () => {
    configureSession();
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith(`/api/v1/visits/${VISIT_ID}`)) {
        return jsonResponse(
          { error: { code: "visit_not_found", message: "Visit was not found in the allowed clinic scope." } },
          404,
        );
      }
      return jsonResponse({ items: [] });
    });

    render(<VisitWorkspaceLiveBanner visitId={VISIT_ID} />);

    await waitFor(() => {
      const banner = screen.getByTestId("visit-workspace-live-banner");
      expect(banner.dataset.mode).toBe("error");
    });
    expect(screen.getByTestId("visit-workspace-live-banner")).toHaveTextContent(/visit_not_found/);
  });
});
