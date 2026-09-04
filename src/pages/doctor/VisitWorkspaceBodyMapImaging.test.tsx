import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const apiSessionMock = vi.hoisted(() => ({
  current: { apiToken: null as string | null, apiBaseUrl: null as string | null },
}));
vi.mock("@/lib/api-session", () => ({
  useApiSession: () => apiSessionMock.current,
}));

import VisitWorkspacePage from "./VisitWorkspacePage";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/patients/:id/visits/:visitId" element={<VisitWorkspacePage />} />
        <Route path="*" element={<div>fallback</div>} />
      </Routes>
    </MemoryRouter>,
  );

function markAtlasReady() {
  fireEvent.load(document.querySelector('[data-part="atlas-image"]') as SVGImageElement);
}

const pointerEvent = (
  type: "pointerdown" | "pointermove" | "pointerup",
  init: MouseEventInit & { pointerId: number },
) => {
  const event = new MouseEvent(type, init);
  Object.defineProperty(event, "pointerId", { value: init.pointerId });
  return event;
};

describe("VisitWorkspacePage · Карта тела ↔ Imaging integration", () => {
  it("names the visit sections and makes hidden mobile tabs discoverable", () => {
    renderAt("/patients/p-004/visits/v-005?tab=intake");

    expect(screen.getByRole("tablist", { name: "Разделы визита" })).toBeInTheDocument();
    expect(screen.getByText("Ещё разделы справа → «Заключение» и «Отчёт»"))
      .toBeInTheDocument();
  });

  it("exposes the selected body projection and zoom as accessible state", () => {
    renderAt("/patients/p-004/visits/v-005?tab=bodymap");

    const projectionGroup = screen.getByRole("group", { name: "Проекция карты тела" });
    expect(within(projectionGroup).getByRole("button", { name: "Спереди" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(within(projectionGroup).getByRole("button", { name: "Сзади" }))
      .toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("status", { name: "Текущий масштаб карты тела" }))
      .toHaveTextContent("100%");
  });

  it("disables zoom and pan until a failed model has loaded successfully again", () => {
    renderAt("/patients/p-004/visits/v-005?tab=bodymap");
    markAtlasReady();

    const zoomIn = screen.getByRole("button", { name: "Увеличить карту тела" });
    for (let step = 0; step < 6; step += 1) fireEvent.click(zoomIn);
    const viewport = screen.getByTestId("body-map-viewport");
    const zoomSurface = screen.getByTestId("body-map-zoom-surface");
    Object.defineProperties(viewport, {
      scrollLeft: { configurable: true, value: 900, writable: true },
      scrollTop: { configurable: true, value: 500, writable: true },
    });
    expect(screen.getByRole("status", { name: "Текущий масштаб карты тела" }))
      .toHaveTextContent("800%");
    expect(zoomSurface).toHaveStyle({ width: "2560px" });
    expect(viewport).toHaveAttribute("tabindex", "0");

    const region = screen.getByTestId("region-front-left-palm");
    fireEvent(region, pointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      pointerId: 6,
      clientX: 300,
      clientY: 300,
    }));
    fireEvent(region, pointerEvent("pointermove", {
      bubbles: true,
      pointerId: 6,
      clientX: 180,
      clientY: 240,
    }));
    fireEvent(region, pointerEvent("pointerup", {
      bubbles: true,
      pointerId: 6,
      clientX: 180,
      clientY: 240,
    }));

    fireEvent.error(document.querySelector('[data-part="atlas-image"]') as SVGImageElement);

    expect(screen.getByRole("status", { name: "Текущий масштаб карты тела" }))
      .toHaveTextContent("100%");
    expect(zoomSurface).toHaveStyle({ width: "320px" });
    expect(viewport.scrollLeft).toBe(0);
    expect(viewport.scrollTop).toBe(0);
    expect(viewport).not.toHaveClass("cursor-grab");
    expect(screen.getByRole("button", { name: "Уменьшить карту тела" })).toBeDisabled();
    expect(zoomIn).toBeDisabled();
    expect(screen.getByRole("button", { name: "Сбросить масштаб" })).toBeDisabled();
    expect(viewport).toHaveAttribute("tabindex", "-1");
    expect(screen.queryByText(/Перетаскивайте увеличенную модель/)).not.toBeInTheDocument();

    const retry = screen.getByRole("button", { name: "Повторить" });
    fireEvent(retry, pointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      pointerId: 7,
      clientX: 40,
      clientY: 40,
    }));
    fireEvent.click(retry);
    expect(screen.getByRole("status", { name: "Состояние модели" }))
      .toHaveTextContent("Модель загружается…");
    expect(zoomIn).toBeDisabled();
    const retryImage = document.querySelector('[data-part="atlas-image"]') as SVGImageElement;
    fireEvent.load(retryImage);

    expect(zoomIn).toBeEnabled();
    expect(screen.getByRole("button", { name: "Сбросить масштаб" })).toBeEnabled();
    expect(viewport).toHaveAttribute("tabindex", "-1");
    expect(screen.queryByText(/Перетаскивайте увеличенную модель/)).not.toBeInTheDocument();

    fireEvent.click(zoomIn);
    expect(viewport).toHaveAttribute("tabindex", "0");
    expect(screen.getByText(/Перетаскивайте увеличенную модель/)).toBeInTheDocument();
  });

  it("pans repeatedly, suppresses pointer release placement, and preserves keyboard controls", async () => {
    const user = userEvent.setup();
    renderAt("/patients/p-004/visits/v-005?tab=bodymap");
    markAtlasReady();

    fireEvent.click(screen.getByRole("button", { name: "Увеличить карту тела" }));
    expect(screen.getByText(
      "Перетаскивайте увеличенную модель мышью или пальцем. Стрелки клавиатуры перемещают область просмотра.",
    )).toBeInTheDocument();

    const viewport = screen.getByTestId("body-map-viewport");
    const setPointerCapture = vi.fn();
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 400 },
      clientHeight: { configurable: true, value: 500 },
      scrollWidth: { configurable: true, value: 1000 },
      scrollHeight: { configurable: true, value: 1200 },
      scrollLeft: { configurable: true, value: 200, writable: true },
      scrollTop: { configurable: true, value: 300, writable: true },
      setPointerCapture: { configurable: true, value: setPointerCapture },
      hasPointerCapture: { configurable: true, value: vi.fn(() => true) },
      releasePointerCapture: { configurable: true, value: vi.fn() },
    });
    const region = screen.getByTestId("region-front-left-palm");
    const svg = screen.getByRole("img", { name: /Карта тела/ }) as unknown as SVGSVGElement;
    (svg as unknown as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 640, bottom: 1067, width: 640, height: 1067, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    fireEvent(region, pointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      pointerId: 7,
      clientX: 300,
      clientY: 300,
    }));
    fireEvent(region, pointerEvent("pointermove", {
      bubbles: true,
      pointerId: 7,
      clientX: 180,
      clientY: 240,
    }));
    vi.useFakeTimers();
    fireEvent(region, pointerEvent("pointerup", {
      bubbles: true,
      pointerId: 7,
      clientX: 180,
      clientY: 240,
    }));
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    fireEvent.click(region, { detail: 1, clientX: 180, clientY: 240 });

    expect(viewport.scrollLeft).toBe(320);
    expect(viewport.scrollTop).toBe(360);
    expect(setPointerCapture).toHaveBeenCalledWith(7);
    expect(screen.queryByRole("textbox", { name: "Метка очага" })).not.toBeInTheDocument();

    viewport.focus();
    fireEvent.keyDown(viewport, { key: "ArrowRight" });
    expect(viewport.scrollLeft).toBe(420);

    fireEvent(region, pointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      pointerId: 8,
      clientX: 180,
      clientY: 240,
    }));
    fireEvent(region, pointerEvent("pointermove", {
      bubbles: true,
      pointerId: 8,
      clientX: 500,
      clientY: 240,
    }));
    fireEvent(region, pointerEvent("pointerup", {
      bubbles: true,
      pointerId: 8,
      clientX: 500,
      clientY: 240,
    }));
    fireEvent.click(region, { detail: 1, clientX: 500, clientY: 240 });

    expect(viewport.scrollLeft).toBe(100);
    expect(screen.queryByRole("textbox", { name: "Метка очага" })).not.toBeInTheDocument();

    fireEvent(region, pointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      pointerId: 9,
      clientX: 180,
      clientY: 240,
    }));
    fireEvent(region, pointerEvent("pointerup", {
      bubbles: true,
      pointerId: 9,
      clientX: 180,
      clientY: 240,
    }));
    fireEvent.click(region, { detail: 1, clientX: 180, clientY: 240 });

    expect(screen.getByRole("textbox", { name: "Метка очага" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Ладонная поверхность левой кисти")).toBeInTheDocument();

    expect(screen.getByText("горизонталь 28% · вертикаль 22%")).toBeInTheDocument();
    fireEvent(region, pointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      pointerId: 10,
      clientX: 180,
      clientY: 240,
    }));
    fireEvent(region, pointerEvent("pointermove", {
      bubbles: true,
      pointerId: 10,
      clientX: 120,
      clientY: 240,
    }));
    fireEvent(region, pointerEvent("pointerup", {
      bubbles: true,
      pointerId: 10,
      clientX: 120,
      clientY: 240,
    }));

    const nudgeRight = screen.getByRole("button", { name: "Сдвинуть метку вправо" });
    nudgeRight.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByText("горизонталь 29% · вертикаль 22%")).toBeInTheDocument();

    fireEvent(region, pointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      pointerId: 12,
      clientX: 180,
      clientY: 240,
    }));
    fireEvent(region, pointerEvent("pointermove", {
      bubbles: true,
      pointerId: 12,
      clientX: 120,
      clientY: 240,
    }));
    fireEvent(region, pointerEvent("pointerup", {
      bubbles: true,
      pointerId: 12,
      clientX: 120,
      clientY: 240,
    }));

    const nudgeLeftAfterEnter = screen.getByRole("button", { name: "Сдвинуть метку влево" });
    nudgeLeftAfterEnter.focus();
    await user.keyboard("[Space]");

    expect(screen.getByText("горизонталь 28% · вертикаль 22%")).toBeInTheDocument();
  });

  it("selects registered lesions from the keyboard and exposes the current row", async () => {
    const user = userEvent.setup();
    renderAt("/patients/p-004/visits/v-005?tab=bodymap");

    const first = screen.getByRole("button", {
      name: "Выбрать очаг 1: Послеоперационная зона",
    });
    const second = screen.getByRole("button", { name: "Выбрать очаг 2: Очаг B" });
    expect(first).toHaveAttribute("aria-pressed", "true");

    second.focus();
    await user.keyboard("{Enter}");

    expect(second).toHaveAttribute("aria-pressed", "true");
    expect(first).toHaveAttribute("aria-pressed", "false");
  });

  it("shows the exact synthetic overview source for a captured lesion", () => {
    renderAt("/patients/p-001/visits/v-001?tab=bodymap&lesion=l-001");

    expect(screen.getByRole("heading", { name: "Источник положения" })).toBeInTheDocument();
    expect(screen.getByText("Снято полностью")).toBeInTheDocument();
    expect(screen.getByText("Подтверждено врачом")).toBeInTheDocument();
    expect(screen.getByText(/Синтетический обзорный снимок/)).toBeInTheDocument();
    expect(screen.getByTestId("source-photo-marker")).toHaveAttribute("data-x", "0.43");
    expect(screen.getByTestId("source-photo-marker")).toHaveAttribute("data-y", "0.31");
    expect(screen.getByTestId("source-photo-marker")).toHaveAttribute("role", "img");
  });

  it("opens the exact overview image selected from the body map", () => {
    renderAt("/patients/p-001/visits/v-001?tab=bodymap&lesion=l-001");

    fireEvent.click(screen.getByRole("button", { name: "Открыть исходный снимок" }));

    expect(screen.getByRole("tab", { name: /снимки/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("selected-image-preview")).toHaveAttribute("data-image-id", "i-001");
  });

  it("asks for clinician review when the overview covers the area only partially", () => {
    renderAt("/patients/p-005/visits/v-006?tab=bodymap&lesion=l-009");

    expect(screen.getByText("Снято частично")).toBeInTheDocument();
    expect(screen.getByText("Нужно подтверждение врача")).toBeInTheDocument();
    expect(screen.getByText(/нужен дополнительный ракурс с согласия пациента/i)).toBeInTheDocument();
  });

  it("does not infer absence when the anatomical area has no overview image", () => {
    renderAt("/patients/p-005/visits/v-006?tab=bodymap&lesion=l-010");

    expect(screen.getByText("Не снято")).toBeInTheDocument();
    expect(screen.getByText(/Это не означает отсутствие образования/)).toBeInTheDocument();
    expect(screen.queryByTestId("source-photo-marker")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Перейти к съёмке" })).toBeInTheDocument();
  });

  it("opens the imaging workflow for an area that needs an additional angle", () => {
    renderAt("/patients/p-005/visits/v-006?tab=bodymap&lesion=l-010");

    fireEvent.click(screen.getByRole("button", { name: "Перейти к съёмке" }));

    expect(screen.getByRole("tab", { name: /снимки/i })).toHaveAttribute("aria-selected", "true");
    const lesionFilter = (screen.getAllByRole("combobox") as HTMLSelectElement[]).find(
      (select) => select.value === "l-010",
    );
    expect(lesionFilter).toBeTruthy();
  });

  it("Карта тела selected lesion shows 'Связанные снимки' panel for l-008", () => {
    renderAt("/patients/p-004/visits/v-005?tab=bodymap&lesion=l-008");
    expect(screen.getByText(/Связанные снимки/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /К снимкам этого очага/ })).toBeInTheDocument();
  });
  it("clicking 'К снимкам этого очага' switches to Imaging tab with lesion preselected", () => {
    renderAt("/patients/p-004/visits/v-005?tab=bodymap&lesion=l-008");
    fireEvent.click(screen.getByRole("button", { name: /К снимкам этого очага/ }));
    expect(screen.getByText(/Захват/)).toBeInTheDocument();
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    const lesionSelect = selects.find((s) => s.value === "l-008");
    expect(lesionSelect).toBeTruthy();
  });
  it("Imaging tab shows 'Открыть на карте тела' for selected linked image and returns to Карта тела", () => {
    renderAt("/patients/p-004/visits/v-005?tab=imaging&lesion=l-008");
    const btn = screen.getByRole("button", { name: /Открыть на карте тела/ });
    fireEvent.click(btn);
    expect(screen.getByText(/Связанные снимки/)).toBeInTheDocument();
  });
  it("lesion list shows 'нет оценки' and 'нужен пересмотр' chips on v-005", () => {
    renderAt("/patients/p-004/visits/v-005?tab=bodymap");
    expect(screen.getAllByText(/нет оценки/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/нужен пересмотр/).length).toBeGreaterThan(0);
  });
  it("регрессия: round-trip Карта тела → Imaging → Карта тела сохраняет lesion и переключает таб", async () => {
    renderAt("/patients/p-004/visits/v-005?tab=bodymap&lesion=l-008");
    const bodymapTab = screen.getByRole("tab", { name: /карта тела/i });
    const imagingTab = screen.getByRole("tab", { name: /снимки/i });
    expect(bodymapTab.getAttribute("aria-selected")).toBe("true");
    expect(imagingTab.getAttribute("aria-selected")).toBe("false");
    expect(screen.getByText(/Связанные снимки/)).toBeInTheDocument();
    // Карта тела → Imaging: таб переключился, lesion предвыбран.
    fireEvent.click(screen.getByRole("button", { name: /К снимкам этого очага/ }));
    expect(imagingTab.getAttribute("aria-selected")).toBe("true");
    expect(bodymapTab.getAttribute("aria-selected")).toBe("false");
    const lesionSelect = (screen.getAllByRole("combobox") as HTMLSelectElement[]).find(
      (s) => s.value === "l-008",
    );
    expect(lesionSelect).toBeTruthy();
    // Imaging → Карта тела: возврат с тем же lesion.
    fireEvent.click(screen.getByRole("button", { name: /Открыть на карте тела/ }));
    expect(bodymapTab.getAttribute("aria-selected")).toBe("true");
    expect(imagingTab.getAttribute("aria-selected")).toBe("false");
    expect(screen.getByText(/Связанные снимки/)).toBeInTheDocument();
    const lesion = (await import("@/lib/mock-data"))
      .getLesionsByPatientId("p-004")
      .find((l) => l.id === "l-008")!;
    expect(screen.getAllByText(new RegExp(lesion.label)).length).toBeGreaterThan(0);
  });
});
