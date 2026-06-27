import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const adminApiMock = vi.hoisted(() => ({
  listAdminServiceKeys: vi.fn(),
  createAdminServiceKey: vi.fn(),
  rotateAdminServiceKey: vi.fn(),
  revokeAdminServiceKey: vi.fn(),
  adminApiErrorText: vi.fn((error: { message?: string } | null) => error?.message ?? "Действие не выполнено."),
  isAdminSessionExpiredError: vi.fn(() => false),
}));

vi.mock("@/lib/app-mode", () => ({
  isProductionAppMode: () => true,
}));

vi.mock("@/lib/self-hosted-api-session", () => ({
  clearSelfHostedApiSession: () => {},
  useSelfHostedApiSession: () => ({
    apiBaseUrl: "https://pro.skindoktor.ru",
    apiToken: "admin-token",
    status: "configured",
    user: {
      id: "system-admin-1",
      displayName: "Администратор Dermatolog Pro",
      roles: ["system_admin"],
    },
  }),
}));

vi.mock("@/lib/self-hosted-admin-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/self-hosted-admin-api")>();
  return {
    ...actual,
    adminApiErrorText: adminApiMock.adminApiErrorText,
    createAdminServiceKey: adminApiMock.createAdminServiceKey,
    isAdminSessionExpiredError: adminApiMock.isAdminSessionExpiredError,
    listAdminServiceKeys: adminApiMock.listAdminServiceKeys,
    revokeAdminServiceKey: adminApiMock.revokeAdminServiceKey,
    rotateAdminServiceKey: adminApiMock.rotateAdminServiceKey,
  };
});

import SysApiKeysPage from "./SysApiKeysPage";

const activeKey = {
  id: "10000000-0000-4000-8000-000000000401",
  label: "Проверочный мост РДС",
  owner: "Кабинет",
  masked: "dpk_abcd…wxyz",
  scopes: ["device:write"],
  status: "active" as const,
  lastUsedAt: null,
  expiresAt: "2026-07-27T00:00:00.000Z",
  rotatedAt: null,
  revokedAt: null,
  createdAt: "2026-06-27T00:00:00.000Z",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/sys/api-keys"]}>
      <SysApiKeysPage />
    </MemoryRouter>,
  );
}

describe("SysApiKeysPage production", () => {
  beforeEach(() => {
    adminApiMock.listAdminServiceKeys.mockReset();
    adminApiMock.createAdminServiceKey.mockReset();
    adminApiMock.rotateAdminServiceKey.mockReset();
    adminApiMock.revokeAdminServiceKey.mockReset();
    adminApiMock.adminApiErrorText.mockClear();
    adminApiMock.isAdminSessionExpiredError.mockClear();
  });

  it("creates, hides, rotates, and revokes a service key through the production UI", async () => {
    adminApiMock.listAdminServiceKeys
      .mockResolvedValueOnce({ ok: true, value: [], error: null })
      .mockResolvedValueOnce({ ok: true, value: [activeKey], error: null })
      .mockResolvedValueOnce({
        ok: true,
        value: [{ ...activeKey, masked: "dpk_efgh…lmno", rotatedAt: "2026-06-27T01:00:00.000Z" }],
        error: null,
      })
      .mockResolvedValueOnce({
        ok: true,
        value: [{ ...activeKey, status: "revoked", revokedAt: "2026-06-27T02:00:00.000Z" }],
        error: null,
      });
    adminApiMock.createAdminServiceKey.mockResolvedValue({
      ok: true,
      value: { ...activeKey, secretOnce: "dpk_created_once" },
      error: null,
    });
    adminApiMock.rotateAdminServiceKey.mockResolvedValue({
      ok: true,
      value: { ...activeKey, masked: "dpk_efgh…lmno", secretOnce: "dpk_rotated_once" },
      error: null,
    });
    adminApiMock.revokeAdminServiceKey.mockResolvedValue({
      ok: true,
      value: { ...activeKey, status: "revoked", revokedAt: "2026-06-27T02:00:00.000Z" },
      error: null,
    });

    const { container } = renderPage();

    expect(await screen.findByText("Служебных ключей пока нет. Создайте отдельный ключ для первого рабочего подключения.")).toBeInTheDocument();
    expect(screen.queryByText(/Учебный режим|учебная|учебное действие/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Название служебного ключа"), {
      target: { value: activeKey.label },
    });
    fireEvent.change(screen.getByLabelText("Владелец или назначение"), {
      target: { value: activeKey.owner },
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать ключ" }));

    await waitFor(() => expect(adminApiMock.createAdminServiceKey).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(`Ключ создан: ${activeKey.label}. Значение показано один раз.`)).toBeInTheDocument();
    expect(screen.getByText("dpk_created_once")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Скрыть ключ" }));
    expect(screen.queryByText("dpk_created_once")).not.toBeInTheDocument();
    expect(await screen.findByText(activeKey.label)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Обновить ключ" }));
    await waitFor(() => expect(adminApiMock.rotateAdminServiceKey).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(`Ключ обновлён: ${activeKey.label}. Новое значение показано один раз.`)).toBeInTheDocument();
    expect(screen.getByText("dpk_rotated_once")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Скрыть ключ" }));
    expect(screen.queryByText("dpk_rotated_once")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Отозвать ключ" }));
    await waitFor(() => expect(adminApiMock.revokeAdminServiceKey).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(`Ключ отозван: ${activeKey.label}.`)).toBeInTheDocument();
    expect(screen.getByText("Отозван")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Рабочий контур" })).toHaveClass("min-h-11");

    expect(adminApiMock.createAdminServiceKey).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          label: activeKey.label,
          owner: activeKey.owner,
          scopes: ["device:write"],
          expiresInDays: 90,
        }),
      }),
    );
    expect(container.innerHTML).not.toMatch(/storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i);
  });
});
