import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import tailwindConfig from "../../../tailwind.config";
import AdminAnalyticsPage from "./AdminAnalyticsPage";

describe("AdminAnalyticsPage — перенос строк учебного отчёта", () => {
  const stylesheet = document.createElement("style");

  afterEach(() => stylesheet.remove());

  it("разрешает перенос длинных строк и слов, сохраняя переводы строк отчёта", async () => {
    const { getByRole, getByLabelText } = render(
      <MemoryRouter>
        <AdminAnalyticsPage />
      </MemoryRouter>,
    );
    fireEvent.click(getByRole("button", { name: "Сформировать учебный отчёт" }));

    const report = getByLabelText("Безопасный агрегатный предпросмотр отчёта");
    // JSDOM не загружает CSS приложения; компилируем реальные utilities отчёта.
    const { css } = await postcss([
      tailwindcss({
        ...tailwindConfig,
        content: [{ raw: report.outerHTML, extension: "html" }],
      }),
    ]).process("@tailwind utilities;", { from: undefined });
    stylesheet.textContent = css;
    document.head.appendChild(stylesheet);
    const computed = getComputedStyle(report);

    expect(computed.whiteSpace).toBe("pre-wrap");
    expect(computed.overflowWrap).toBe("break-word");
    expect(report.textContent).toContain("Период: Все данные\nГраница: только агрегаты, без пациентских строк.");
  });
});
