// Demo-only dialog simulator. Production uses the clinic booking request contract.
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/clinical/RiskBadge";
import { formatDateTime } from "@/lib/format";
import {
  CLINICS,
  getDialogById,
  getMessagesByDialogId,
  getLeads,
  getAnalysisCardForLead,
  ANALYSIS_CARDS,
} from "@/lib/mock-data";
import { getLeadLink } from "@/lib/operator-adapters";
import type { BotChannel, BotMessage, LeadStatus } from "@/lib/domain";

const DEMO_NOW = new Date("2026-05-04T00:00:00Z");

const LEAD_LABEL: Record<LeadStatus, string> = {
  new: "Новый",
  qualified: "Уточнён",
  booked: "Записан",
  lost: "Закрыт",
  duplicate: "Дубль",
};

const STATE_LABEL: Record<string, string> = {
  new: "Новый",
  awaiting_photo: "Ждёт фото",
  awaiting_quality: "Проверка качества",
  recommendation_sent: "Рекомендация отправлена",
  with_operator: "У оператора",
  booked: "Запись",
  closed: "Закрыт",
};

const NEXT_ACTION_LABEL: Record<string, string> = {
  book: "Записать на приём",
  repeat_photo: "Запросить фото лучше",
  urgent: "Передать врачу срочно",
};

const SAFETY_NOTE =
  "Предварительная сводка не является диагнозом. Окончательное решение принимает врач.";

const CHANNEL_LABEL: Record<BotChannel, string> = {
  telegram: "Телеграм",
  whatsapp: "Вотсап",
  web: "Сайт",
};

const LEAD_SOURCE_LABEL: Record<string, string> = {
  telegram: "Телеграм",
  whatsapp: "Вотсап",
  site: "Сайт",
  operator: "Оператор",
  phone: "Телефон",
  portal: "Портал",
  other: "Другое",
};

const UTM_VALUE_LABEL: Record<string, string> = {
  tg: "Телеграм",
  wa: "Вотсап",
  bot: "бот",
  miniapp: "форма записи",
  form: "форма",
  site: "сайт",
  skincheck_q1: "проверка кожи",
};

function getDialogLabel(id: string) {
  return `Обращение ${id.replace(/^bd-/, "") || id}`;
}

function getSafeChannelText(channel: BotChannel) {
  return `${CHANNEL_LABEL[channel]} · номер скрыт`;
}

function marketingValueLabel(value: string) {
  return UTM_VALUE_LABEL[value] ?? value.replaceAll("_", " ");
}

function MessageBubble({ m }: { m: BotMessage }) {
  const isIn = m.direction === "in";
  const isSystem = m.kind === "system";
  const isCta = m.kind === "cta";
  const isPhoto = m.kind === "photo";

  if (isSystem) {
    return (
      <div className="my-2 text-center text-[11px] uppercase tracking-wide text-muted-foreground">
        {m.payload}
        <div className="text-[10px] normal-case">{formatDateTime(m.createdAt)}</div>
      </div>
    );
  }

  return (
    <div className={`flex ${isIn ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] ${
          isIn
            ? "bg-muted text-foreground"
            : isCta
            ? "border border-primary/40 bg-primary/10 text-foreground"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {isPhoto ? (
          <div className="italic text-muted-foreground">Фото получено · скрыто в прототипе</div>
        ) : (
          <div>{m.payload}</div>
        )}
        <div className="mt-1 text-[10px] opacity-70">{formatDateTime(m.createdAt)}</div>
      </div>
    </div>
  );
}

export default function OperatorDialogPage() {
  const { id = "" } = useParams();
  const dialog = getDialogById(id);
  const messages = useMemo(() => getMessagesByDialogId(id), [id]);

  const lead = useMemo(() => getLeads().find((l) => l.dialogId === id), [id]);
  const card = lead
    ? getAnalysisCardForLead(lead.id)
    : ANALYSIS_CARDS.find((c) => c.dialogId === id);
  const link = getLeadLink(lead);

  const linkActive = link ? new Date(link.expiresAt).getTime() > DEMO_NOW.getTime() : false;

  const [localState, setLocalState] = useState<string | null>(null);
  const [audit, setAudit] = useState<string[]>([]);

  function logAction(label: string, status?: string) {
    if (status) setLocalState(status);
    setAudit((a) => [
      `${formatDateTime(DEMO_NOW.toISOString())} · ${label} · Учебное действие записано локально`,
      ...a,
    ]);
  }

  if (!dialog) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Диалог не найден" />
        <div className="p-4">
          <Button asChild variant="outline" className="min-h-[44px]">
            <Link to="/operator">
              <ArrowLeft className="h-4 w-4" /> К очереди
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={getDialogLabel(dialog.id)}
        subtitle={`${getSafeChannelText(dialog.channel)} · ${STATE_LABEL[dialog.state] ?? dialog.state} · ${formatDateTime(
          dialog.lastMessageAt,
        )} · оператор: ${dialog.assignedOperatorId ? "назначен" : "не назначен"}`}
        actions={
          <Button asChild variant="outline" size="sm" className="min-h-[44px]">
            <Link to="/operator">
              <ArrowLeft className="h-4 w-4" /> К очереди
            </Link>
          </Button>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-auto p-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card className="flex min-h-[300px] flex-col gap-2 p-3">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Переписка
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-auto">
              {messages.map((m) => (
                <MessageBubble key={m.id} m={m} />
              ))}
              {messages.length === 0 && (
                <div className="text-center text-[12px] text-muted-foreground">
                  Сообщений нет.
                </div>
              )}
            </div>
          </Card>

          <Card className="p-3 text-[13px]">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              Учебные действия
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="min-h-[44px]"
                onClick={() => logAction("Взял в работу", "в работе")}
              >
                Взять в работу
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => logAction("Передано врачу", "передано врачу")}
              >
                Передать врачу
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => logAction("Заявка уточнена", "уточнена")}
              >
                Отметить заявку уточнённой
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => logAction("Заявка закрыта без записи", "закрыта без записи")}
              >
                Закрыть без записи
              </Button>
            </div>
            {localState && (
              <div className="mt-2 text-[12px] text-muted-foreground">
                Локальный статус: <span className="text-foreground">{localState}</span>
              </div>
            )}
            {audit.length > 0 && (
              <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                {audit.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            )}
          </Card>

          {lead && (
            <Card className="p-3 text-[13px]">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                Запись на приём
              </div>
              <p className="text-muted-foreground">
                Запись через форму уже прототипирована. Реальная передача записи в клинику будет
                после подключения клиники.
              </p>
              <Button size="sm" disabled className="mt-2 min-h-[44px]">
                Передача записи отключена
              </Button>
            </Card>
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-3">
          <Card className="p-3 text-[13px]">
            <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" /> Безопасность данных
            </div>
            <p className="text-muted-foreground">{SAFETY_NOTE}</p>
          </Card>

          {lead ? (
            <Card className="p-3 text-[13px]">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                Заявка
              </div>
              <div>Статус: {LEAD_LABEL[lead.status]}</div>
              <div className="text-muted-foreground">Источник: {LEAD_SOURCE_LABEL[lead.source] ?? "Другое"}</div>
              <div className="text-muted-foreground">
                Клиника: {CLINICS.find((c) => c.id === lead.clinicId)?.name ?? "—"}
              </div>
              <div className="text-muted-foreground">
                Создан: {formatDateTime(lead.createdAt)}
              </div>
              {(lead.utm.source || lead.utm.medium || lead.utm.campaign) && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {lead.utm.source && (
                    <span className="rounded-sm border px-1.5 py-0.5 text-[11px]">
                      Источник · {marketingValueLabel(lead.utm.source)}
                    </span>
                  )}
                  {lead.utm.medium && (
                    <span className="rounded-sm border px-1.5 py-0.5 text-[11px]">
                      Канал · {marketingValueLabel(lead.utm.medium)}
                    </span>
                  )}
                  {lead.utm.campaign && (
                    <span className="rounded-sm border px-1.5 py-0.5 text-[11px]">
                      Кампания · {marketingValueLabel(lead.utm.campaign)}
                    </span>
                  )}
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-3 text-[13px] text-muted-foreground">Заявка по обращению не создана.</Card>
          )}

          {card ? (
            <Card className="p-3 text-[13px]">
              <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>Предварительная сводка</span>
                <RiskBadge level={card.routingRisk} />
              </div>
              <p className="text-foreground">{card.safeSummary}</p>
              <div className="mt-2 text-[12px] text-muted-foreground">
                Качество фото: {Math.round(card.qualityGate.score * 100)}%
                {card.qualityGate.issues.length > 0 && (
                  <> · {card.qualityGate.issues.join(", ")}</>
                )}
              </div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                Следующее действие: {NEXT_ACTION_LABEL[card.ctaType] ?? "Передать оператору"}
              </div>
            </Card>
          ) : (
            <Card className="p-3 text-[13px] text-muted-foreground">
              Безопасное резюме для обращения отсутствует.
            </Card>
          )}

          {link && (
            <Card className="p-3 text-[13px]">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                Защищённая ссылка анализа
              </div>
              <div className="rounded-md bg-muted p-2 text-[12px] text-muted-foreground">
                Доступ скрыт в операторском интерфейсе. Видны только статус и срок действия.
              </div>
              <div className="mt-1">
                Статус:{" "}
                <span className={linkActive ? "text-foreground" : "text-muted-foreground"}>
                  {linkActive ? "активна" : "истекла"}
                </span>
              </div>
              <div className="text-muted-foreground">
                Действует до {formatDateTime(link.expiresAt)}
              </div>
              {linkActive && (
                <Button asChild size="sm" variant="outline" className="mt-2 min-h-[44px]">
                  <Link to={`/operator/dialogs/${dialog.id}`}>Остаться в карточке диалога</Link>
                </Button>
              )}
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
