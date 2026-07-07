import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import DoctorReportsPageDemo from "./DoctorReportsPageDemo";

function renderPage() {
  return render(
      <MemoryRouter>
      <DoctorReportsPageDemo />
    </MemoryRouter>,
  );
}

describe("DoctorReportsPage", () => {
  it("renders a safe operational reports center with visit report links", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Центр отчётов" })).toBeInTheDocument();
    expect(screen.getByText("Очередь отчётов")).toBeInTheDocument();
    expect(screen.getAllByText("Выпуск отчёта").length).toBeGreaterThan(0);
    expect(screen.getByText("Блокеры выпуска")).toBeInTheDocument();

    const firstReportLink = screen.getAllByRole("link", { name: /Открыть отчёт в визите/i })[0];
    expect(firstReportLink).toHaveAttribute("href", "/patients/p-007/visits/v-008?tab=report");

    expect(document.body.textContent).not.toContain("tok-r001-demo");
    expect(document.body.textContent).not.toContain("tok-r005-demo");
    expect(document.body.textContent).not.toContain("doctorVersionText");
    expect(document.body.textContent).not.toContain("sharedLink");
    expect(document.body.textContent).not.toMatch(
      /MVP|демо|токен|token|raw ID|backend|self-hosted|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|DP-2026-\d+/i,
    );
  });

  it("filters reports by patient or clinic text", async () => {
    renderPage();

    await userEvent.type(screen.getByRole("searchbox", { name: "Поиск отчёта" }), "Новиков");

    expect(screen.getAllByText("Новиков Артём Сергеевич").length).toBeGreaterThan(0);
    expect(screen.queryByText("Иванова Наталья Олеговна")).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Сводка фильтра отчётов" })).toHaveTextContent(
      "Найдено 1 из 5",
    );
  });
});
