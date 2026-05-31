import { Link } from "react-router-dom";
import { CalendarClock, Camera, CheckCircle2, ClipboardList, MapPin, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { getSafeLesionHistory, getSafeProtocolTimeline } from "./patient-data";

const PROTOCOL_BULLETS = [
  "Показываются только врачом проверенные сведения.",
  "Врачебная версия, внутренние ссылки и технические детали скрыты.",
  "Снимки открываются пациенту только через выпущенное заключение.",
];

function StatePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-h-[24px] items-center rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

export default function MeHistoryPageDemo() {
  const lesions = getSafeLesionHistory();
  const timeline = getSafeProtocolTimeline();

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="История очагов" subtitle="Безопасный протокол наблюдения пациента." />

      <div className="space-y-3 p-3 sm:p-4">
        <section
          aria-label="Контур безопасного протокола"
          className="rounded-md border px-3 py-3 text-[12px]"
          style={{
            background: "hsl(var(--success) / 0.08)",
            borderColor: "hsl(var(--success) / 0.30)",
            color: "hsl(var(--success))",
          }}
        >
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <div className="min-w-0">
              <div className="font-semibold">Контур безопасного протокола</div>
              <ul className="mt-1 grid gap-1 sm:grid-cols-3">
                {PROTOCOL_BULLETS.map((item) => (
                  <li key={item} className="min-w-0">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="min-w-0 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold">Очаги под наблюдением</h2>
                <p className="text-[12px] text-muted-foreground">
                  Patient-safe список без врачебных внутренних полей и без сырых файлов.
                </p>
              </div>
              <Button asChild variant="outline" className="min-h-[44px] text-[12px] sm:min-h-[36px]">
                <Link to="/me/booking">Записаться на контроль</Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {lesions.map((item) => (
                <article key={item.id} className="min-w-0 rounded-lg border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold">{item.title}</div>
                      <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span className="min-w-0 truncate">{item.bodyZone}</span>
                      </div>
                    </div>
                    <StatePill>{item.stateLabel}</StatePill>
                  </div>

                  <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Первое наблюдение</dt>
                      <dd className="font-medium">{formatDate(item.firstSeenAt)}</dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Последняя проверка</dt>
                      <dd className="font-medium">{formatDate(item.checkedAt)}</dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Снимков в карте</dt>
                      <dd className="font-medium">{item.snapshotCount}</dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Сравнение</dt>
                      <dd className="font-medium">Врачебная проверка</dd>
                    </div>
                  </dl>

                  <div className="mt-3 space-y-2 text-[12px]">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
                      <span>{item.nextStep}</span>
                    </div>
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Camera className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>{item.comparisonState}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Card>

          <Card className="min-w-0 p-4">
            <div className="mb-3">
              <h2 className="text-[15px] font-semibold">Хронология визитов</h2>
              <p className="text-[12px] text-muted-foreground">Только опубликованные пациенту итоги и будущие контрольные точки.</p>
            </div>

            <ol className="space-y-3">
              {timeline.map((item) => (
                <li key={item.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[13px] font-semibold">
                      <CalendarClock className="h-4 w-4" aria-hidden />
                      {formatDate(item.visitDate)}
                    </div>
                    <StatePill>{item.stateLabel}</StatePill>
                  </div>
                  <div className="mt-1 text-[12px] text-muted-foreground">{item.clinicName}</div>
                  <p className="mt-2 text-[12px] leading-5">{item.summary}</p>
                  <div className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                    <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                    {item.observedCount > 0 ? `${item.observedCount} элемента в протоколе` : "Контрольная точка"}
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </div>
  );
}
