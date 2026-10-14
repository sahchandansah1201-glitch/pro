import { readFile } from "node:fs/promises";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FORBIDDEN_TOKENS } from "../../../scripts/forbidden-patterns.mjs";
import { writeSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import PatientsPage from "./PatientsPage";

const patient = {
  id: "10000000-0000-4000-8000-000000000201", code: "SYNTHETIC-1",
  fullName: "Проверочная Запись", birthDate: "2000-01-01", sex: "female",
  phototype: "II", imagingConsent: false,
};
type FormMode = "create" | "edit";
const response = (body: unknown) => new Response(JSON.stringify(body), {
  status: 200, headers: { "Content-Type": "application/json" },
});

beforeEach(() => {
  window.localStorage.clear();
  writeSelfHostedApiSession({ apiBaseUrl: "http://localhost:19231", apiToken: "synthetic-date-test" });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 0, 2, 0, 15));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

async function openForm(mode: FormMode) {
  const writes: Array<{ method: string; birthDate: string }> = [];
  vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (!init?.method || init.method === "GET") return response({ items: mode === "edit" ? [patient] : [] });
    const payload = JSON.parse(String(init.body));
    writes.push({ method: init.method, birthDate: payload.birthDate });
    return response({ item: { ...patient, ...payload } });
  }));
  render(<MemoryRouter initialEntries={["/patients"]}><PatientsPage /></MemoryRouter>);
  await waitFor(() => expect(screen.queryByText("Загрузка списка пациентов…")).not.toBeInTheDocument());
  fireEvent.click(mode === "create"
    ? screen.getAllByRole("button", { name: "Добавить пациента" })[0]
    : within(screen.getByRole("table")).getByRole("button", { name: /Редактировать пациента Проверочная Запись/ }));
  const dialog = screen.getByRole("dialog", { name: mode === "create" ? "Новый пациент" : "Редактировать пациента" });
  if (mode === "create") fireEvent.change(within(dialog).getByLabelText("ФИО"), { target: { value: patient.fullName } });
  return { dialog, writes, submit: () => fireEvent.click(within(dialog).getByRole("button", {
    name: mode === "create" ? "Добавить пациента" : "Сохранить изменения",
  })) };
}

describe("working patient birth-date validation", () => {
  it("keeps the working page inside the existing doctor hygiene rules", async () => {
    const source = await readFile("src/pages/doctor/PatientsPage.tsx", "utf8");
    const findings = FORBIDDEN_TOKENS.filter((token: string) => source.includes(token));
    expect(findings).toEqual([]);
  });

  describe.each(["create", "edit"] as const)("%s working form", (mode) => {
    it("rejects tomorrow and sends no patient mutation", async () => {
      const { dialog, writes, submit } = await openForm(mode);
      fireEvent.change(within(dialog).getByLabelText("Дата рождения"), { target: { value: "2026-01-03" } });
      submit();
      expect(within(dialog).getByRole("alert")).toHaveTextContent("Дата рождения не может быть в будущем.");
      expect(writes).toEqual([]);
    });

    it.each(["2026-01-02", "1900-01-01"])("accepts %s and sends the original ISO date", async (birthDate) => {
      const { dialog, writes, submit } = await openForm(mode);
      fireEvent.change(within(dialog).getByLabelText("Дата рождения"), { target: { value: birthDate } });
      submit();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(writes).toEqual([{ method: mode === "create" ? "POST" : "PATCH", birthDate }]);
    });

    it.each([
      ["", "Укажите дату рождения пациента."],
      ["1899-12-31", "Дата рождения выглядит слишком ранней."],
    ])("retains the existing rejection of %s", async (birthDate, message) => {
      const { dialog, writes, submit } = await openForm(mode);
      fireEvent.change(within(dialog).getByLabelText("Дата рождения"), { target: { value: birthDate } });
      submit();
      expect(within(dialog).getByRole("alert")).toHaveTextContent(message);
      expect(writes).toEqual([]);
    });

    it("uses the date at submission after local midnight, not when the form opened", async () => {
      vi.setSystemTime(new Date(2026, 0, 1, 23, 59));
      const { dialog, writes, submit } = await openForm(mode);
      fireEvent.change(within(dialog).getByLabelText("Дата рождения"), { target: { value: "2026-01-02" } });
      submit();
      expect(within(dialog).getByRole("alert")).toHaveTextContent("Дата рождения не может быть в будущем.");
      expect(writes).toEqual([]);
      vi.setSystemTime(new Date(2026, 0, 2, 0, 1));
      submit();
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(writes).toEqual([{ method: mode === "create" ? "POST" : "PATCH", birthDate: "2026-01-02" }]);
    });
  });
});
