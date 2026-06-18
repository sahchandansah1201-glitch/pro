import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";
import { getPublicAnalysisView } from "@/lib/public-analysis-access";

const DISCLAIMER =
  "Эта сводка не является диагнозом. Окончательное решение принимает врач.";

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
      <main className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 sm:py-8">
        <div
          role="note"
          aria-label="Учебный просмотр"
          className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground"
        >
          Учебный просмотр. Содержимое не является медицинским заключением.
        </div>
        {children}
      </main>
    </div>
  );
}

function StateBlock({ title, body }: { title: string; body: string }) {
  return (
    <section className="rounded-md border border-border p-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{body}</p>
    </section>
  );
}

function SafeActions() {
  return (
    <div className="flex flex-col gap-2 pt-1 sm:flex-row">
      <Button
        type="button"
        variant="outline"
        disabled
        aria-disabled="true"
        className="min-h-[44px] w-full border-border bg-muted text-muted-foreground hover:bg-muted sm:w-auto"
      >
        Скачать файл
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled
        aria-disabled="true"
        className="min-h-[44px] w-full border-border bg-muted text-muted-foreground hover:bg-muted sm:w-auto"
      >
        Связаться с клиникой
      </Button>
    </div>
  );
}

export default function AnalysisPublicPage() {
  const { token = "" } = useParams<{ token: string }>();
  const view = getPublicAnalysisView(token);

  if (view.status === "not_found") {
    return (
      <PublicShell>
        <StateBlock
          title="Ссылка не найдена"
          body="Ссылка не найдена. Проверьте адрес или обратитесь в клинику."
        />
      </PublicShell>
    );
  }

  if (view.status === "expired") {
    return (
      <PublicShell>
        <StateBlock
          title="Ссылка истекла"
          body="Срок действия ссылки истёк. Обратитесь в клинику, чтобы получить новый доступ."
        />
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <article className="space-y-5">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold sm:text-2xl">
              Предварительная сводка
            </h1>
            <Badge variant="secondary">Не является диагнозом</Badge>
          </div>
          {view.createdAt && (
            <div className="text-xs text-muted-foreground">
              Дата: {formatDateTime(view.createdAt)}
            </div>
          )}
          {view.clinicName && (
            <div className="text-sm">
              Клиника: <span className="font-medium">{view.clinicName}</span>
            </div>
          )}
        </header>

        <section className="rounded-md border border-border p-5">
          <h2 className="text-sm font-semibold">Краткая сводка</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {view.safeSummary}
          </p>
        </section>

        <section className="rounded-md border border-border p-5">
          <h2 className="text-sm font-semibold">Качество снимка</h2>
          <div className="mt-2 text-sm">
            {view.qualityPassed
              ? "Фото подходит для предварительной сводки"
              : "Фото требует повторения"}
          </div>
        </section>

        <SafeActions />

        <footer className="space-y-1 border-t border-border pt-4 text-xs text-muted-foreground">
          {view.expiresAt && (
            <div>Ссылка действительна до: {formatDateTime(view.expiresAt)}</div>
          )}
          <div>{DISCLAIMER}</div>
        </footer>
      </article>
    </PublicShell>
  );
}
