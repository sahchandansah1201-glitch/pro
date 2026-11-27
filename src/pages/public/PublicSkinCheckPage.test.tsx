import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import PublicSkinCheckPage from "@/pages/public/PublicSkinCheckPage";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("Stage 7 PublicSkinCheckPage", () => {
  it("enforces CHILD_UNDER_18 guardian checkbox gate and shows zero user-facing quota limits", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/v1/public/onboarding/session")) {
        return new Response(
          JSON.stringify({
            sessionToken: "sd_onb_test_token_1234567890",
            quotaEnforced: false,
            profiles: [],
            clinics: [{ id: "10000000-0000-4000-8000-000000000001", slug: "main", name: "Клиника Дерматолог Про" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/v1/public/telegram/simulate")) {
        return new Response(
          JSON.stringify({
            fsmState: "S0_START",
            quotaEnforced: false,
            reply: {
              text: "Здравствуйте! Кому проверяем кожу?",
              buttons: [[{ text: "Себе", callbackData: "rel:SELF" }]],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    render(
      <MemoryRouter>
        <PublicSkinCheckPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Кому проверяем кожу\?/i)).toBeTruthy();
    expect(screen.getByText(/Ограничения по числу проверок для пользователей отключены/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Ребёнку \(до 18 лет\)/i }));
    fireEvent.click(screen.getByRole("button", { name: /Перейти к загрузке снимка/i }));

    expect(
      await screen.findByText(/Подтвердите галочкой статус родителя или законного представителя ребёнка/i),
    ).toBeTruthy();
  });
});
