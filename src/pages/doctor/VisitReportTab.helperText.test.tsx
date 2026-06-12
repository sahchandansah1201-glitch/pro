import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import VisitWorkspacePage from "./VisitWorkspacePage";

const HELPER = /Отправка и печать будут подключены через систему клиники/;

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/patients/:id/visits/:visitId" element={<VisitWorkspacePage />} />
        <Route path="*" element={<div>fallback</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("VisitReportTab · helper text «Отправка и печать будут подключены через систему клиники»", () => {
  const cases: Array<{ name: string; path: string }> = [
    {
      name: "valid lesion (l-008)",
      path: "/patients/p-004/visits/v-005?tab=report&lesion=l-008",
    },
    {
      name: "fallback при некорректном lesion-id",
      path: "/patients/p-004/visits/v-005?tab=report&lesion=bad-id",
    },
    {
      name: "без параметра lesion",
      path: "/patients/p-004/visits/v-005?tab=report",
    },
    {
      name: "local-lesion-1 (демо-очаг)",
      path: "/patients/p-004/visits/v-005?tab=report&lesion=local-lesion-1",
    },
    {
      name: "local-lesion-999 (несуществующий локальный)",
      path: "/patients/p-004/visits/v-005?tab=report&lesion=local-lesion-999",
    },
    {
      name: "lesion без assessment (l-009)",
      path: "/patients/p-004/visits/v-005?tab=report&lesion=l-009",
    },
  ];

  for (const c of cases) {
    it(`показывает helper text — ${c.name}`, () => {
      renderAt(c.path);
      const matches = screen.getAllByText(HELPER);
      expect(matches.length).toBeGreaterThan(0);
      // Helper не должен быть подменён на сообщение про реальную отправку.
      expect(
        screen.queryByText(/(Отправлено|Ошибка отправки|История отправок)/i),
      ).toBeNull();
    });
  }
});
