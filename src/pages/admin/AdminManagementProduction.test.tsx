import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import AdminClinicsPage from "@/pages/admin/AdminClinicsPage";
import SysUsersPage from "@/pages/sys/SysUsersPage";

vi.mock("@/lib/app-mode", () => ({
  isProductionAppMode: () => true,
}));

vi.mock("@/lib/self-hosted-api-session", () => ({
  isSelfHostedApiConfigured: (session: { status: string; apiToken: string | null }) =>
    session.status === "configured" && Boolean(session.apiToken),
  useSelfHostedApiSession: () => ({
    apiBaseUrl: "https://clinic.local",
    apiToken: "admin-token",
    status: "configured",
    user: {
      id: "system-admin-1",
      displayName: "Администратор Dermatolog Pro",
      roles: ["system_admin"],
    },
  }),
}));

const clinic = {
  id: "clinic-1",
  name: "Кабинет Морозова",
  address: "Краснодар, ул. Северная, 11",
  slug: "morozov",
  timezone: "Europe/Moscow",
  createdAt: "2026-06-22T00:00:00.000Z",
  usersCount: 2,
  patientsCount: 0,
  visitsCount: 0,
};

const owner = {
  id: "user-1",
  email: "owner@example.test",
  displayName: "Морозов Дмитрий Игоревич",
  active: true,
  createdAt: "2026-06-22T00:00:00.000Z",
  disabledAt: null,
  roles: [
    { role: "clinic_admin", clinicId: "clinic-1", clinicName: "Кабинет Морозова", clinicSlug: "morozov" },
    { role: "private_doctor", clinicId: "clinic-1", clinicName: "Кабинет Морозова", clinicSlug: "morozov" },
  ],
};

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

function renderRouted(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("Production admin management UI", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates a private practice from the clinics-first screen", async () => {
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/v1/admin/clinics") && !init?.method) {
        return json({ items: [clinic] });
      }
      if (href.endsWith("/api/v1/admin/private-practices") && init?.method === "POST") {
        return json({ item: { clinic, owner } }, 201);
      }
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRouted(<AdminClinicsPage />);

    expect(await screen.findByRole("heading", { name: "Клиники и кабинеты" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Название кабинета"), { target: { value: "Кабинет Морозова" } });
    fireEvent.change(screen.getByLabelText("Адрес кабинета"), { target: { value: "Краснодар, ул. Северная, 11" } });
    fireEvent.change(screen.getByLabelText("ФИО владельца кабинета"), { target: { value: "Морозов Дмитрий Игоревич" } });
    fireEvent.change(screen.getByLabelText("Эл. почта владельца кабинета"), { target: { value: "owner@example.test" } });
    fireEvent.change(screen.getByLabelText("Временный пароль владельца кабинета"), { target: { value: "long-password-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Создать кабинет и владельца" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://clinic.local/api/v1/admin/private-practices",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            clinicName: "Кабинет Морозова",
            address: "Краснодар, ул. Северная, 11",
            timezone: "Europe/Moscow",
            ownerDisplayName: "Морозов Дмитрий Игоревич",
            ownerEmail: "owner@example.test",
            ownerPassword: "long-password-1",
          }),
        }),
      );
    });
    expect(await screen.findByText(/Владелец получил доступ администратора и частного врача/)).toBeInTheDocument();
  });

  it("creates a clinic with a human address, shows it in the list, and edits the saved clinic", async () => {
    const createdClinic = {
      id: "clinic-2",
      name: "Яблоко ООО",
      address: "70-я октября, Краснодар",
      slug: "yabloko-ooo",
      timezone: "Europe/Moscow",
      createdAt: "2026-06-23T00:00:00.000Z",
      usersCount: 0,
      patientsCount: 0,
      visitsCount: 0,
    };
    const updatedClinic = {
      ...createdClinic,
      address: "ул. Северная, 11, Краснодар",
      updatedAt: "2026-06-23T00:01:00.000Z",
    };
    let clinicItems = [] as (typeof createdClinic)[];
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/v1/admin/clinics") && init?.method === "POST") {
        clinicItems = [createdClinic];
        return json({ item: createdClinic }, 201);
      }
      if (href.endsWith("/api/v1/admin/clinics/clinic-2") && init?.method === "PATCH") {
        clinicItems = [updatedClinic];
        return json({ item: updatedClinic }, 200);
      }
      if (href.endsWith("/api/v1/admin/clinics")) {
        return json({ items: clinicItems });
      }
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRouted(<AdminClinicsPage />);

    expect(await screen.findByRole("heading", { name: "Клиники и кабинеты" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Название клиники"), { target: { value: "Яблоко ООО" } });
    fireEvent.change(screen.getByLabelText("Адрес клиники"), { target: { value: "70-я октября, Краснодар" } });
    fireEvent.click(screen.getByRole("button", { name: "Создать клинику" }));

    expect(await screen.findByText("Клиника сохранена и добавлена в список: Яблоко ООО")).toBeInTheDocument();
    expect(screen.getByText("адрес: 70-я октября, Краснодар")).toBeInTheDocument();
    expect(screen.queryByText(/Короткий адрес клиники должен содержать/)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/admin/clinics",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Яблоко ООО",
          address: "70-я октября, Краснодар",
          timezone: "Europe/Moscow",
        }),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Редактировать" }));
    fireEvent.change(screen.getByLabelText("Адрес редактируемой клиники"), {
      target: { value: "ул. Северная, 11, Краснодар" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить изменения" }));

    expect(await screen.findByText("Изменения сохранены: Яблоко ООО")).toBeInTheDocument();
    expect(screen.getByText("адрес: ул. Северная, 11, Краснодар")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/admin/clinics/clinic-2",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Яблоко ООО",
          address: "ул. Северная, 11, Краснодар",
          timezone: "Europe/Moscow",
        }),
      }),
    );
  });

  it("shows one employee with all assigned roles and clinics", async () => {
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/api/v1/admin/users")) return json({ items: [owner] });
      if (href.includes("/api/v1/admin/clinics")) return json({ items: [clinic] });
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRouted(<SysUsersPage />);

    expect(await screen.findByRole("heading", { name: "Сотрудники и доступ" })).toBeInTheDocument();
    expect((await screen.findAllByText("Морозов Дмитрий Игоревич")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Администратор клиники").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Частный врач").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Кабинет Морозова").length).toBeGreaterThan(0);
    expect(screen.getByText(/один человек может иметь несколько ролей/i)).toBeInTheDocument();
  });
});
