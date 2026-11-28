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
    expect(screen.getByRole("heading", { name: /Мультиканальный конфигуратор воронки общения/i })).toBeInTheDocument();
  });

  it("loads and saves multi-channel communication settings (Telegram, MAX, WhatsApp, Web)", async () => {
    mocks.listSettings.mockResolvedValue({
      ok: true,
      value: [settings("clinic-a", "Клиника А", "Приветствие А")],
      error: null,
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_input, init) => {
      if (init?.method === "PUT") {
        return new Response(
          JSON.stringify({
            item: {
              configKey: "default",
              channels: {
                telegram: { enabled: true, transport: "Вебхук", botHandle: "@skindoktor_pro_bot" },
                web: { enabled: true, transport: "Веб", route: "/check" },
                max: { enabled: true, transport: "МАХ", botHandle: "@skindoktor_max" },
                whatsapp: { enabled: false, transport: "Вотсап", instanceName: "" },
              },
              flowRules: {
                photoFirstMode: true,
                postPhotoLeadCaptureEnabled: true,
                photoWaitNudgeMinutes: 5,
                lowRiskFollowupDays: 30,
                mediumRiskSecondPhotoCheckEnabled: true,
                persistentMenuEnabled: true,
              },
              greetingVariants: ["Ура! Пришлите фото ~10 см."],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          item: {
            configKey: "default",
            channels: {
              telegram: { enabled: true, transport: "Вебхук", botHandle: "@skindoktor_pro_bot" },
              web: { enabled: true, transport: "Веб", route: "/check" },
              max: { enabled: false, transport: "МАХ", botHandle: "" },
              whatsapp: { enabled: false, transport: "Вотсап", instanceName: "" },
            },
            flowRules: {
              photoFirstMode: true,
              postPhotoLeadCaptureEnabled: true,
              photoWaitNudgeMinutes: 4,
              lowRiskFollowupDays: 30,
              mediumRiskSecondPhotoCheckEnabled: true,
              persistentMenuEnabled: true,
            },
            greetingVariants: ["Ура! Пришлите фото ~10 см."],
          },
          instructionVisualSvgDataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    renderPage();
    expect(await screen.findByLabelText(/Адрес помощника в Телеграм/i)).toHaveValue("@skindoktor_pro_bot");

    fireEvent.change(screen.getByLabelText(/Таймер мягкого напоминания/i), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /Сохранить мультиканальный сценарий/i }));

    expect(await screen.findByText(/Мультиканальный сценарий и таймеры успешно сохранены/i)).toBeInTheDocument();
    fetchSpy.mockRestore();
  });
});
