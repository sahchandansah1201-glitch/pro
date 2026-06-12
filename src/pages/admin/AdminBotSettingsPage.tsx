import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Camera,
  CheckCircle2,
  ClipboardList,
  Headphones,
  ShieldCheck,
} from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CLINICS,
  getAnalysisCards,
  getDialogs,
  getLeads,
} from "@/lib/mock-data";
import type {
  AnalysisCard,
  BotDialogState,
  LeadStatus,
  RiskLevel,
} from "@/lib/domain";

/**
 * Центр управления ботом.
 *
 * SAFETY:
 *   - Бот собирает данные, направляет обращение и передает сложные случаи
 *     оператору; медицинские выводы делает врач.
 *   - Не рендерим имена пациентов, ссылки на фото, служебные коды,
 *     внешние идентификаторы мессенджеров, версии моделей или детали подсказок.
 *   - Все действия локальные: без сетевых вызовов и без отправки сообщений.
 */

type TemplateKey =
  | "greeting"
  | "photo_instruction"
  | "quality_failed"
  | "operator_handoff"
  | "booking_cta"
  | "follow_up";

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  greeting: "Приветствие",
  photo_instruction: "Инструкция по фото",
  quality_failed: "Запрос повторного фото",
  operator_handoff: "Передача оператору",
  booking_cta: "Запись на приём",
  follow_up: "Напоминание",
};

const DEFAULT_TEMPLATES: Record<TemplateKey, string> = {
  greeting:
    "Здравствуйте. Я помогу подготовить данные для очного приёма: вопросы, фото и запись. Предварительный ответ не является диагнозом.",
  photo_instruction:
    "Сделайте общий снимок и крупный план при ровном дневном свете. Без вспышки, бликов и теней. Это нужно только для подготовки к приёму.",
  quality_failed:
    "Фото нужно повторить: качество снимка недостаточно для подготовки материалов. Предварительный ответ не является диагнозом.",
  operator_handoff:
    "Передаю диалог оператору клиники. Оператор поможет с записью и организационными вопросами; медицинские выводы делает врач.",
  booking_cta:
    "Можно выбрать удобный слот для очного приёма. Запись подтвердит администратор клиники.",
  follow_up:
    "Напоминание: если вопрос сохраняется, запишитесь на очный осмотр. Предварительный ответ не является диагнозом.",
};

interface IntakeStep {
  id: string;
  label: string;
  detail: string;
  required: boolean;
}

const INTAKE_STEPS: IntakeStep[] = [
  {
    id: "consent",
    label: "Согласие и ограничение",
    detail: "ПДн, медицинская съёмка, бот не делает медицинский вывод.",
    required: true,
  },
  {
    id: "location",
    label: "Локализация",
    detail: "Где находится очаг: зона тела, сторона, привязка к карте тела.",
    required: true,
  },
  {
    id: "timeline",
    label: "Срок и изменение",
    detail: "Когда заметили, менялся ли размер, цвет, форма или ощущения.",
    required: true,
  },
  {
    id: "photo",
    label: "Фото",
    detail: "Общий вид + крупный план; проверка качества до маршрутизации.",
    required: true,
  },
  {
    id: "contact",
    label: "Запись",
    detail: "Клиника, слот, операторская проверка перед подтверждением.",
    required: false,
  },
];

const DIALOG_STATE_LABEL: Record<BotDialogState, string> = {
  new: "Новый",
  awaiting_photo: "Ждёт фото",
  awaiting_quality: "Ждёт качество",
  recommendation_sent: "Ответ отправлен",
  with_operator: "У оператора",
  booked: "Записан",
  closed: "Закрыт",
};

const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Новый",
  qualified: "Квалифицирован",
  booked: "Записан",
  lost: "Потерян",
  duplicate: "Дубль",
};

const PRIORITY_LABEL: Record<RiskLevel, string> = {
  low: "Планово",
  moderate: "Нужна проверка",
  high: "Приоритетно",
  urgent: "Срочно",
};

const PRIORITY_TONE: Record<RiskLevel, string> = {
  low: "border-info/40 bg-info/10 text-info",
  moderate: "border-warning/40 bg-warning/10 text-warning",
  high: "border-destructive/40 bg-destructive/10 text-destructive",
  urgent: "border-destructive/40 bg-destructive/10 text-destructive",
};

interface AuditEntry {
  id: string;
  ts: string;
  text: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function dialogLabel(dialogId: string): string {
  const suffix = dialogId.split("-").at(-1) ?? dialogId;
  return `Диалог ${suffix}`;
}

function cardLabel(card: AnalysisCard): string {
  return dialogLabel(card.dialogId);
}

function clinicName(id: string): string {
  return CLINICS.find((clinic) => clinic.id === id)?.name ?? "Клиника не выбрана";
}

export default function AdminBotSettingsPage() {
  const dialogs = getDialogs();
  const leads = getLeads();
  const cards = getAnalysisCards();

  const [templates, setTemplates] = useState<Record<TemplateKey, string>>(DEFAULT_TEMPLATES);
  const [enabledSteps, setEnabledSteps] = useState<Record<string, boolean>>(
    () => Object.fromEntries(INTAKE_STEPS.map((step) => [step.id, true])),
  );
  const [audit, setAudit] = useState<AuditEntry[]>([
    {
      id: "init",
      ts: nowIso(),
      text: "Открыт центр управления ботом: локальная сессия, сообщения не отправляются.",
    },
  ]);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<string | null>(null);

  const activeDialogs = useMemo(
    () => dialogs.filter((dialog) => dialog.state !== "closed"),
    [dialogs],
  );

  const photoQueue = useMemo(
    () =>
      cards.filter(
        (card) =>
          !card.qualityGate.passed ||
          card.qualityGate.score < 0.8 ||
          card.ctaType === "repeat_photo",
      ),
    [cards],
  );

  const escalationQueue = useMemo(
    () =>
      cards.filter((card) => {
        const dialog = dialogs.find((item) => item.id === card.dialogId);
        return (
          card.routingRisk === "urgent" ||
          card.routingRisk === "high" ||
          card.routingRisk === "moderate" ||
          dialog?.state === "with_operator"
        );
      }),
    [cards, dialogs],
  );

  const botLeads = useMemo(
    () => leads.filter((lead) => lead.source === "telegram" || lead.source === "whatsapp"),
    [leads],
  );

  const statusCards = [
    {
      label: "Активные диалоги",
      value: activeDialogs.length,
      hint: "кроме закрытых",
      tone: "info",
    },
    {
      label: "Нужно фото лучше",
      value: photoQueue.length,
      hint: "проверка качества",
      tone: "warn",
    },
    {
      label: "Передать оператору",
      value: escalationQueue.length,
      hint: "оператор/врач",
      tone: "danger",
    },
    {
      label: "Заявки из бота",
      value: botLeads.length,
      hint: "мессенджеры",
      tone: "ok",
    },
  ] as const;

  function appendAudit(text: string) {
    setAudit((items) => [
      { id: `${Date.now()}-${items.length}`, ts: nowIso(), text },
      ...items,
    ].slice(0, 24));
  }

  function localAction(text: string) {
    setLastAction(text);
    appendAudit(`${text}; сообщения не отправляются.`);
  }

  function requestRetake(card: AnalysisCard) {
    localAction(`Запрос повторного фото сформирован локально для ${cardLabel(card)}`);
  }

  function handoffOperator(card: AnalysisCard) {
    localAction(`Передача оператору подготовлена локально для ${cardLabel(card)}`);
  }

  function toggleStep(step: IntakeStep) {
    setEnabledSteps((current) => {
      const nextValue = !current[step.id];
      appendAudit(`Шаг сбора данных «${step.label}» ${nextValue ? "включён" : "выключен"} локально.`);
      return { ...current, [step.id]: nextValue };
    });
  }

  function updateTemplate(key: TemplateKey, value: string) {
    setTemplates((current) => ({ ...current, [key]: value }));
  }

  function resetTemplates() {
    setTemplates(DEFAULT_TEMPLATES);
    appendAudit("Безопасные шаблоны сброшены локально.");
  }

  function buildDryRun() {
    const enabledCount = INTAKE_STEPS.filter((step) => enabledSteps[step.id]).length;
    const preview = [
      "Пробная проверка сценария",
      "Граница: только локальная проверка, сообщения не отправляются.",
      `Шаги сбора данных: включено ${enabledCount} из ${INTAKE_STEPS.length}.`,
      `Очередь фото: ${photoQueue.length}; передача оператору: ${escalationQueue.length}; заявки из мессенджеров: ${botLeads.length}.`,
      "Безопасность: диагноз, риск, прогноз, служебные коды и внешние идентификаторы не показываются.",
    ].join("\n");
    setDryRun(preview);
    appendAudit("Пробная проверка сценария сформирована локально.");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Центр управления ботом"
        subtitle="сбор данных, маршрутизация, качество фото, передача оператору и журнал"
      />

      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] leading-relaxed text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
        Учебный режим: бот помогает собрать данные, проверить фото и передать
        обращение оператору. Сообщения не отправляются, бот не ставит диагноз
        и не показывает пациенту риск или прогноз.
      </div>

      <section aria-label="Операционный статус бота" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[13px] font-semibold">Операционный статус бота</h2>
          <div className="text-[11px] text-muted-foreground">учебные агрегаты</div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {statusCards.map((item) => (
            <StatusCard
              key={item.label}
              label={item.label}
              value={item.value}
              hint={item.hint}
              tone={item.tone}
            />
          ))}
        </div>
      </section>

      {lastAction && (
        <div
          role="status"
          className="rounded-md border border-info/40 bg-info/10 px-3 py-2 text-[13px]"
        >
          {lastAction}. Реальная отправка отключена: сообщения не отправляются.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]">
        <div className="min-w-0 space-y-5">
          <SectionCard
            title="Контроль качества фото"
            hint={`${photoQueue.length} требуют действия`}
          >
            <div className="space-y-2">
              {photoQueue.map((card) => (
                <QueueRow
                  key={card.id}
                  card={card}
                  primaryLabel="Запросить повтор фото"
                  secondaryLabel="Передать оператору"
                  onPrimary={() => requestRetake(card)}
                  onSecondary={() => handoffOperator(card)}
                />
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Передача оператору" hint={`${escalationQueue.length} в работе`}>
            <div className="space-y-2">
              {escalationQueue.map((card) => {
                const dialog = dialogs.find((item) => item.id === card.dialogId);
                return (
                  <div
                    key={card.id}
                    className="rounded-md border bg-card px-3 py-3 text-[13px]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium">{cardLabel(card)}</div>
                        <div className="mt-0.5 text-[12px] text-muted-foreground">
                          {dialog ? DIALOG_STATE_LABEL[dialog.state] : "Статус неизвестен"} ·{" "}
                          {clinicName(card.recommendedClinicId)}
                        </div>
                      </div>
                      <Badge className={PRIORITY_TONE[card.routingRisk]}>
                        {PRIORITY_LABEL[card.routingRisk]}
                      </Badge>
                    </div>
                    <div className="mt-2 rounded border bg-muted/30 px-2 py-1.5 text-[12px] text-muted-foreground">
                      Следующее действие: операторская проверка и запись без
                      автоматического медицинского вывода.
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="min-h-[44px] sm:min-h-[32px]"
                        onClick={() => handoffOperator(card)}
                      >
                        <Headphones className="size-4" aria-hidden />
                        Передать оператору
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-[44px] sm:min-h-[32px]"
                        onClick={() =>
                          localAction(`Приоритетная запись подготовлена локально для ${cardLabel(card)}`)
                        }
                      >
                        <ClipboardList className="size-4" aria-hidden />
                        Подготовить запись
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard title="Сценарии сбора данных" hint="обязательные шаги">
            <div className="grid gap-2 md:grid-cols-2">
              {INTAKE_STEPS.map((step) => (
                <div key={step.id} className="rounded-md border bg-card px-3 py-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-medium">{step.label}</span>
                        {step.required && (
                          <Badge variant="outline" className="text-[10px]">
                            обязательно
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 text-[12px] leading-snug text-muted-foreground">
                        {step.detail}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant={enabledSteps[step.id] ? "default" : "outline"}
                      className="min-h-[44px] shrink-0 px-3 text-[12px]"
                      aria-pressed={enabledSteps[step.id]}
                      aria-label={`Переключить шаг сбора данных «${step.label}»`}
                      onClick={() => toggleStep(step)}
                    >
                      {enabledSteps[step.id] ? "Включено" : "Выключено"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-5">
          <SectionCard title="Безопасные шаблоны" hint="локальная редакция">
            <div className="space-y-3">
              <div className="rounded-md border border-success/40 bg-success/10 px-3 py-2 text-[12px]">
                Все ключевые шаблоны содержат границу: предварительный ответ не
                является диагнозом, медицинские выводы делает врач.
              </div>
              {(Object.keys(TEMPLATE_LABELS) as TemplateKey[]).map((key) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`bot-template-${key}`} className="text-[13px]">
                    {TEMPLATE_LABELS[key]}
                  </Label>
                  <Textarea
                    id={`bot-template-${key}`}
                    value={templates[key]}
                    onChange={(event) => updateTemplate(key, event.target.value)}
                    rows={key === "photo_instruction" ? 4 : 3}
                    className="text-[13px] leading-snug"
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="min-h-[44px] sm:min-h-[32px]"
                onClick={resetTemplates}
              >
                <ShieldCheck className="size-4" aria-hidden />
                Сбросить безопасные шаблоны
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="Пробная проверка и журнал" hint="без внешних отправок">
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px] sm:min-h-[32px]"
                  onClick={() =>
                    localAction(
                      `Проверка сценариев: включено ${
                        INTAKE_STEPS.filter((step) => enabledSteps[step.id]).length
                      } из ${INTAKE_STEPS.length} шагов`,
                    )
                  }
                >
                  <CheckCircle2 className="size-4" aria-hidden />
                  Проверить сценарии
                </Button>
                <Button
                  type="button"
                  className="min-h-[44px] sm:min-h-[32px]"
                  onClick={buildDryRun}
                  aria-label="Сформировать пробную проверку сценария"
                >
                  <Bot className="size-4" aria-hidden />
                  Пробная проверка
                </Button>
              </div>

              {dryRun && (
                <pre className="max-h-56 overflow-auto rounded-md border bg-muted/40 p-2 text-[11px] leading-snug">
                  {dryRun}
                </pre>
              )}

              <ul className="max-h-72 space-y-1 overflow-auto text-[12px]" aria-label="Журнал аудита бота">
                {audit.map((item) => (
                  <li key={item.id} className="rounded border bg-card px-2 py-1">
                    <span className="text-muted-foreground">
                      {new Date(item.ts).toLocaleTimeString("ru-RU")}
                    </span>{" "}
                    — {item.text}
                  </li>
                ))}
              </ul>
            </div>
          </SectionCard>

          <SectionCard title="Безопасность сценария" hint="границы безопасности">
            <div className="space-y-2 text-[12px] leading-relaxed">
              <SafetyRow text="Нет автоматического диагноза, риска или прогноза для пациента." />
              <SafetyRow text="Сообщения не отправляются из этого экрана." />
              <SafetyRow text="Служебные коды, ссылки, внешние идентификаторы и пути к фото скрыты." />
              <SafetyRow text="Передача оператору означает организационную проверку, не врачебное заключение." />
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Заявки и статусы бота" hint="агрегированный контроль">
        <div className="grid gap-2 md:grid-cols-3">
          {botLeads.map((lead, index) => {
            const dialog = dialogs.find((item) => item.id === lead.dialogId);
            return (
              <div key={lead.id} className="rounded-md border bg-card px-3 py-2 text-[13px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">Заявка {index + 1}</div>
                  <Badge variant="outline">{LEAD_STATUS_LABEL[lead.status]}</Badge>
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  мессенджер ·{" "}
                  {dialog ? DIALOG_STATE_LABEL[dialog.state] : "без диалога"} ·{" "}
                  {formatTime(lead.createdAt)}
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </Card>
  );
}

function StatusCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "ok" | "warn" | "danger" | "info";
}) {
  const toneClass = {
    ok: "border-success/40 bg-success/10 text-success",
    warn: "border-warning/40 bg-warning/10 text-warning",
    danger: "border-destructive/40 bg-destructive/10 text-destructive",
    info: "border-info/40 bg-info/10 text-info",
  }[tone];

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-[22px] font-semibold leading-tight tabular-nums text-foreground">
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function QueueRow({
  card,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: {
  card: AnalysisCard;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <div className="rounded-md border bg-card px-3 py-3 text-[13px]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium">{cardLabel(card)}</div>
          <div className="mt-0.5 text-[12px] text-muted-foreground">
            Качество {pct(card.qualityGate.score)} ·{" "}
            {card.qualityGate.issues.length
              ? card.qualityGate.issues.join(", ")
              : "замечаний нет"}
          </div>
        </div>
        <Badge
          className={
            card.qualityGate.passed
              ? "border-warning/40 bg-warning/10 text-warning"
              : "border-destructive/40 bg-destructive/10 text-destructive"
          }
        >
          {card.qualityGate.passed ? "Проверить условия" : "Нужно переснять"}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="min-h-[44px] sm:min-h-[32px]"
          onClick={onPrimary}
        >
          <Camera className="size-4" aria-hidden />
          {primaryLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-[44px] sm:min-h-[32px]"
          onClick={onSecondary}
        >
          <Headphones className="size-4" aria-hidden />
          {secondaryLabel}
        </Button>
      </div>
    </div>
  );
}

function SafetyRow({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded border bg-card px-2 py-1.5">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <span>{text}</span>
    </div>
  );
}
