import { useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CLINICS,
  getAnalysisCardById,
  getProtectedAnalysisLinkByToken,
} from "@/lib/mock-data";
import { formatDateTime } from "@/lib/format";
import type { RiskLevel } from "@/lib/domain";

// Фиксированная демо-«сейчас» дата для MVP-проверки срока действия ссылок.
const DEMO_NOW = "2026-05-04T00:00:00Z";

const ROUTING_LABEL: Record<RiskLevel, string> = {
  low: "Плановая запись",
  moderate: "Рекомендуется запись",
  high: "Приоритетная запись",
  urgent: "Срочная очная оценка",
};

const CTA_LABEL = {
  book: "Записаться в клинику",
  urgent: "Связаться с клиникой",
  repeat_photo: "Повторить фото",
} as const;

const CTA_DEMO_STATUS = {
  book: "Демо: заявка на запись подготовлена. В реальном сервисе здесь откроется запись в клинику-партнёр.",
  urgent: "Демо: запрос на срочную связь с клиникой подготовлен. В реальном сервисе оператор увидит приоритетное обращение.",
  repeat_photo: "Демо: пациент будет возвращён в бот для повторной съёмки. Новый снимок снова пройдёт контроль качества.",
} as const;

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto w-full max-w-3xl px-4 py-4">
          <div className="text-sm font-medium text-muted-foreground">
            Дерматолог Про · Защищённый просмотр
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}

function StateBlock({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <section className="rounded-md border border-border p-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
    </section>
  );
}

export default function AnalysisPublicPage() {
  const { token = "" } = useParams<{ token: string }>();
  const link = getProtectedAnalysisLinkByToken(token);

  if (!link) {
    return (
      <PublicShell>
        <StateBlock
          title="Ссылка недоступна"
          body="Ссылка недействительна или была введена с ошибкой."
        />
      </PublicShell>
    );
  }

  const nowMs = Date.parse(DEMO_NOW);
  const expMs = Date.parse(link.expiresAt);
  if (!Number.isFinite(expMs) || expMs < nowMs) {
    return (
      <PublicShell>
        <StateBlock
          title="Срок действия ссылки истёк"
          body="Срок действия ссылки истёк. Обратитесь в клинику или повторите анализ через бота."
        />
      </PublicShell>
    );
  }

  const card = getAnalysisCardById(link.analysisCardId);
  if (!card) {
    return (
      <PublicShell>
        <StateBlock
          title="Ссылка недоступна"
          body="Ссылка недействительна или была введена с ошибкой."
        />
      </PublicShell>
    );
  }

  const clinic = CLINICS.find((c) => c.id === card.recommendedClinicId);
  const qualityPct = Math.round(card.qualityGate.score * 100);
  const ctaLabel = CTA_LABEL[card.ctaType];

  return (
    <PublicShell>
      <article className="space-y-6">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold sm:text-2xl">
              Предварительная оценка
            </h1>
            <Badge variant="secondary">Не является диагнозом</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{card.safeSummary}</p>
        </header>

        <section className="rounded-md border border-border p-5">
          <h2 className="text-sm font-semibold">Качество снимка</h2>
          <div className="mt-2 text-sm">
            {card.qualityGate.passed
              ? "Фото подходит для предварительной оценки"
              : "Фото требует повторения"}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Оценка качества: {qualityPct}%
          </div>
          {card.qualityGate.issues.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
              {card.qualityGate.issues.map((it) => (
                <li key={it}>{it}</li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-md border border-border p-5">
          <h2 className="text-sm font-semibold">Маршрутизация</h2>
          <div className="mt-2 text-sm">{ROUTING_LABEL[card.routingRisk]}</div>
        </section>

        {clinic && (
          <section className="rounded-md border border-border p-5">
            <h2 className="text-sm font-semibold">Рекомендованная клиника</h2>
            <div className="mt-2 space-y-1 text-sm">
              <div className="font-medium">{clinic.name}</div>
              <div className="text-muted-foreground">{clinic.address}</div>
              <div className="text-muted-foreground">{clinic.phone}</div>
            </div>
          </section>
        )}

        <div className="pt-1">
          <Button
            type="button"
            className="min-h-11 w-full text-sm font-semibold sm:w-auto sm:min-h-10 sm:px-6"
          >
            {ctaLabel}
          </Button>
        </div>

        <footer className="space-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
          <div>Ссылка действительна до: {formatDateTime(link.expiresAt)}</div>
          <div>Окончательное решение принимает врач на очном приёме.</div>
        </footer>
      </article>
    </PublicShell>
  );
}
