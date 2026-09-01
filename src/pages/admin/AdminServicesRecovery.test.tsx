import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import AdminServicesPage from "@/pages/admin/AdminServicesPage";
import { clearSelfHostedApiSession, writeSelfHostedApiSession } from "@/lib/self-hosted-api-session";

const service = {
  id: "service-recovery",
  clinicId: "clinic-recovery",
  clinicName: "Тестовая клиника",
  name: "Тестовая услуга",
  category: "consult",
  durationMin: 30,
  priceMin: 1000,
  priceMax: 1000,
  consentNote: "",
  onlineBooking: false,
  active: true,
};

function json(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  }));
}

afterEach(() => {
  cleanup();
  document.body.removeAttribute("tabindex");
  clearSelfHostedApiSession();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it.each(["clinic_admin", "system_admin"])("%s can refresh after a Russian not-found error without losing the service draft", async (role) => {
  vi.stubEnv("VITE_APP_MODE", "production");
  writeSelfHostedApiSession({
    apiBaseUrl: "https://clinic.test",
    apiToken: "synthetic-unit-token",
    user: { id: "admin-recovery", displayName: "Тестовый администратор", roles: [role] },
  });
  let unavailable = false;
  let restored = false;
  let releaseRefresh: (() => void) | null = null;
  vi.stubGlobal("fetch", vi.fn((url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    if (href.endsWith("/api/v1/admin/services/service-recovery") && init?.method === "PATCH") {
      if (restored) return json({ item: { ...service, ...JSON.parse(String(init.body)) } });
      unavailable = true;
      return json({ error: { code: "not_found", message: "Resource was not found in the allowed clinic scope." } }, 404);
    }
    if (href.endsWith("/api/v1/admin/services")) {
      if (unavailable && !restored) {
        return new Promise<Response>((resolve) => {
          releaseRefresh = () => void json({ items: [] }).then(resolve);
        });
      }
      return json({ items: [service] });
    }
    if (href.endsWith("/api/v1/admin/clinics")) return json({ items: [{ id: service.clinicId, name: service.clinicName }] });
    throw new Error(`Unexpected test request: ${href}`);
  }));

  render(<MemoryRouter><AdminServicesPage /></MemoryRouter>);
  fireEvent.click((await screen.findAllByRole("button", { name: "Редактировать" }))[0]);
  const form = within(screen.getByRole("region", { name: "Редактирование услуги" }));
  fireEvent.change(form.getByLabelText("Название редактируемой услуги"), { target: { value: "Услуга с изменениями" } });
  fireEvent.change(form.getByLabelText("Минимальная цена редактируемой услуги"), { target: { value: "1250" } });
  fireEvent.change(form.getByLabelText("Максимальная цена редактируемой услуги"), { target: { value: "1500" } });
  fireEvent.click(form.getByRole("button", { name: "Сохранить услугу" }));

  expect(await screen.findByText("Услуга не найдена или недоступна для вашей клиники. Изменения не сохранены. Обновите список услуг.")).toBeInTheDocument();
  expect(form.getByLabelText("Название редактируемой услуги")).toHaveValue("Услуга с изменениями");
  expect(form.getByLabelText("Минимальная цена редактируемой услуги")).toHaveValue("1250");
  expect(form.getByLabelText("Максимальная цена редактируемой услуги")).toHaveValue("1500");
  expect(form.getByRole("button", { name: "Сохранить услугу" })).toBeEnabled();
  expect(document.body).not.toHaveTextContent(/Resource was not found|Услуга обновлена/);
  expect(form.getByRole("alert")).toHaveTextContent("Изменения не сохранены");

  const refreshButton = form.getByRole("button", { name: "Обновить список услуг" });
  refreshButton.focus();
  expect(refreshButton).toHaveFocus();
  fireEvent.click(refreshButton);
  expect(refreshButton).toBeDisabled();
  // A disabled button loses focus in Chrome while the request is in flight.
  document.body.tabIndex = -1;
  document.body.focus();
  expect(document.body).toHaveFocus();
  await act(async () => releaseRefresh?.());
  expect(await screen.findByText("В списке: 0")).toBeInTheDocument();
  await waitFor(() => expect(refreshButton).toHaveFocus());
  expect(form.getByLabelText("Название редактируемой услуги")).toHaveValue("Услуга с изменениями");
  expect(form.getByLabelText("Минимальная цена редактируемой услуги")).toHaveValue("1250");
  expect(form.getByLabelText("Максимальная цена редактируемой услуги")).toHaveValue("1500");

  restored = true;
  fireEvent.click(form.getByRole("button", { name: "Сохранить услугу" }));
  expect(await screen.findByText("Услуга обновлена: Услуга с изменениями")).toBeInTheDocument();
  await waitFor(() => expect(screen.queryByRole("region", { name: "Редактирование услуги" })).not.toBeInTheDocument());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
