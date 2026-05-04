import { useMemo, useState } from "react";
import { Inbox, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getLeads,
  getAppointments,
  getDialogs,
  getAnalysisCards,
  getClinics,
} from "@/lib/mock-data";
import type {
  BotDialogState,
  LeadStatus,
  PartnerTier,
  RiskLevel,
} from "@/lib/domain";
import { resolveEmptyCopy, type EmptyStateKey } from "./analytics-empty-copy";

/**
 * Аналитика клиники (MVP): агрегаты по воронке лидов, источникам,
 * маршрутизации, риску, качеству фото и состояниям бот-диалогов.
 *
 * SAFETY:
 *   - Только агрегаты (counts/percentages). Никаких пациент-уровневых
 *     полей: имена, контакты, фото, диагнозы, ссылки, AI/XAI детали,
 *     внешние идентификаторы пользователей мессенджера и т.п. — не
 *     импортируются и не рендерятся.
 *   - Никаких сетевых вызовов, clipboard, storage. Только локальное
 *     состояние внутри компонента.
 */

// ───────── Range filter ─────────

type RangeKey = "all" | "march_2026" | "last_90d";
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "all", label: "Все данные" },
  { key: "march_2026", label: "Март 2026" },
  { key: "last_90d", label: "Последние 90 дней" },
];

/**
 * Фиксированный «сейчас» для детерминированных демо-данных.
 * MVP без реального clock — не импортируем Date.now во избежание дрейфа
 * в тестах/снимках.
 */
const NOW_ISO = "2026-03-13T12:00:00Z";

function inRange(iso: string, range: RangeKey): boolean {
  if (range === "all") return true;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  if (range === "march_2026") {
    const start = Date.parse("2026-03-01T00:00:00Z");
    const end = Date.parse("2026-04-01T00:00:00Z");
    return t >= start && t < end;
  }
  // last_90d
  const now = Date.parse(NOW_ISO);
  const start = now - 90 * 24 * 60 * 60 * 1000;
  return t >= start && t <= now;
}

// ───────── Labels ─────────

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Низкий",
  moderate: "Умеренный",
  high: "Высокий",
  urgent: "Срочный",
};

const RISK_TONE: Record<RiskLevel, string> = {
  low: "hsl(var(--success))",
  moderate: "hsl(var(--info))",
  high: "hsl(var(--warning))",
  urgent: "hsl(var(--destructive))",
};

const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Новый",
  qualified: "Квалифицирован",
  booked: "Записан",
  lost: "Потерян",
  duplicate: "Дубль",
};

const SOURCE_LABEL: Record<string, string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  web: "Web",
  site: "Сайт",
  operator: "Оператор",
};

const DIALOG_STATE_LABEL: Record<BotDialogState, string> = {
  new: "Новый",
  awaiting_photo: "Ожидает фото",
  awaiting_quality: "Ожидает качества",
  recommendation_sent: "Рекомендация отправлена",
  with_operator: "У оператора",
  booked: "Записан",
  closed: "Закрыт",
};

const PARTNER_TIER_LABEL: Record<PartnerTier, string> = {
  owned: "Своя",
  partner: "Партнёр",
  external: "Внешняя",
};

// ───────── Helpers ─────────

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function fmtPct(n: number): string {
  return `${n}%`;
}

// ───────── Subcomponents ─────────

function KpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-[20px] font-semibold leading-tight tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function Bar({ value, max, tone = "hsl(var(--primary))" }: { value: number; max: number; tone?: string }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full"
        style={{ width: `${w}%`, background: tone }}
        aria-hidden
      />
    </div>
  );
}

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[13px] font-semibold">{title}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </Card>
  );
}

/**
 * Унифицированное пустое состояние для всех секций аналитики.
 * Одинаковая высота, иконка, основной заголовок и подсказка
 * с указанием выбранного периода — чтобы все секции выглядели
 * визуально согласованно при отсутствии данных.
 */
function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-empty="true"
      className="flex min-h-[120px] flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-surface px-4 py-6 text-center"
    >
      <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden />
      <div className="text-[12px] font-medium text-foreground">{title}</div>
      {hint && (
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

// ───────── Page ─────────

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<RangeKey>("all");
  const [clinicSort, setClinicSort] = useState<"priority" | "conversion">(
    "priority",
  );
  const [reportPreview, setReportPreview] = useState<string | null>(null);

  const rangeLabel =
    RANGES.find((r) => r.key === range)?.label ?? "выбранный период";

  /** Хелпер для рендера empty-state через единый словарь. */
  const renderEmpty = (key: EmptyStateKey) => {
    const c = resolveEmptyCopy(key, rangeLabel);
    return <EmptyState title={c.title} hint={c.hint} />;
  };

  const all = useMemo(() => {
    const leads = getLeads();
    const appointments = getAppointments();
    const dialogs = getDialogs();
    const cards = getAnalysisCards();
    const clinics = getClinics();
    return { leads, appointments, dialogs, cards, clinics };
  }, []);

  const data = useMemo(() => {
    const leads = all.leads.filter((l) => inRange(l.createdAt, range));
    const appointments = all.appointments.filter((a) => inRange(a.slotAt, range));
    const dialogs = all.dialogs.filter((d) => inRange(d.lastMessageAt, range));
    const cards = all.cards.filter((c) => inRange(c.createdAt, range));
    return { ...all, leads, appointments, dialogs, cards };
  }, [all, range]);

  // Funnel
  const totalLeads = data.leads.length;
  const qualifiedLeads = data.leads.filter((l) => l.status === "qualified" || l.status === "booked").length;
  const bookedLeads = data.leads.filter((l) => l.status === "booked").length;
  const visits = data.appointments.filter((a) => a.status === "completed").length;

  const conversionLeadToBooking = pct(bookedLeads, totalLeads);
  const highOrUrgent = data.cards.filter((c) => c.routingRisk === "high" || c.routingRisk === "urgent").length;

  // Funnel rows
  const funnelMax = Math.max(totalLeads, qualifiedLeads, bookedLeads, visits, 1);
  const funnel = [
    { key: "lead", label: "Лиды", value: totalLeads },
    { key: "qualified", label: "Квалифицированы", value: qualifiedLeads },
    { key: "booked", label: "Записаны", value: bookedLeads },
    { key: "visit", label: "Визиты", value: visits },
  ];

  // Sources
  const bySource = useMemo(() => {
    const map = new Map<string, { source: string; count: number; booked: number }>();
    for (const l of data.leads) {
      const key = l.source;
      const cur = map.get(key) ?? { source: key, count: 0, booked: 0 };
      cur.count += 1;
      if (l.status === "booked") cur.booked += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [data.leads]);

  // Clinics routing (агрегаты, без персональных данных)
  const byClinic = useMemo(() => {
    const rows = data.clinics.map((c) => {
      const leadsForClinic = data.leads.filter((l) => l.clinicId === c.id);
      const bookedForClinic = leadsForClinic.filter(
        (l) => l.status === "booked",
      ).length;
      return {
        id: c.id,
        name: c.name,
        partnerTier: c.partnerTier,
        routingPriority: c.routingPriority,
        leads: leadsForClinic.length,
        booked: bookedForClinic,
        conv: pct(bookedForClinic, leadsForClinic.length),
      };
    });
    if (clinicSort === "conversion") {
      // По убыванию конверсии; tie-break: больше лидов → выше приоритет (меньше число).
      rows.sort(
        (a, b) =>
          b.conv - a.conv ||
          b.leads - a.leads ||
          a.routingPriority - b.routingPriority,
      );
    } else {
      // По возрастанию routingPriority (1 — самый высокий приоритет).
      rows.sort(
        (a, b) =>
          a.routingPriority - b.routingPriority || b.conv - a.conv,
      );
    }
    return rows;
  }, [data.clinics, data.leads, clinicSort]);

  // Risk distribution
  const riskDist = useMemo(() => {
    const order: RiskLevel[] = ["low", "moderate", "high", "urgent"];
    return order.map((r) => ({
      key: r,
      label: RISK_LABEL[r],
      count: data.cards.filter((c) => c.routingRisk === r).length,
    }));
  }, [data.cards]);

  // Image quality
  const totalCards = data.cards.length;
  const passed = data.cards.filter((c) => c.qualityGate.passed).length;
  const needsRepeat = totalCards - passed;
  const avgScore =
    totalCards > 0
      ? Math.round(
          (data.cards.reduce((acc, c) => acc + c.qualityGate.score, 0) / totalCards) * 100,
        )
      : 0;
  const repeatCta = data.cards.filter((c) => c.ctaType === "repeat_photo").length;

  // Bot dialog state aggregates
  const dialogStates = useMemo(() => {
    const order: BotDialogState[] = [
      "new",
      "awaiting_photo",
      "awaiting_quality",
      "recommendation_sent",
      "with_operator",
      "booked",
      "closed",
    ];
    return order.map((s) => ({
      key: s,
      label: DIALOG_STATE_LABEL[s],
      count: data.dialogs.filter((d) => d.state === s).length,
    }));
  }, [data.dialogs]);

  const onGenerateReport = () => {
    const safeAggregate = {
      range,
      kpi: {
        leads: totalLeads,
        qualified: qualifiedLeads,
        booked: bookedLeads,
        visits,
        conversionLeadToBookingPct: conversionLeadToBooking,
        highOrUrgent,
      },
      funnel: funnel.map((f) => ({ stage: f.key, count: f.value })),
      sources: bySource.map((s) => ({
        source: s.source,
        count: s.count,
        sharePct: pct(s.count, totalLeads),
        booked: s.booked,
      })),
      clinics: byClinic.map((c) => ({
        name: c.name,
        partnerTier: c.partnerTier,
        routingPriority: c.routingPriority,
        leads: c.leads,
        booked: c.booked,
        conversionPct: c.conv,
      })),
      risk: riskDist.map((r) => ({
        level: r.key,
        label: r.label,
        count: r.count,
        sharePct: pct(r.count, totalCards),
      })),
      imageQuality: {
        passed,
        needsRepeat,
        avgScorePct: avgScore,
        repeatPhotoCtaCount: repeatCta,
      },
      botDialogStates: dialogStates.map((s) => ({
        state: s.key,
        label: s.label,
        count: s.count,
      })),
    };
    setReportPreview(JSON.stringify(safeAggregate, null, 2));
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Аналитика"
        subtitle="Воронка лидов, запись, маршрутизация и качество фото · агрегированные демо-данные"
      />

      <div className="space-y-4 p-4">
        {/* Safety banner */}
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]"
          style={{
            background: "hsl(var(--warning) / 0.08)",
            borderColor: "hsl(var(--warning) / 0.30)",
            color: "hsl(var(--warning))",
          }}
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Только агрегаты. Без PHI, фото, диагнозов и AI/XAI деталей. Внешние системы не вызываются.
          </span>
        </div>

        {/* Range segmented control */}
        <div
          role="tablist"
          aria-label="Период"
          className="inline-flex flex-wrap gap-1 rounded-md border border-border bg-surface p-1"
        >
          {RANGES.map((r) => {
            const active = r.key === range;
            return (
              <button
                key={r.key}
                role="tab"
                aria-selected={active}
                onClick={() => setRange(r.key)}
                className={`min-h-[36px] rounded px-3 text-[12px] font-medium transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Лиды" value={totalLeads} />
          <KpiCard label="Квалифицированы" value={qualifiedLeads} />
          <KpiCard label="Записаны" value={bookedLeads} />
          <KpiCard label="Визиты" value={visits} hint="завершённые приёмы" />
          <KpiCard
            label="Конверсия лид → запись"
            value={fmtPct(conversionLeadToBooking)}
          />
          <KpiCard
            label="Высокий / срочный маршрут"
            value={highOrUrgent}
            hint="по предварительной оценке"
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {/* Funnel */}
          <SectionCard title="Воронка" hint="MVP: расчёт построен на мок-данных.">
            {totalLeads === 0 ? (
              <EmptyState title="Нет лидов" hint={emptyHint} />
            ) : (
              <ul className="space-y-3">
                {funnel.map((row) => {
                  const sharePct = pct(row.value, totalLeads);
                  return (
                    <li key={row.key}>
                      <div className="flex items-baseline justify-between gap-2 text-[12px]">
                        <span className="font-medium">{row.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {row.value} · {fmtPct(sharePct)}
                        </span>
                      </div>
                      <div className="mt-1">
                        <Bar value={row.value} max={funnelMax} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {/* Sources */}
          <SectionCard title="Источники лидов">
            {bySource.length === 0 ? (
              <EmptyState title="Нет источников" hint={emptyHint} />
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {bySource.map((s) => (
                  <div
                    key={s.source}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-2 text-[12px]"
                  >
                    <span className="font-medium">
                      {SOURCE_LABEL[s.source] ?? s.source}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.count}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {fmtPct(pct(s.count, totalLeads))}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      записан: {s.booked}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Clinics */}
          <SectionCard
            title="Маршрутизация по клиникам"
            hint={
              <span
                role="tablist"
                aria-label="Сортировка клиник"
                className="inline-flex gap-1 rounded-md border border-border bg-surface p-0.5"
              >
                {([
                  ["priority", "По приоритету"],
                  ["conversion", "По конверсии"],
                ] as const).map(([key, label]) => {
                  const active = clinicSort === key;
                  return (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setClinicSort(key)}
                      className={`min-h-[28px] rounded px-2 text-[11px] font-medium transition ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </span>
            }
          >
            {byClinic.length === 0 ? (
              <EmptyState title="Нет клиник" hint="Добавьте клиники в справочнике, чтобы увидеть маршрутизацию." />
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {byClinic.map((c) => (
                  <div
                    key={c.id}
                    className="grid grid-cols-1 gap-1 px-3 py-2 text-[12px] sm:grid-cols-[1fr_auto_auto_auto_auto]"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      приоритет: {c.routingPriority}
                    </span>
                    <span className="text-muted-foreground">
                      {PARTNER_TIER_LABEL[c.partnerTier]}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      лидов: {c.leads} · записан: {c.booked}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      конверсия: {fmtPct(c.conv)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Risk */}
          <SectionCard
            title="Распределение по риску"
            hint="по предварительному маршруту бот-воронки"
          >
            {totalCards === 0 ? (
              <EmptyState title="Нет карточек предварительной оценки" hint={emptyHint} />
            ) : (
              <ul className="space-y-3">
                {riskDist.map((r) => (
                  <li key={r.key}>
                    <div className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span className="font-medium">{r.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {r.count} · {fmtPct(pct(r.count, totalCards))}
                      </span>
                    </div>
                    <div className="mt-1">
                      <Bar
                        value={r.count}
                        max={totalCards}
                        tone={RISK_TONE[r.key]}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          {/* Image quality */}
          <SectionCard
            title="Качество фото"
            hint="техническое качество снимка, не диагноз"
          >
            {totalCards === 0 ? (
              <EmptyState title="Нет снимков" hint={emptyHint} />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiCard label="Прошли проверку" value={passed} />
                <KpiCard label="Нужен повтор" value={needsRepeat} />
                <KpiCard label="Средний балл" value={fmtPct(avgScore)} />
                <KpiCard label="CTA «повторить фото»" value={repeatCta} />
              </div>
            )}
          </SectionCard>

          {/* Bot dialog states */}
          <SectionCard title="Состояния бот-диалогов">
            {data.dialogs.length === 0 ? (
              <EmptyState title="Нет диалогов" hint={emptyHint} />
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {dialogStates.map((s) => (
                  <div
                    key={s.key}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-[12px]"
                  >
                    <span className="font-medium">{s.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Lead status mini-row */}
        <SectionCard title="Лиды по статусу">
          <div className="flex flex-wrap gap-2 text-[12px]">
            {(Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]).map((st) => {
              const n = data.leads.filter((l) => l.status === st).length;
              return (
                <span
                  key={st}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1"
                >
                  <span>{LEAD_STATUS_LABEL[st]}</span>
                  <span className="tabular-nums text-muted-foreground">{n}</span>
                </span>
              );
            })}
          </div>
        </SectionCard>

        {/* Demo actions */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13px] font-semibold">Действия</div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled title="Демо: отключено">
                Экспорт CSV (демо, отключено)
              </Button>
              <Button size="sm" variant="outline" onClick={onGenerateReport}>
                Сформировать отчёт (демо)
              </Button>
            </div>
          </div>
          <div className="mt-2 text-[12px] text-muted-foreground">
            Это демо-предпросмотр. Данные не отправляются во внешние системы.
          </div>
          {reportPreview && (
            <pre
              aria-label="Безопасный агрегатный предпросмотр отчёта"
              className="mt-3 max-h-80 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-[12px] leading-relaxed"
            >
{reportPreview}
            </pre>
          )}
        </Card>
      </div>
    </div>
  );
}
