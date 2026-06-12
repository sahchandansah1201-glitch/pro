import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminIntegrationDetailPage from "./AdminIntegrationDetailPage";
import { getIntegrations } from "@/lib/mock-data";

/**
 * Контракт безопасности admin UI для /admin/integrations/crm/int-005:
 *   - страница не содержит токен `externalUserRef` ни в тексте, ни в
 *     атрибутах (title/aria-label/alt и пр.) — он запрещён политикой
 *     данных учебного режима;
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

  it("безопасная связь канала отображается русскими названиями", () => {
    const { container, getAllByText, getByText } = renderInt005();

    expect(container.querySelectorAll("code")).toHaveLength(0);
    expect(getByText("Канал связи")).toBeTruthy();
    expect(getByText("Тип диалога")).toBeTruthy();

    // Подпись «разрешено» присутствует хотя бы один раз.
    expect(getAllByText("разрешено").length).toBeGreaterThanOrEqual(1);
  });

  it("заблокированные категории показаны русскими названиями без технических сокращений", () => {
    const { container, getAllByText, getByText } = renderInt005();
    const visible = container.textContent ?? "";
    expect(getByText("Идентификаторы пациента")).toBeTruthy();
    expect(getByText("Фото")).toBeTruthy();
    expect(getByText("Клиническое решение")).toBeTruthy();
    expect(getByText("Технические детали подсказки")).toBeTruthy();
    // «закрыто» встречается несколько раз — по одному на каждую категорию.
    expect(getAllByText("закрыто").length).toBeGreaterThanOrEqual(4);
    expect(visible).not.toMatch(/MVP|AI|XAI|PHI|DryRun|JSON|Report|AnalysisCard|safeSummary|protectedLink|Telegram Bot API/i);
  });
});
