import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminIntegrationDetailPage from "./AdminIntegrationDetailPage";
import { getIntegrations } from "@/lib/mock-data";

/**
 * Контракт безопасности admin UI для /admin/integrations/crm/int-005:
 *   - страница не содержит токен `externalUserRef` ни в тексте, ни в
 *     атрибутах (title/aria-label/alt и пр.) — он запрещён политикой
 *     данных MVP;
 *   - при этом безопасный маппинг `channel → chat_type` отображается
 *     корректно как разрешённая строка.
 */
function renderInt005() {
  return render(
    <MemoryRouter initialEntries={["/admin/integrations/crm/int-005"]}>
      <Routes>
        <Route
          path="/admin/integrations/:kind/:id"
          element={<AdminIntegrationDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminIntegrationDetailPage — int-005 messenger integration", () => {
  it("моки int-005 действительно содержат запрещённый externalUserRef (страховка теста)", () => {
    const i = getIntegrations().find((x) => x.id === "int-005");
    expect(i, "int-005 must exist in mocks").toBeTruthy();
    expect(Object.keys(i!.fieldMap)).toContain("externalUserRef");
    expect(Object.keys(i!.fieldMap)).toContain("channel");
  });

  it("в DOM нигде нет подстроки 'externalUserRef' — ни в тексте, ни в атрибутах", () => {
    const { container } = renderInt005();
    // innerHTML покрывает и текстовые узлы, и значения атрибутов (title/aria-label/alt).
    expect(container.innerHTML).not.toMatch(/externalUserRef/);
    expect(container.textContent ?? "").not.toMatch(/externalUserRef/);

    // На всякий случай — явная проверка по всем элементам и их атрибутам.
    const all = container.querySelectorAll("*");
    for (const el of Array.from(all)) {
      for (const attr of Array.from(el.attributes)) {
        expect(attr.value).not.toMatch(/externalUserRef/);
      }
    }
  });

  it("безопасный маппинг channel → chat_type отображается как разрешённый", () => {
    const { container, getByText } = renderInt005();

    // Левая часть строки маппинга: наше поле `channel` (в <code>).
    const codes = Array.from(container.querySelectorAll("code")).map(
      (c) => c.textContent,
    );
    expect(codes).toContain("channel");
    expect(codes).toContain("chat_type");

    // Подпись «разрешено» присутствует хотя бы один раз.
    expect(getByText("разрешено")).toBeTruthy();
  });

  it("заблокированные категории (фото, диагноз, AI/XAI, идентификаторы пациента) показаны как закрытые", () => {
    const { getAllByText, getByText } = renderInt005();
    expect(getByText("Идентификаторы пациента")).toBeTruthy();
    expect(getByText("Фото")).toBeTruthy();
    expect(getByText("Клиническое решение")).toBeTruthy();
    expect(getByText("AI / XAI детали")).toBeTruthy();
    // «закрыто» встречается несколько раз — по одному на каждую категорию.
    expect(getAllByText("закрыто").length).toBeGreaterThanOrEqual(4);
  });
});
