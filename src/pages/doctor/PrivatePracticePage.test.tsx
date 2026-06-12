import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import PrivatePracticePage from "./PrivatePracticePage";
import { canRoleAccess } from "@/lib/access";
import { ROLE_BY_ID } from "@/lib/roles";

function renderPage() {
  return render(
    <MemoryRouter>
      <PrivatePracticePage />
    </MemoryRouter>,
  );
}

describe("PrivatePracticePage · Batch H private doctor practice center", () => {
  it("renders the private practice operating surface with safe sections and actions", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Центр частной практики" })).toBeInTheDocument();
    expect(screen.getByText(/Учебный режим: показаны рабочие очереди частного врача/i)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Рабочий день" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Очередь частной практики" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Финансы и оплата" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Заявки на запись" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Качество фото" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Готовность кабинета" })).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Открыть рабочее место врача" })).toHaveAttribute(
      "href",
      "/cockpit",
    );
    expect(screen.getByRole("link", { name: "Перейти к съёмке" })).toHaveAttribute(
      "href",
      "/capture",
    );
    expect(screen.getByRole("link", { name: "Открыть отчёты" })).toHaveAttribute(
      "href",
      "/reports",
    );
    expect(screen.getByRole("link", { name: "Настроить услуги" })).toHaveAttribute(
      "href",
      "/admin/services",
    );
  });

  it("does not leak protected tokens, raw channel refs, or clinical-risk copy in the practice center", () => {
    const { container } = renderPage();
    const html = container.innerHTML;
    const forbidden = [
      "pal-tok",
      "mock://",
      ["tg", "100"].join(":"),
      ["wa", "200"].join(":"),
      ["web", "300"].join(":"),
      ["external", "User", "Ref"].join(""),
      ["photo", "Ref"].join(""),
      ["model", "Version"].join(""),
      ["protected", "Analysis", "Link"].join(""),
    ];

    for (const token of forbidden) {
      expect(html, `forbidden token ${token}`).not.toContain(token);
    }
    expect(html).not.toMatch(/меланома|рак кожи|вероятность меланомы/i);
    expect(document.body.textContent).not.toMatch(
      /MVP|демо|лид|Lead|raw ID|backend|self-hosted|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|dermoscopy|macro|overview|body_map|DP-2026-\d+/i,
    );
  });

  it("is routed only to private doctors", () => {
    expect(canRoleAccess("private_doctor", "/practice")).toBe(true);
    expect(canRoleAccess("doctor", "/practice")).toBe(false);
    expect(canRoleAccess("clinic_admin", "/practice")).toBe(false);
    expect(ROLE_BY_ID.private_doctor.home).toBe("/practice");
  });
});
