import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RoleProvider } from "@/context/RoleContext";
import CockpitPage from "@/pages/doctor/CockpitPage";

function renderCockpit() {
  return render(
    <RoleProvider>
      <CockpitPage />
    </RoleProvider>,
  );
}

describe("CockpitPage", () => {
  it("uses compact report status copy that fits the right status rail", () => {
    renderCockpit();

    expect(screen.getAllByText(/Заблокирован: анамнез/).length).toBeGreaterThan(0);
  });

  it("shows the not-comparable photo quality state required by Batch A+", () => {
    renderCockpit();

    expect(screen.getAllByText(/Не сопоставимо/).length).toBeGreaterThan(0);
  });

  it("keeps device status as a compact top indicator instead of a right-rail device card", () => {
    renderCockpit();

    expect(screen.getByText(/Телефон: подключён/)).toBeInTheDocument();
    expect(screen.getByText(/Дерматоскоп: внимание/)).toBeInTheDocument();
    expect(screen.queryByText("Устройства")).not.toBeInTheDocument();
  });

  it("shows a compact lesion and localization summary without the full body map editor", () => {
    renderCockpit();

    expect(screen.getByText("Очаги и локализация")).toBeInTheDocument();
    expect(screen.getByText(/2 очага/)).toBeInTheDocument();
    expect(screen.getAllByText(/Очаг #1/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Body Map · следующий этап/)).toBeInTheDocument();
    expect(screen.queryByText(/Редактор карты тела/)).not.toBeInTheDocument();
  });
});
