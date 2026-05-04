import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminIntegrationDetailPage, {
  ALLOWED_SOURCE_FIELDS,
} from "./AdminIntegrationDetailPage";
import { getIntegrations } from "@/lib/mock-data";

/**
 * Контракт безопасности:
 *   1) ALLOWED_SOURCE_FIELDS никогда не должен содержать `externalUserRef`
 *      и любые иные чувствительные токены (PHI, фото, AI/XAI, ссылки).
 *   2) Ни одна интеграция при рендере не должна выводить токен
 *      `externalUserRef` в DOM (ни в текст, ни в атрибуты).
 */

const FORBIDDEN_SOURCE_FIELDS = [
  "externalUserRef",
  "fullName",
  "birthDate",
  "phone",
  "email",
  "photoRef",
  "storagePath",
  "diagnosis",
  "doctorVersionText",
  "patientSafeText",
  "sharedLink",
  "features",
  "modelVersion",
  "heatmapRef",
];

function renderIntegration(kind: string, id: string) {
  return render(
    <MemoryRouter initialEntries={[`/admin/integrations/${kind}/${id}`]}>
      <Routes>
        <Route
          path="/admin/integrations/:kind/:id"
          element={<AdminIntegrationDetailPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminIntegrationDetailPage — ALLOWED_SOURCE_FIELDS guard", () => {
  it("ALLOWED_SOURCE_FIELDS не содержит externalUserRef", () => {
    expect(ALLOWED_SOURCE_FIELDS.has("externalUserRef")).toBe(false);
  });

  it("ALLOWED_SOURCE_FIELDS не содержит ни одного запрещённого токена", () => {
    for (const token of FORBIDDEN_SOURCE_FIELDS) {
      expect(
        ALLOWED_SOURCE_FIELDS.has(token),
        `forbidden token "${token}" leaked into ALLOWED_SOURCE_FIELDS`,
      ).toBe(false);
    }
  });

  it("ни одна интеграция не рендерит externalUserRef в DOM", () => {
    for (const integration of getIntegrations()) {
      const { container, unmount } = renderIntegration(
        integration.kind,
        integration.id,
      );
      expect(
        container.innerHTML,
        `externalUserRef leaked in ${integration.id}`,
      ).not.toMatch(/externalUserRef/);
      unmount();
    }
  });
});
