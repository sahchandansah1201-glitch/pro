import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { VisitImagingTab } from "./VisitImagingTab";
import type { Visit } from "@/lib/domain";
import { clearSelfHostedApiSession, writeSelfHostedApiSession } from "@/lib/self-hosted-api-session";

afterEach(() => { cleanup(); clearSelfHostedApiSession(); vi.unstubAllGlobals(); });

describe("Working imaging without educational fallback", () => {
  it("never shows educational images for a historical visit ID without a working session", () => {
    clearSelfHostedApiSession();
    const fetchMock=vi.fn(); vi.stubGlobal("fetch",fetchMock);
    render(<MemoryRouter><VisitImagingTab visit={{id:"v-001"} as Visit} patientId="p-001" lesions={[]} initialImageId="i-002" /></MemoryRouter>);
    expect(screen.queryByTestId("selected-image-preview")).toBeNull();
    expect(screen.getByText("Снимок не выбран.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores a late image list after logout without restoring educational images", async () => {
    writeSelfHostedApiSession({apiBaseUrl:"http://localhost:19190",apiToken:"synthetic-only",user:{id:"synthetic-doctor",displayName:"Проверочный врач",roles:["doctor"]}});
    let finish: (value: Response) => void=()=>{};
    vi.stubGlobal("fetch",vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;})));
    render(<MemoryRouter><VisitImagingTab visit={{id:"v-001"} as Visit} patientId="p-001" lesions={[]} /></MemoryRouter>);
    await act(async()=>{clearSelfHostedApiSession();});
    await act(async()=>{finish(new Response(JSON.stringify({items:[{id:"late-asset",clinicId:"synthetic-clinic",visitId:"v-001",lesionId:null,kind:"overview",captureSource:"file",capturedAt:"2026-10-13T00:00:00Z",createdAt:"2026-10-13T00:00:00Z"}]}),{status:200,headers:{"Content-Type":"application/json"}}));});
    expect(screen.queryByTestId("selected-image-preview")).toBeNull();
    expect(screen.getByText("Снимок не выбран.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("late-asset");
  });
});
