import { afterEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminAnalyticsPage from "./AdminAnalyticsPage";

vi.mock("@/lib/app-mode", () => ({ isProductionAppMode: () => true }));
vi.mock("@/lib/self-hosted-api-session", () => ({ useSelfHostedApiSession: () => ({
  apiBaseUrl: "https://synthetic.invalid", apiToken: "synthetic", status: "configured",
  user: { id: "synthetic-admin", roles: ["clinic_admin"] },
}) }));

function result(url: string, visitsCreated = 7) {
  const params = new URL(url).searchParams;
  return new Response(JSON.stringify({ item: { clinics: 1, visits: 90, recentAuditEvents: [], period: {
    dateFrom: params.get("dateFrom"), dateTo: params.get("dateTo"), timeZone: params.get("timeZone"),
    patientsCreated: 2, visitsCreated, photosAdded: 4, reportsSigned: 1,
  } } }));
}
function renderPage() { return render(<MemoryRouter><AdminAnalyticsPage /></MemoryRouter>); }
function chooseJuly() {
  fireEvent.change(screen.getByLabelText("С"), { target: { value: "2026-07-01" } });
  fireEvent.change(screen.getByLabelText("По"), { target: { value: "2026-07-31" } });
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("lets the administrator apply a period and see its counters separately from totals", async () => {
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(result(url, url.includes("2026-07-01") ? 3 : 7))));
  renderPage();
  expect(await screen.findByRole("heading", { name: "За выбранный период" })).toBeVisible();
  chooseJuly();
  fireEvent.click(screen.getByRole("button", { name: "Показать за период" }));
  await waitFor(() => expect(within(screen.getByRole("region", { name: "За выбранный период" })).getByText("3")).toBeVisible());
  expect(screen.getByText("01.07.2026 — 31.07.2026 · Москва")).toBeVisible();
  expect(screen.getByText("Создано записей визитов")).toBeVisible();
  expect(screen.getByText("Даты по московскому времени. Обе даты включены.")).toBeVisible();
});

it("does not let a slow previous request replace the newly selected period", async () => {
  let finishFirst: (value: Response) => void = () => undefined;
  let firstUrl = "";
  const fetchMock = vi.fn((url: string) => Promise.resolve(result(url, 3)));
  fetchMock.mockImplementationOnce((url) => { firstUrl = url; return new Promise((resolve) => { finishFirst = resolve; }); });
  vi.stubGlobal("fetch", fetchMock);
  renderPage();
  chooseJuly();
  fireEvent.click(screen.getByRole("button", { name: "Показать за период" }));
  await waitFor(() => expect(within(screen.getByRole("region", { name: "За выбранный период" })).getByText("3")).toBeVisible());
  await act(async () => finishFirst(result(firstUrl, 777)));
  expect(screen.queryByText("777")).not.toBeInTheDocument();
  expect(screen.getByText("01.07.2026 — 31.07.2026 · Москва")).toBeVisible();
});

it("shows a recoverable error without invented zero counters and clears it after retry", async () => {
  const fetchMock = vi.fn((url: string) => Promise.resolve(result(url, 3))).mockRejectedValueOnce(new Error("offline"));
  vi.stubGlobal("fetch", fetchMock);
  renderPage();
  expect(await screen.findByRole("alert")).toHaveTextContent("Сбой сети");
  expect(within(screen.getByRole("region", { name: "За выбранный период" })).queryByText("0")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Показать за период" }));
  await waitFor(() => expect(screen.getByText("3")).toBeVisible());
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("does not call the API for an inverted date range", async () => {
  const fetchMock = vi.fn((url: string) => Promise.resolve(result(url)));
  vi.stubGlobal("fetch", fetchMock);
  renderPage();
  await waitFor(() => expect(screen.getByText("7")).toBeVisible());
  chooseJuly();
  fireEvent.change(screen.getByLabelText("С"), { target: { value: "2026-08-01" } });
  expect(screen.getByRole("button", { name: "Показать за период" })).toBeDisabled();
  expect(screen.getByRole("alert")).toHaveTextContent("Дата окончания");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("explains an empty period and refuses an old backend without period support", async () => {
  const fetchMock = vi.fn((url: string) => {
    const params = new URL(url).searchParams;
    return Promise.resolve(new Response(JSON.stringify({ item: { period: {
      dateFrom: params.get("dateFrom"), dateTo: params.get("dateTo"), timeZone: "Europe/Moscow",
      patientsCreated: 0, visitsCreated: 0, photosAdded: 0, reportsSigned: 0,
    } } })));
  });
  vi.stubGlobal("fetch", fetchMock);
  renderPage();
  expect(await screen.findByText(/За этот период записей нет/)).toBeVisible();
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ item: { visits: 900 } })));
  fireEvent.click(screen.getByRole("button", { name: "Показать за период" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось получить данные за выбранный период");
  expect(screen.queryByText("900")).not.toBeInTheDocument();
  expect(screen.queryByText(/За этот период записей нет/)).not.toBeInTheDocument();
});
