import { useCallback, useEffect, useState, type FormEvent } from "react";
import { LayoutGrid, RefreshCw, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  stepTelegramBotDialogSimulator,
  type LesionCropCardItemDTO,
  type TelegramBotInlineButtonDTO,
} from "@/lib/self-hosted-onboarding-api";

interface TgChatBubble {
  id: string;
  side: "bot" | "user";
  text: string;
  visualBannerUrl?: string | null;
  visualBannerAlt?: string | null;
  cropCard?: LesionCropCardItemDTO | null;
}

const DEFAULT_PERSISTENT_MENU_2X3: string[][] = [
  ["Новый анализ", "Инструкция"],
  ["Зачем это?", "Техподдержка"],
  ["Помощь", "О проекте"],
];

const TG_STATE_LABEL_RU: Record<string, string> = {
  M0_WELCOME: "Приветствие (/start)",
  M0_MENU_READY: "Главное меню 2×3",
  M1_AWAIT_PHOTO: "Памятка ХОРОШО / ПЛОХО · ожидание фото",
  M2_MISMATCH_GUARD: "Сверка тона кожи с профилем",
  M2_CONFIRM_RETURNING: "Выбор профиля повторного снимка",
  M2_LEAD_NAME: "После фото · знакомство (Имя)",
  M2_LEAD_PHONE: "После фото · телефон для связи",
  M2_PROFILE_AGE: "Уточнение возраста пациента",
  M2_GUARDIAN_GATE: "Подтверждение законного представителя (< 18 лет)",
  M2_PROFILE_SEX: "Уточнение пола пациента",
  M2_QUICK_SYMPTOMS: "Быстрый вопрос по ощущениям (1 тап)",
  M2_U6_CHILD_CHECK: "Педиатрическая проверка самочувствия",
  M3_RESULT_TRAFFIC_LIGHT: "Карточка светофора (🔴 / ⚠️ / ✅)",
  M3_QUEUED_GPU: "Очередь расчёта с доотправкой в чат",
  M3_RISK_FACTORS: "Индивидуальные факторы риска",
  M4_BOOK_ONE_TAP: "Запись на приём в 1 нажатие (выбор окна)",
  M4_BOOK_DONE: "Заявка передана в клинику",
  M7_DELETED_152FZ: "Данные удалены по 152-ФЗ",
};

export function TelegramMiroDialogPanel() {
  const [tgChatId, setTgChatId] = useState(() => `tg-miro-${Math.random().toString(36).slice(2, 9)}`);
  const [tgState, setTgState] = useState("M0_WELCOME");
  const [tgButtons, setTgButtons] = useState<TelegramBotInlineButtonDTO[][]>([]);
  const [persistentMenu, setPersistentMenu] = useState<string[][]>(DEFAULT_PERSISTENT_MENU_2X3);
  const [menuOpen, setMenuOpen] = useState(true);
  const [tgInput, setTgInput] = useState("");
  const [tgBusy, setTgBusy] = useState(false);
  const [tgBubbles, setTgBubbles] = useState<TgChatBubble[]>([]);

  const startDialog = useCallback(async (targetChatId: string) => {
    setTgBusy(true);
    const res = await stepTelegramBotDialogSimulator({
      chatId: targetChatId,
      text: "/start",
    });
    setTgBusy(false);
    if (res.ok && res.value) {
      setTgState(res.value.fsmState);
      setTgButtons(res.value.reply.buttons || []);
      if (res.value.persistentMenu?.length) {
        setPersistentMenu(res.value.persistentMenu);
      }
      setTgBubbles([
        {
          id: "tg-init",
          side: "bot",
          text: res.value.reply.text,
          visualBannerUrl: res.value.reply.visualBannerUrl,
          visualBannerAlt: res.value.reply.visualBannerAlt,
          cropCard: res.value.reply.cropCard,
        },
      ]);
    }
  }, []);

  useEffect(() => {
    if (tgBubbles.length === 0) {
      void startDialog(tgChatId);
    }
  }, [startDialog, tgBubbles.length, tgChatId]);

  async function sendAction(opts: {
    userLabel: string;
    text?: string | null;
    callbackData?: string | null;
    simulatePhotoPreset?: "clear_skin" | "blur" | "glare" | "dark" | "mismatch_skin" | null;
    clientHints?: Record<string, unknown>;
  }) {
    setTgBubbles((prev) => [
      ...prev,
      { id: `u-${Date.now()}-${Math.random()}`, side: "user", text: opts.userLabel },
    ]);
    setTgBusy(true);
    const res = await stepTelegramBotDialogSimulator({
      chatId: tgChatId,
      text: opts.text ?? null,
      callbackData: opts.callbackData ?? null,
      simulatePhotoPreset: opts.simulatePhotoPreset ?? null,
      clientHints: opts.clientHints ?? {},
    });
    setTgBusy(false);
    if (res.ok && res.value) {
      setTgState(res.value.fsmState);
      setTgButtons(res.value.reply.buttons || []);
      if (res.value.persistentMenu?.length) {
        setPersistentMenu(res.value.persistentMenu);
      }
      setTgBubbles((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}-${Math.random()}`,
          side: "bot",
          text: res.value.reply.text,
          visualBannerUrl: res.value.reply.visualBannerUrl,
          visualBannerAlt: res.value.reply.visualBannerAlt,
          cropCard: res.value.reply.cropCard,
        },
      ]);
    }
  }

  function handleTextSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = tgInput.trim();
    if (!trimmed || tgBusy) return;
    setTgInput("");
    void sendAction({ userLabel: trimmed, text: trimmed });
  }

  function handleResetNewChat() {
    const freshId = `tg-miro-${Math.random().toString(36).slice(2, 9)}`;
    setTgChatId(freshId);
    setTgBubbles([]);
    void startDialog(freshId);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.9fr)]">
      <Card className="flex flex-col border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 className="text-[15px] font-semibold">
              Живой диалог в Telegram (сценарий Miro: фото-первый вход + меню 2×3)
            </h2>
            <p className="text-[12px] text-muted-foreground">
              Текущий шаг:{" "}
              <span className="font-medium text-foreground">
                {TG_STATE_LABEL_RU[tgState] ?? "Активный диалог"}
              </span>
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={tgBusy}
            onClick={handleResetNewChat}
            className="min-h-11 gap-1.5 text-[12px]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Начать заново (/start)
          </Button>
        </div>

        {/* Лента сообщений бота и пользователя */}
        <div className="my-3 max-h-[430px] min-h-[280px] space-y-2.5 overflow-y-auto rounded-md border border-border bg-surface-muted p-3">
          {tgBubbles.map((bubble) => (
            <div
              key={bubble.id}
              className={`flex flex-col ${bubble.side === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[90%] space-y-2 rounded-lg px-3.5 py-2.5 text-[13px] whitespace-pre-line ${
                  bubble.side === "user"
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-surface text-foreground"
                }`}
              >
                <p>{bubble.text}</p>
                {bubble.visualBannerUrl ? (
                  <img
                    src={bubble.visualBannerUrl}
                    alt={bubble.visualBannerAlt || "Наглядная карточка помощника"}
                    className="w-full max-w-[340px] rounded border border-border bg-surface"
                  />
                ) : null}
                {bubble.cropCard ? (
                  <div className="space-y-1 rounded border border-border bg-surface-muted p-2">
                    <img
                      src={bubble.cropCard.cropSvgDataUrl}
                      alt={`Локальный участок №${bubble.cropCard.lesionIndex}`}
                      className="w-full max-w-[260px] rounded"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Показан только локальный участок (+{bubble.cropCard.surroundingSkinMarginPercent}% кожи вокруг) без полного лица и фона. Чёткость: {bubble.cropCard.qualityScore0To100}/100.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Инлайн-кнопки текущего шага */}
        {tgButtons.length > 0 ? (
          <div className="mb-3 space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground">Быстрые ответы шага:</p>
            {tgButtons.map((row, rowIdx) => (
              <div key={rowIdx} className="flex flex-wrap gap-1.5">
                {row.map((btn) => (
                  <Button
                    key={btn.callbackData}
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={tgBusy}
                    onClick={() =>
                      void sendAction({
                        userLabel: btn.text,
                        callbackData: btn.callbackData,
                      })
                    }
                    className="h-auto min-h-11 flex-1 whitespace-normal py-2 text-left text-[12px]"
                  >
                    {btn.text}
                  </Button>
                ))}
              </div>
            ))}
          </div>
        ) : null}

        {/* Строка ввода + кнопка постоянного меню 2×3 */}
        <form onSubmit={handleTextSubmit} className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={menuOpen ? "default" : "outline"}
            disabled={tgBusy}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            className="min-h-11 gap-1.5 text-[12px]"
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            Меню 2×3
          </Button>
          <Input
            value={tgInput}
            onChange={(e) => setTgInput(e.target.value)}
            placeholder="Напишите имя, телефон, возраст или команду (/start)…"
            aria-label="Сообщение в Telegram-бот"
            className="min-h-11 min-w-[180px] flex-1"
          />
          <Button type="submit" disabled={tgBusy || !tgInput.trim()} className="min-h-11 gap-1.5">
            <Send className="h-4 w-4" aria-hidden />
            Отправить
          </Button>
        </form>

        {/* Постоянная нижняя клавиатура Telegram 2×3 из Miro */}
        {menuOpen ? (
          <div
            aria-label="Постоянное меню бота 2 на 3"
            className="mt-3 rounded-md border border-border bg-surface-muted p-2"
          >
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
              Постоянное нижнее меню мессенджера (доступно на любом шаге):
            </p>
            <div className="space-y-1.5">
              {persistentMenu.map((row, rIdx) => (
                <div key={rIdx} className="grid grid-cols-2 gap-1.5">
                  {row.map((label) => (
                    <Button
                      key={label}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={tgBusy}
                      onClick={() => void sendAction({ userLabel: label, text: label })}
                      className="h-auto min-h-11 w-full whitespace-normal bg-surface py-2 text-[12px] font-medium"
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      {/* Правая панель быстрой проверки всех ветвей Miro */}
      <Card className="space-y-3 border-border bg-surface p-4">
        <div className="space-y-1">
          <h3 className="text-[14px] font-semibold">Быстрая проверка ветвей сценария Miro</h3>
          <p className="text-[12px] text-muted-foreground">
            Проверьте отправку фото сразу после инструкции, таймеры 3–5 минут и 30 дней, сбор имени и телефона после загрузки кадра и запись в клинику в 1 нажатие:
          </p>
        </div>

        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            disabled={tgBusy}
            onClick={() =>
              void sendAction({
                userLabel: "[Фото без сжатия · чёткий макрокадр ~10 см]",
                simulatePhotoPreset: "clear_skin",
              })
            }
            className="h-auto min-h-11 w-full justify-start whitespace-normal py-2 text-left text-[12px]"
          >
            1. Отправить чёткое фото кожи (~10 см)
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={tgBusy}
            onClick={() =>
              void sendAction({
                userLabel: "[Фото · смазанный кадр издалека]",
                simulatePhotoPreset: "blur",
              })
            }
            className="h-auto min-h-11 w-full justify-start whitespace-normal py-2 text-left text-[12px]"
          >
            2. Отправить смазанное фото (отказ + памятка ХОРОШО / ПЛОХО)
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={tgBusy}
            onClick={() =>
              void sendAction({
                userLabel: "[Сработал таймер ожидания 3–5 мин без фото]",
                callbackData: "nudge:photo_timeout",
              })
            }
            className="h-auto min-h-11 w-full justify-start whitespace-normal py-2 text-left text-[12px]"
          >
            3. Проверить мягкое напоминание через 3–5 мин без фото
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={tgBusy}
            onClick={() =>
              void sendAction({
                userLabel: "[Сработал плановый таймер через 30 дней]",
                callbackData: "nudge:followup_30d",
              })
            }
            className="h-auto min-h-11 w-full justify-start whitespace-normal py-2 text-left text-[12px]"
          >
            4. Проверить напоминание повторного осмотра через 30 дней
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={tgBusy}
            onClick={() =>
              void sendAction({
                userLabel: "[Фото другого человека · заметно другой тон кожи]",
                simulatePhotoPreset: "mismatch_skin",
              })
            }
            className="h-auto min-h-11 w-full justify-start whitespace-normal py-2 text-left text-[12px]"
          >
            5. Снимок с другим тоном кожи (сверка профиля)
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={tgBusy}
            onClick={() =>
              void sendAction({
                userLabel: "/delete_my_data",
                text: "/delete_my_data",
              })
            }
            className="h-auto min-h-11 w-full justify-start whitespace-normal py-2 text-left text-[12px] text-destructive"
          >
            6. Удалить мои снимки и данные (152-ФЗ)
          </Button>
        </div>

        <div className="rounded border border-border bg-surface-muted p-3 text-[11px] text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Воронка Miro (фото-первый вход):</p>
          <p>• На старте нет длинной анкеты — сразу памятка ХОРОШО / ПЛОХО (~10 см) и отправка фото.</p>
          <p>• Сразу после прохождения проверки резкости запрашиваются Имя, Телефон, Возраст и Пол (для ребёнка до 18 лет — обязательное подтверждение законного представителя).</p>
          <p>• После карточки светофора (🔴 / ⚠️ / ✅) запись в клинику выполняется в 1 нажатие без повторного ввода телефона.</p>
        </div>
      </Card>
    </div>
  );
}
