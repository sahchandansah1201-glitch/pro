import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/clinical/RiskBadge";
import { formatDateTime } from "@/lib/format";
import {
  CLINICS,
  getDialogs,
  getLeads,
  getMessagesByDialogId,
  ANALYSIS_CARDS,
} from "@/lib/mock-data";
import { getDialogUserHandle, getLeadLink } from "@/lib/operator-adapters";
import type { BotChannel, BotDialogState } from "@/lib/domain";

const DEMO_NOW = new Date("2026-05-04T00:00:00Z");

const STATE_FILTERS: { value: "all" | BotDialogState; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "new", label: "Новые" },
  { value: "with_operator", label: "У оператора" },
  { value: "recommendation_sent", label: "Рекомендация отправлена" },
  { value: "booked", label: "Запись" },
  { value: "closed", label: "Закрытые" },
];

const CHANNEL_FILTERS: { value: "all" | BotChannel; label: string }[] = [
  { value: "all", label: "Все каналы" },
  { value: "telegram", label: "Телеграм" },
  { value: "whatsapp", label: "Вотсап" },
  { value: "web", label: "Сайт" },
];

const STATE_LABEL: Record<BotDialogState, string> = {
  new: "Новый",
  awaiting_photo: "Ждёт фото",
  awaiting_quality: "Проверка качества",
  recommendation_sent: "Рекомендация",
  with_operator: "У оператора",
  booked: "Запись",
  closed: "Закрыт",
};

const LEAD_LABEL: Record<string, string> = {
  new: "Новый",
  qualified: "Уточнён",
  booked: "Записан",
  lost: "Закрыт",
  duplicate: "Дубль",
};

const CHANNEL_LABEL: Record<BotChannel, string> = {
  telegram: "Телеграм",
  whatsapp: "Вотсап",
  web: "Сайт",
};

const MESSAGE_KIND_LABEL: Record<string, string> = {
  text: "текст",
  photo: "фото",
  system: "система",
  cta: "действие",
};

function getDialogLabel(id: string) {
  return `Обращение ${id.replace(/^bd-/, "") || id}`;
}

function getSafeChannelText(channel: BotChannel) {
  return `${CHANNEL_LABEL[channel]} · номер скрыт`;
}

export default function OperatorConsolePageDemo() {
  const dialogs = getDialogs();
  const leads = getLeads();

  const [stateFilter, setStateFilter] = useState<"all" | BotDialogState>("all");
  const [channelFilter, setChannelFilter] = useState<"all" | BotChannel>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(dialogs[0]?.id ?? null);
  const [handoffStatus, setHandoffStatus] = useState("Ожидает выбора");

  const leadsByDialog = useMemo(() => {
    const map = new Map<string, typeof leads[number]>();
    for (const l of leads) if (l.dialogId) map.set(l.dialogId, l);
    return map;
  }, [leads]);

  const cardsByDialog = useMemo(() => {
    const map = new Map<string, typeof ANALYSIS_CARDS[number]>();
    for (const c of ANALYSIS_CARDS) map.set(c.dialogId, c);
    return map;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dialogs.filter((d) => {
      if (stateFilter !== "all" && d.state !== stateFilter) return false;
      if (channelFilter !== "all" && d.channel !== channelFilter) return false;
      if (!q) return true;
      const lead = leadsByDialog.get(d.id);
      return (
        d.id.toLowerCase().includes(q) ||
        getDialogUserHandle(d).toLowerCase().includes(q) ||
        (lead?.id.toLowerCase().includes(q) ?? false)
      );
    });
  }, [dialogs, stateFilter, channelFilter, search, leadsByDialog]);

  const totals = useMemo(() => {
    const newLeads = leads.filter((l) => l.status === "new").length;
    const booked = leads.filter((l) => l.status === "booked").length;
    const urgent = ANALYSIS_CARDS.filter(
      (c) => c.routingRisk === "urgent" || c.routingRisk === "high",
    ).length;
    return { dialogs: dialogs.length, newLeads, booked, urgent };
  }, [dialogs, leads]);

  const handoffQueue = useMemo(() => {
    return dialogs.flatMap((d) => {
      const lead = leadsByDialog.get(d.id);
      const card = cardsByDialog.get(d.id);
      const needsPhoto =
        d.state === "awaiting_photo" ||
        d.state === "awaiting_quality" ||
        card?.ctaType === "repeat_photo" ||
        card?.qualityGate.passed === false ||
        (card?.qualityGate.score ?? 1) < 0.72;
      const needsDoctor =
        d.state === "with_operator" ||
        card?.routingRisk === "moderate" ||
        card?.routingRisk === "high" ||
        card?.routingRisk === "urgent";

      if (!needsPhoto && !needsDoctor) return [];

      const actionLabel =
        d.state === "with_operator" || !needsPhoto ? "Передать врачу" : "Нужно фото лучше";
      const detail =
        actionLabel === "Передать врачу"
          ? "Проверить контекст, закрыть организационные вопросы и передать врачу без диагноза."
          : "Попросить повторный снимок: свет, фокус, расстояние и привязка к обращению.";

      return [
        {
          id: d.id,
          label: getDialogLabel(d.id),
          channel: getSafeChannelText(d.channel),
          actionLabel,
          detail,
          leadStatus: lead ? LEAD_LABEL[lead.status] ?? lead.status : "Заявка не создана",
          quality: card ? `${Math.round(card.qualityGate.score * 100)}%` : "нет снимка",
          state: STATE_LABEL[d.state],
        },
      ];
    });
  }, [dialogs, leadsByDialog, cardsByDialog]);

  const selected = filtered.find((d) => d.id === selectedId) ?? filtered[0];
  const selectedLead = selected ? leadsByDialog.get(selected.id) : undefined;
  const selectedCard = selected ? cardsByDialog.get(selected.id) : undefined;
  const selectedLink = getLeadLink(selectedLead);
  const lastMessage = selected ? getMessagesByDialogId(selected.id).slice(-1)[0] : undefined;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Консоль оператора"
        subtitle={`Диалогов: ${totals.dialogs} · Новых заявок: ${totals.newLeads} · Запись: ${totals.booked} · Срочных/высоких: ${totals.urgent}`}
      />

      <section
        aria-labelledby="operator-transfer-title"
        className="mx-4 mt-4 shrink-0 rounded-lg border bg-card p-3 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="operator-transfer-title" className="text-[15px] font-semibold">
              Центр обращений оператора
            </h2>
            <p className="mt-1 max-w-[760px] text-[12px] leading-5 text-muted-foreground">
              Оператор закрывает организационные задачи: качество фото, запись, контактные
              данные и передачу врачу. Сообщения не отправляются из этого экрана.
            </p>
          </div>
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            aria-label="Статус передачи"
            className="min-h-[36px] rounded-md border bg-background px-3 py-2 text-[12px] font-medium"
          >
            <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
              Статус передачи
            </span>
            <span>{handoffStatus}</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 xl:grid-cols-[180px_minmax(0,1fr)]">
          <div className="rounded-md bg-muted p-3 text-[12px]">
            <div className="font-medium">Очередь передачи</div>
            <div className="mt-1 text-muted-foreground">
              {handoffQueue.length} задач · локальное состояние
            </div>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-3">
            {handoffQueue.map((item) => (
              <article key={item.id} className="min-w-0 rounded-md border bg-background p-3">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-[12px] font-semibold">{item.label}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {item.channel} · {item.state} · {item.leadStatus}
                    </div>
                  </div>
                  <span className="rounded-sm border px-1.5 py-0.5 text-[11px]">
                    {item.actionLabel}
                  </span>
                </div>
                <div className="mt-2 text-[12px] leading-5 text-muted-foreground">
                  {item.detail}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>Качество: {item.quality}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto min-h-[44px]"
                    onClick={() => setHandoffStatus(`В работе: ${item.label}`)}
                  >
                    Принять в работу {item.label}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-3 overflow-hidden">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1">
              {STATE_FILTERS.map((f) => (
                <Button
                  key={f.value}
                  size="sm"
                  variant={stateFilter === f.value ? "default" : "outline"}
                  onClick={() => setStateFilter(f.value)}
                  className="min-h-[44px]"
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {CHANNEL_FILTERS.map((f) => (
                <Button
                  key={f.value}
                  size="sm"
                  variant={channelFilter === f.value ? "default" : "outline"}
                  onClick={() => setChannelFilter(f.value)}
                  className="min-h-[44px]"
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <Input
              placeholder="Поиск по обращению, пользователю, заявке"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-h-[44px] max-w-xs"
            />
          </div>

          <div className="flex-1 space-y-2 overflow-auto pr-1">
            {filtered.length === 0 && (
              <div className="rounded-md border border-dashed p-6 text-center text-[13px] text-muted-foreground">
                Нет диалогов под фильтры.
              </div>
            )}
            {filtered.map((d) => {
              const lead = leadsByDialog.get(d.id);
              const card = cardsByDialog.get(d.id);
              const active = selected?.id === d.id;
              return (
                <Card
                  key={d.id}
                  onClick={() => setSelectedId(d.id)}
                  className={`min-h-[44px] cursor-pointer p-3 transition-colors ${
                    active ? "border-primary" : "hover:border-primary/40"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="text-foreground">{getDialogLabel(d.id)}</span>
                      <span className="rounded-sm border px-1.5 py-0.5 text-muted-foreground">
                        {CHANNEL_LABEL[d.channel]}
                      </span>
                      <span className="text-muted-foreground">{getSafeChannelText(d.channel)}</span>
                      <span className="rounded-sm bg-muted px-1.5 py-0.5">{STATE_LABEL[d.state]}</span>
                      {lead && (
                        <span className="rounded-sm border px-1.5 py-0.5">
                          заявка · {LEAD_LABEL[lead.status] ?? lead.status}
                        </span>
                      )}
                      {card && <RiskBadge level={card.routingRisk} />}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        {formatDateTime(d.lastMessageAt)}
                      </span>
                      <Button asChild size="sm" variant="outline" className="min-h-[44px]">
                        <Link to={`/operator/dialogs/${d.id}`}>Открыть</Link>
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <aside className="hidden min-w-0 flex-col gap-3 overflow-auto lg:flex">
          {selected ? (
            <>
              <Card className="p-3 text-[13px]">
                <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Превью диалога
                </div>
                <div>{getDialogLabel(selected.id)}</div>
                <div className="text-muted-foreground">{getSafeChannelText(selected.channel)}</div>
                <div className="mt-1">{STATE_LABEL[selected.state]}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {formatDateTime(selected.lastMessageAt)}
                </div>
                {lastMessage && (
                  <div className="mt-2 rounded-md bg-muted p-2 text-[12px]">
                    <div className="mb-0.5 text-[10px] uppercase text-muted-foreground">
                      {lastMessage.direction === "in" ? "От пользователя" : "От бота"} ·{" "}
                      {MESSAGE_KIND_LABEL[lastMessage.kind] ?? "сообщение"}
                    </div>
                    {lastMessage.kind === "photo"
                      ? "Фото получено · скрыто в прототипе"
                      : lastMessage.payload}
                  </div>
                )}
              </Card>

              {selectedLead && (
                <Card className="p-3 text-[13px]">
                  <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Заявка
                  </div>
                  <div>
                    Статус: {LEAD_LABEL[selectedLead.status] ?? selectedLead.status}
                  </div>
                  <div className="text-muted-foreground">
                    {CLINICS.find((c) => c.id === selectedLead.clinicId)?.name ?? "—"}
                  </div>
                </Card>
              )}

              {selectedLink && (() => {
                const expiresMs = new Date(selectedLink.expiresAt).getTime();
                const diffMs = expiresMs - DEMO_NOW.getTime();
                const selectedLinkActive = diffMs > 0;
                const absMs = Math.abs(diffMs);
                const hours = Math.round(absMs / 3_600_000);
                const days = Math.round(absMs / 86_400_000);
                const remainingLabel =
                  absMs >= 86_400_000 ? `${days} дн.` : `${hours} ч.`;
                return (
                  <Card
                    role="region"
                    aria-label="Защищённая ссылка анализа"
                    tabIndex={0}
                    className="p-3 text-[13px] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                      Защищённая ссылка анализа
                    </div>
                    <div className="rounded-md bg-muted p-2 text-[12px] text-muted-foreground">
                      Доступ скрыт в операторском списке: оператор видит только статус и срок
                      действия.
                    </div>
                    <div className="text-muted-foreground">
                      Действует до {formatDateTime(selectedLink.expiresAt)}
                      {" · "}
                      <span className={selectedLinkActive ? "text-foreground" : "text-destructive"}>
                        {selectedLinkActive ? `осталось ${remainingLabel}` : `истекла ${remainingLabel} назад`}
                      </span>
                    </div>
                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="shrink-0 text-[12px] text-muted-foreground" aria-hidden="true">
                        Статус:
                      </span>
                      <span
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                        tabIndex={0}
                        aria-label={
                          selectedLinkActive
                            ? `Статус защищённой ссылки: активна, осталось ${remainingLabel}`
                            : `Статус защищённой ссылки: истекла ${remainingLabel} назад`
                        }
                        className={`inline-flex w-fit max-w-full shrink-0 flex-nowrap items-center gap-1.5 whitespace-nowrap break-keep rounded-full border px-2 py-0.5 align-middle text-[12px] font-semibold leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                          selectedLinkActive
                            ? "border-[hsl(158_70%_24%)] bg-[hsl(158_70%_24%)] text-white"
                            : "border-[hsl(0_75%_36%)] bg-[hsl(0_75%_36%)] text-white"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className="inline-block h-[0.5em] w-[0.5em] shrink-0 self-center rounded-full bg-current leading-none"
                        />
                        <span
                          aria-hidden="true"
                          className="inline-block self-center whitespace-nowrap leading-none"
                        >
                          {selectedLinkActive ? "активна" : "истекла"}
                        </span>
                      </span>
                    </div>
                    <div className="mt-3">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="min-h-[44px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                    <Link to={`/operator/dialogs/${selected.id}`}>Открыть карточку обращения</Link>
                      </Button>
                    </div>
                  </Card>
                );
              })()}

              {selectedCard && (
                <Card className="p-3 text-[13px]">
                  <div className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    Безопасное резюме
                  </div>
                  <p className="text-foreground">{selectedCard.safeSummary}</p>
                </Card>
              )}
            </>
          ) : (
            <Card className="p-3 text-[13px] text-muted-foreground">Выберите диалог.</Card>
          )}
        </aside>
      </div>
    </div>
  );
}
