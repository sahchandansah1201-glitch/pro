import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import CapturePage from "./CapturePage";

function renderCapture() {
  return render(
    <MemoryRouter>
      <CapturePage />
    </MemoryRouter>,
  );
}

function selectTab(name: RegExp) {
  const tab = screen.getByRole("tab", { name });
  fireEvent.pointerDown(tab, { button: 0 });
  fireEvent.mouseDown(tab, { button: 0 });
  fireEvent.click(tab);
}

describe("CapturePage · Batch B capture workflow", () => {
  it("uses native Russian capture wording without technical device or transfer terms", () => {
    const { container } = renderCapture();

    expect(screen.getByText(/Учебный режим: реальные устройства не подключены/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Дерматоскоп" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Локально" })).toBeInTheDocument();

    selectTab(/Дерматоскоп/);
    expect(screen.getByText(/Служебные коды устройства скрыты/)).toBeInTheDocument();
    expect(screen.getByText(/Снимок с дерматоскопа проходит через локальную связь клиники/)).toBeInTheDocument();

    selectTab(/Локально/);
    expect(screen.getAllByText(/код.*скрыт/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/код и служебные данные скрыты/i)).toBeInTheDocument();

    const visible = container.textContent ?? "";
    expect(visible).not.toMatch(/MVP|Device Bridge|Body map|сервер|хранилище|DryRun|JSON|backend|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|AI|XAI|PHI|token|токен|credential|session|signed|closed|scheduled|in_progress|cancelled/i);
    expect(visible).not.toMatch(/482 913|DP-LOCAL|d-00[1-4]|DL5-|HD30-|FF-HS|br-msk|br-spb|quality score/i);
  });

  it("lesion-first mode attaches a captured photo to the selected lesion", () => {
    renderCapture();

    expect(screen.getByRole("button", { name: /Сначала очаг/ })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /Добавить фото с телефона/ }));

    const queue = screen.getByRole("region", { name: /Очередь снимков/ });
    expect(within(queue).getByText(/Очаг B · висок левый/)).toBeInTheDocument();
    expect(within(queue).getByText(/привязано к очагу/i)).toBeInTheDocument();
    expect(screen.getByText(/Непривязано:\s*0/)).toBeInTheDocument();
  });

  it("batch-first mode creates an unassigned photo that can be assigned to the current lesion", () => {
    renderCapture();

    fireEvent.click(screen.getByRole("button", { name: /Серия без привязки/ }));
    selectTab(/Файл/);
    fireEvent.click(screen.getByRole("button", { name: /Добавить файл/ }));

    const queue = screen.getByRole("region", { name: /Очередь снимков/ });
    expect(within(queue).getByText(/без образования/i)).toBeInTheDocument();
    expect(within(queue).getByText(/требует привязки/i)).toBeInTheDocument();
    expect(screen.getByText(/Непривязано:\s*1/)).toBeInTheDocument();

    fireEvent.click(within(queue).getByRole("button", { name: /Привязать к очагу/ }));

    expect(within(queue).getByText(/Очаг B · висок левый/)).toBeInTheDocument();
    expect(screen.getByText(/Непривязано:\s*0/)).toBeInTheDocument();
  });

  it("links capture context and localization action to the body map for the current lesion", () => {
    renderCapture();

    const bodyMapLink = screen.getByRole("link", { name: /Открыть карту тела/ });
    expect(bodyMapLink).toHaveAttribute(
      "href",
      "/patients/p-004/visits/v-005?tab=bodymap&lesion=l-008",
    );

    fireEvent.click(screen.getByRole("button", { name: /Серия без привязки/ }));
    selectTab(/Файл/);
    fireEvent.click(screen.getByRole("button", { name: /Добавить файл/ }));

    const queue = screen.getByRole("region", { name: /Очередь снимков/ });
    const localizationLink = within(queue).getByRole("link", { name: /Локализация на карте тела/ });
    expect(localizationLink).toHaveAttribute(
      "href",
      "/patients/p-004/visits/v-005?tab=bodymap&lesion=l-008",
    );
  });

  it("shows a technical photo-quality gate with retake reason instead of clinical interpretation", () => {
    renderCapture();

    fireEvent.click(screen.getByRole("button", { name: /Добавить фото с телефона/ }));

    expect(screen.getAllByText(/С предупреждением/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/лёгкие блики/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Контроль качества — техническая проверка снимка/i)).toBeInTheDocument();
    expect(screen.getByText(/Это не диагноз/i)).toBeInTheDocument();
  });

  it("routes technically weak photos into Needs Better Photo Queue and records retake requests", () => {
    renderCapture();

    fireEvent.click(screen.getByRole("button", { name: /Добавить фото с телефона/ }));

    const retakeQueue = screen.getByRole("region", { name: /Нужно переснять/ });
    expect(within(retakeQueue).getByText(/лёгкие блики/i)).toBeInTheDocument();
    expect(within(retakeQueue).getByText(/Только техническое качество/i)).toBeInTheDocument();
    expect(screen.getByText(/Ожидают пересъёмки:\s*1/)).toBeInTheDocument();

    fireEvent.click(within(retakeQueue).getByRole("button", { name: /Запросить переснимок/ }));

    expect(within(retakeQueue).getByText(/Переснимок запрошен/i)).toBeInTheDocument();
    expect(screen.getByText(/Ожидают пересъёмки:\s*0/)).toBeInTheDocument();
    expect(screen.getByText(/Готово · 91%/i)).toBeInTheDocument();
  });
});
