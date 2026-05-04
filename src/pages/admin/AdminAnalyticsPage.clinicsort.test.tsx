import { describe, it, expect } from "vitest";
import { render, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminAnalyticsPage from "./AdminAnalyticsPage";
import { getClinics, getLeads } from "@/lib/mock-data";

/**
 * Контракт сортировки строк клиник в разделе «Маршрутизация по клиникам»:
 *   - режим «По приоритету»: возрастание routingPriority;
 *   - режим «По конверсии»: убывание конверсии (booked / leads);
 *   - агрегатный вид сохраняется (нет ФИО, контактов, photoRef и т.п.).
 */

function getClinicsSection(container: HTMLElement): HTMLElement {
  const titleEl = Array.from(container.querySelectorAll("div"))
    .find((d) => d.textContent?.trim() === "Маршрутизация по клиникам") as
    | HTMLElement
    | undefined;
  if (!titleEl) throw new Error("clinics section not found");
  return titleEl.closest("div.p-4") as HTMLElement;
}

function readClinicNames(section: HTMLElement): string[] {
  const rows = section.querySelectorAll(".divide-y > .grid");
  return Array.from(rows).map(
    (row) => row.querySelector(".font-medium")!.textContent!.trim(),
  );
}

function expectedByPriority(): string[] {
  return [...getClinics()]
    .sort((a, b) => a.routingPriority - b.routingPriority)
    .map((c) => c.name);
}

function expectedByConversion(): string[] {
  const leads = getLeads();
  const enriched = getClinics().map((c) => {
    const lf = leads.filter((l) => l.clinicId === c.id);
    const bk = lf.filter((l) => l.status === "booked").length;
    const conv = lf.length > 0 ? Math.round((bk / lf.length) * 100) : 0;
    return { name: c.name, conv, leads: lf.length, prio: c.routingPriority };
  });
  enriched.sort(
    (a, b) =>
      b.conv - a.conv || b.leads - a.leads || a.prio - b.prio,
  );
  return enriched.map((c) => c.name);
}

describe("AdminAnalyticsPage — Маршрутизация по клиникам, сортировка", () => {
  it("по умолчанию строки отсортированы по приоритету", () => {
    const { container } = render(
      <MemoryRouter>
        <AdminAnalyticsPage />
      </MemoryRouter>,
    );
    const section = getClinicsSection(container);
    expect(readClinicNames(section)).toEqual(expectedByPriority());
  });

  it("переключение «По конверсии» сортирует строки по убыванию конверсии", () => {
    const { container, getByRole } = render(
      <MemoryRouter>
        <AdminAnalyticsPage />
      </MemoryRouter>,
    );
    fireEvent.click(getByRole("tab", { name: "По конверсии" }));
    const section = getClinicsSection(container);
    expect(readClinicNames(section)).toEqual(expectedByConversion());
  });

  it("обратное переключение на «По приоритету» возвращает исходный порядок", () => {
    const { container, getByRole } = render(
      <MemoryRouter>
        <AdminAnalyticsPage />
      </MemoryRouter>,
    );
    fireEvent.click(getByRole("tab", { name: "По конверсии" }));
    fireEvent.click(getByRole("tab", { name: "По приоритету" }));
    const section = getClinicsSection(container);
    expect(readClinicNames(section)).toEqual(expectedByPriority());
  });

  it("после сортировки по конверсии секция остаётся агрегатной — без PHI", () => {
    const { container, getByRole } = render(
      <MemoryRouter>
        <AdminAnalyticsPage />
      </MemoryRouter>,
    );
    fireEvent.click(getByRole("tab", { name: "По конверсии" }));
    const section = getClinicsSection(container);
    const text = section.textContent ?? "";
    // Запрещённые токены и образцы PHI из моков.
    for (const t of [
      "fullName",
      "phone",
      "email",
      "photoRef",
      "externalUserRef",
    ]) {
      expect(section.innerHTML).not.toMatch(new RegExp(t));
    }
    expect(text).not.toMatch(/tg:|wa:|web:|mock:\/\//);
    // Все клиники по-прежнему перечислены.
    for (const c of getClinics()) {
      expect(within(section).getByText(c.name)).toBeInTheDocument();
    }
  });
});
