import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AnalysisPublicPage from "./AnalysisPublicPage";

vi.mock("@/lib/app-mode", () => ({
  isProductionAppMode: () => true,
}));

const getSelfHostedPublicAnalysis = vi.fn();

vi.mock("@/lib/self-hosted-public-analysis-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/self-hosted-public-analysis-api")>(
    "@/lib/self-hosted-public-analysis-api",
  );
  return {
    ...actual,
    getSelfHostedPublicAnalysis: (...args: unknown[]) => getSelfHostedPublicAnalysis(...args),
  };
});

function renderAt(token: string) {
  return render(
    <MemoryRouter initialEntries={[`/analysis/${token}`]}>
      <Routes>
        <Route path="/analysis/:token" element={<AnalysisPublicPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AnalysisPublicPage production", () => {
  beforeEach(() => {
    getSelfHostedPublicAnalysis.mockReset();
  });

  it("loads production public link from self-hosted API and hides token/demo copy", async () => {
    getSelfHostedPublicAnalysis.mockResolvedValue({
      ok: true,
      value: {
        status: "valid",
        safeSummary: "Покажите врачу на контрольном приёме.",
        clinicName: "Яблоко ООО",
        qualityPassed: true,
        expiresAt: "2026-07-09T10:00:00.000Z",
      },
      error: null,
    });

    const { container } = renderAt("live-secret-token-001");

    expect(screen.getByText("Загружаем сводку…")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Предварительная сводка" })).toBeInTheDocument());
    expect(screen.getByText("Покажите врачу на контрольном приёме.")).toBeInTheDocument();
    expect(container.textContent || "").not.toMatch(/live-secret-token-001|Учебный просмотр|demo|backend|self-hosted|PostgreSQL/i);
    expect(getSelfHostedPublicAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({ token: "live-secret-token-001" }),
    );
  });

  it("renders expired production link as recovery state", async () => {
    getSelfHostedPublicAnalysis.mockResolvedValue({
      ok: true,
      value: { status: "expired", expiresAt: "2026-07-08T10:00:00.000Z" },
      error: null,
    });

    renderAt("live-expired-token-001");

    await waitFor(() => expect(screen.getByRole("heading", { name: "Ссылка истекла" })).toBeInTheDocument());
    expect(screen.getByText(/обратитесь в клинику/i)).toBeInTheDocument();
  });
});
