import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import VisitWorkspacePage from "./VisitWorkspacePage";

describe("dbg", () => {
  it("dump", () => {
    render(
      <MemoryRouter initialEntries={["/patients/p-001/visits/v-001"]}>
        <Routes>
          <Route path="/patients/:id/visits/:visitId" element={<VisitWorkspacePage />} />
        </Routes>
      </MemoryRouter>,
    );
    const t = screen.getByRole("tab", { name: /body map/i });
    console.log("aria-selected before:", t.getAttribute("aria-selected"));
    fireEvent.pointerDown(t, { button: 0 }); fireEvent.mouseDown(t, { button: 0 }); fireEvent.click(t);
    console.log("aria-selected after:", t.getAttribute("aria-selected"));
    const found = screen.queryAllByText(/Тип карты/);
    console.log("FOUND tipo karty:", found.length);
    const all = screen.queryAllByText(/Body map/);
    console.log("body map labels:", all.length);
    expect(true).toBe(true);
  });
});
