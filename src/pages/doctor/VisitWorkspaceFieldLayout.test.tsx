import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@/lib/api-session", () => ({
  useApiSession: () => ({ apiToken: null, apiBaseUrl: null }),
}));

import VisitWorkspacePage from "./VisitWorkspacePage";

describe("VisitWorkspacePage · мобильные подписи полей", () => {
  it("группирует все термины и значения первичного приёма в списки описаний", () => {
    render(
      <MemoryRouter initialEntries={["/patients/p-004/visits/v-005"]}>
        <Routes>
          <Route path="/patients/:id/visits/:visitId" element={<VisitWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );

    const terms = ["Жалоба и параметры визита", "Демография", "Согласия"].flatMap((sectionName) => {
      const section = screen.getByRole("heading", { name: sectionName }).closest("section");
      return Array.from(section?.querySelectorAll("dt") ?? []);
    });

    expect(terms).toHaveLength(15);
    expect(terms.every((term) => term.closest("dl") !== null)).toBe(true);
  });

  it("переносит русские подписи только между словами и оставляет место значению", () => {
    render(
      <MemoryRouter initialEntries={["/patients/p-004/visits/v-005"]}>
        <Routes>
          <Route path="/patients/:id/visits/:visitId" element={<VisitWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );

    const term = screen.getByText("Жалоба");
    const multiwordTerm = screen.getByText("Медицинская съёмка");
    const value = term.parentElement?.querySelector("dd");

    expect(term.tagName).toBe("DT");
    expect(term.className).toMatch(/\bmin-w-min\b/);
    expect(term.className).toMatch(/\bbreak-normal\b/);
    expect(term.className).not.toMatch(/\bwhitespace-nowrap\b/);
    expect(multiwordTerm.className).toMatch(/\bmin-w-min\b/);
    expect(multiwordTerm.className).toMatch(/\bbreak-normal\b/);
    expect(value).not.toBeNull();
    expect(value!.className).toMatch(/\bmin-w-0\b/);
    expect(value!.className).toMatch(/\bbreak-words\b/);
  });
});
