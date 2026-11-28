import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import PublicSkinCheckPage from "@/pages/public/PublicSkinCheckPage";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("Stage 7B PublicSkinCheckPage (Miro Photo-First Funnel & Telegram 2x3 Menu)", () => {
  it("starts directly with photo-first instruction (no upfront questionnaire), captures Name+Phone post-photo, enforces child <18 guardian gate, and supports 1-tap booking", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/api/v1/public/onboarding/flow-config")) {
        return new Response(
          JSON.stringify({
            item: {
              configKey: "default",
              flowRules: { lowRiskFollowupDays: 30, photoWaitNudgeMinutes: 4 },
            },
            instructionVisualSvgDataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
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
      if (url.includes("/api/v1/public/onboarding/photos")) {
        return new Response(
          JSON.stringify({
            submissionId: "90000000-0000-4000-8000-000000000011",
            profileId: "90000000-0000-4000-8000-000000000022",
            status: "awaiting_micro_survey",
            quotaEnforced: false,
            qualityGate: { passed: true, score0To100: 92, rejectCode: null, reasonRu: "Ок", recoveryTipsRu: [] },
            analysisStagesVisuals: {
              step1DetectionSvgDataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
              step2AttentionSvgDataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
            },
            phototypeEstimate: { itaDegrees: 46.2, fitzpatrickBand: "II", profileMismatchTriggered: false, deltaItaFromProfile: null },
            mismatchPrompt: null,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/survey")) {
        return new Response(
          JSON.stringify({
            submissionId: "90000000-0000-4000-8000-000000000011",
            status: "ready",
            quotaEnforced: false,
            card: {
              queued: false,
              trafficLight: "GREEN_LOW",
              routingCategory: "ROUTINE_FOLLOWUP",
              bookingPriority: "PLANNED_STANDARD",
              safeSummaryRu: "Спокойная картина участка кожи — рекомендуется плановый фотоконтроль через 30 дней.",
              followupDays: 30,
              followupTimerMessageRu: "Запущено напоминание на 30 дней.",
              lesionCrops: [
                {
                  lesionIndex: 1,
                  title: "Участок №1",
                  cropSvgDataUrl: "data:image/svg+xml;base64,PHN2Zy8+",
                  surroundingSkinMarginPercent: 25,
                  qualityScore0To100: 92,
                  safeSummary: "Ок",
                },
              ],
              primaryCtaLabelRu: "Записаться на приём сейчас",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/book")) {
        return new Response(
          JSON.stringify({
            booked: true,
            handoffCaseCode: "SD-20261128-001",
            clinicName: "Клиника Дерматолог Про",
            bookingPriority: "PLANNED_STANDARD",
            bookingPriorityLabelRu: "Плановая запись",
            messageRu: "Заявка успешно отправлена в клинику",
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      }
      if (url.includes("/api/v1/public/telegram/simulate")) {
        return new Response(
          JSON.stringify({
            fsmState: "M0_WELCOME",
            quotaEnforced: false,
            persistentMenu: [
              ["Новый анализ", "Инструкция"],
              ["Зачем это?", "Техподдержка"],
              ["Помощь", "О проекте"],
            ],
            reply: {
              text: "Привет! Нажми Меню -> Новый анализ",
              buttons: [[{ text: "Меню", callbackData: "menu:open" }]],
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

    // 1. Photo-first start screen (no upfront age/sex questionnaire)
    expect(await screen.findByText(/Правильное фото — точный результат!/i)).toBeTruthy();
    expect(screen.getByText(/Ограничения по числу проверок для пользователей отключены/i)).toBeTruthy();

    // 2. Click test photo upload -> moves to Post-Photo Lead & Profile screen
    fireEvent.click(screen.getByRole("button", { name: /Проверить сценарий на тестовом чётком снимке/i }));
    expect(await screen.findByText(/Пока готовится карточка результата — представьтесь/i)).toBeTruthy();

    // 3. Fill Name, Phone, and child age < 18 without guardian checkbox -> blocked!
    fireEvent.change(screen.getByLabelText(/Как Вас зовут/i), { target: { value: "Анна" } });
    fireEvent.change(screen.getByLabelText(/По какому номеру телефона/i), {
      target: { value: "+7 999 555-44-33" },
    });
    fireEvent.change(screen.getByLabelText(/Возраст пациента/i), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: /Показать результат проверки/i }));

    expect(
      await screen.findByText(/Подтвердите галочкой статус родителя или законного представителя ребёнка/i),
    ).toBeTruthy();

    // 4. Confirm guardian checkbox -> reveals traffic-light result + 1-tap clinic booking!
    fireEvent.click(screen.getByRole("checkbox", { name: /Подтверждаю, что являюсь родителем/i }));
    fireEvent.click(screen.getByRole("button", { name: /Показать результат проверки/i }));

    expect(await screen.findByText(/✅ Низкий уровень/i)).toBeTruthy();
    expect(screen.getByText(/Запущено напоминание на 30 дней/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Записаться на приём сейчас/i }));
    expect(await screen.findByText(/Заявка успешно отправлена в клинику/i)).toBeTruthy();
  });
});
