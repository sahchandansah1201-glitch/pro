import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminBotSettingsPage from "./AdminBotSettingsPage";

const mocks = vi.hoisted(() => ({
  listSettings: vi.fn(),
  dryRunSettings: vi.fn(),
  updateSettings: vi.fn(),
}));

vi.mock("@/lib/app-mode", () => ({
  isProductionAppMode: () => true,
}));

vi.mock("@/lib/self-hosted-api-session", () => ({
  useSelfHostedApiSession: () => ({
    apiBaseUrl: "https://clinic.local",
    apiToken: "admin-token",
    status: "configured",
    revision: 0,
    user: null,
  }),
}));

vi.mock("@/lib/self-hosted-admin-api", () => ({
  adminApiErrorText: () => "Не удалось загрузить настройки.",
  listAdminClinicBotSettings: mocks.listSettings,
  dryRunAdminClinicBotSettings: mocks.dryRunSettings,
  updateAdminClinicBotSettings: mocks.updateSettings,
}));

function settings(clinicId: string, clinicName: string, greeting: string) {
  return {
    id: `settings-${clinicId}`,
    clinicId,
    clinicName,
    enabled: true,
    intakeSteps: {},
    templates: { greeting },
    lastDryRunAt: null,
    updatedAt: null,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminBotSettingsPage />
    </MemoryRouter>,
  );
}

describe("AdminBotSettingsPage · live settings synchronization", () => {
  beforeEach(() => {
    mocks.listSettings.mockReset();
    mocks.dryRunSettings.mockReset();
    mocks.updateSettings.mockReset();
  });

  it("keeps the selected clinic form synchronized after refreshing the same clinic id", async () => {
    mocks.listSettings
      .mockResolvedValueOnce({
        ok: true,
        value: [
          settings("clinic-a", "Клиника А", "Приветствие А"),
          settings("clinic-b", "Клиника Б", "Приветствие Б"),
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        ok: true,
        value: [
          settings("clinic-a", "Клиника А", "Обновлённое приветствие А"),
          settings("clinic-b", "Клиника Б", "Обновлённое приветствие Б"),
        ],
        error: null,
      });
    mocks.dryRunSettings.mockResolvedValue({
      ok: true,
      value: settings("clinic-b", "Клиника Б", "Приветствие Б"),
      error: null,
    });

    renderPage();
    await screen.findByDisplayValue("Приветствие А");

    fireEvent.change(screen.getByLabelText("Клиника помощника записи"), {
      target: { value: "clinic-b" },
    });
    expect(await screen.findByDisplayValue("Приветствие Б")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Проверить сценарий" }));

    await waitFor(() => expect(mocks.listSettings).toHaveBeenCalledTimes(2));
    expect(await screen.findByDisplayValue("Обновлённое приветствие Б")).toBeInTheDocument();
  });
});
