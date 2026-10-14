import AnalysisPublicPage from "@/pages/public/AnalysisPublicPage";
import SysReleaseStatusPage from "@/pages/sys/SysReleaseStatusPage";
import SysAuditPage from "@/pages/sys/SysAuditPage";
import SysApiKeysPage from "@/pages/sys/SysApiKeysPage";
import SysUsersPage from "@/pages/sys/SysUsersPage";
import CockpitPage from "@/pages/doctor/CockpitPage";
import PrivatePracticePage from "@/pages/doctor/PrivatePracticePage";
import AdminAnalyticsPage from "@/pages/admin/AdminAnalyticsPage";
import AdminBotSettingsPage from "@/pages/admin/AdminBotSettingsPage";
import AdminServicesPage from "@/pages/admin/AdminServicesPage";
import AdminClinicsPage from "@/pages/admin/AdminClinicsPage";
import AdminDoctorsPage from "@/pages/admin/AdminDoctorsPage";
import AdminIntegrationDetailPage from "@/pages/admin/AdminIntegrationDetailPage";
import AdminIntegrationsPage from "@/pages/admin/AdminIntegrationsPage";
import AdminHomePage from "@/pages/admin/AdminHomePage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { clearSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import CapturePage from "@/pages/doctor/CapturePage";
import { RoleProvider } from "@/context/RoleContext";

beforeEach(() => { clearSelfHostedApiSession(); vi.stubEnv("VITE_APP_MODE", "demo"); });
afterEach(() => { cleanup(); clearSelfHostedApiSession(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Working-only cutover", () => {
  it("opens only the working capture without allowing the old mode to invent patients or devices", () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><CapturePage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Съёмка" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Войдите в систему клиники");
    expect(document.body).not.toHaveTextContent("Учебный режим");
    expect(document.body).not.toHaveTextContent("Новиков");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("AdminHomePage never restores educational data when the old mode is demo", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><AdminHomePage /></MemoryRouter>);
    expect(document.body).not.toHaveTextContent(/Учебный режим/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("AdminIntegrationsPage never restores educational data when the old mode is demo", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><AdminIntegrationsPage /></MemoryRouter>);
    expect(document.body).not.toHaveTextContent(/Учебный режим/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("AdminIntegrationDetailPage never restores educational data when the old mode is demo", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter initialEntries={["/admin/integrations/int-001"]}><Routes><Route path="/admin/integrations/:id" element={<AdminIntegrationDetailPage />} /></Routes></MemoryRouter>);
    expect(document.body).not.toHaveTextContent(/Учебный режим/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("AdminDoctorsPage never restores educational data when the old mode is demo", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><AdminDoctorsPage /></MemoryRouter>);
    expect(document.body).not.toHaveTextContent(/Учебный режим/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("AdminClinicsPage never restores educational data when the old mode is demo", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><AdminClinicsPage /></MemoryRouter>);
    expect(document.body).not.toHaveTextContent(/Учебный режим/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("AdminServicesPage never restores educational data when the old mode is demo", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><AdminServicesPage /></MemoryRouter>);
    expect(document.body).not.toHaveTextContent(/Учебный режим/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("AdminBotSettingsPage never restores educational data when the old mode is demo", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><AdminBotSettingsPage /></MemoryRouter>);
    expect(document.body).not.toHaveTextContent(/Учебный режим/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("AdminAnalyticsPage never restores educational data when the old mode is demo", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><AdminAnalyticsPage /></MemoryRouter>);
    expect(screen.getByRole("button", { name: "Показать за период" })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Учебный режим/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("PrivatePracticePage never restores educational data when the old mode is demo", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><PrivatePracticePage /></MemoryRouter>);
    expect(document.body).not.toHaveTextContent(/Учебный режим/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("CockpitPage never restores educational data when the old mode is demo", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<RoleProvider><MemoryRouter initialEntries={["/doctor"]}><Routes><Route path="/doctor" element={<CockpitPage />} /><Route path="/desk" element={<h1>Рабочий стол</h1>} /></Routes></MemoryRouter></RoleProvider>);
    expect(await screen.findByRole("heading", { name: "Рабочий стол" })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Учебный режим/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("SysUsersPage never restores educational data when the old mode is demo", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><SysUsersPage /></MemoryRouter>);
    expect(document.body).not.toHaveTextContent(/Учебный режим/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("SysApiKeysPage never restores educational data when the old mode is demo", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><SysApiKeysPage /></MemoryRouter>);
    expect(document.body).not.toHaveTextContent(/Учебный режим/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("SysAuditPage never restores educational data when the old mode is demo", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><SysAuditPage /></MemoryRouter>);
    expect(document.body).not.toHaveTextContent(/Учебный режим/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("SysReleaseStatusPage never restores educational data when the old mode is demo", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><SysReleaseStatusPage /></MemoryRouter>);
    expect(screen.getByRole("alert", { name: "Текущий статус публикации не подтверждён" })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("AnalysisPublicPage never restores educational data when the old mode is demo", async () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><AnalysisPublicPage /></MemoryRouter>);
    expect(screen.queryByRole("note", { name: "Учебный просмотр" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
