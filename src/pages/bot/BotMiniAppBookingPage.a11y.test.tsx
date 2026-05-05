import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import BotMiniAppBookingPage from "./BotMiniAppBookingPage";
import { CLINICS } from "@/lib/mock-data";

const renderPage = () =>
  render(
    <MemoryRouter>
      <BotMiniAppBookingPage />
    </MemoryRouter>,
  );

describe("BotMiniAppBookingPage a11y", () => {
  it("ссылка 'Вернуться в бот' имеет aria-label", () => {
    renderPage();
    const back = screen.getByRole("link", { name: "Вернуться в бот" });
    expect(back).toHaveAttribute("href", "/bot-sim");
  });

  it("кнопки выбора клиники имеют type=button и доступны как role=button", () => {
    renderPage();
    const btn = screen.getByRole("button", { name: new RegExp(CLINICS[0].name) });
    expect(btn).toHaveAttribute("type", "button");
    expect(btn).not.toBeDisabled();
  });

  it("кнопка 'Продолжить' на шаге слота disabled, пока слот не выбран", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(CLINICS[0].name) }));
    const cont = screen.getByRole("button", { name: /Продолжить/ });
    expect(cont).toBeDisabled();
    const slot = screen.getAllByRole("button").find((b) => /\d{2}:\d{2}/.test(b.textContent ?? ""))!;
    fireEvent.click(slot);
    expect(screen.getByRole("button", { name: /Продолжить/ })).not.toBeDisabled();
  });

  it("блок 'Передача в /operator' помечен aria-disabled", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(CLINICS[0].name) }));
    const slot = screen.getAllByRole("button").find((b) => /\d{2}:\d{2}/.test(b.textContent ?? ""))!;
    fireEvent.click(slot);
    fireEvent.click(screen.getByRole("button", { name: /Продолжить/ }));
    fireEvent.click(screen.getByRole("button", { name: /Подтвердить демо-запись/ }));
    const stub = screen.getByText(/Передача в \/operator недоступна в демо/);
    expect(stub).toHaveAttribute("aria-disabled");
  });

  it("Tab перемещает фокус между кнопками клиник", async () => {
    const user = userEvent.setup();
    renderPage();
    const first = screen.getByRole("button", { name: new RegExp(CLINICS[0].name) });
    first.focus();
    expect(document.activeElement).toBe(first);
    await user.tab();
    const second = screen.getByRole("button", { name: new RegExp(CLINICS[1].name) });
    expect(document.activeElement).toBe(second);
  });

  it("кнопки навигации имеют достаточный tap-target (min-h-[44px])", () => {
    renderPage();
    const clinicBtn = screen.getByRole("button", { name: new RegExp(CLINICS[0].name) });
    expect(clinicBtn.className).toMatch(/min-h-\[44px\]/);
  });
});
