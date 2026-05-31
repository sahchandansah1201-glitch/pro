import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MeHomePage from "./MeHomePage";
import MeHistoryPage from "./MeHistoryPage";
import MeReportPage from "./MeReportPage";
import MeReportsPage from "./MeReportsPage";
import MeBookingPage from "./MeBookingPage";
import MeRemindersPage from "./MeRemindersPage";

vi.mock("@/lib/app-mode", () => ({
  isProductionAppMode: () => true,
}));

vi.mock("@/lib/self-hosted-api-session", () => ({
  useSelfHostedApiSession: () => ({
    apiBaseUrl: "https://clinic.local",
    apiToken: "patient-token",
    status: "configured",
    user: { id: "patient-user", displayName: "Пациент", roles: ["patient"] },
  }),
}));

const portal = {
  portal: {
    patient: {
      id: "patient-live-1",
      code: "DP-LIVE",
      fullName: "Пациент Production",
      clinic: { id: "clinic-1", name: "Live Clinic" },
    },
    nextAppointment: {
      id: "visit-live-1",
      visitId: "visit-live-1",
      status: "planned",
      startedAt: "2026-06-01T10:00:00.000Z",
      clinic: { id: "clinic-1", name: "Live Clinic" },
    },
    reports: [{
      id: "report-live-1",
      visitId: "visit-live-1",
      status: "signed",
      visitDate: "2026-05-20T10:00:00.000Z",
      signedAt: "2026-05-20T11:00:00.000Z",
      summary: "Пациентское заключение",
      patientSafeText: "Текст для пациента без врачебных внутренних данных.",
      physicianText: "Скрытый врачебный текст",
      clinic: { id: "clinic-1", name: "Live Clinic" },
      doctor: { id: "doctor-1", displayName: "Доктор" },
    }],
    reminders: [{ id: "rem-1", source: "appointment", title: "Ближайший приём", dueAt: "2026-06-01T10:00:00.000Z" }],
    reminderPreferences: {
      appointmentRemindersEnabled: true,
      reportNotificationsEnabled: true,
      preferredChannel: "email",
    },
    bookingRequests: [{
      id: "booking-live-1",
      status: "requested",
      preferredFrom: "2026-06-15T10:00:00.000Z",
      reason: "Плановый контроль",
      clinic: { id: "clinic-1", name: "Live Clinic" },
    }],
  },
};

function response(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  }));
}

function mockFetch(options: { revokedPhotoProtocol?: boolean } = {}) {
  const revokedPhotoProtocol = Boolean(options.revokedPhotoProtocol);
  const fetchMock = vi.fn((url: string | URL | Request) => {
    const href = String(url);
    if (href.endsWith("/api/v1/me/portal")) return response(portal);
    if (href.endsWith("/api/v1/me/reports/report-live-1")) {
      return response({
        item: {
          ...portal.portal.reports[0],
          physicianText: "Скрытый врачебный текст",
        },
      });
    }
    if (href.endsWith("/api/v1/me/photo-protocols/visit-live-1")) {
      return response({
        item: {
          id: "photo-protocol-live-1",
          visitId: "visit-live-1",
          reportId: "report-live-1",
          status: revokedPhotoProtocol ? "revoked" : "prepared",
          accessStatus: revokedPhotoProtocol ? "revoked" : "metadata_ready_delivery_blocked",
          selectedPhotoCount: 2,
          counts: {
            selectedPhotos: 2,
            overviewPhotos: 1,
            dermoscopyPhotos: 1,
            reportAttachments: 0,
          },
          preparedAt: "2026-05-20T12:00:00.000Z",
          revokedAt: revokedPhotoProtocol ? "2026-05-21T09:00:00.000Z" : null,
          expiresAt: "2026-06-20T10:00:00.000Z",
          auditTrail: revokedPhotoProtocol
            ? [
                {
                  kind: "prepared",
                  label: "Фото-протокол подготовлен клиникой",
                  occurredAt: "2026-05-20T12:00:00.000Z",
                  rawPayload: "hidden",
                },
                {
                  kind: "revoked",
                  label: "Доступ отозван клиникой",
                  occurredAt: "2026-05-21T09:00:00.000Z",
                  revokeReason: "hidden",
                },
              ]
            : [
                {
                  kind: "prepared",
                  label: "Фото-протокол подготовлен клиникой",
                  occurredAt: "2026-05-20T12:00:00.000Z",
                },
              ],
          deliveryBoundary: {
            patientDeliveryAllowed: false,
            rawFilesExposed: false,
            signedUrlsIssued: false,
            storagePathsExposed: false,
            tokensExposed: false,
            doctorOnlyTextExposed: false,
            fileProxyReady: false,
          },
          photos: [{
            sequence: 1,
            kind: "overview_photo",
            contentType: "image/jpeg",
            capturedAt: "2026-05-20T10:10:00.000Z",
            lesionLabel: "Очаг A",
            bodyZone: "спина",
            previewAvailable: false,
          }],
        },
      });
    }
    if (href.endsWith("/api/v1/me/photo-protocols/visit-live-1/photos/1/download")) {
      return Promise.resolve(new Response("patient-photo", {
        status: 200,
        headers: {
          "content-type": "image/jpeg",
          "content-disposition": "inline; filename=\"photo-protocol-1.jpg\"",
        },
      }));
    }
    if (href.endsWith("/api/v1/me/booking-requests")) {
      return response({
        item: {
          id: "booking-live-2",
          status: "requested",
          preferredFrom: "2026-06-20T10:00:00.000Z",
          reason: "Контроль после лечения",
        },
      }, 201);
    }
    if (href.endsWith("/api/v1/me/reminder-preferences")) {
      return response({
        item: {
          appointmentRemindersEnabled: false,
          reportNotificationsEnabled: true,
          preferredChannel: "none",
        },
      });
    }
    if (href.endsWith("/api/v1/me/follow-ups")) {
      return response({
        items: [{
          id: "follow-up-live-1",
          visitId: "visit-live-1",
          status: "sent",
          priority: "normal",
          reason: "Контроль после лечения",
          patientSummary: "Через две недели пришлите фото зоны лечения.",
          dueAt: "2026-06-10T10:00:00.000Z",
          messageCount: 1,
          latestMessage: {
            id: "message-live-1",
            followUpId: "follow-up-live-1",
            senderRole: "doctor",
            direction: "clinic_to_patient",
            body: "Ожидаем контрольный ответ.",
            patientVisible: true,
          },
        }],
      });
    }
    if (href.endsWith("/api/v1/me/follow-ups/follow-up-live-1/messages")) {
      return response({
        item: {
          id: "message-live-2",
          followUpId: "follow-up-live-1",
          senderRole: "patient",
          direction: "patient_to_clinic",
          body: "Ответ пациента",
        },
      }, 201);
    }
    return response({ error: { code: "not_found", message: "Not found" } }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/me" element={<MeHomePage />} />
        <Route path="/me/history" element={<MeHistoryPage />} />
        <Route path="/me/reports" element={<MeReportsPage />} />
        <Route path="/me/reports/:id" element={<MeReportPage />} />
        <Route path="/me/booking" element={<MeBookingPage />} />
        <Route path="/me/reminders" element={<MeRemindersPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Patient portal · Stage 5N production", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads /me from self-hosted patient portal without demo copy", async () => {
    const fetchMock = mockFetch();
    renderRoute("/me");

    expect(await screen.findByText(/Production portal подключён/i)).toBeInTheDocument();
    expect(screen.getByText(/Пациент Production/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Демо-режим");
    expect(document.body).not.toHaveTextContent("Скрытый врачебный текст");
    expect(fetchMock).toHaveBeenCalledWith("https://clinic.local/api/v1/me/portal", {
      method: "GET",
      headers: { Accept: "application/json", Authorization: "Bearer patient-token" },
    });
  });

  it("renders reports list and one report through patient-safe endpoints", async () => {
    mockFetch();
    const list = renderRoute("/me/reports");
    expect(await screen.findByText("Пациентское заключение")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Контур безопасной выдачи/ })).toBeInTheDocument();
    expect(screen.getByText(/Доступ: self-hosted кабинет/)).toBeInTheDocument();
    expect(screen.getByText(/Сырые токены и врачебная версия скрыты/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Скрытый врачебный текст");
    list.unmount();

    renderRoute("/me/reports/report-live-1");
    expect(await screen.findByText("Заключение для пациента")).toBeInTheDocument();
    expect(screen.getByText(/Текст для пациента/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Безопасность доступа/ })).toBeInTheDocument();
    expect(screen.getByText(/Токен доступа скрыт/)).toBeInTheDocument();
    expect(screen.getByText(/Врачебная версия скрыта/)).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: /Фото-протокол пациента/ })).toBeInTheDocument();
    expect(screen.getByText(/метаданные готовы, политика доступа ограничивает выдачу/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Контур политики доступа к фото/ })).toBeInTheDocument();
    expect(screen.getByText(/Сырые файлы, защищённые ссылки/)).toBeInTheDocument();
    await waitFor(() => expect(document.body).not.toHaveTextContent("Скрытый врачебный текст"));
  });

  it("prepares one photo through the secure backend proxy without exposing backend paths", async () => {
    const createObjectURL = vi.fn(() => "blob:patient-photo-protocol-1");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const fetchMock = mockFetch();
    const view = renderRoute("/me/reports/report-live-1");

    expect(await screen.findByRole("region", { name: /Фото-протокол пациента/ })).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Подготовить фото 1" }));

    const openLink = await screen.findByRole("link", { name: "Открыть фото 1" });
    expect(openLink).toHaveAttribute("href", "blob:patient-photo-protocol-1");
    expect(screen.getByText(/Фото 1 подготовлено через защищённый backend/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/me/photo-protocols/visit-live-1/photos/1/download",
      {
        method: "GET",
        headers: { Accept: "image/*", Authorization: "Bearer patient-token" },
      },
    );
    expect(document.body).not.toHaveTextContent("/api/v1/me/photo-protocols/visit-live-1/photos/1/download");
    expect(document.body).not.toHaveTextContent("patient-token");
    expect(document.body).not.toHaveTextContent("Скрытый врачебный текст");
    view.unmount();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:patient-photo-protocol-1");
  });

  it("shows revoked photo-protocol access and safe audit review without downloading photos", async () => {
    const fetchMock = mockFetch({ revokedPhotoProtocol: true });
    renderRoute("/me/reports/report-live-1");

    expect(await screen.findByRole("region", { name: /Фото-протокол пациента/ })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Отзыв и журнал доступа/ })).toBeInTheDocument();
    expect(screen.getByText("Доступ отозван клиникой")).toBeInTheDocument();
    expect(screen.getByText(/Фото-протокол отозван/)).toBeInTheDocument();
    const prepareButton = screen.getByRole("button", { name: "Подготовить фото 1" });
    expect(prepareButton).toBeDisabled();
    fireEvent.click(prepareButton);
    expect(fetchMock).not.toHaveBeenCalledWith(
      "https://clinic.local/api/v1/me/photo-protocols/visit-live-1/photos/1/download",
      expect.any(Object),
    );
    expect(document.body).not.toHaveTextContent("hidden");
    expect(document.body).not.toHaveTextContent("revokeReason");
    expect(document.body).not.toHaveTextContent("rawPayload");
    expect(document.body).not.toHaveTextContent("patient-token");
  });

  it("shows production-safe lesion history boundary without internal content", async () => {
    mockFetch();
    renderRoute("/me/history");

    expect(await screen.findByText(/История очагов/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /Контур безопасного протокола/ })).toBeInTheDocument();
    expect(screen.getByText(/self-hosted backend пока не отдаёт проверенный протокол очагов/)).toBeInTheDocument();
    expect(screen.getByText(/История доступна через выпущенные заключения/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Скрытый врачебный текст");
  });

  it("shows production booking state and creates a self-hosted booking request", async () => {
    const fetchMock = mockFetch();
    const booking = renderRoute("/me/booking");

    expect(await screen.findByText("Самозапись пациента")).toBeInTheDocument();
    expect(screen.getByText("Плановый контроль")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Предпочтительное начало записи"), {
      target: { value: "2026-06-20T10:00" },
    });
    fireEvent.change(screen.getByLabelText("Причина запроса на запись"), {
      target: { value: "Контроль после лечения" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Отправить запрос" }));

    expect(await screen.findByText("Запрос на запись отправлен в клинику.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/me/booking-requests",
      expect.objectContaining({ method: "POST" }),
    );
    expect(document.body).not.toHaveTextContent("Подтвердить (демо)");
    booking.unmount();
  });

  it("shows reminders and updates reminder preferences through self-hosted backend", async () => {
    const fetchMock = mockFetch();
    renderRoute("/me/reminders");

    expect(await screen.findByText("Ближайший приём")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Напоминать о ближайшем приёме"));
    fireEvent.change(screen.getByLabelText("Канал уведомлений пациента"), {
      target: { value: "none" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить настройки" }));

    expect(await screen.findByText("Настройки напоминаний сохранены.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/me/reminder-preferences",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(document.body).not.toHaveTextContent("Отметить выполнено");
  });

  it("keeps production reminders visible without demo actions", async () => {
    mockFetch();
    renderRoute("/me/reminders");
    expect(await screen.findByText("Ближайший приём")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Отметить выполнено");
  });

  it("shows patient-visible follow-ups and posts a clinic reply", async () => {
    const fetchMock = mockFetch();
    renderRoute("/me/reminders");

    expect(await screen.findByText("Контроль после лечения")).toBeInTheDocument();
    expect(screen.getByText("Через две недели пришлите фото зоны лечения.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Doctor-only");

    fireEvent.change(screen.getByLabelText(/Ответ клинике по контролю/i), {
      target: { value: "Фото отправлю завтра." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ответить клинике" }));

    expect(await screen.findByText("Ответ клинике сохранён в self-hosted backend.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/me/follow-ups/follow-up-live-1/messages",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
