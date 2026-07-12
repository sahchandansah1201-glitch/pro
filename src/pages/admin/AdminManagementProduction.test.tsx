import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import AdminClinicsPage from "@/pages/admin/AdminClinicsPage";
import AdminDoctorsPage from "@/pages/admin/AdminDoctorsPage";
import AdminHomePage from "@/pages/admin/AdminHomePage";
import AdminServicesPage from "@/pages/admin/AdminServicesPage";
import SysAuditPage from "@/pages/sys/SysAuditPage";
import SysUsersPage from "@/pages/sys/SysUsersPage";

const sessionMock = vi.hoisted(() => ({
  roles: ["system_admin"] as string[],
}));

vi.mock("@/lib/app-mode", () => ({
  isProductionAppMode: () => true,
}));

vi.mock("@/lib/self-hosted-api-session", () => ({
  clearSelfHostedApiSession: () => {},
  isSelfHostedApiConfigured: (session: { status: string; apiToken: string | null }) =>
    session.status === "configured" && Boolean(session.apiToken),
  useSelfHostedApiSession: () => ({
    apiBaseUrl: "https://clinic.local",
    apiToken: "admin-token",
    status: "configured",
    user: {
      id: "system-admin-1",
      displayName: "Администратор Dermatolog Pro",
      roles: sessionMock.roles,
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
    sessionMock.roles = ["system_admin"];
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the clinic admin home from working admin APIs without training copy", async () => {
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const href = String(url);
      if (href.endsWith("/api/v1/admin/analytics")) {
        return json({
          item: {
            clinics: 1,
            activeUsers: 2,
            doctors: 1,
            patients: 0,
            visits: 0,
            photos: 0,
            signedReports: 0,
            auditEvents7d: 3,
            recentAuditEvents: [],
          },
        });
      }
      if (href.endsWith("/api/v1/admin/clinics")) {
        return json({ items: [clinic] });
      }
      if (href.endsWith("/api/v1/admin/doctors")) {
        return json({ items: [owner] });
      }
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRouted(<AdminHomePage />);

    expect(await screen.findByRole("heading", { name: "Операционный центр клиники" })).toBeInTheDocument();
    expect(await screen.findByText("Рабочий режим: показатели читаются из рабочей базы сервиса. Персональные строки, фото и медицинские выводы не выводятся.")).toBeInTheDocument();
    expect((await screen.findAllByText("Кабинет Морозова")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Морозов Дмитрий Игоревич")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Учебный режим|учебная оценка|Учебная система|демо|mock/i);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/admin/analytics",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer admin-token" }) }),
    );
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

  it("validates private practice owner fields before calling the backend", async () => {
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const href = String(url);
      if (href.endsWith("/api/v1/admin/clinics")) {
        return json({ items: [clinic] });
      }
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRouted(<AdminClinicsPage />);

    expect(await screen.findByRole("heading", { name: "Клиники и кабинеты" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Название кабинета"), { target: { value: "Кабинет Морозова" } });
    fireEvent.change(screen.getByLabelText("Адрес кабинета"), { target: { value: "Краснодар, ул. Северная, 11" } });
    fireEvent.click(screen.getByRole("button", { name: "Создать кабинет и владельца" }));

    expect(await screen.findByText(/Укажите имя владельца кабинета/)).toBeInTheDocument();
    expect(screen.getByText(/Укажите рабочую почту владельца/)).toBeInTheDocument();
    expect(screen.getByText(/Пароль должен быть не короче 10 символов/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "https://clinic.local/api/v1/admin/private-practices",
      expect.anything(),
    );
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

    fireEvent.click(screen.getAllByRole("button", { name: "Редактировать" })[0]);
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

  it("limits clinic_admin clinic screen to scoped clinic editing without system-only actions", async () => {
    sessionMock.roles = ["clinic_admin"];
    const updatedClinic = {
      ...clinic,
      address: "Краснодар, обновлённый адрес",
      updatedAt: "2026-06-23T00:01:00.000Z",
    };
    let clinicItems = [clinic];
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/v1/admin/clinics/clinic-1") && init?.method === "PATCH") {
        clinicItems = [updatedClinic];
        return json({ item: updatedClinic });
      }
      if (href.endsWith("/api/v1/admin/clinics")) return json({ items: clinicItems });
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRouted(<AdminClinicsPage />);

    expect(await screen.findByRole("heading", { name: "Клиники и кабинеты" })).toBeInTheDocument();
    expect(screen.getByText("Доступ администратора клиники")).toBeInTheDocument();
    expect(screen.queryByLabelText("Название клиники")).not.toBeInTheDocument();
    expect(screen.queryByText("Создать частный кабинет")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Приостановить" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "В архив" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Удалить пустую запись" })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Редактировать" })[0]);
    fireEvent.change(screen.getByLabelText("Адрес редактируемой клиники"), {
      target: { value: "Краснодар, обновлённый адрес" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить изменения" }));

    expect(await screen.findByText("Изменения сохранены: Кабинет Морозова")).toBeInTheDocument();
    expect(screen.getByText("адрес: Краснодар, обновлённый адрес")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/admin/clinics/clinic-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Кабинет Морозова",
          address: "Краснодар, обновлённый адрес",
          timezone: "Europe/Moscow",
        }),
      }),
    );
  });

  it("clinic_admin creates and edits a service through the working catalog", async () => {
    sessionMock.roles = ["clinic_admin"];
    const createdService = {
      id: "service-1",
      clinicId: "clinic-1",
      clinicName: "Кабинет Морозова",
      name: "Дерматоскопия",
      category: "imaging",
      durationMin: 25,
      priceMin: 2500,
      priceMax: 3500,
      consentNote: "Согласие на съёмку",
      onlineBooking: true,
      active: true,
      createdAt: "2026-07-08T00:00:00.000Z",
      updatedAt: "2026-07-08T00:00:00.000Z",
    };
    const updatedService = {
      ...createdService,
      name: "Дерматоскопия контрольная",
      durationMin: 35,
      priceMin: 3000,
      priceMax: 4000,
      consentNote: "Согласие на съёмку обновлено",
      updatedAt: "2026-07-08T00:01:00.000Z",
    };
    let services = [] as (typeof createdService)[];
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/v1/admin/services") && init?.method === "POST") {
        services = [createdService];
        return json({ item: createdService }, 201);
      }
      if (href.endsWith("/api/v1/admin/services/service-1") && init?.method === "PATCH") {
        services = [updatedService];
        return json({ item: updatedService });
      }
      if (href.endsWith("/api/v1/admin/services")) return json({ items: services });
      if (href.endsWith("/api/v1/admin/clinics")) return json({ items: [clinic] });
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRouted(<AdminServicesPage />);

    expect(await screen.findByRole("heading", { name: "Услуги и тарифы" })).toBeInTheDocument();
    expect(screen.getByText(/Рабочий режим: услуги сохраняются в базе клиники/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Название услуги"), { target: { value: "Дерматоскопия" } });
    fireEvent.change(screen.getByLabelText("Клиника услуги"), { target: { value: "clinic-1" } });
    fireEvent.change(screen.getByLabelText("Категория услуги"), { target: { value: "imaging" } });
    fireEvent.change(screen.getByLabelText("Длительность услуги"), { target: { value: "25" } });
    fireEvent.change(screen.getByLabelText("Минимальная цена"), { target: { value: "2500" } });
    fireEvent.change(screen.getByLabelText("Максимальная цена"), { target: { value: "3500" } });
    fireEvent.change(screen.getByLabelText("Согласие для услуги"), { target: { value: "Согласие на съёмку" } });
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Создать услугу" }));

    expect(await screen.findByText("Услуга создана: Дерматоскопия")).toBeInTheDocument();
    expect(screen.getAllByText("Согласие на съёмку").length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/admin/services",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          clinicId: "clinic-1",
          name: "Дерматоскопия",
          category: "imaging",
          durationMin: 25,
          priceMin: 2500,
          priceMax: 3500,
          consentNote: "Согласие на съёмку",
          onlineBooking: true,
          active: true,
        }),
      }),
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Редактировать" })[0]);
    fireEvent.change(screen.getByLabelText("Название редактируемой услуги"), {
      target: { value: "Дерматоскопия контрольная" },
    });
    fireEvent.change(screen.getByLabelText("Длительность редактируемой услуги"), { target: { value: "35" } });
    fireEvent.change(screen.getByLabelText("Минимальная цена редактируемой услуги"), { target: { value: "3000" } });
    fireEvent.change(screen.getByLabelText("Максимальная цена редактируемой услуги"), { target: { value: "4000" } });
    fireEvent.change(screen.getByLabelText("Согласие редактируемой услуги"), {
      target: { value: "Согласие на съёмку обновлено" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить услугу" }));

    expect(await screen.findByText("Услуга обновлена: Дерматоскопия контрольная")).toBeInTheDocument();
    expect(screen.getAllByText("Согласие на съёмку обновлено").length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/admin/services/service-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          clinicId: "clinic-1",
          name: "Дерматоскопия контрольная",
          category: "imaging",
          durationMin: 35,
          priceMin: 3000,
          priceMax: 4000,
          consentNote: "Согласие на съёмку обновлено",
          onlineBooking: true,
          active: true,
        }),
      }),
    );
    expect(document.body).not.toHaveTextContent(/Учебный режим|демо|mock/i);
  });

  it("suspends, reactivates, archives, and deletes an empty clinic through visible controls", async () => {
    const activeClinic = { ...clinic, status: "active", statusReason: null, statusChangedAt: null, usersCount: 0, patientsCount: 0, visitsCount: 0 };
    const suspendedClinic = { ...activeClinic, status: "suspended" };
    const archivedClinic = { ...activeClinic, status: "archived" };
    let clinicItems = [activeClinic];
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/v1/admin/clinics/clinic-1/status") && init?.method === "PATCH") {
        const body = JSON.parse(String(init.body));
        const next = body.status === "suspended" ? suspendedClinic : body.status === "archived" ? archivedClinic : activeClinic;
        clinicItems = [next];
        return json({ item: next });
      }
      if (href.endsWith("/api/v1/admin/clinics/clinic-1") && init?.method === "DELETE") {
        clinicItems = [];
        return json({ item: { id: "clinic-1", deleted: true, blockerCount: 0, blockers: {} } });
      }
      if (href.endsWith("/api/v1/admin/clinics")) return json({ items: clinicItems });
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRouted(<AdminClinicsPage />);

    expect(await screen.findByRole("heading", { name: "Клиники и кабинеты" })).toBeInTheDocument();
    expect(await screen.findByText("Работает")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Приостановить" }));
    expect(await screen.findByText("Статус обновлён: Кабинет Морозова · Приостановлена")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/admin/clinics/clinic-1/status",
      expect.objectContaining({ method: "PATCH", body: expect.stringContaining('"status":"suspended"') }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Вернуть в работу" }));
    expect(await screen.findByText("Статус обновлён: Кабинет Морозова · Работает")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "В архив" }));
    expect(await screen.findByText("Статус обновлён: Кабинет Морозова · Архив")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Удалить пустую запись" }));
    expect(await screen.findByText(/Подтвердите удаление пустой записи/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить удаление" }));
    expect(await screen.findByText("Пустая запись удалена: Кабинет Морозова")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/admin/clinics/clinic-1",
      expect.objectContaining({ method: "DELETE" }),
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

  it("reactivates employees and disables one role without removing the account", async () => {
    const disabledOwner = { ...owner, active: false, disabledAt: "2026-06-25T00:00:00.000Z" };
    const rolePausedOwner = {
      ...owner,
      roles: owner.roles.map((role) => (role.role === "private_doctor" ? { ...role, active: false, disabledAt: "2026-06-25T00:00:00.000Z" } : role)),
    };
    let users = [disabledOwner];
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/v1/admin/users/user-1/reactivate") && init?.method === "PATCH") {
        users = [owner];
        return json({ item: owner });
      }
      if (href.endsWith("/api/v1/admin/users/user-1/role-status") && init?.method === "PATCH") {
        users = [rolePausedOwner];
        return json({ item: { userId: "user-1", role: "private_doctor", clinicId: "clinic-1", status: "disabled" } });
      }
      if (href.includes("/api/v1/admin/users")) return json({ items: users });
      if (href.includes("/api/v1/admin/clinics")) return json({ items: [clinic] });
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRouted(<SysUsersPage />);

    expect(await screen.findByRole("heading", { name: "Сотрудники и доступ" })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Вернуть доступ" }));
    expect(await screen.findByText("Доступ возвращён: Морозов Дмитрий Игоревич")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Отключить роль · Частный врач/ }));
    expect(await screen.findByText("Роль отключена: Частный врач · Морозов Дмитрий Игоревич")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/admin/users/user-1/role-status",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining('"status":"disabled"'),
      }),
    );
  });

  it("creates a second system administrator with visible progress and success feedback", async () => {
    const createdAdmin = {
      id: "user-admin-2",
      email: "admin2@skindoktor.ru",
      displayName: "Админ 2",
      active: true,
      createdAt: "2026-06-25T00:00:00.000Z",
      disabledAt: null,
      roles: [{ role: "system_admin", clinicId: null, clinicName: null, clinicSlug: null }],
    };
    let users = [] as (typeof createdAdmin)[];
    let resolveCreateUser: ((value: Response) => void) | null = null;
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/v1/admin/users") && init?.method === "POST") {
        return new Promise<Response>((resolve) => {
          resolveCreateUser = (value) => {
            users = [createdAdmin];
            resolve(value);
          };
        });
      }
      if (href.includes("/api/v1/admin/users")) return json({ items: users });
      if (href.includes("/api/v1/admin/clinics")) return json({ items: [clinic] });
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRouted(<SysUsersPage />);

    expect(await screen.findByRole("heading", { name: "Сотрудники и доступ" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("ФИО сотрудника"), { target: { value: "Админ 2" } });
    fireEvent.change(screen.getByLabelText("Эл. почта"), { target: { value: "admin2@skindoktor.ru" } });
    fireEvent.change(screen.getByLabelText("Временный пароль"), { target: { value: "Admin2-password-2026!" } });
    fireEvent.change(screen.getByLabelText("Роль"), { target: { value: "system_admin" } });
    expect(screen.getByLabelText("Клиника")).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Создать сотрудника" }));

    expect(await screen.findByText("Создаём сотрудника: Админ 2")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Создаём сотрудника..." })).toBeDisabled();
    expect(resolveCreateUser).toBeTypeOf("function");
    resolveCreateUser?.(
      new Response(JSON.stringify({ item: createdAdmin }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://clinic.local/api/v1/admin/users",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            displayName: "Админ 2",
            email: "admin2@skindoktor.ru",
            password: "Admin2-password-2026!",
            role: "system_admin",
            clinicId: null,
          }),
        }),
      );
    });
    expect(await screen.findByText("Учётная запись создана: Админ 2")).toBeInTheDocument();
    expect(screen.getByText("admin2@skindoktor.ru")).toBeInTheDocument();
    expect(screen.getAllByText("Системный администратор").length).toBeGreaterThan(0);
  });

  it("shows explicit validation instead of doing nothing when required employee fields are empty", async () => {
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/api/v1/admin/users")) return json({ items: [] });
      if (href.includes("/api/v1/admin/clinics")) return json({ items: [clinic] });
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRouted(<SysUsersPage />);

    expect(await screen.findByRole("heading", { name: "Сотрудники и доступ" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Создать сотрудника" }));

    expect(await screen.findByText("Укажите ФИО, почту и временный пароль.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "https://clinic.local/api/v1/admin/users",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("validates employee email before creating an account", async () => {
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/api/v1/admin/users")) return json({ items: [] });
      if (href.includes("/api/v1/admin/clinics")) return json({ items: [clinic] });
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRouted(<SysUsersPage />);

    expect(await screen.findByRole("heading", { name: "Сотрудники и доступ" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("ФИО сотрудника"), { target: { value: "Сотрудник" } });
    fireEvent.change(screen.getByLabelText("Эл. почта"), { target: { value: "wrong-email" } });
    fireEvent.change(screen.getByLabelText("Временный пароль"), { target: { value: "Admin2-password-2026!" } });
    fireEvent.click(screen.getByRole("button", { name: "Создать сотрудника" }));

    expect(await screen.findByText("Укажите рабочую почту сотрудника.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "https://clinic.local/api/v1/admin/users",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows a short-password error inside the create form and focuses the password field", async () => {
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/api/v1/admin/users")) return json({ items: [] });
      if (href.includes("/api/v1/admin/clinics")) return json({ items: [clinic] });
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRouted(<SysUsersPage />);

    expect(await screen.findByRole("heading", { name: "Сотрудники и доступ" })).toBeInTheDocument();
    const createRegion = screen.getByRole("region", { name: "Создание сотрудника" });
    fireEvent.change(within(createRegion).getByLabelText("ФИО сотрудника"), { target: { value: "Максименко Мария" } });
    fireEvent.change(within(createRegion).getByLabelText("Эл. почта"), { target: { value: "marysik100@yandex.ru" } });
    fireEvent.change(within(createRegion).getByLabelText("Временный пароль"), { target: { value: "123456789" } });
    fireEvent.click(within(createRegion).getByRole("button", { name: "Создать сотрудника" }));

    expect(await within(createRegion).findByRole("alert")).toHaveTextContent(
      "Временный пароль должен быть не короче 10 символов.",
    );
    expect(within(createRegion).getByLabelText("Временный пароль")).toHaveAttribute("aria-invalid", "true");
    expect(within(createRegion).getByLabelText("Временный пароль")).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "https://clinic.local/api/v1/admin/users",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows an API creation error inside the create form", async () => {
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/v1/admin/users") && init?.method === "POST") {
        return json({ error: { code: "duplicate_email", message: "Сотрудник с этой почтой уже существует." } }, 409);
      }
      if (href.includes("/api/v1/admin/users")) return json({ items: [] });
      if (href.includes("/api/v1/admin/clinics")) return json({ items: [clinic] });
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRouted(<SysUsersPage />);

    expect(await screen.findByRole("heading", { name: "Сотрудники и доступ" })).toBeInTheDocument();
    const createRegion = screen.getByRole("region", { name: "Создание сотрудника" });
    fireEvent.change(within(createRegion).getByLabelText("ФИО сотрудника"), { target: { value: "Максименко Мария" } });
    fireEvent.change(within(createRegion).getByLabelText("Эл. почта"), { target: { value: "marysik100@yandex.ru" } });
    fireEvent.change(within(createRegion).getByLabelText("Временный пароль"), {
      target: { value: "Temporary-2026!" },
    });
    fireEvent.click(within(createRegion).getByRole("button", { name: "Создать сотрудника" }));

    expect(await within(createRegion).findByRole("alert")).toHaveTextContent(
      "Сотрудник с этой почтой уже существует.",
    );
    fireEvent.change(within(createRegion).getByLabelText("Эл. почта"), {
      target: { value: "another@yandex.ru" },
    });
    expect(within(createRegion).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("requires a clinic before assigning a non-global role", async () => {
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/api/v1/admin/users")) return json({ items: [owner] });
      if (href.includes("/api/v1/admin/clinics")) return json({ items: [] });
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRouted(<SysUsersPage />);

    expect(await screen.findByRole("heading", { name: "Сотрудники и доступ" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Добавить роль" }));

    expect(await screen.findByText("Выберите клинику для этой роли.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "https://clinic.local/api/v1/admin/users/user-1/role",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("blocks employee actions after an expired session and offers re-login", async () => {
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/api/v1/admin/users")) {
        return json({ error: { code: "invalid_token", message: "Invalid or expired authorization token." } }, 401);
      }
      if (href.includes("/api/v1/admin/clinics")) return json({ items: [clinic] });
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRouted(<SysUsersPage />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Сессия истекла");
    expect(screen.getByRole("button", { name: "Войти заново" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Создать сотрудника" })).toBeDisabled();
  });

  it("validates doctor email before creating a doctor account", async () => {
    const fetchMock = vi.fn((url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("/api/v1/admin/doctors")) return json({ items: [] });
      if (href.includes("/api/v1/admin/clinics")) return json({ items: [clinic] });
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRouted(<AdminDoctorsPage />);

    expect(await screen.findByRole("heading", { level: 1, name: "Врачи" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("ФИО врача"), { target: { value: "Врач" } });
    fireEvent.change(screen.getByLabelText("Эл. почта"), { target: { value: "wrong-email" } });
    fireEvent.change(screen.getByLabelText("Временный пароль"), { target: { value: "Doctor-password-2026!" } });
    fireEvent.click(screen.getByRole("button", { name: "Добавить врача" }));

    expect(await screen.findByText("Укажите рабочую почту врача.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "https://clinic.local/api/v1/admin/doctors",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("renders production audit from the server, supports search, integrity check, and export", async () => {
    const createObjectUrl = vi.fn(() => "blob:admin-audit");
    const revokeObjectUrl = vi.fn();
    const clickSpy = vi.fn();
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const originalCreateElement = document.createElement.bind(document);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl,
    });
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName.toLowerCase() === "a") {
        Object.defineProperty(element, "click", { value: clickSpy });
      }
      return element;
    });

    const fetchMock = vi.fn((url: string | URL | Request) => {
      const href = String(url);
      if (href.endsWith("/api/v1/admin/audit-events")) {
        return json({
          items: [
            {
              id: "audit-1",
              action: "admin.clinic.create",
              entityType: "clinic",
              actorName: "Админ 2",
              clinicName: "Яблоко ООО",
              createdAt: "2026-06-27T08:00:00.000Z",
              storagePath: "hidden",
            },
            {
              id: "audit-2",
              action: "admin.user.role.assign",
              entityType: "admin_user",
              actorName: "Админ 2",
              clinicName: null,
              createdAt: "2026-06-27T08:05:00.000Z",
            },
            {
              id: "audit-3",
              action: "clinic_booking_request.update",
              entityType: "patient_portal_booking_request",
              actorName: "Ольга Оператор",
              clinicName: "Яблоко ООО",
              createdAt: "2026-06-27T08:10:00.000Z",
            },
          ],
        });
      }
      return json({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRouted(<SysAuditPage />);

    expect(await screen.findByRole("heading", { name: "Аудит" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/admin/audit-events",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer admin-token",
        }),
      }),
    );
    expect(screen.getByText(/Рабочий режим: журнал читается из базы сервера/)).toBeInTheDocument();
    expect(screen.queryByText(/Учебный режим|Экспорт отключён|backend|self-hosted|payload|storagePath/i)).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Клиники" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Сотрудники" })).toBeInTheDocument();
    expect(screen.getAllByText("Клиника создана").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Роль назначена").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Заметка обращения сохранена").length).toBeGreaterThan(0);
    expect(screen.getAllByText("обращения на запись").length).toBeGreaterThan(0);
    expect(screen.queryByText("hidden")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Поиск аудита"), { target: { value: "нет совпадений" } });
    expect(await screen.findByText("События не найдены. Измените фильтр или обновите журнал.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Поиск аудита"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Проверить целостность" }));
    expect(await screen.findByText(/Целостность: записей 3/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Скачать журнал" }));
    expect(clickSpy).toHaveBeenCalled();
    expect(createObjectUrl).toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:admin-audit");
    expect(appendSpy).toHaveBeenCalled();
  });
});
