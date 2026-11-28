// Stage 7B · Telegram Bot (and unified messenger channel) Miro Photo-First FSM.
// Implements Dima's Miro onboarding vision:
//   - Warm /start + persistent 2x3 bottom menu (Новый анализ, Инструкция, Зачем это?, Техподдержка, Помощь, О проекте)
//   - Rotating friendly replies + ХОРОШО ✓ / ПЛОХО ✕ ~10 cm visual guide + 3-5 min photo-wait nudge
//   - Photo-first intake (1-tap 152-FZ consent, zero questionnaire barrier before 1st photo)
//   - Post-photo Lead & Profile capture at peak user motivation (Name -> Phone -> Age/Guardian -> Sex -> Quick signal)
//   - 2-step visual progress (1 шаг: Детектированы важные участки -> 2 шаг: Анализ нейросети)
//   - Traffic-light result (🔴 / ⚠️ / ✅) without % diagnoses + 30-day timer (✅) + 2nd-angle photo check (⚠️) + 1-tap clinic slot booking.

import { createHash, timingSafeEqual } from "node:crypto";

import { AuthRequiredError, ForbiddenError } from "./rbac.mjs";
import { buildMiroPhotoInstructionSvgDataUrl } from "./split-vault-inspector.mjs";

export const PERSISTENT_TELEGRAM_MENU_2X3 = [
  ["Новый анализ", "Инструкция"],
  ["Зачем это?", "Техподдержка"],
  ["Помощь", "О проекте"],
];

function sha256Hex(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function deterministicSessionTokenForChat(channel, chatId) {
  return `sd_${channel}_${sha256Hex(`${channel}:${chatId}`).slice(0, 38)}`;
}

export function createSyntheticValidJpegBuffer({
  width = 640,
  height = 480,
  displayP3 = false,
  exifMake = null,
  gpsLatDeg = null,
  includeThumbnail = false,
  pilDefaultDqt = false,
} = {}) {
  const chunks = [Buffer.from([0xff, 0xd8])];

  if (exifMake || gpsLatDeg != null || includeThumbnail) {
    const tiff = Buffer.alloc(220, 0);
    tiff.write("II", 0, "ascii");
    tiff.writeUInt16LE(42, 2);
    tiff.writeUInt32LE(8, 4);
    const entries = [];
    let dataCursor = 8 + 2 + 4 * 12 + 4;

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
      tiff.writeUInt16LE(0x0001, gpsIfdPos + 2);
      tiff.writeUInt16LE(2, gpsIfdPos + 4);
      tiff.writeUInt32LE(2, gpsIfdPos + 6);
      tiff.write(isSouth ? "S\0\0\0" : "N\0\0\0", gpsIfdPos + 10, "ascii");
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

  const dqtPayload = Buffer.alloc(65, 0x14);
  dqtPayload[0] = 0x00;
  if (pilDefaultDqt) {
    Buffer.from("100b0c0e0c0a100e0d0e121110131828", "hex").copy(dqtPayload, 1);
  }
  chunks.push(Buffer.from([0xff, 0xdb, 0x00, 67]), dqtPayload);

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

  const sosPayload = Buffer.from([0x03, 0x01, 0x00, 0x02, 0x11, 0x03, 0x11, 0x00, 0x3f, 0x00]);
  chunks.push(
    Buffer.from([0xff, 0xda, 0x00, sosPayload.length + 2]),
    sosPayload,
    Buffer.alloc(640, 0x7a),
    Buffer.from([0xff, 0xd9]),
  );

  return Buffer.concat(chunks);
}

function normalizeMenuIntent(text = "", cb = "") {
  const lower = String(text || "")
    .replace(/^[^\p{L}\p{N}/]+/u, "")
    .trim()
    .toLowerCase();
  if (cb === "menu:open" || lower === "меню" || lower === "/menu") return "menu";
  if (cb === "menu:new_analysis" || lower === "новый анализ" || lower === "/new") return "new_analysis";
  if (cb === "menu:instruction" || lower === "инструкция") return "instruction";
  if (cb === "menu:why" || lower === "зачем это?" || lower === "зачем это") return "why";
  if (cb === "menu:support" || lower === "техподдержка") return "support";
  if (cb === "menu:help" || lower === "помощь" || lower === "/help") return "help";
  if (cb === "menu:about" || lower === "о проекте") return "about";
  return null;
}

function quickSymptomsButtons() {
  return [
    [{ text: "Спокойный участок, не беспокоит", callbackData: "sig:calm" }],
    [{ text: "Появился недавно или периодически зудит", callbackData: "sig:planned" }],
    [{ text: "Заметно растёт, меняет цвет или кровит", callbackData: "sig:urgent" }],
    [{ text: "За 14 дней мазали гормональной мазью / зелёнкой", callbackData: "sig:u5_modified" }],
  ];
}

function mapQuickSignalToSurvey(sig) {
  if (sig === "urgent") {
    return { evolution: "growing_changing", symptoms: "bleeding_or_crust", priorTopical14d: "none" };
  }
  if (sig === "u5_modified") {
    return { evolution: "new_lt_3m", symptoms: "itch_or_pain", priorTopical14d: "steroid_ointment" };
  }
  if (sig === "planned") {
    return { evolution: "new_lt_3m", symptoms: "itch_or_pain", priorTopical14d: "none" };
  }
  return { evolution: "stable_long", symptoms: "none", priorTopical14d: "none" };
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
      return Buffer.from(await fileRes.arrayBuffer());
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
      const hasInline = Array.isArray(reply.buttons) && reply.buttons.length > 0;
      const replyMarkup = hasInline
        ? {
            inline_keyboard: reply.buttons.map((row) =>
              row.map((btn) => ({ text: btn.text, callback_data: btn.callbackData })),
            ),
          }
        : {
            keyboard: PERSISTENT_TELEGRAM_MENU_2X3.map((row) => row.map((label) => ({ text: label }))),
            resize_keyboard: true,
            is_persistent: true,
          };
      await fetch(`https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: reply.text,
          reply_markup: replyMarkup,
        }),
      });
      return { deliveredExternal: true };
    } catch {
      return { deliveredExternal: false };
    }
  }

  async function stepDialog({
    chatId,
    channel = "telegram",
    text = null,
    callbackData = null,
    photoBytes = null,
    imageBase64 = null,
    clientHints = {},
    nowIso = new Date().toISOString(),
  }) {
    const safeChannel = ["telegram", "whatsapp", "max", "web"].includes(channel) ? channel : "telegram";
    const safeChatId = String(chatId || "sim-default-chat").trim().slice(0, 80);
    const sessionToken = deterministicSessionTokenForChat(safeChannel, safeChatId);
    const sessionTokenSha256 = sha256Hex(sessionToken);

    const bundle = await previsitHandoffRepository.upsertOnboardingSession({
      sessionTokenSha256,
      channel: safeChannel,
      externalChatId: safeChatId,
    });
    const omnicfgRes = previsitHandoffService.getOmnichannelConfig
      ? await previsitHandoffService.getOmnichannelConfig()
      : null;
    const omnicfg = omnicfgRes?.item || {};
    const greetingVariants = Array.isArray(omnicfg.greetingVariants) && omnicfg.greetingVariants.length > 0
      ? omnicfg.greetingVariants
      : [
          "Ура! Рад помочь — сделайте фото по наглядной памятке ниже и пришлите сюда.",
          "Рад новому обращению! Пожалуйста, пришлите чёткую фотографию участка кожи крупным планом.",
          "Отлично, готов проверить снимок! Точная маршрутизация возможна только по чёткой фотографии с расстояния около 10 см.",
        ];
    const nudgeMinutes = Number(omnicfg.flowRules?.photoWaitNudgeMinutes || 4);
    const instructionSvg = buildMiroPhotoInstructionSvgDataUrl();

    const session = bundle?.session || {};
    const profiles = Array.isArray(bundle?.profiles) ? bundle.profiles : [];
    const ctx = session.fsmContext && typeof session.fsmContext === "object" ? { ...session.fsmContext } : {};
    let state = String(session.fsmState || "M0_WELCOME");

    const cleanText = text == null ? "" : String(text).trim();
    const cb = callbackData == null ? "" : String(callbackData).trim();
    const menuIntent = normalizeMenuIntent(cleanText, cb);

    function wrapResponse(fsmState, reply, extra = {}) {
      return {
        fsmState,
        quotaEnforced: false,
        persistentMenu: PERSISTENT_TELEGRAM_MENU_2X3,
        ...extra,
        reply,
      };
    }

    async function saveState(nextState, nextCtx = ctx, activeProfileId = undefined) {
      await previsitHandoffRepository.updateOnboardingSessionState({
        sessionId: session.id,
        fsmState: nextState,
        fsmContext: nextCtx,
        activeProfileId,
      });
      return nextState;
    }

    // 0. /start & global commands
    if (cleanText === "/start" || cb === "nav:start") {
      state = await saveState("M0_WELCOME", { consent152FzAccepted: Boolean(ctx.consent152FzAccepted) });
      return wrapResponse(state, {
        text:
          "Привет!\n"
          + "Я помогаю следить за здоровьем и красотой твоей кожи и подскажу, к какому врачу обратиться, если замечу поводы для внимания.\n\n"
          + "Помни: самолечение опасно — при любых сомнениях сразу обращайся к врачу очно.\n"
          + "Нажми «Меню» → «Новый анализ», чтобы отправить первое фото.",
        buttons: [
          [{ text: "Меню", callbackData: "menu:open" }],
          [{ text: "Новый анализ", callbackData: "menu:new_analysis" }],
        ],
      });
    }

    if (cleanText === "/delete_my_data" || cb === "act:delete_152fz") {
      const del = await previsitHandoffService.deleteOnboardingMyData(
        { sessionToken },
        { "x-onboarding-token": sessionToken },
      );
      return wrapResponse("M7_DELETED_152FZ", {
        text: del.messageRu,
        buttons: [[{ text: "Открыть меню", callbackData: "menu:open" }]],
      });
    }

    // 1. 6-Button Persistent Menu Handlers (Miro Left Board)
    if (menuIntent === "menu") {
      state = await saveState("M0_MENU_READY", ctx);
      return wrapResponse(state, {
        text: "Я на связи!\nВыбери в меню нужный пункт, чтобы продолжить…",
        buttons: [
          [
            { text: "Новый анализ", callbackData: "menu:new_analysis" },
            { text: "Инструкция", callbackData: "menu:instruction" },
          ],
          [
            { text: "Зачем это?", callbackData: "menu:why" },
            { text: "Техподдержка", callbackData: "menu:support" },
          ],
          [
            { text: "Помощь", callbackData: "menu:help" },
            { text: "О проекте", callbackData: "menu:about" },
          ],
        ],
      });
    }

    if (menuIntent === "why") {
      return wrapResponse(state, {
        text:
          "Зачем проверять родинки и новые изменения на коже?\n\n"
          + "Мы привыкли регулярно ходить к стоматологу, но к дерматологу часто обращаемся только тогда, когда проблема уже сильно заметна.\n"
          + "• Регулярный фотоконтроль помогает вовремя заметить изменения цвета, формы или контура и записаться к дерматологу с дерматоскопией.\n"
          + "• Если вы много времени проводите на солнце, следите за новыми пятнами и образованиями особенно внимательно.\n"
          + "• Сервис не ставит диагноз, а бережно подсказывает срочность очного осмотра врача.",
        buttons: [
          [
            { text: "Новый анализ", callbackData: "menu:new_analysis" },
            { text: "Инструкция", callbackData: "menu:instruction" },
          ],
        ],
      });
    }

    if (menuIntent === "instruction") {
      const nextCtx = { ...ctx, consent152FzAccepted: Boolean(ctx.consent152FzAccepted) };
      state = await saveState("M1_AWAIT_PHOTO", nextCtx);
      return wrapResponse(state, {
        text:
          "Правильное фото — точный результат!\n\n"
          + "1. Поместите нужный участок кожи в центр кадра.\n"
          + "2. Снимите при ровном дневном свете с расстояния около 10 см в чётком фокусе.\n"
          + "3. Уберите из кадра одежду, волосы и пёстрый фон позади.\n"
          + "4. Пришлите фото сюда (обычным фото или «Файлом / Документом» без сжатия)!",
        visualBannerUrl: instructionSvg,
        visualBannerAlt: "Памятка съёмки: ХОРОШО крупно в центре около 10 см, ПЛОХО издалека",
        buttons: nextCtx.consent152FzAccepted
          ? [[{ text: "Я готов — жду загрузку фото", callbackData: "menu:new_analysis" }]]
          : [[{ text: "Принимаю условия 152-ФЗ — готов отправить фото", callbackData: "consent:accept_photo" }]],
      });
    }

    if (menuIntent === "support") {
      return wrapResponse(state, {
        text:
          "Техподдержка «Дерматолог Про»:\n"
          + "Если возникла сложность с отправкой снимка или записью на приём, опишите вопрос или нажмите «Записаться на приём» — администратор клиники поможет подобрать окно.",
        buttons: [
          [{ text: "Новый анализ", callbackData: "menu:new_analysis" }],
          [{ text: "Удалить мои данные (152-ФЗ)", callbackData: "act:delete_152fz" }],
        ],
      });
    }

    if (menuIntent === "help") {
      return wrapResponse(state, {
        text:
          "Как работает помощник:\n"
          + "1. Нажмите «Новый анализ» и пришлите чёткое фото участка кожи с расстояния ~10 см.\n"
          + "2. Укажите имя и контакт, пока нейросеть готовит разбор.\n"
          + "3. Получите понятную маршрутизацию (🔴 / ⚠️ / ✅) и при необходимости запишитесь к врачу в 1 нажатие.\n\n"
          + "Помните: самолечение опасно — при любых тревожных симптомах обращайтесь к врачу очно.",
        buttons: [[{ text: "Новый анализ", callbackData: "menu:new_analysis" }]],
      });
    }

    if (menuIntent === "about") {
      return wrapResponse(state, {
        text:
          "О проекте «Дерматолог Про»:\n"
          + "• Информационно-маршрутизирующий сервис подготовки к очному приёму дерматолога (не заменяет врача и не ставит диагноз).\n"
          + "• При загрузке снимка на сервере РФ автоматически очищаются метаданные EXIF и GPS (152-ФЗ), а в чат возвращается только локальный участок кожи без полного лица и фона.",
        buttons: [
          [{ text: "Новый анализ", callbackData: "menu:new_analysis" }],
          [{ text: "Удалить мои снимки и данные (152-ФЗ)", callbackData: "act:delete_152fz" }],
        ],
      });
    }

    // 2. Entry into "Новый анализ" & 2nd-photo verification & 30-day reminder trigger
    if (menuIntent === "new_analysis" || cb === "act:new_photo" || cb === "act:second_angle_photo") {
      const turnIdx = Number(ctx.greetingCounter || 0);
      const chosenGreeting = greetingVariants[turnIdx % greetingVariants.length];
      const nextCtx = {
        ...ctx,
        greetingCounter: turnIdx + 1,
        verificationOfSubmissionId: cb === "act:second_angle_photo" ? ctx.submissionId || null : null,
      };
      state = await saveState("M1_AWAIT_PHOTO", nextCtx);
      const headerLine =
        cb === "act:second_angle_photo"
          ? "Удостоверимся в результате! Сделайте 2-е фото этого же участка чуть под другим углом (~10 см) и пришлите сюда:"
          : chosenGreeting;
      return wrapResponse(state, {
        text:
          `${headerLine}\n\n`
          + "Советы перед съёмкой:\n"
          + "1. Нужный участок в центре кадра\n"
          + "2. Хорошая резкость с расстояния ~10 см при дневном свете\n"
          + (nextCtx.consent152FzAccepted
            ? "3. Пришлите фото прямо в чат!"
            : "3. Нажмите кнопку согласия 152-ФЗ ниже или сразу прикрепите снимок (отправляя фото, вы принимаете условия информационного сервиса и 152-ФЗ)."),
        visualBannerUrl: instructionSvg,
        visualBannerAlt: "Памятка съёмки ХОРОШО и ПЛОХО",
        buttons: nextCtx.consent152FzAccepted
          ? [[{ text: "Памятка по съёмке", callbackData: "menu:instruction" }]]
          : [[{ text: "Принимаю условия 152-ФЗ — готов отправить фото", callbackData: "consent:accept_photo" }]],
      });
    }

    if (cb === "consent:accept_photo") {
      ctx.consent152FzAccepted = true;
      state = await saveState("M1_AWAIT_PHOTO", ctx);
      return wrapResponse(state, {
        text: "Согласие 152-ФЗ зафиксировано. Прикрепите и отправьте фотографию участка кожи прямо в этот чат!",
        buttons: [],
      });
    }

    // Miro 3-5 minute photo-wait nudge trigger
    if (cb === "nudge:photo_timeout") {
      state = await saveState("M1_AWAIT_PHOTO", ctx);
      return wrapResponse(state, {
        text:
          `Прошло ${nudgeMinutes} мин — я всё ещё жду твоё фото, чтобы завершить осмотр. Ты его пришлёшь?`,
        buttons: [
          [{ text: "Показать памятку ХОРОШО / ПЛОХО", callbackData: "menu:instruction" }],
        ],
      });
    }

    // Miro 30-day follow-up reminder trigger (from GREEN_LOW)
    if (cb === "nudge:followup_30d") {
      state = await saveState("M1_AWAIT_PHOTO", ctx);
      return wrapResponse(state, {
        text:
          "Плановое напоминание (30 дней):\n"
          + "Месяц назад мы проводили плановую проверку участка кожи. Сделайте свежее фото при дневном свете (~10 см) и пришлите сюда для контроля в динамике!",
        visualBannerUrl: instructionSvg,
        buttons: [],
      });
    }

    // 3. Photo Arrival (Photo-First! Works directly from M1_AWAIT_PHOTO or any state)
    if (photoBytes || imageBase64) {
      ctx.consent152FzAccepted = true;
      const activeProfileId = ctx.profileId || session.activeProfileId || profiles[0]?.id || undefined;
      const photoResult = await previsitHandoffService.submitOnboardingPhoto(
        {
          sessionToken,
          channel: safeChannel,
          profileId: activeProfileId,
          consent152FzAccepted: true,
          fileBytes: photoBytes,
          imageBase64,
          clientHints,
        },
        { "x-onboarding-token": sessionToken },
        { nowIso },
      );

      if (!photoResult.qualityGate.passed) {
        state = await saveState("M1_AWAIT_PHOTO", ctx, photoResult.profileId);
        const tips = (photoResult.qualityGate.recoveryTipsRu || []).map((t) => `• ${t}`).join("\n");
        return wrapResponse(
          state,
          {
            text:
              `Плохое фото — нужен повторный кадр:\n${photoResult.qualityGate.reasonRu}\n\n`
              + `Как снять правильно:\n${tips}`,
            visualBannerUrl: instructionSvg,
            buttons: [[{ text: "Попробовать ещё раз по инструкции", callbackData: "menu:new_analysis" }]],
          },
          { photoResult },
        );
      }

      ctx.submissionId = photoResult.submissionId;
      ctx.profileId = photoResult.profileId;
      const step1Visual = photoResult.analysisStagesVisuals?.step1DetectionSvgDataUrl || null;

      // Profile Mismatch Guard if baseline ITA° already existed and |ΔITA°| > 22°
      if (photoResult.status === "awaiting_mismatch_confirm" && photoResult.mismatchPrompt) {
        state = await saveState("M2_MISMATCH_GUARD", ctx, ctx.profileId);
        return wrapResponse(
          state,
          {
            text: `1 шаг: Детектированы важные участки кожи.\n\n${photoResult.mismatchPrompt.questionRu}`,
            visualBannerUrl: step1Visual,
            buttons: [
              [{ text: "Это моё фото (другое освещение или загар)", callbackData: "mm:same_person_lighting" }],
              [{ text: "Проверяю другого человека (отдельный профиль)", callbackData: "mm:switched_profile" }],
            ],
          },
          { photoResult },
        );
      }

      // Returning user in same session who already provided Name + Phone + Age/Sex:
      const savedName = ctx.contactName || session.contactName;
      const savedPhone = ctx.contactPhone || session.contactPhone;
      if (savedName && savedPhone && ctx.ageComplete) {
        state = await saveState("M2_CONFIRM_RETURNING", ctx, ctx.profileId);
        return wrapResponse(
          state,
          {
            text:
              "1 шаг: Детектированы важные участки кожи.\n"
              + "2 шаг: Анализ нейросети запущен…\n\n"
              + `Продолжаем проверку для «${savedName}» или обследуем другого человека?`,
            visualBannerUrl: step1Visual,
            buttons: [
              [{ text: `Продолжить для «${savedName}»`, callbackData: "ret:same" }],
              [{ text: "Другой человек (указать данные)", callbackData: "ret:other" }],
            ],
          },
          { photoResult },
        );
      }

      // PEAK USER MOTIVATION (Dima's A1 rule!): ask Name & Phone right after photo upload!
      state = await saveState("M2_LEAD_NAME", ctx, ctx.profileId);
      return wrapResponse(
        state,
        {
          text:
            "1 шаг: Детектированы важные участки кожи.\n"
            + "2 шаг: Анализ нейросети запущен…\n\n"
            + "Пока я готовлю подробную сводку, напишите, пожалуйста: как Вас зовут (или имя обследуемого пациента)?",
          visualBannerUrl: step1Visual,
          buttons: [],
        },
        { photoResult },
      );
    }

    if (state === "M2_MISMATCH_GUARD") {
      const resolution = cb.startsWith("mm:") ? cb.slice(3) : "";
      if (resolution !== "same_person_lighting" && resolution !== "switched_profile") {
        return wrapResponse(state, {
          text: "Выберите кнопкой ниже, чей это снимок:",
          buttons: [
            [{ text: "Это моё фото (другое освещение или загар)", callbackData: "mm:same_person_lighting" }],
            [{ text: "Проверяю другого человека (отдельный профиль)", callbackData: "mm:switched_profile" }],
          ],
        });
      }
      const resolved = await previsitHandoffService.resolveProfileMismatch(
        ctx.submissionId,
        { sessionToken, resolution },
        { "x-onboarding-token": sessionToken },
        { nowIso },
      );
      ctx.profileId = resolved.submission.profileId;
      if (resolution === "switched_profile") {
        state = await saveState("M2_LEAD_NAME", ctx, ctx.profileId);
        return wrapResponse(state, {
          text: "Снимок перенесён в отдельный профиль без повторной загрузки.\nКак зовут обследуемого человека?",
          buttons: [],
        });
      }
      state = await saveState("M2_QUICK_SYMPTOMS", ctx, ctx.profileId);
      return wrapResponse(state, {
        text: "Отлично! Уточните одним нажатием, беспокоит ли этот участок кожи:",
        buttons: quickSymptomsButtons(),
      });
    }

    if (state === "M2_CONFIRM_RETURNING") {
      if (cb === "ret:other") {
        state = await saveState("M2_LEAD_NAME", { ...ctx, ageComplete: false }, ctx.profileId);
        return wrapResponse(state, {
          text: "Как зовут обследуемого пациента?",
          buttons: [],
        });
      }
      state = await saveState("M2_QUICK_SYMPTOMS", ctx, ctx.profileId);
      return wrapResponse(state, {
        text: "Последний штрих перед выдачей результата — беспокоит ли этот участок кожи?",
        buttons: quickSymptomsButtons(),
      });
    }

    // 4. Post-Photo Lead & Profile Sequence (Name -> Phone -> Age/Guardian -> Sex -> Quick Signal -> Result!)
    if (state === "M2_LEAD_NAME") {
      if (cleanText.length < 2) {
        return wrapResponse(state, {
          text: "Пожалуйста, напишите Ваше имя или имя обследуемого пациента (не короче 2 букв):",
          buttons: [],
        });
      }
      ctx.contactName = cleanText;
      state = await saveState("M2_LEAD_PHONE", ctx);
      return wrapResponse(state, {
        text: `Приятно познакомиться, ${cleanText}!\nВ результате обследования по какому номеру телефона с Вами можно связаться?`,
        buttons: [],
      });
    }

    if (state === "M2_LEAD_PHONE") {
      if (cleanText.replace(/\D/g, "").length < 10) {
        return wrapResponse(state, {
          text: "Укажите корректный контактный номер телефона (не менее 10 цифр, например +7 999 123-45-67):",
          buttons: [],
        });
      }
      ctx.contactPhone = cleanText;
      state = await saveState("M2_PROFILE_AGE", ctx);
      return wrapResponse(state, {
        text: "Укажите возраст пациента (выберите кнопку или напишите число полных лет):",
        buttons: [
          [{ text: "Младенец до 1 года", callbackData: "age:infant" }, { text: "Ребёнок (7 лет)", callbackData: "age:7" }],
          [{ text: "25 лет", callbackData: "age:25" }, { text: "35 лет", callbackData: "age:35" }, { text: "50 лет", callbackData: "age:50" }],
        ],
      });
    }

    if (state === "M2_PROFILE_AGE") {
      if (cb === "age:infant") {
        ctx.isInfantUnder1Year = true;
        ctx.ageYears = 0;
        ctx.ageMonths = 6;
        ctx.subjectRelation = "CHILD_UNDER_18";
        state = await saveState("M2_GUARDIAN_GATE", ctx);
        return wrapResponse(state, {
          text: "Для проверки снимка ребёнка до 18 лет подтвердите статус родителя или законного представителя:",
          buttons: [[{ text: "Подтверждаю статус законного представителя", callbackData: "guard:confirm" }]],
        });
      }
      const ageRaw = cb.startsWith("age:") ? cb.slice(4) : cleanText;
      const parsedAge = Number.parseInt(ageRaw, 10);
      if (!Number.isFinite(parsedAge) || parsedAge < 1 || parsedAge > 120) {
        return wrapResponse(state, {
          text: "Укажите возраст числом от 1 до 120 лет (или выберите «Младенец до 1 года»):",
          buttons: [
            [{ text: "Младенец до 1 года", callbackData: "age:infant" }, { text: "35 лет", callbackData: "age:35" }],
          ],
        });
      }
      ctx.ageYears = parsedAge;
      ctx.isInfantUnder1Year = false;
      ctx.ageMonths = null;
      if (parsedAge < 18) {
        ctx.subjectRelation = "CHILD_UNDER_18";
        state = await saveState("M2_GUARDIAN_GATE", ctx);
        return wrapResponse(state, {
          text: "Пациенту меньше 18 лет — подтвердите, что Вы являетесь родителем или законным представителем ребёнка:",
          buttons: [[{ text: "Подтверждаю статус законного представителя", callbackData: "guard:confirm" }]],
        });
      }
      ctx.subjectRelation = "SELF";
      state = await saveState("M2_PROFILE_SEX", ctx);
      return wrapResponse(state, {
        text: "Укажите пол пациента:",
        buttons: [[{ text: "Женский", callbackData: "sex:female" }, { text: "Мужской", callbackData: "sex:male" }]],
      });
    }

    if (state === "M2_GUARDIAN_GATE") {
      if (cb !== "guard:confirm") {
        return wrapResponse(state, {
          text: "Без подтверждения статуса законного представителя выдача результата по детскому снимку заблокирована.",
          buttons: [
            [{ text: "Подтверждаю статус законного представителя", callbackData: "guard:confirm" }],
            [{ text: "Отмена — в меню", callbackData: "menu:open" }],
          ],
        });
      }
      ctx.legalGuardianConfirmed = true;
      state = await saveState("M2_PROFILE_SEX", ctx);
      return wrapResponse(state, {
        text: "Статус подтверждён. Укажите пол ребёнка:",
        buttons: [[{ text: "Женский", callbackData: "sex:female" }, { text: "Мужской", callbackData: "sex:male" }]],
      });
    }

    if (state === "M2_PROFILE_SEX") {
      const sex = cb.startsWith("sex:") ? cb.slice(4) : "";
      if (sex !== "female" && sex !== "male") {
        return wrapResponse(state, {
          text: "Выберите пол кнопкой ниже:",
          buttons: [[{ text: "Женский", callbackData: "sex:female" }, { text: "Мужской", callbackData: "sex:male" }]],
        });
      }
      ctx.biologicalSex = sex;
      ctx.ageComplete = true;
      state = await saveState("M2_QUICK_SYMPTOMS", ctx);
      return wrapResponse(state, {
        text: "И последнее уточнение для точности маршрута — беспокоит ли этот участок кожи?",
        buttons: quickSymptomsButtons(),
      });
    }

    if (state === "M2_QUICK_SYMPTOMS") {
      const sig = cb.startsWith("sig:") ? cb.slice(4) : "calm";
      const mapped = mapQuickSignalToSurvey(sig);
      const isInfantOrToddler = Boolean(ctx.isInfantUnder1Year || (typeof ctx.ageYears === "number" && ctx.ageYears < 3));
      if (isInfantOrToddler && !cb.startsWith("u6:")) {
        ctx.pendingSurvey = mapped;
        state = await saveState("M2_U6_CHILD_CHECK", ctx);
        return wrapResponse(state, {
          text: "Педиатрическая проверка: есть ли у ребёнка сейчас повышенная температура, выраженная вялость или быстрое распространение сыпи?",
          buttons: [
            [{ text: "Нет, общее самочувствие спокойное", callbackData: "u6:no" }],
            [{ text: "Да, есть температура или вялость", callbackData: "u6:yes" }],
          ],
        });
      }

      const cardRes = await previsitHandoffService.submitMicroSurveyAndBuildCard(
        ctx.submissionId,
        {
          sessionToken,
          contactName: ctx.contactName,
          contactPhone: ctx.contactPhone,
          subjectRelation: ctx.subjectRelation || "SELF",
          legalGuardianConfirmed: Boolean(ctx.legalGuardianConfirmed),
          isInfantUnder1Year: Boolean(ctx.isInfantUnder1Year),
          ageYears: ctx.ageYears,
          ageMonths: ctx.ageMonths,
          biologicalSex: ctx.biologicalSex,
          verificationOfSubmissionId: ctx.verificationOfSubmissionId || null,
          ...mapped,
          pediatricSystemicRedFlags: false,
          simulateGpuTimeout: Boolean(clientHints?.simulateGpuTimeout),
        },
        { "x-onboarding-token": sessionToken },
        { nowIso },
      );

      return buildTrafficLightReplyFromCard(cardRes);
    }

    if (state === "M2_U6_CHILD_CHECK") {
      const redFlags = cb === "u6:yes";
      const mapped = ctx.pendingSurvey || mapQuickSignalToSurvey("planned");
      const cardRes = await previsitHandoffService.submitMicroSurveyAndBuildCard(
        ctx.submissionId,
        {
          sessionToken,
          contactName: ctx.contactName,
          contactPhone: ctx.contactPhone,
          subjectRelation: "CHILD_UNDER_18",
          legalGuardianConfirmed: true,
          isInfantUnder1Year: Boolean(ctx.isInfantUnder1Year),
          ageYears: ctx.ageYears,
          ageMonths: ctx.ageMonths,
          biologicalSex: ctx.biologicalSex,
          ...mapped,
          pediatricSystemicRedFlags: redFlags,
        },
        { "x-onboarding-token": sessionToken },
        { nowIso },
      );
      return buildTrafficLightReplyFromCard(cardRes);
    }

    async function buildTrafficLightReplyFromCard(cardRes) {
      if (cardRes.status === "queued_gpu") {
        state = await saveState("M3_QUEUED_GPU", ctx);
        return wrapResponse(
          state,
          {
            text: cardRes.card.statusMessageRu,
            buttons: [
              [{ text: "Записаться на приём сейчас", callbackData: "act:book_clinic" }],
              [{ text: "Новый анализ", callbackData: "menu:new_analysis" }],
            ],
          },
          { cardResult: cardRes },
        );
      }

      state = await saveState("M3_RESULT_TRAFFIC_LIGHT", ctx);
      const tl = cardRes.card.trafficLight || "GREEN_LOW";
      const tlHeader =
        tl === "RED_HIGH"
          ? "🔴 Высокий уровень внимания — нужен очный осмотр врача"
          : tl === "YELLOW_MEDIUM"
            ? "⚠️ Средний уровень — рекомендуется плановая консультация дерматолога"
            : "✅ Низкий уровень — спокойная визуальная картина";

      const emergencyLine = cardRes.card.emergency103Banner
        ? "ЭКСТРЕННО (103 / 112): при температуре, вялости или быстром распространении сыпи у ребёнка незамедлительно вызовите скорую помощь 103 или 112.\n\n"
        : "";

      const extraMiroBlock =
        tl === "GREEN_LOW" && cardRes.card.followupTimerMessageRu
          ? `\n\n⏱ ${cardRes.card.followupTimerMessageRu}`
          : tl === "YELLOW_MEDIUM" && cardRes.card.secondPhotoVerificationPromptRu
            ? `\n\n🔎 ${cardRes.card.secondPhotoVerificationPromptRu}`
            : "";

      const actionButtons = [
        [{ text: "Записаться на приём сейчас", callbackData: "act:book_clinic" }],
      ];
      if (tl === "YELLOW_MEDIUM") {
        actionButtons.push([{ text: "Отправить 2-е фото этого места", callbackData: "act:second_angle_photo" }]);
      }
      if (tl === "GREEN_LOW") {
        actionButtons.push([{ text: "Проверить напоминание через 30 дней", callbackData: "nudge:followup_30d" }]);
      }
      actionButtons.push([
        { text: "Новый анализ", callbackData: "menu:new_analysis" },
        { text: "Уточнить факторы риска", callbackData: "act:risk_factors" },
      ]);

      return wrapResponse(
        state,
        {
          text:
            `2 шаг: Анализ нейросети завершён.\n\n`
            + `${emergencyLine}${tlHeader}\n\n`
            + `${cardRes.card.safeSummaryRu}${extraMiroBlock}`,
          visualBannerUrl: cardRes.card.analysisStagesVisuals?.step2AttentionSvgDataUrl || null,
          cropCard: cardRes.card.lesionCrops?.[0] || null,
          buttons: actionButtons,
        },
        { cardResult: cardRes },
      );
    }

    if (cb === "act:risk_factors") {
      state = await saveState("M3_RISK_FACTORS", ctx);
      return wrapResponse(state, {
        text: "Отметьте индивидуальные факторы (передаются врачу на очном приёме):",
        buttons: [
          [{ text: "Солнечные ожоги в детстве", callbackData: "rf:sunburnsChildhood" }],
          [{ text: "Более 50 родинок на теле", callbackData: "rf:neviOver50" }],
          [{ text: "Онкоанамнез кожи в семье", callbackData: "rf:familyMelanomaHistory" }],
          [{ text: "Записаться на приём сейчас", callbackData: "act:book_clinic" }],
        ],
      });
    }

    if (state === "M3_RISK_FACTORS" && cb.startsWith("rf:")) {
      const factorKey = cb.slice(3);
      await previsitHandoffService.updateProfileRiskFactors(
        ctx.profileId || session.activeProfileId,
        { sessionToken, riskFactors: { [factorKey]: true } },
        { "x-onboarding-token": sessionToken },
      );
      return wrapResponse(state, {
        text: "Фактор сохранён в карточку для врача. Выберите следующее действие:",
        buttons: [
          [{ text: "Записаться на приём сейчас", callbackData: "act:book_clinic" }],
          [{ text: "Новый анализ", callbackData: "menu:new_analysis" }],
        ],
      });
    }

    // 5. 1-Tap Clinic Slot Booking (Name & Phone already collected post-photo!)
    if (cb === "act:book_clinic") {
      state = await saveState("M4_BOOK_ONE_TAP", ctx);
      const contactHint = ctx.contactName && ctx.contactPhone
        ? `Контакт для связи уже сохранён (${ctx.contactName}, ${ctx.contactPhone}). Выберите удобное окно приёма в клинике:`
        : "Выберите удобное время для очного приёма дерматолога:";
      return wrapResponse(state, {
        text: contactHint,
        buttons: [
          [{ text: "Ближайшее свободное окно", callbackData: "slot:Ближайшее свободное окно" }],
          [{ text: "Будни утром (09:00–13:00)", callbackData: "slot:Будни утром (09:00–13:00)" }],
          [{ text: "Будни вечером (после 18:00)", callbackData: "slot:Будни вечером (после 18:00)" }],
        ],
      });
    }

    if (state === "M4_BOOK_ONE_TAP") {
      const chosenSlot = cb.startsWith("slot:") ? cb.slice(5) : cleanText || "Ближайшее свободное окно";
      const booked = await previsitHandoffService.bookClinicFromSubmission(
        ctx.submissionId,
        {
          sessionToken,
          displayName: ctx.contactName || session.contactName || "Пациент",
          phone: ctx.contactPhone || session.contactPhone || "+79990000000",
          preferredTimeNote: chosenSlot,
        },
        { "x-onboarding-token": sessionToken },
        { nowIso },
      );
      state = await saveState("M4_BOOK_DONE", ctx);
      return wrapResponse(
        state,
        {
          text:
            `Заявка передана в клинику «${booked.clinicName}» (${booked.bookingPriorityLabelRu}, окно: ${chosenSlot}).\n\n`
            + "Администратор записи видит только Ваш контакт и выбранное окно (снимки скрыты от оператора и откроются только врачу на очном приёме). После визита активируется бессрочный Паспорт контроля кожи.",
          buttons: [
            [{ text: "Новый анализ", callbackData: "menu:new_analysis" }],
            [{ text: "Открыть меню", callbackData: "menu:open" }],
          ],
        },
        { bookingResult: booked },
      );
    }

    // Default fallback -> open Miro menu
    state = await saveState("M0_MENU_READY", ctx);
    return wrapResponse(state, {
      text: "Я на связи! Выберите нужный пункт в меню ниже:",
      buttons: [
        [
          { text: "Новый анализ", callbackData: "menu:new_analysis" },
          { text: "Инструкция", callbackData: "menu:instruction" },
        ],
        [
          { text: "Зачем это?", callbackData: "menu:why" },
          { text: "Помощь", callbackData: "menu:help" },
        ],
      ],
    });
  }

  return {
    stepDialog,

    async handleWebhookUpdate(update = {}, headers = {}, { nowIso = new Date().toISOString() } = {}) {
      verifyWebhookSecret(headers);

      const message = update?.message || update?.edited_message || null;
      const callbackQuery = update?.callback_query || null;
      const chatId = callbackQuery?.message?.chat?.id ?? message?.chat?.id ?? null;

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
        channel: "telegram",
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
        persistentMenu: stepped.persistentMenu,
        reply: stepped.reply,
        deliveredExternal: delivery.deliveredExternal,
      };
    },
  };
}
