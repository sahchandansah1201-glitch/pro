import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { AuthContext, type AuthContextValue } from "@/context/auth-context";
import { RoleProvider } from "@/context/RoleContext";
import { clearSelfHostedApiSession, writeSelfHostedApiSession } from "@/lib/self-hosted-api-session";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase-client", () => ({ isSupabaseConfigured: () => true, getSupabaseClient: () => ({ rpc }) }));
import SysAccessEventsPage from "./SysAccessEventsPage";

function auth(status: AuthContextValue["status"] = "authenticated", role = "system_admin"): AuthContextValue {
  return { status, session: null, accessToken: status === "authenticated" ? "synthetic-managed" : null,
    apiBaseUrl: "https://synthetic.invalid", user: { id: "synthetic-managed-user", app_metadata: { role },
      user_metadata: {}, aud: "authenticated", created_at: "2026-10-13T00:00:00Z" } as User,
    signInWithPassword: vi.fn(), signInWithGoogle: vi.fn(), signOut: vi.fn() };
}
function page(value = auth()) {
  return <AuthContext.Provider value={value}><RoleProvider><MemoryRouter><SysAccessEventsPage /></MemoryRouter></RoleProvider></AuthContext.Provider>;
}
const row = (name = "Проверочный сотрудник") => ({ id: "synthetic-event", created_at: "2026-10-13T09:00:00Z",
  clinic_name: "Проверочная клиника", actor_full_name: name, action: "view", entity: "patient",
  entity_id: null, patient_code: null, visit_id: null, lesion_label: null });
beforeEach(() => { window.localStorage.clear(); clearSelfHostedApiSession(); vi.stubEnv("VITE_APP_MODE", "production"); rpc.mockReset(); });
afterEach(() => { cleanup(); clearSelfHostedApiSession(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Working access events", () => {
  it("retains the authenticated managed RPC even with the retired production selector", async () => {
    rpc.mockResolvedValue({ data: [row()], error: null }); render(page());
    expect((await screen.findAllByText("Проверочный сотрудник")).length).toBeGreaterThan(0);
    expect(rpc).toHaveBeenCalledWith("list_access_events_admin", { _limit: 200, _offset: 0 });
    expect(document.body).not.toHaveTextContent(/Учебный режим|Март 2026/);
  });
  it.each(["anonymous", "loading"] as const)("%s does not open the journal or fetch invented rows", (status) => {
    render(page(auth(status)));
    expect(rpc).not.toHaveBeenCalled();
    expect(document.body).not.toHaveTextContent(/Переключите роль|Учебный режим/);
  });
  it("native non-admin never falls through to a dormant managed administrator", () => {
    writeSelfHostedApiSession({ apiBaseUrl: "http://localhost:19180", apiToken: "synthetic-native",
      user: { id: "native-patient", displayName: "Проверочный пациент", roles: ["patient"] } });
    const fetchMock=vi.fn(); vi.stubGlobal("fetch", fetchMock); render(page());
    expect(screen.getByRole("alert")).toHaveTextContent("только системному администратору");
    expect(rpc).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("hides previous managed rows immediately and ignores a late response after logout", async () => {
    let finish: (value: unknown) => void = () => {};
    rpc.mockReturnValue(new Promise(resolve=>{ finish=resolve; }));
    const { rerender }=render(page());
    rerender(page(auth("anonymous")));
    await act(async()=>{finish({ data:[row("Запись старой сессии")],error:null });});
    expect(document.body).not.toHaveTextContent("Запись старой сессии");
  });
  it("stops a delayed export when its authenticated session ends", async () => {
    rpc.mockResolvedValue({data:[row()],error:null});
    const click=vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
    const {rerender}=render(page()); await screen.findAllByText("Проверочный сотрудник");
    fireEvent.click(screen.getByRole("button",{name:"Скачать события доступа таблицей"}));
    rerender(page(auth("anonymous")));
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,120));});
    expect(click).not.toHaveBeenCalled();
  });
});
