import { ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";

export default function SysReleaseStatusPage() {
  return <ProductionReleaseStatusUnavailable />;
}

function ProductionReleaseStatusUnavailable() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Готовность публикации"
        subtitle="Проверка текущего состояния рабочего контура."
      />

      <div className="space-y-4 p-3 sm:p-4">
        <div
          role="alert"
          aria-label="Текущий статус публикации не подтверждён"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive"
        >
          <div className="font-semibold">Текущий статус не подтверждён</div>
          <p className="mt-1">
            Этот экран пока не подключён к текущему состоянию сервера и
            проверкам GitHub, поэтому не подтверждает готовность публикации.
          </p>
        </div>

        <Card className="max-w-3xl p-4">
          <h2 className="text-[16px] font-semibold">Что проверить сейчас</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Перед публикацией нужны живые результаты всех трёх проверок. Старые
            учебные данные на рабочем экране не используются.
          </p>
          <ul className="mt-4 space-y-2 text-[13px]">
            <li>
              <a
                href="/healthz"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 text-primary underline-offset-4 hover:underline"
              >
                Доступность сервера
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </li>
            <li>
              <a
                href="/readyz"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 text-primary underline-offset-4 hover:underline"
              >
                Готовность базы данных и зависимостей
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </li>
            <li>
              <a
                href="https://github.com/sahchandansah1201-glitch/pro/actions"
                target="_blank"
                rel="noreferrer"
                aria-label="Открыть проверки GitHub"
                className="inline-flex min-h-11 items-center gap-2 text-primary underline-offset-4 hover:underline"
              >
                Открыть проверки GitHub
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            </li>
          </ul>
          <p className="mt-4 rounded-md border border-border bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground">
            Не используйте этот экран как разрешение на публикацию, пока все
            результаты не получены из рабочего контура.
          </p>
        </Card>
      </div>
    </div>
  );
}
