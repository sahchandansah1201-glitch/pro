import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PatientDetailPage from "@/pages/doctor/PatientDetailPage";
import PatientsPage from "@/pages/doctor/PatientsPage";
import VisitWorkspacePage from "@/pages/doctor/VisitWorkspacePage";
import { clearSelfHostedApiSession, writeSelfHostedApiSession } from "@/lib/self-hosted-api-session";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});
function session(token: string) {
  writeSelfHostedApiSession({ apiBaseUrl: "http://localhost:19180", apiToken: token,
    user: { id: token, displayName: "Проверочный врач", roles: ["doctor"] } });
}
function detail() {
  return render(<MemoryRouter initialEntries={["/patients/p-001"]}><Routes>
    <Route path="/patients/:id" element={<PatientDetailPage />} />
  </Routes></MemoryRouter>);
}
function detailReply(input: RequestInfo | URL, name: string) {
  return String(input).endsWith("/visits") ? json({ items: [] }) : json({ item: {
    id: "p-001", code: "SYNTHETIC-1", fullName: name, birthDate: null, sex: null,
    phototype: null, imagingConsent: null,
  } });
}
beforeEach(() => { clearSelfHostedApiSession(); vi.stubEnv("VITE_APP_MODE", "demo"); });
afterEach(() => { cleanup(); clearSelfHostedApiSession(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Working clinical cutover", () => {
  it("rejects a patient reply whose ID differs from the requested card", async () => {
    session("synthetic-B");
    vi.stubGlobal("fetch", vi.fn(async input => String(input).endsWith("/visits") ? json({items:[]}) : json({item:{id:"different-patient",fullName:"Чужая карточка",code:"OTHER"}})));
    detail();
    expect(await screen.findByRole("heading",{name:"Карточка пациента недоступна"})).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Чужая карточка");
  });
  it("rejects lesions linked to another patient or visit", async () => {
    session("synthetic-B");
    vi.stubGlobal("fetch", vi.fn(async input => String(input).endsWith("/lesions")
      ? json({items:[{id:"wrong-lesion",patientId:"another-patient",visitId:"another-visit",label:"Чужой очаг"}]})
      : json({item:{id:"v-001",patientId:"p-001",status:"in_progress",patient:{id:"p-001",fullName:"Проверочный пациент",code:"SYNTHETIC-1",birthDate:"1980-01-01",sex:"male"},clinic:{id:"synthetic-clinic",name:"Проверочная клиника",slug:"synthetic"}}})));
    render(<MemoryRouter initialEntries={["/patients/p-001/visits/v-001?tab=bodymap"]}><Routes><Route path="/patients/:id/visits/:visitId" element={<VisitWorkspacePage />} /></Routes></MemoryRouter>);
    expect(await screen.findByRole("heading",{name:"Рабочее место визита недоступно"})).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Чужой очаг");
  });
  it("working bodymap marks image metadata as unloaded instead of claiming no images", async () => {
    session("synthetic-B");
    vi.stubGlobal("fetch", vi.fn(async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/lesions")) return json({ items: [{ id: "synthetic-lesion", patientId: "p-001", visitId: "v-001", label: "Рабочий очаг", bodyZone: "Кисть", status: "active" }] });
      if (path === "/api/v1/visits/v-001") return json({ item: { id: "v-001", patientId: "p-001", clinicId: "synthetic-clinic", status: "in_progress", startedAt: "2026-10-13T09:00:00Z", patient: { id: "p-001", fullName: "Проверочный пациент", code: "SYNTHETIC-1", birthDate: "1980-01-01", sex: "male" }, clinic: { id: "synthetic-clinic", name: "Проверочная клиника", slug: "synthetic" } } });
      return json({ error: { code: "not_found" } }, 404);
    }));
    render(<MemoryRouter initialEntries={["/patients/p-001/visits/v-001?tab=bodymap&lesion=synthetic-lesion"]}><Routes><Route path="/patients/:id/visits/:visitId" element={<VisitWorkspacePage />} /></Routes></MemoryRouter>);
    await screen.findAllByText("Рабочий очаг");
    expect(document.body).not.toHaveTextContent(/нет снимков|Снимков: 0/);
    expect(screen.getAllByText("не загружено").length).toBeGreaterThan(0);
  });
  it("VisitWorkspacePage requires login even for an old valid training URL", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<MemoryRouter initialEntries={["/patients/p-001/visits/v-001"]}><Routes>
      <Route path="/patients/:id/visits/:visitId" element={<VisitWorkspacePage />} />
    </Routes></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Требуется вход в систему клиники" })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Иванова Наталья");
  });
  it("PatientsPage has no educational patients or local restore action without login", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<MemoryRouter><PatientsPage /></MemoryRouter>);
    expect(document.body).not.toHaveTextContent(/Иванова Наталья|Учебный режим/);
    expect(screen.getByRole("link", { name: "Войти в систему клиники" })).toBeInTheDocument();
  });
  it("PatientsPage never borrows clinical counts from an educational record with the same ID", async () => {
    session("synthetic-B");
    vi.stubGlobal("fetch", vi.fn(async () => json({ items: [{
      id: "p-001", code: "SYNTHETIC-1", fullName: "Рабочий пациент", birthDate: null,
      sex: null, phototype: null, imagingConsent: null,
    }] })));
    render(<MemoryRouter><PatientsPage /></MemoryRouter>);
    await screen.findAllByText("Рабочий пациент");
    const row = screen.getByRole("row", { name: /Рабочий пациент/ });
    expect(row).not.toHaveTextContent(/2026|карта 0001/);
    expect(row.querySelectorAll("td")[7]).toHaveTextContent("—");
  });
  it("PatientDetailPage never supplies the old patient without a working session", () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); detail();
    expect(screen.getByRole("heading", { name: "Требуется рабочий вход" })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Иванова Наталья");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("PatientDetailPage clears account A immediately and ignores its late response", async () => {
    session("synthetic-A");
    let finishOld: () => void = () => {};
    const pending = new Promise<void>((resolve) => { finishOld = resolve; });
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      const old = (init?.headers as Record<string, string>).Authorization === "Bearer synthetic-A";
      if (old) await pending;
      return detailReply(input, old ? "Запись A" : "Запись B");
    }));
    detail();
    expect(document.body).not.toHaveTextContent("Иванова Наталья");
    await act(async () => { session("synthetic-B"); });
    expect(await screen.findByRole("heading", { name: "Запись B" })).toBeInTheDocument();
    await act(async () => { finishOld(); });
    expect(document.body).not.toHaveTextContent("Запись A");
    await act(async () => { clearSelfHostedApiSession(); });
    expect(document.body).not.toHaveTextContent("Запись B");
  });
});
