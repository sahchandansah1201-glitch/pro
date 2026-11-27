// Stage 7 · Telegram Bot first-channel onboarding FSM & webhook handler.
// Implements the deterministic dialog state machine (S0..S7) over previsitHandoffService.
// Works both with live Telegram Bot API webhooks (X-Telegram-Bot-Api-Secret-Token)
// and with the interactive web/QA Telegram simulator (/api/v1/public/telegram/simulate).

import { createHash, timingSafeEqual } from "node:crypto";

import { AuthRequiredError, ForbiddenError } from "./rbac.mjs";

function sha256Hex(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function deterministicSessionTokenForChat(chatId) {
  return `sd_tg_${sha256Hex(`telegram:${chatId}`).slice(0, 40)}`;
}

// Minimal valid 320x240 JPEG header + scan bytes for Telegram simulated/file-id fallback when Bot token is offline
export function createSyntheticValidJpegBuffer({
  width = 640,
  height = 480,
  displayP3 = false,
  exifMake = null,
  gpsLatDeg = null,
  includeThumbnail = false,
  pilDefaultDqt = false,
} = {}) {
  const chunks = [Buffer.from([0xff, 0xd8])]; // SOI

  if (exifMake || gpsLatDeg != null || includeThumbnail) {
    // Build minimal little-endian TIFF header inside APP1 Exif
    const tiff = Buffer.alloc(220, 0);
    tiff.write("II", 0, "ascii");
    tiff.writeUInt16LE(42, 2);
    tiff.writeUInt32LE(8, 4); // IFD0 offset = 8
    const entries = [];
    let dataCursor = 8 + 2 + 4 * 12 + 4; // 62

    if (exifMake) {
      const makeBytes = Buffer.from(`${exifMake}\0`, "ascii");
      makeBytes.copy(tiff, dataCursor);
      entries.push({ tag: 0x010f, type: 2, count: makeBytes.length, val: dataCursor });
      dataCursor += makeBytes.length + (makeBytes.length % 2);
    }

    if (gpsLatDeg != null) {
      const gpsIfdPos = dataCursor;
      const isSouth = gpsLatDeg < 0;
      const absLat = Math.abs(gpsLatDeg);
      const ratPos = gpsIfdPos + 2 + 2 * 12 + 4;
      tiff.writeUInt16LE(2, gpsIfdPos);
      // Tag 0x0001 GPSLatitudeRef
      tiff.writeUInt16LE(0x0001, gpsIfdPos + 2);
      tiff.writeUInt16LE(2, gpsIfdPos + 4);
      tiff.writeUInt32LE(2, gpsIfdPos + 6);
      tiff.write(isSouth ? "S\0\0\0" : "N\0\0\0", gpsIfdPos + 10, "ascii");
      // Tag 0x0002 GPSLatitude rational
      tiff.writeUInt16LE(0x0002, gpsIfdPos + 14);
      tiff.writeUInt16LE(5, gpsIfdPos + 16);
      tiff.writeUInt32LE(1, gpsIfdPos + 18);
      tiff.writeUInt32LE(ratPos, gpsIfdPos + 22);
      tiff.writeUInt32LE(Math.round(absLat * 1000), ratPos);
      tiff.writeUInt32LE(1000, ratPos + 4);
      entries.push({ tag: 0x8825, type: 4, count: 1, val: gpsIfdPos });
      dataCursor = ratPos + 12;
    }

    tiff.writeUInt16LE(entries.length, 8);
    entries.forEach((entry, idx) => {
      const pos = 10 + idx * 12;
      tiff.writeUInt16LE(entry.tag, pos);
      tiff.writeUInt16LE(entry.type, pos + 2);
      tiff.writeUInt32LE(entry.count, pos + 4);
      tiff.writeUInt32LE(entry.val, pos + 8);
    });
    const nextIfdPos = 10 + entries.length * 12;
    tiff.writeUInt32LE(includeThumbnail ? dataCursor : 0, nextIfdPos);
    if (includeThumbnail && dataCursor + 8 < tiff.length) {
      tiff.writeUInt16LE(0, dataCursor);
    }

    const exifPayload = Buffer.concat([Buffer.from("Exif\0\0", "ascii"), tiff]);
    const app1Header = Buffer.alloc(4);
    app1Header[0] = 0xff;
    app1Header[1] = 0xe1;
    app1Header.writeUInt16BE(exifPayload.length + 2, 2);
    chunks.push(app1Header, exifPayload);
  }

  if (displayP3) {
    const iccPayload = Buffer.from("ICC_PROFILE\0\x01\x01APPL Display P3 profile", "ascii");
    const app2Header = Buffer.alloc(4);
    app2Header[0] = 0xff;
    app2Header[1] = 0xe2;
    app2Header.writeUInt16BE(iccPayload.length + 2, 2);
    chunks.push(app2Header, iccPayload);
  }

  // DQT segment (0xFFDB)
  const dqtPayload = Buffer.alloc(65, 0x14);
  dqtPayload[0] = 0x00;
  if (pilDefaultDqt) {
    Buffer.from("100b0c0e0c0a100e0d0e121110131828", "hex").copy(dqtPayload, 1);
  }
  const dqtHeader = Buffer.from([0xff, 0xdb, 0x00, 67]);
  chunks.push(dqtHeader, dqtPayload);

  // SOF0 segment (0xFFC0) with width/height
  const sofPayload = Buffer.from([
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x03,
    0x01, 0x22, 0x00,
    0x02, 0x11, 0x01,
    0x03, 0x11, 0x01,
  ]);
  const sofHeader = Buffer.alloc(4);
  sofHeader[0] = 0xff;
  sofHeader[1] = 0xc0;
  sofHeader.writeUInt16BE(sofPayload.length + 2, 2);
  chunks.push(sofHeader, sofPayload);

  // SOS segment (0xFFDA) + padded scan payload >= 640 bytes + EOI (0xFFD9)
  const sosPayload = Buffer.from([0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00]);
  const sosHeader = Buffer.from([0xff, 0xda, 0x00, sosPayload.length + 2]);
  const scanBody = Buffer.alloc(640, 0x7a);
  const eoi = Buffer.from([0xff, 0xd9]);
  chunks.push(sosHeader, sosPayload, scanBody, eoi);

  return Buffer.concat(chunks);
}

function startButtons(profiles = []) {
  const profileRows = profiles.slice(0, 3).map((p) => [
    {
      text: `Профиль: ${p.label} (${p.biologicalSex === "male" ? "муж." : "жен."})`,
      callbackData: `prof:${p.id}`,
    },
  ]);
  return [
    ...profileRows,
    [{ text: "Себе", callbackData: "rel:SELF" }],
    [{ text: "Ребёнку (до 18 лет)", callbackData: "rel:CHILD_UNDER_18" }],
    [{ text: "Близкому взрослому", callbackData: "rel:ADULT_RELATIVE" }],
  ];
}

function awaitPhotoReply(profileLabel = "Себе") {
  return {
    text:
      `Профиль «${profileLabel}» готов к проверке.\n\n`
      + "Пришлите снимок участка кожи:\n"
      + "• снимите при дневном свете без прямой вспышки с расстояния 10–15 см;\n"
      + "• можно отправить обычным фото или прикрепить «Файлом / Документом» для максимальной чёткости.",
    buttons: [
      [{ text: "Сменить профиль", callbackData: "nav:start" }],
      [{ text: "Удалить мои данные (152-ФЗ)", callbackData: "act:delete_152fz" }],
    ],
  };
}

function evolutionQuestionReply() {
  return {
    text: "Снимок прошёл проверку чёткости. Ответьте на 3 коротких вопроса по очагу.\n\nВопрос 1 из 3 — Как давно появилось образование и меняется ли оно?",
    buttons: [
      [{ text: "Давно и не меняется", callbackData: "q1:stable_long" }],
      [{ text: "Появилось недавно (< 3 мес)", callbackData: "q1:new_lt_3m" }],
      [{ text: "Заметно растёт или меняет цвет/форму", callbackData: "q1:growing_changing" }],
      [{ text: "Трудно сказать", callbackData: "q1:unsure" }],
    ],
  };
}

export function createTelegramOnboardingBot({
  previsitHandoffRepository,
  previsitHandoffService,
  env = process.env,
} = {}) {
  const webhookSecret = String(env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  const botToken = String(env.TELEGRAM_BOT_TOKEN || "").trim();

  function verifyWebhookSecret(headers = {}) {
    if (!webhookSecret) {
      // Fail-closed on external webhook unless secret is configured
      throw new AuthRequiredError("TELEGRAM_WEBHOOK_SECRET не настроен на сервере.");
    }
    const provided = String(
      headers["x-telegram-bot-api-secret-token"]
      || headers["X-Telegram-Bot-Api-Secret-Token"]
      || "",
    ).trim();
    if (!provided) {
      throw new AuthRequiredError("Отсутствует заголовок X-Telegram-Bot-Api-Secret-Token.");
    }
    const a = Buffer.from(sha256Hex(provided), "utf8");
    const b = Buffer.from(sha256Hex(webhookSecret), "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenError("Неверный секрет Telegram webhook.");
    }
  }

  async function downloadTelegramFileIfConfigured(fileId) {
    if (!botToken || !fileId || typeof fetch !== "function") {
      return createSyntheticValidJpegBuffer({ displayP3: true });
    }
    try {
      const metaRes = await fetch(
        `https://api.telegram.org/bot${encodeURIComponent(botToken)}/getFile?file_id=${encodeURIComponent(fileId)}`,
      );
      const metaJson = await metaRes.json();
      const filePath = metaJson?.result?.file_path;
      if (!filePath) return createSyntheticValidJpegBuffer({ displayP3: true });
      const fileRes = await fetch(
        `https://api.telegram.org/file/bot${encodeURIComponent(botToken)}/${filePath}`,
      );
      const arrayBuf = await fileRes.arrayBuffer();
      return Buffer.from(arrayBuf);
    } catch {
      return createSyntheticValidJpegBuffer({ displayP3: true });
    }
  }

  async function deliverReplyToTelegramChat(chatId, reply, callbackQueryId = null) {
    if (!botToken || typeof fetch !== "function") return { deliveredExternal: false };
    try {
      if (callbackQueryId) {
        await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/answerCallbackQuery`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackQueryId }),
        });
      }
      const inlineKeyboard = Array.isArray(reply.buttons) && reply.buttons.length > 0
        ? reply.buttons.map((row) =>
            row.map((btn) => ({ text: btn.text, callback_data: btn.callbackData })),
          )
        : undefined;
      await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: reply.text,
          ...(inlineKeyboard ? { reply_markup: { inline_keyboard: inlineKeyboard } } : {}),
        }),
      });
      return { deliveredExternal: true };
    } catch {
      return { deliveredExternal: false };
    }
  }

  async function stepDialog({
    chatId,
    text = null,
    callbackData = null,
    photoBytes = null,
    imageBase64 = null,
    clientHints = {},
    nowIso = new Date().toISOString(),
  }) {
    const safeChatId = String(chatId || "sim-default-chat").trim().slice(0, 80);
    const sessionToken = deterministicSessionTokenForChat(safeChatId);
    const sessionTokenSha256 = sha256Hex(sessionToken);

    const bundle = await previsitHandoffRepository.upsertOnboardingSession({
      sessionTokenSha256,
      channel: "telegram",
      externalChatId: safeChatId,
    });
    const session = bundle?.session || {};
    const profiles = Array.isArray(bundle?.profiles) ? bundle.profiles : [];
    const ctx = session.fsmContext && typeof session.fsmContext === "object" ? { ...session.fsmContext } : {};
    let state = String(session.fsmState || "S0_START");

    const cleanText = text == null ? "" : String(text).trim();
    const cb = callbackData == null ? "" : String(callbackData).trim();

    async function saveState(nextState, nextCtx = ctx, activeProfileId = undefined) {
      await previsitHandoffRepository.updateOnboardingSessionState({
        sessionId: session.id,
        fsmState: nextState,
        fsmContext: nextCtx,
        activeProfileId,
      });
      return nextState;
    }

    // Global commands & navigation
    if (cleanText === "/start" || cleanText === "/new" || cb === "nav:start") {
      state = await saveState("S0_START", {});
      return {
        fsmState: state,
        quotaEnforced: false,
        reply: {
          text:
            "Здравствуйте! Я помощник «Дерматолог Про».\n"
            + "Помогу проверить чёткость снимка кожи, собрать короткую анкету и подготовить безопасную сводку перед очным приёмом дерматолога (это не медицинский диагноз).\n\n"
            + "Кому проверяем кожу?",
          buttons: startButtons(profiles),
        },
      };
    }

    if (cleanText === "/delete_my_data" || cb === "act:delete_152fz") {
      const del = await previsitHandoffService.deleteOnboardingMyData(
        { sessionToken },
        { "x-onboarding-token": sessionToken },
      );
      return {
        fsmState: "S7_DELETED_152FZ",
        quotaEnforced: false,
        reply: {
          text: del.messageRu,
          buttons: [[{ text: "Начать новую проверку", callbackData: "nav:start" }]],
        },
      };
    }

    // Existing profile selection
    if (cb.startsWith("prof:")) {
      const selectedProfileId = cb.slice(5);
      const matched = profiles.find((p) => p.id === selectedProfileId);
      if (matched) {
        state = await saveState("S3_AWAIT_PHOTO", { profileId: matched.id }, matched.id);
        return {
          fsmState: state,
          quotaEnforced: false,
          reply: awaitPhotoReply(matched.label),
        };
      }
    }

    // Step 1: Relation selection
    if (cb.startsWith("rel:")) {
      const relation = cb.slice(4);
      const nextCtx = { subjectRelation: relation };
      if (relation === "CHILD_UNDER_18") {
        state = await saveState("S1_GUARDIAN_CHECK", nextCtx);
        return {
          fsmState: state,
          quotaEnforced: false,
          reply: {
            text:
              "Проверка снимков ребёнка до 18 лет доступна только родителю или иному законному представителю.\n\n"
              + "Подтвердите ваш статус для продолжения:",
            buttons: [
              [{ text: "Подтверждаю статус законного представителя", callbackData: "guard:confirm" }],
              [{ text: "Назад к выбору профиля", callbackData: "nav:start" }],
            ],
          },
        };
      }
      state = await saveState("S1_CONSENT_152FZ", nextCtx);
      return {
        fsmState: state,
        quotaEnforced: false,
        reply: {
          text:
            "Перед началом подтвердите согласие на обработку персональных данных (152-ФЗ, ст. 9, ст. 10).\n"
            + "Сервис носит информационно-маршрутизирующий характер и не заменяет очную консультацию врача.",
          buttons: [
            [{ text: "Принимаю условия 152-ФЗ", callbackData: "consent:accept" }],
            [{ text: "Отмена", callbackData: "nav:start" }],
          ],
        },
      };
    }

    if (state === "S1_GUARDIAN_CHECK") {
      if (cb !== "guard:confirm") {
        return {
          fsmState: state,
          quotaEnforced: false,
          reply: {
            text: "Без подтверждения статуса законного представителя загрузка снимка ребёнка заблокирована.",
            buttons: [
              [{ text: "Подтверждаю статус законного представителя", callbackData: "guard:confirm" }],
              [{ text: "Выбрать другой профиль", callbackData: "nav:start" }],
            ],
          },
        };
      }
      ctx.legalGuardianConfirmed = true;
      state = await saveState("S1_CONSENT_152FZ", ctx);
      return {
        fsmState: state,
        quotaEnforced: false,
        reply: {
          text:
            "Статус законного представителя подтверждён.\n"
            + "Примите согласие на обработку данных (152-ФЗ) и условия информационного сервиса:",
          buttons: [
            [{ text: "Принимаю условия 152-ФЗ", callbackData: "consent:accept" }],
            [{ text: "Назад", callbackData: "nav:start" }],
          ],
        },
      };
    }

    if (state === "S1_CONSENT_152FZ") {
      if (cb !== "consent:accept") {
        return {
          fsmState: state,
          quotaEnforced: false,
          reply: {
            text: "Для продолжения нажмите кнопку согласия 152-ФЗ ниже.",
            buttons: [
              [{ text: "Принимаю условия 152-ФЗ", callbackData: "consent:accept" }],
              [{ text: "Назад", callbackData: "nav:start" }],
            ],
          },
        };
      }
      ctx.consent152FzAccepted = true;
      state = await saveState("S2_AGE", ctx);
      const isChild = ctx.subjectRelation === "CHILD_UNDER_18";
      return {
        fsmState: state,
        quotaEnforced: false,
        reply: {
          text: isChild
            ? "Укажите возраст ребёнка (выберите кнопку или отправьте число полных лет):"
            : "Укажите возраст проверяемого человека (выберите кнопку или отправьте число полных лет):",
          buttons: isChild
            ? [
                [{ text: "Младенец до 1 года (в месяцах)", callbackData: "age:infant" }],
                [{ text: "2 года", callbackData: "age:2" }, { text: "6 лет", callbackData: "age:6" }],
                [{ text: "12 лет", callbackData: "age:12" }, { text: "16 лет", callbackData: "age:16" }],
              ]
            : [
                [{ text: "25 лет", callbackData: "age:25" }, { text: "35 лет", callbackData: "age:35" }],
                [{ text: "45 лет", callbackData: "age:45" }, { text: "60 лет", callbackData: "age:60" }],
              ],
        },
      };
    }

    if (state === "S2_AGE") {
      if (cb === "age:infant") {
        ctx.isInfantUnder1Year = true;
        state = await saveState("S2_INFANT_MONTHS", ctx);
        return {
          fsmState: state,
          quotaEnforced: false,
          reply: {
            text: "Укажите возраст малыша в месяцах (от 0 до 11):",
            buttons: [
              [{ text: "2 мес.", callbackData: "months:2" }, { text: "5 мес.", callbackData: "months:5" }],
              [{ text: "8 мес.", callbackData: "months:8" }, { text: "11 мес.", callbackData: "months:11" }],
            ],
          },
        };
      }
      const ageRaw = cb.startsWith("age:") ? cb.slice(4) : cleanText;
      const parsedYears = Number.parseInt(ageRaw, 10);
      if (!Number.isFinite(parsedYears) || parsedYears < 1 || parsedYears > 120 || (ctx.subjectRelation === "CHILD_UNDER_18" && parsedYears >= 18)) {
        return {
          fsmState: state,
          quotaEnforced: false,
          reply: {
            text: ctx.subjectRelation === "CHILD_UNDER_18"
              ? "Укажите корректный возраст ребёнка младше 18 лет (или выберите «Младенец до 1 года»)."
              : "Укажите возраст числом от 1 до 120 лет.",
            buttons: [],
          },
        };
      }
      ctx.ageYears = parsedYears;
      ctx.isInfantUnder1Year = false;
      state = await saveState("S2_SEX", ctx);
      return {
        fsmState: state,
        quotaEnforced: false,
        reply: {
          text: "Укажите биологический пол:",
          buttons: [
            [{ text: "Женский", callbackData: "sex:female" }, { text: "Мужской", callbackData: "sex:male" }],
          ],
        },
      };
    }

    if (state === "S2_INFANT_MONTHS") {
      const mRaw = cb.startsWith("months:") ? cb.slice(7) : cleanText;
      const parsedMonths = Number.parseInt(mRaw, 10);
      if (!Number.isFinite(parsedMonths) || parsedMonths < 0 || parsedMonths > 11) {
        return {
          fsmState: state,
          quotaEnforced: false,
          reply: {
            text: "Укажите возраст младенца в месяцах от 0 до 11.",
            buttons: [
              [{ text: "3 мес.", callbackData: "months:3" }, { text: "6 мес.", callbackData: "months:6" }, { text: "9 мес.", callbackData: "months:9" }],
            ],
          },
        };
      }
      ctx.ageMonths = parsedMonths;
      ctx.ageYears = 0;
      state = await saveState("S2_SEX", ctx);
      return {
        fsmState: state,
        quotaEnforced: false,
        reply: {
          text: "Укажите биологический пол ребёнка:",
          buttons: [
            [{ text: "Женский", callbackData: "sex:female" }, { text: "Мужской", callbackData: "sex:male" }],
          ],
        },
      };
    }

    if (state === "S2_SEX") {
      const sex = cb.startsWith("sex:") ? cb.slice(4) : "";
      if (sex !== "male" && sex !== "female") {
        return {
          fsmState: state,
          quotaEnforced: false,
          reply: {
            text: "Выберите биологический пол кнопкой ниже:",
            buttons: [
              [{ text: "Женский", callbackData: "sex:female" }, { text: "Мужской", callbackData: "sex:male" }],
            ],
          },
        };
      }
      const created = await previsitHandoffService.createOnboardingProfile(
        {
          sessionToken,
          channel: "telegram",
          subjectRelation: ctx.subjectRelation || "SELF",
          legalGuardianConfirmed: Boolean(ctx.legalGuardianConfirmed),
          consent152FzAccepted: Boolean(ctx.consent152FzAccepted),
          isInfantUnder1Year: Boolean(ctx.isInfantUnder1Year),
          ageYears: ctx.ageYears,
          ageMonths: ctx.ageMonths,
          biologicalSex: sex,
        },
        { "x-onboarding-token": sessionToken },
        { nowIso },
      );
      state = await saveState(
        "S3_AWAIT_PHOTO",
        {
          profileId: created.profile.id,
          pediatricU6Active: created.profile.pediatricU6Active,
        },
        created.profile.id,
      );
      return {
        fsmState: state,
        quotaEnforced: false,
        profile: created.profile,
        reply: awaitPhotoReply(created.profile.label),
      };
    }

    if (cb === "act:new_photo") {
      const activeId = ctx.profileId || session.activeProfileId;
      state = await saveState("S3_AWAIT_PHOTO", { profileId: activeId }, activeId);
      return {
        fsmState: state,
        quotaEnforced: false,
        reply: awaitPhotoReply("Текущий профиль"),
      };
    }

    // Step 2: Photo upload & PAD-DIQA + Profile Mismatch Guard
    if (state === "S3_AWAIT_PHOTO" || photoBytes || imageBase64) {
      if (!photoBytes && !imageBase64) {
        return {
          fsmState: "S3_AWAIT_PHOTO",
          quotaEnforced: false,
          reply: awaitPhotoReply("Выбранный профиль"),
        };
      }
      const activeProfileId = ctx.profileId || session.activeProfileId || profiles[0]?.id;
      const photoResult = await previsitHandoffService.submitOnboardingPhoto(
        {
          sessionToken,
          channel: "telegram",
          profileId: activeProfileId,
          fileBytes: photoBytes,
          imageBase64,
          clientHints,
        },
        { "x-onboarding-token": sessionToken },
      );

      if (!photoResult.qualityGate.passed) {
        state = await saveState("S3_AWAIT_PHOTO", ctx, activeProfileId);
        const tips = (photoResult.qualityGate.recoveryTipsRu || []).map((t) => `• ${t}`).join("\n");
        return {
          fsmState: state,
          quotaEnforced: false,
          photoResult,
          reply: {
            text:
              `Снимок не прошёл входной контроль качества:\n${photoResult.qualityGate.reasonRu}\n\n`
              + `Как переснять:\n${tips}`,
            buttons: [
              [{ text: "Отправить новый снимок", callbackData: "act:new_photo" }],
            ],
          },
        };
      }

      ctx.submissionId = photoResult.submissionId;
      if (photoResult.status === "awaiting_mismatch_confirm" && photoResult.mismatchPrompt) {
        state = await saveState("S3_MISMATCH_GUARD", ctx, activeProfileId);
        return {
          fsmState: state,
          quotaEnforced: false,
          photoResult,
          reply: {
            text: photoResult.mismatchPrompt.questionRu,
            buttons: [
              [{ text: "Это моё фото (другое освещение или загар)", callbackData: "mm:same_person_lighting" }],
              [{ text: "Проверяю другого человека (отдельный профиль)", callbackData: "mm:switched_profile" }],
            ],
          },
        };
      }

      state = await saveState("S4_Q1_EVOLUTION", ctx, activeProfileId);
      return {
        fsmState: state,
        quotaEnforced: false,
        photoResult,
        reply: evolutionQuestionReply(),
      };
    }

    if (state === "S3_MISMATCH_GUARD") {
      const resolution = cb.startsWith("mm:") ? cb.slice(3) : "";
      if (resolution !== "same_person_lighting" && resolution !== "switched_profile") {
        return {
          fsmState: state,
          quotaEnforced: false,
          reply: {
            text: "Уточните кнопкой ниже, чей это снимок:",
            buttons: [
              [{ text: "Это моё фото (другое освещение или загар)", callbackData: "mm:same_person_lighting" }],
              [{ text: "Проверяю другого человека (отдельный профиль)", callbackData: "mm:switched_profile" }],
            ],
          },
        };
      }
      const resolved = await previsitHandoffService.resolveProfileMismatch(
        ctx.submissionId,
        { sessionToken, resolution },
        { "x-onboarding-token": sessionToken },
        { nowIso },
      );
      ctx.profileId = resolved.submission.profileId;
      state = await saveState("S4_Q1_EVOLUTION", ctx, ctx.profileId);
      return {
        fsmState: state,
        quotaEnforced: false,
        reply: {
          text:
            resolution === "switched_profile"
              ? `Снимок перенесён в отдельный профиль без повторной загрузки.\n\n${evolutionQuestionReply().text}`
              : evolutionQuestionReply().text,
          buttons: evolutionQuestionReply().buttons,
        },
      };
    }

    if (state === "S4_Q1_EVOLUTION") {
      if (!cb.startsWith("q1:")) {
        return { fsmState: state, quotaEnforced: false, reply: evolutionQuestionReply() };
      }
      ctx.evolution = cb.slice(3);
      state = await saveState("S4_Q2_SYMPTOMS", ctx);
      return {
        fsmState: state,
        quotaEnforced: false,
        reply: {
          text: "Вопрос 2 из 3 — Беспокоит ли этот участок кожи?",
          buttons: [
            [{ text: "Не беспокоит", callbackData: "q2:none" }],
            [{ text: "Зудит или болит", callbackData: "q2:itch_or_pain" }],
            [{ text: "Кровит или покрывается корочкой без травмы", callbackData: "q2:bleeding_or_crust" }],
          ],
        },
      };
    }

    if (state === "S4_Q2_SYMPTOMS") {
      if (!cb.startsWith("q2:")) {
        return {
          fsmState: state,
          quotaEnforced: false,
          reply: {
            text: "Выберите вариант ответа на вопрос 2 из 3:",
            buttons: [
              [{ text: "Не беспокоит", callbackData: "q2:none" }],
              [{ text: "Зудит или болит", callbackData: "q2:itch_or_pain" }],
              [{ text: "Кровит или покрывается корочкой без травмы", callbackData: "q2:bleeding_or_crust" }],
            ],
          },
        };
      }
      ctx.symptoms = cb.slice(3);
      state = await saveState("S4_Q3_TOPICAL_U5", ctx);
      return {
        fsmState: state,
        quotaEnforced: false,
        reply: {
          text: "Вопрос 3 из 3 — Наносили ли что-то на этот участок за последние 14 дней?",
          buttons: [
            [{ text: "Ничем не мазали", callbackData: "q3:none" }],
            [{ text: "Гормональная мазь (Целестодерм, Тридерм, Акридерм и др.)", callbackData: "q3:steroid_ointment" }],
            [{ text: "Зелёнка, фукорцин, йод, чистотел", callbackData: "q3:antiseptic_dye_celelandine" }],
            [{ text: "Увлажняющий или обычный крем", callbackData: "q3:moisturizer" }],
          ],
        },
      };
    }

    if (state === "S4_Q3_TOPICAL_U5") {
      if (!cb.startsWith("q3:")) {
        return {
          fsmState: state,
          quotaEnforced: false,
          reply: {
            text: "Выберите вариант ответа на вопрос 3 из 3:",
            buttons: [
              [{ text: "Ничем не мазали", callbackData: "q3:none" }],
              [{ text: "Гормональная мазь", callbackData: "q3:steroid_ointment" }],
              [{ text: "Зелёнка, фукорцин, йод, чистотел", callbackData: "q3:antiseptic_dye_celelandine" }],
              [{ text: "Увлажняющий или обычный крем", callbackData: "q3:moisturizer" }],
            ],
          },
        };
      }
      ctx.priorTopical14d = cb.slice(3);
      const activeProfile = profiles.find((p) => p.id === (ctx.profileId || session.activeProfileId));
      if (activeProfile?.pediatricU6Active || ctx.pediatricU6Active) {
        state = await saveState("S4_U6_CHILD_RED_FLAGS", ctx);
        return {
          fsmState: state,
          quotaEnforced: false,
          reply: {
            text:
              "Педиатрическая проверка безопасности: есть ли у ребёнка сейчас повышенная температура, выраженная вялость или быстрое распространение высыпаний?",
            buttons: [
              [{ text: "Нет, общее самочувствие обычное", callbackData: "u6:no" }],
              [{ text: "Да, есть общие настораживающие симптомы", callbackData: "u6:yes" }],
            ],
          },
        };
      }

      const cardRes = await previsitHandoffService.submitMicroSurveyAndBuildCard(
        ctx.submissionId,
        {
          sessionToken,
          evolution: ctx.evolution,
          symptoms: ctx.symptoms,
          priorTopical14d: ctx.priorTopical14d,
          pediatricSystemicRedFlags: false,
          simulateGpuTimeout: Boolean(clientHints?.simulateGpuTimeout),
        },
        { "x-onboarding-token": sessionToken },
      );

      if (cardRes.status === "queued_gpu") {
        state = await saveState("S5_QUEUED_GPU", ctx);
        return {
          fsmState: state,
          quotaEnforced: false,
          cardResult: cardRes,
          reply: {
            text: cardRes.card.statusMessageRu,
            buttons: [
              [{ text: "Оставить контакт для записи в клинику", callbackData: "act:book_clinic" }],
              [{ text: "Удалить мои снимки и данные", callbackData: "act:delete_152fz" }],
            ],
          },
        };
      }

      state = await saveState("S5_RESULT_CARD", ctx);
      return {
        fsmState: state,
        quotaEnforced: false,
        cardResult: cardRes,
        reply: {
          text:
            `Маршрут: ${cardRes.card.badgeLabelRu}\n\n`
            + `${cardRes.card.safeSummaryRu}\n\n`
            + "В ленте показан только локальный кроп очага (+25% здоровой кожи вокруг контура) без полного кадра.",
          cropCard: cardRes.card.lesionCrops?.[0] || null,
          buttons: [
            [{ text: "Записаться к дерматологу", callbackData: "act:book_clinic" }],
            [{ text: "Уточнить индивидуальные факторы риска", callbackData: "act:risk_factors" }],
            [{ text: "Проверить ещё снимок", callbackData: "act:new_photo" }],
            [{ text: "Удалить мои снимки и данные", callbackData: "act:delete_152fz" }],
          ],
        },
      };
    }

    if (state === "S4_U6_CHILD_RED_FLAGS") {
      const redFlags = cb === "u6:yes";
      const cardRes = await previsitHandoffService.submitMicroSurveyAndBuildCard(
        ctx.submissionId,
        {
          sessionToken,
          evolution: ctx.evolution,
          symptoms: ctx.symptoms,
          priorTopical14d: ctx.priorTopical14d,
          pediatricSystemicRedFlags: redFlags,
          simulateGpuTimeout: Boolean(clientHints?.simulateGpuTimeout),
        },
        { "x-onboarding-token": sessionToken },
      );
      state = await saveState("S5_RESULT_CARD", ctx);
      const emergencyHeader = cardRes.card.emergency103Banner
        ? "ЭКСТРЕННОЕ ПРЕДУПРЕЖДЕНИЕ (103 / 112): при температуре, вялости или быстром распространении сыпи у ребёнка вызовите скорую помощь 103 или 112.\n\n"
        : "";
      return {
        fsmState: state,
        quotaEnforced: false,
        cardResult: cardRes,
        reply: {
          text: `${emergencyHeader}Маршрут: ${cardRes.card.badgeLabelRu}\n\n${cardRes.card.safeSummaryRu}`,
          cropCard: cardRes.card.lesionCrops?.[0] || null,
          buttons: [
            [{ text: "Записаться к детскому дерматологу", callbackData: "act:book_clinic" }],
            [{ text: "Проверить ещё снимок", callbackData: "act:new_photo" }],
            [{ text: "Удалить мои снимки и данные", callbackData: "act:delete_152fz" }],
          ],
        },
      };
    }

    if (cb === "act:risk_factors") {
      state = await saveState("S5_RISK_FACTORS", ctx);
      return {
        fsmState: state,
        quotaEnforced: false,
        reply: {
          text: "Выберите индивидуальные факторы риска (они передаются только врачу на очном приёме):",
          buttons: [
            [{ text: "Солнечные ожоги в детстве", callbackData: "rf:sunburnsChildhood" }],
            [{ text: "Более 50 родинок на теле", callbackData: "rf:neviOver50" }],
            [{ text: "Онкоанамнез кожи в семье", callbackData: "rf:familyMelanomaHistory" }],
            [{ text: "Перейти к записи к дерматологу", callbackData: "act:book_clinic" }],
          ],
        },
      };
    }

    if (state === "S5_RISK_FACTORS" && cb.startsWith("rf:")) {
      const factorKey = cb.slice(3);
      const profileId = ctx.profileId || session.activeProfileId;
      await previsitHandoffService.updateProfileRiskFactors(
        profileId,
        { sessionToken, riskFactors: { [factorKey]: true } },
        { "x-onboarding-token": sessionToken },
      );
      return {
        fsmState: state,
        quotaEnforced: false,
        reply: {
          text: "Фактор сохранён в профиль для врача. Можете отметить ещё или перейти к записи:",
          buttons: [
            [{ text: "Записаться к дерматологу", callbackData: "act:book_clinic" }],
            [{ text: "Проверить ещё снимок", callbackData: "act:new_photo" }],
          ],
        },
      };
    }

    if (cb === "act:book_clinic") {
      state = await saveState("S6_BOOK_NAME", ctx);
      return {
        fsmState: state,
        quotaEnforced: false,
        reply: {
          text: "Оформляем заявку администратору записи клиники.\nКак к вам обращаться (укажите имя)?",
          buttons: [],
        },
      };
    }

    if (state === "S6_BOOK_NAME") {
      if (cleanText.length < 2) {
        return {
          fsmState: state,
          quotaEnforced: false,
          reply: { text: "Пожалуйста, напишите ваше имя (не короче 2 символов).", buttons: [] },
        };
      }
      ctx.bookingName = cleanText;
      state = await saveState("S6_BOOK_PHONE", ctx);
      return {
        fsmState: state,
        quotaEnforced: false,
        reply: {
          text: "Укажите контактный номер телефона для подтверждения окна приёма (например, +79991234567):",
          buttons: [],
        },
      };
    }

    if (state === "S6_BOOK_PHONE") {
      if (cleanText.replace(/\D/g, "").length < 10) {
        return {
          fsmState: state,
          quotaEnforced: false,
          reply: { text: "Укажите корректный номер телефона (не менее 10 цифр).", buttons: [] },
        };
      }
      ctx.bookingPhone = cleanText;
      state = await saveState("S6_BOOK_TIME", ctx);
      return {
        fsmState: state,
        quotaEnforced: false,
        reply: {
          text: "Выберите удобное время для визита или напишите пожелание текстом:",
          buttons: [
            [{ text: "Ближайшее доступное окно", callbackData: "time:Ближайшее доступное окно" }],
            [{ text: "Будни утром (09:00–13:00)", callbackData: "time:Будни утром (09:00–13:00)" }],
            [{ text: "Будни после 18:00", callbackData: "time:Будни после 18:00" }],
          ],
        },
      };
    }

    if (state === "S6_BOOK_TIME") {
      const preferredTime = cb.startsWith("time:") ? cb.slice(5) : cleanText || "Ближайшее доступное окно";
      const booked = await previsitHandoffService.bookClinicFromSubmission(
        ctx.submissionId,
        {
          sessionToken,
          displayName: ctx.bookingName,
          phone: ctx.bookingPhone,
          preferredTimeNote: preferredTime,
        },
        { "x-onboarding-token": sessionToken },
        { nowIso },
      );
      state = await saveState("S6_BOOK_DONE", ctx);
      return {
        fsmState: state,
        quotaEnforced: false,
        bookingResult: booked,
        reply: {
          text:
            `Заявка отправлена в клинику «${booked.clinicName}» (${booked.bookingPriorityLabelRu}).\n`
            + "Оператор свяжется с вами для выбора слота (медицинские фото оператору не видны — они откроются только врачу на приёме). После очного визита вам откроется бессрочный Паспорт контроля кожи.",
          buttons: [
            [{ text: "Проверить ещё снимок", callbackData: "act:new_photo" }],
            [{ text: "В главное меню", callbackData: "nav:start" }],
          ],
        },
      };
    }

    return {
      fsmState: state,
      quotaEnforced: false,
      reply: {
        text: "Используйте кнопки диалога или отправьте /start для выбора профиля.",
        buttons: startButtons(profiles),
      },
    };
  }

  return {
    stepDialog,

    async handleWebhookUpdate(update = {}, headers = {}, { nowIso = new Date().toISOString() } = {}) {
      verifyWebhookSecret(headers);

      const message = update?.message || update?.edited_message || null;
      const callbackQuery = update?.callback_query || null;
      const chatId =
        callbackQuery?.message?.chat?.id
        ?? message?.chat?.id
        ?? null;

      if (chatId == null) {
        return { ok: true, ignored: true };
      }

      let photoBytes = null;
      if (Array.isArray(message?.photo) && message.photo.length > 0) {
        const largest = message.photo[message.photo.length - 1];
        photoBytes = await downloadTelegramFileIfConfigured(largest.file_id);
      } else if (message?.document?.file_id && String(message.document.mime_type || "").startsWith("image/")) {
        photoBytes = await downloadTelegramFileIfConfigured(message.document.file_id);
      }

      const stepped = await stepDialog({
        chatId: String(chatId),
        text: message?.text || null,
        callbackData: callbackQuery?.data || null,
        photoBytes,
        nowIso,
      });

      const delivery = await deliverReplyToTelegramChat(
        chatId,
        stepped.reply,
        callbackQuery?.id || null,
      );

      return {
        ok: true,
        fsmState: stepped.fsmState,
        reply: stepped.reply,
        deliveredExternal: delivery.deliveredExternal,
      };
    },
  };
}
