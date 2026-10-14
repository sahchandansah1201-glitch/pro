import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import { VisitImagingTab } from "./VisitImagingTab";
import type { Visit } from "@/lib/domain";
import { clearSelfHostedApiSession, writeSelfHostedApiSession } from "@/lib/self-hosted-api-session";

const json=(body: unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}});
const page=()=>render(<MemoryRouter><VisitImagingTab visit={{id:"synthetic-visit"} as Visit} patientId="synthetic-patient" lesions={[]} /></MemoryRouter>);
beforeEach(()=>{clearSelfHostedApiSession();writeSelfHostedApiSession({apiBaseUrl:"http://localhost:19201",apiToken:"synthetic-only",user:{id:"synthetic-doctor",displayName:"Проверочный врач",roles:["doctor"]}});});
afterEach(()=>{cleanup();clearSelfHostedApiSession();vi.restoreAllMocks();vi.unstubAllGlobals();});

describe("Working imaging UX",()=>{
  it("does not claim an empty clinical list when its request fails",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>json({error:{code:"service_unavailable"}},503)));
    page();
    const region=screen.getByRole("region",{name:"Снимки визита"});
    expect(await within(region).findByRole("alert")).toHaveTextContent("Не удалось загрузить снимки.");
    expect(within(region).queryByText("В системе клиники ещё нет снимков для этого визита.")).toBeNull();
  });

  it("keeps the main list, timeline and counters unknown after a failed read",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>json({error:{code:"service_unavailable"}},503)));
    page(); await screen.findByRole("alert");
    expect(document.body).not.toHaveTextContent("Снимков визита нет.");
    expect(document.body).not.toHaveTextContent("По выбранным фильтрам снимков нет.");
    expect(screen.queryAllByText("0 шт.")).toHaveLength(0);
    expect(screen.getByTestId("imaging-summary")).toHaveTextContent(/Всего\s*—/);
  });

  it("offers the real file picker at the start without educational capture controls",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>json({items:[]})));
    const {container}=page();
    const region=screen.getByRole("region",{name:"Снимки визита"});
    await within(region).findByText("В системе клиники ещё нет снимков для этого визита.");
    expect(document.body).not.toHaveTextContent(/учебн/i);
    expect(region.compareDocumentPosition(screen.getByRole("heading",{name:"Просмотр"})) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const input=container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).not.toBeNull();
    const choose=vi.spyOn(input as HTMLInputElement,"click");
    await userEvent.click(within(region).getByRole("button",{name:"Загрузить снимок"}));
    expect(choose).toHaveBeenCalledOnce();
  });

  it("keeps counts unknown while loading and confirms zero only after a successful empty read", async () => {
    let finish: (response: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
    page();
    const region = screen.getByRole("region", { name: "Снимки визита" });
    expect(screen.getAllByText("Загружаем снимки…")).toHaveLength(2);
    expect(screen.getByTestId("imaging-summary")).toHaveTextContent(/Всего\s*—/);
    expect(document.body).not.toHaveTextContent("Снимков визита нет.");
    expect(within(region).getByRole("button", { name: "Загрузить снимок" })).toBeDisabled();
    await act(async () => { finish(json({ items: [] })); });
    expect(screen.getByTestId("imaging-summary")).toHaveTextContent(/Всего\s*0/);
    expect(screen.getByText("Снимков визита нет.")).toBeInTheDocument();
    expect(within(region).getByText("В системе клиники ещё нет снимков для этого визита.")).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: "Загрузить снимок" })).toBeEnabled();
  });

  it("retries a failed read and clears the error only after the new list arrives", async () => {
    let finish: (response: Response) => void = () => {};
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ error: { code: "service_unavailable" } }, 503))
      .mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
    vi.stubGlobal("fetch", fetchMock);
    page();
    const region = screen.getByRole("region", { name: "Снимки визита" });
    await within(region).findByRole("alert");
    await userEvent.click(within(region).getByRole("button", { name: "Повторить загрузку списка снимков" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("imaging-summary")).toHaveTextContent(/Всего\s*—/);
    expect(document.body).not.toHaveTextContent("Снимков визита нет.");
    await act(async () => { finish(json({ items: [] })); });
    expect(within(region).queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("imaging-summary")).toHaveTextContent(/Всего\s*0/);
  });

  it("requires a working login and disables upload instead of offering an educational action", () => {
    clearSelfHostedApiSession();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    page();
    const region = screen.getByRole("region", { name: "Снимки визита" });
    expect(within(region).getByRole("button", { name: "Загрузить снимок" })).toBeDisabled();
    expect(within(region).getByRole("link", { name: "Войти в систему клиники" })).toHaveAttribute("href", "/self-hosted/login");
    expect(screen.getByTestId("imaging-summary")).toHaveTextContent(/Всего\s*—/);
    expect(document.body).not.toHaveTextContent(/учебн/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps counts unknown after logout even when the old request returns", async () => {
    let finish: (response: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { finish = resolve; })));
    page();
    await act(async () => { clearSelfHostedApiSession(); });
    await act(async () => { finish(json({ items: [] })); });
    expect(screen.getByTestId("imaging-summary")).toHaveTextContent(/Всего\s*—/);
    expect(screen.getByRole("button", { name: "Загрузить снимок" })).toBeDisabled();
    expect(document.body).not.toHaveTextContent("Снимков визита нет.");
  });

  it("does not turn a failed list into an empty list after file validation clears the alert", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: "service_unavailable" } }, 503)));
    const { container } = page();
    const region = screen.getByRole("region", { name: "Снимки визита" });
    await within(region).findByRole("alert");
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(["not an image"], "invalid.txt", { type: "text/plain" })] },
    });
    await within(region).findByText("Выберите файл изображения: JPEG, PNG, WebP или HEIC.");
    expect(within(region).queryByText("0 шт.")).toBeNull();
    expect(within(region).queryByText("В системе клиники ещё нет снимков для этого визита.")).toBeNull();
    expect(screen.getByTestId("imaging-summary")).toHaveTextContent(/Всего\s*—/);
  });
});
