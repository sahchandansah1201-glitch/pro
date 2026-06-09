import { Link } from "react-router-dom";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { CalendarClock, Camera, CheckCircle2, ClipboardList, MapPin, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  fetchSelfHostedPatientPortalHistory,
  type SelfHostedPatientPortalHistory,
} from "@/lib/self-hosted-patient-portal-api";

const PROTOCOL_BULLETS = [
  "Показываются только врачом проверенные сведения.",
  "Врачебная версия, внутренние ссылки и технические детали скрыты.",
  "Сравнение снимков трактуется только после врачебной проверки.",
];

type LoadStatus = "missing_session" | "loading" | "ready" | "error";

function LoginRequired() {
  return (
    <Card className="m-4 p-4">
      <div className="text-[15px] font-semibold">Требуется вход пациента</div>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Войдите в личный кабинет, чтобы открыть историю наблюдения.
      </p>
      <Button asChild className="mt-3 min-h-[44px] sm:min-h-[36px]">
        <Link to="/self-hosted/login">Войти</Link>
      </Button>
    </Card>
  );
}

function StatePill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-[24px] items-center rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function retentionStatusLabel(status: SelfHostedPatientPortalHistory["retentionGovernance"]["status"]): string {
  switch (status) {
    case "policy_ready":
      return "Доступ проверен";
    case "policy_in_progress":
      return "Доступ проверяется";
    default:
      return "Нет подготовленных выпусков";
  }
}

function comparisonStatusLabel(status: SelfHostedPatientPortalHistory["comparisonOperations"]["status"]): string {
  switch (status) {
    case "ready_for_review":
      return "Серия готова к проверке";
    case "partial_ready":
      return "Серия частично собрана";
    case "needs_capture":
      return "Нужны контрольные фото";
    default:
      return "Серия пока не собрана";
  }
}

function sessionLifecycleStatusLabel(status: SelfHostedPatientPortalHistory["sessionLifecycle"]["status"]): string {
  switch (status) {
    case "governance_ready":
      return "Контур доступа стабилен";
    case "governance_attention":
      return "Нужна проверка срока доступа";
    default:
      return "Окна доступа не подготовлены";
  }
}

export default function MeHistoryPageLive() {
  const session = useSelfHostedApiSession();
  const [status, setStatus] = useState<LoadStatus>(() => session.apiToken ? "loading" : "missing_session");
  const [history, setHistory] = useState<SelfHostedPatientPortalHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!session.apiToken) {
      setStatus("missing_session");
      setHistory(null);
      setError(null);
      return;
    }
    setStatus("loading");
    const result = await fetchSelfHostedPatientPortalHistory({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
    });
    if (!result.ok) {
      setStatus("error");
      setHistory(null);
      setError(result.error.message);
      return;
    }
    setStatus("ready");
    setHistory(result.value);
    setError(null);
  }, [session.apiBaseUrl, session.apiToken]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="История очагов" subtitle="Опубликованная клиникой история наблюдения" />
      {status === "missing_session" ? (
        <LoginRequired />
      ) : (
        <div className="space-y-3 p-3 sm:p-4">
          <section
            aria-label="Безопасная история наблюдения"
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
                <div className="font-semibold">Безопасная история наблюдения</div>
                <ul className="mt-1 grid gap-1 sm:grid-cols-3">
                  {PROTOCOL_BULLETS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {status === "loading" && <Card className="p-4 text-[13px] text-muted-foreground">Загружаем историю…</Card>}
          {status === "error" && (
            <Card className="p-4">
              <div role="alert" className="text-[13px] text-destructive">{error || "Не удалось загрузить историю."}</div>
              <Button variant="outline" className="mt-3 min-h-[44px] sm:min-h-[36px]" onClick={() => void loadHistory()}>
                Повторить
              </Button>
            </Card>
          )}

          {status === "ready" && history && (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
              <Card className="min-w-0 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-[15px] font-semibold">Очаги под наблюдением</h2>
                    <p className="text-[12px] text-muted-foreground">
                      Список показывает только опубликованные клиникой данные для пациента.
                    </p>
                  </div>
                  <Button asChild variant="outline" className="min-h-[44px] text-[12px] sm:min-h-[36px]">
                    <Link to="/me/booking">Записаться на контроль</Link>
                  </Button>
                </div>

                {history.lesions.length === 0 ? (
                  <div className="rounded-lg border p-3 text-[13px] text-muted-foreground">
                    Очаги пока не опубликованы в пациентском протоколе.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {history.lesions.map((item) => (
                      <article key={item.id} className="min-w-0 rounded-lg border p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[14px] font-semibold">{item.title}</div>
                            <div className="mt-1 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              <span className="min-w-0 truncate">{item.bodyZone || "зона не указана"}</span>
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
                            <dt className="text-muted-foreground">Сопоставимых</dt>
                            <dd className="font-medium">{item.comparableSnapshotCount}</dd>
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
                )}
              </Card>

              <div className="space-y-3">
                <Card className="min-w-0 p-4">
                  <div className="mb-3">
                    <h2 className="text-[15px] font-semibold">Хронология визитов</h2>
                    <p className="text-[12px] text-muted-foreground">
                      Только опубликованные пациенту итоги и будущие контрольные точки.
                    </p>
                  </div>

                  {history.timeline.length === 0 ? (
                    <div className="rounded-lg border p-3 text-[12px] text-muted-foreground">
                      Хронология появится после следующего визита.
                    </div>
                  ) : (
                    <ol className="space-y-3">
                      {history.timeline.map((item) => (
                        <li key={item.id} className="rounded-lg border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-[13px] font-semibold">
                              <CalendarClock className="h-4 w-4" aria-hidden />
                              {formatDate(item.visitDate)}
                            </div>
                            <StatePill>{item.stateLabel}</StatePill>
                          </div>
                          <div className="mt-1 text-[12px] text-muted-foreground">{item.clinicName || "Клиника"}</div>
                          <p className="mt-2 text-[12px] leading-5">{item.summary || "Безопасный итог будет опубликован врачом."}</p>
                          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                            {item.observedCount > 0 ? `${item.observedCount} элемента в протоколе` : "Контрольная точка"}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </Card>

                <Card className="min-w-0 p-4" aria-label="Доступ к фотографиям">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[15px] font-semibold">Доступ к фотографиям</h2>
                    <StatePill>{retentionStatusLabel(history.retentionGovernance.status)}</StatePill>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-[12px]">
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Выпуски</dt>
                      <dd className="font-medium">{history.retentionGovernance.releasesTotal}</dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Доступ проверен</dt>
                      <dd className="font-medium">{history.retentionGovernance.policyReady}</dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Срок хранения подтверждён</dt>
                      <dd className="font-medium">{history.retentionGovernance.retentionApproved}</dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Текст для пациента проверен</dt>
                      <dd className="font-medium">{history.retentionGovernance.patientCopyApproved}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Сырые файлы и врачебная версия скрыты. Сравнение динамики требует врачебной проверки.
                  </p>
                  <Button asChild variant="outline" className="mt-3 w-full min-h-[44px] text-[12px] sm:min-h-[36px]">
                    <Link to="/me/reports">Открыть заключения</Link>
                  </Button>
                </Card>

                <Card className="min-w-0 p-4" aria-label="Операции сравнения">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[15px] font-semibold">Операции сравнения</h2>
                    <StatePill>{comparisonStatusLabel(history.comparisonOperations.status)}</StatePill>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-[12px]">
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Очагов в протоколе</dt>
                      <dd className="font-medium">{history.comparisonOperations.lesionsTotal}</dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Готово к проверке</dt>
                      <dd className="font-medium">{history.comparisonOperations.readyForDoctorReview}</dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Нужен следующий кадр</dt>
                      <dd className="font-medium">{history.comparisonOperations.requiresNextCapture}</dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Покрытие серии</dt>
                      <dd className="font-medium">{history.comparisonOperations.comparableCoveragePercent}%</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Автосравнение не публикуется пациенту: динамику подтверждает врач на визите.
                  </p>
                </Card>

                <Card className="min-w-0 p-4" aria-label="Жизненный цикл доступа">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-[15px] font-semibold">Жизненный цикл доступа</h2>
                    <StatePill>{sessionLifecycleStatusLabel(history.sessionLifecycle.status)}</StatePill>
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-[12px]">
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Активные окна</dt>
                      <dd className="font-medium">{history.sessionLifecycle.activeAccessWindows}</dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Истекают ≤24ч</dt>
                      <dd className="font-medium">{history.sessionLifecycle.expiringIn24h}</dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Отозвано</dt>
                      <dd className="font-medium">{history.sessionLifecycle.revokedAccessWindows}</dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Без срока</dt>
                      <dd className="font-medium">{history.sessionLifecycle.missingExpiry}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Временные коды и служебные данные не показываются в пациентском интерфейсе.
                  </p>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
