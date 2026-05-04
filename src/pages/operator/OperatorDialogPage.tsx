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
  getProtectedAnalysisLinkById,
  ANALYSIS_CARDS,
} from "@/lib/mock-data";
import type { BotMessage, LeadStatus } from "@/lib/domain";

const DEMO_NOW = new Date("2026-05-04T00:00:00Z");

const LEAD_LABEL: Record<LeadStatus, string> = {
  new: "Новый",
  qualified: "Квалифицирован",
  booked: "Записан",
  lost: "Потерян",
  duplicate: "Дубль",
};

const SAFETY_NOTE =
  "Предварительный анализ не является диагнозом. Окончательное решение принимает врач.";

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
          <div className="italic text-muted-foreground">Фото получено · скрыто в MVP</div>
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
  const link =
    lead?.protectedAnalysisLinkId
      ? getProtectedAnalysisLinkById(lead.protectedAnalysisLinkId)
      : undefined;

  const linkActive = link ? new Date(link.expiresAt).getTime() > DEMO_NOW.getTime() : false;

  const [localState, setLocalState] = useState<string | null>(null);
  const [audit, setAudit] = useState<string[]>([]);

  function logAction(label: string, status?: string) {
    if (status) setLocalState(status);
    setAudit((a) => [
      `${formatDateTime(DEMO_NOW.toISOString())} · ${label} · Демо-действие записано локально`,
      ...a,
    ]);
  }

  if (!dialog) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Диалог не найден" />
        <div className="p-4">
          <Button asChild variant="outline">
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
        title={`Диалог ${dialog.id}`}
        subtitle={`${dialog.channel.toUpperCase()} · ${dialog.externalUserRef} · ${dialog.state} · ${formatDateTime(
          dialog.lastMessageAt,
        )} · оператор: ${dialog.assignedOperatorId ?? "не назначен"}`}
        actions={
          <Button asChild variant="outline" size="sm">
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
              Локальные демо-действия
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                className="min-h-[44px]"
                onClick={() => logAction("Взял в работу", "in_work")}
              >
                Взять в работу
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => logAction("Эскалировано врачу", "escalated")}
              >
                Эскалировать врачу
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => logAction("Лид помечен квалифицированным", "qualified")}
              >
                Отметить лид квалифицированным
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-[44px]"
                onClick={() => logAction("Лид помечен потерянным", "lost")}
              >
                Отметить потерянным
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
                Запись через Mini App уже прототипирована. Реальная передача записи в клинику будет
                на этапе бэкенда.
              </p>
              <Button size="sm" disabled className="mt-2 min-h-[44px]">
                Передать запись (демо, отключено)
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
                Лид
              </div>
              <div className="font-mono">{lead.id}</div>
              <div>Статус: {LEAD_LABEL[lead.status]}</div>
              <div className="text-muted-foreground">Источник: {lead.source}</div>
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
                      source · {lead.utm.source}
                    </span>
                  )}
                  {lead.utm.medium && (
                    <span className="rounded-sm border px-1.5 py-0.5 text-[11px]">
                      medium · {lead.utm.medium}
                    </span>
                  )}
                  {lead.utm.campaign && (
                    <span className="rounded-sm border px-1.5 py-0.5 text-[11px]">
                      campaign · {lead.utm.campaign}
                    </span>
                  )}
                </div>
              )}
            </Card>
          ) : (
            <Card className="p-3 text-[13px] text-muted-foreground">Лид по диалогу не создан.</Card>
          )}

          {card ? (
            <Card className="p-3 text-[13px]">
              <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
                <span>Предварительный анализ</span>
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
                CTA: {card.ctaType}
              </div>
            </Card>
          ) : (
            <Card className="p-3 text-[13px] text-muted-foreground">
              AnalysisCard для диалога отсутствует.
            </Card>
          )}

          {link && (
            <Card className="p-3 text-[13px]">
              <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                Защищённая ссылка анализа
              </div>
              <div className="font-mono text-[11px] break-all">{link.token}</div>
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
                  <Link to={`/analysis/${link.token}`}>Открыть защищённый просмотр</Link>
                </Button>
              )}
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
