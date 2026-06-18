import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEMO_USERS,
} from "@/lib/users";
import {
  getAssessmentsByVisitId,
  getClinicById,
  getImagesByLesionId,
  getLesionsByPatientId,
  getPatientById,
  getReportsByPatientId,
  getVisitsByPatientId,
} from "@/lib/mock-data";
import { calcAge, formatDate, formatDateTime, sexShort } from "@/lib/format";
import type { Lesion, Patient, Report, Visit } from "@/lib/domain";
import { getReportLinkExpiry, getReportSafeText } from "@/lib/report-access";
import { formatCardNumber } from "@/lib/card-number";
import { isProductionAppMode } from "@/lib/app-mode";
import {
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";
import {
  getSelfHostedPatient,
  type SelfHostedApiError,
} from "@/lib/self-hosted-patient-api";
import { listSelfHostedVisitsByPatient } from "@/lib/self-hosted-visit-api";
import {
  selfHostedPatientDetailToDomain,
  selfHostedVisitToDomain,
} from "@/lib/self-hosted-clinical-adapter";

const VISIT_STATUS: Record<Visit["status"], string> = {
  scheduled: "Запланирован",
  in_progress: "В работе",
  closed: "Закрыт",
  cancelled: "Отменён",
};

const LESION_STATUS: Record<Lesion["status"], string> = {
  active: "Активное",
  monitoring: "Наблюдение",
  removed: "Удалено",
  archived: "Архив",
};

function userName(id: string | null | undefined): string {
  if (!id) return "—";
  return Object.values(DEMO_USERS).find((u) => u.id === id)?.fullName ?? id;
}

type LivePatientDetailState =
  | { kind: "idle" | "loading" }
  | { kind: "ready"; patient: Patient; visits: Visit[] }
  | { kind: "error"; message: string };

function apiErrorText(error: SelfHostedApiError | null | undefined): string {
  if (!error) return "Система клиники не вернула описание ошибки.";
  if (error.status === 401) return "Требуется повторный вход в систему клиники.";
  if (error.status === 403) return "Недостаточно прав для просмотра карточки пациента.";
  return error.message;
}

export default function PatientDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const productionMode = isProductionAppMode();
  const selfHostedSession = useSelfHostedApiSession();
  const liveBackend = isSelfHostedApiConfigured(selfHostedSession);
  const [liveState, setLiveState] = useState<LivePatientDetailState>({ kind: "idle" });

  useEffect(() => {
    if (!productionMode || !liveBackend || !id) {
      setLiveState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setLiveState({ kind: "loading" });
    void (async () => {
      const [patientResult, visitsResult] = await Promise.all([
        getSelfHostedPatient({
          apiBaseUrl: selfHostedSession.apiBaseUrl,
          apiToken: selfHostedSession.apiToken,
          patientId: id,
        }),
        listSelfHostedVisitsByPatient({
          apiBaseUrl: selfHostedSession.apiBaseUrl,
          apiToken: selfHostedSession.apiToken,
          patientId: id,
        }),
      ]);
      if (cancelled) return;
      if (!patientResult.ok || !patientResult.value) {
        setLiveState({ kind: "error", message: apiErrorText(patientResult.error) });
        return;
      }
      if (!visitsResult.ok) {
        setLiveState({ kind: "error", message: apiErrorText(visitsResult.error) });
        return;
      }
      setLiveState({
        kind: "ready",
        patient: selfHostedPatientDetailToDomain(patientResult.value),
        visits: (visitsResult.value ?? []).map(selfHostedVisitToDomain),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    id,
    liveBackend,
    productionMode,
    selfHostedSession.apiBaseUrl,
    selfHostedSession.apiToken,
  ]);

  if (productionMode && !liveBackend) {
    return (
      <ProductionPatientState
        title="Требуется рабочий вход"
        text="Карточки пациентов открываются только после входа в систему клиники."
      />
    );
  }

  if (productionMode && liveState.kind === "loading") {
    return <ProductionPatientState title="Загружаем карточку пациента" text="Читаем данные из системы клиники…" />;
  }

  if (productionMode && liveState.kind === "error") {
    return <ProductionPatientState title="Карточка пациента недоступна" text={liveState.message} />;
  }

  const patient = productionMode && liveState.kind === "ready"
    ? liveState.patient
    : id
      ? getPatientById(id)
      : undefined;
  const visits = productionMode && liveState.kind === "ready"
    ? liveState.visits.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    : patient
      ? getVisitsByPatientId(patient.id).sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      : [];
  const lesions: Lesion[] = productionMode ? [] : patient ? getLesionsByPatientId(patient.id) : [];
  const reports: Report[] = productionMode
    ? []
    : patient
      ? getReportsByPatientId(patient.id).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
      : [];

  if (!patient) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Пациент не найден" subtitle="Карточка пациента отсутствует в учебных данных." />
        <div className="p-4">
          <Button asChild size="sm" variant="secondary" className="min-h-11 text-[12px] sm:min-h-8">
            <Link to="/patients">К списку пациентов</Link>
          </Button>
        </div>
      </div>
    );
  }

  const lastVisit = visits.find((v) => v.status === "closed") ?? visits[0];
  const lastReport = reports[0];
  const activeLesionCount = lesions.filter((lesion) => lesion.status === "active" || lesion.status === "monitoring").length;

  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title={patient.fullName}
        subtitle={`№ ${patient.code} · ${sexShort(patient.sex)} · ${calcAge(patient.birthDate)} лет · фототип ${patient.phototype}`}
        actions={
          <Button asChild size="sm" variant="secondary" className="min-h-11 text-[12px] sm:min-h-8">
            <Link to="/patients">К списку</Link>
          </Button>
        }
      />

      {productionMode ? (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-border bg-surface px-6 py-2 text-[12px] text-muted-foreground"
        >
          <span className="font-medium text-foreground">Данные из системы клиники</span>
          {" · "}учебные данные для карточки отключены.
        </div>
      ) : null}

      <section
        role="region"
        aria-label="Что делать с карточкой пациента"
        className="border-b border-border bg-surface px-6 py-3 text-[12px]"
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">Что делать сейчас</p>
            <h2 className="mt-1 text-[14px] font-semibold">
              {lastVisit ? "Открыть последний приём" : "Проверить данные пациента"}
            </h2>
            <p className="mt-1 text-muted-foreground">
              Приёмов: <span className="font-medium text-foreground">{visits.length}</span> · очагов в наблюдении:{" "}
              <span className="font-medium text-foreground">{activeLesionCount}</span> · отчётов:{" "}
              <span className="font-medium text-foreground">{reports.length}</span>.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2 lg:justify-end">
            {lastVisit ? (
              <Button asChild className="min-h-11 text-[12px]">
                <Link to={`/patients/${patient.id}/visits/${lastVisit.id}`}>Открыть приём</Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="min-h-11 text-[12px]">
              <Link to="/patients">К списку пациентов</Link>
            </Button>
          </div>
        </div>
      </section>

      <Tabs defaultValue="overview" className="flex-1">
        <div className="border-b border-border bg-surface px-6">
          <TabsList className="h-auto min-h-11 flex-wrap justify-start gap-1 bg-transparent py-1">
            <TabsTrigger value="overview" className="min-h-11 text-[13px]">Обзор</TabsTrigger>
            <TabsTrigger value="visits" className="min-h-11 text-[13px]">Визиты ({visits.length})</TabsTrigger>
            <TabsTrigger value="lesions" className="min-h-11 text-[13px]">Очаги ({lesions.length})</TabsTrigger>
            <TabsTrigger value="reports" className="min-h-11 text-[13px]">Отчёты ({reports.length})</TabsTrigger>
          </TabsList>
        </div>

        {/* Обзор */}
        <TabsContent value="overview" className="m-0 px-6 py-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Section title="Данные пациента" className="lg:col-span-4">
              <Field term="ФИО" value={patient.fullName} />
              <Field term="Номер карты" value={patient.code} />
              <Field term="Дата рождения" value={`${formatDate(patient.birthDate)} (${calcAge(patient.birthDate)} лет)`} />
              <Field term="Пол" value={patient.sex === "male" ? "Мужской" : "Женский"} />
              <Field term="Фототип" value={patient.phototype} />
            </Section>

            <Section title="Согласия" className="lg:col-span-4">
              <Field term="Обработка ПД" value={patient.consents.pdn ? "Есть" : "Нет"} />
              <Field term="Медицинская съёмка" value={patient.consents.imaging ? "Есть" : "Нет"} />
              <Field term="Телемедицина" value={patient.consents.telemed ? "Есть" : "Нет"} />
            </Section>

            <Section title="Отметки наблюдения" className="lg:col-span-4">
              {patient.riskFactors.length === 0 ? (
                <div className="text-meta">Не указаны.</div>
              ) : (
                <ul className="space-y-1 text-row">
                  {patient.riskFactors.map((rf) => (
                    <li key={rf} className="flex items-start gap-1.5">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                      <span>{rf}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title="Последний визит" className="lg:col-span-6">
              {!lastVisit ? (
                <div className="text-meta">Визитов нет.</div>
              ) : (
                <>
                  <Field term="Дата" value={formatDateTime(lastVisit.startedAt)} />
                  <Field term="Клиника" value={getClinicById(lastVisit.clinicId)?.name ?? "—"} />
                  <Field term="Врач" value={userName(lastVisit.doctorId)} />
                  <Field term="Статус" value={VISIT_STATUS[lastVisit.status]} />
                  <Field term="Жалоба" value={lastVisit.complaint} />
                  <div className="pt-3">
                    <Button
                      asChild
                      variant="default"
                      className="min-h-11 w-full gap-1.5 text-sm font-semibold shadow-sm sm:w-auto sm:min-h-10 sm:px-5"
                    >
                      <Link to={`/patients/${patient.id}/visits/${lastVisit.id}`}>
                        Открыть приём
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </Section>

            <Section title="Очаги и отчёты" className="lg:col-span-6">
              <Field term="Всего очагов" value={lesions.length} />
              <Field term="Активных / наблюдение" value={`${lesions.filter((l) => l.status === "active").length} / ${lesions.filter((l) => l.status === "monitoring").length}`} />
              <Field term="Всего отчётов" value={reports.length} />
              {lastReport && <Field term="Последний отчёт" value={formatDateTime(lastReport.generatedAt)} />}
            </Section>
          </div>
        </TabsContent>

        {/* Визиты */}
        <TabsContent value="visits" className="m-0 px-6 py-6">
          {visits.length === 0 ? (
            <Empty text="Визитов у пациента пока нет." />
          ) : (
            <div className="surface-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-[160px]">Дата</th>
                      <th className="w-[110px]">Статус</th>
                      <th>Жалоба</th>
                      <th className="w-[180px]">Клиника</th>
                      <th className="w-[200px]">Врач</th>
                      <th className="w-[120px]" aria-label="Действие" />
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v) => {
                      const href = `/patients/${patient.id}/visits/${v.id}`;
                      return (
                        <tr
                          key={v.id}
                          tabIndex={0}
                          role="link"
                          aria-label={`Открыть визит ${formatDateTime(v.startedAt)}`}
                          onClick={() => navigate(href)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              navigate(href);
                            }
                          }}
                          className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
                        >
                          <td className="text-[12px] text-muted-foreground tabular-nums">{formatDateTime(v.startedAt)}</td>
                          <td>{VISIT_STATUS[v.status]}</td>
                          <td className="max-w-[420px] truncate">{v.complaint}</td>
                          <td className="text-[12px] text-muted-foreground">{getClinicById(v.clinicId)?.name ?? "—"}</td>
                          <td className="text-[12px] text-muted-foreground">{userName(v.doctorId)}</td>
                          <td>
                            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-primary">
                              Открыть
                              <ChevronRight className="h-4 w-4" aria-hidden />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Очаги */}
        <TabsContent value="lesions" className="m-0 px-6 py-6">
          {lesions.length === 0 ? (
            <Empty text="Очаги у пациента не зарегистрированы." />
          ) : (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {lesions.map((l) => {
                const imageCount = getImagesByLesionId(l.id).length;
                const lastAssessment = visits
                  .flatMap((v) => getAssessmentsByVisitId(v.id).filter((a) => a.lesionId === l.id))
                  .sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))[0];
                return (
                  <li key={l.id} className="surface-card p-4">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-row font-semibold">{l.label}</div>
                        <div className="truncate text-meta">{l.bodyZone}</div>
                      </div>
                      <span className="shrink-0 rounded-sm bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {LESION_STATUS[l.status]}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
                      <Stat term="Впервые" value={formatDate(l.firstSeenAt)} />
                      <Stat term="Снимков" value={imageCount} />
                      {lastAssessment && (
                        <>
                          <Stat term="Оценка ABCD" value={lastAssessment.abcd.total.toFixed(1)} />
                          <Stat term="7 признаков" value={lastAssessment.sevenPoint.total} />
                        </>
                      )}
                    </dl>
                    <div className="mt-3 flex justify-end">
                      <Link
                        to={`/patients/${patient.id}/lesions/${l.id}`}
                        className="inline-flex min-h-11 items-center gap-0.5 text-[12px] font-medium text-primary hover:underline"
                      >
                        Открыть <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        {/* Отчёты */}
        <TabsContent value="reports" className="m-0 px-6 py-6">
          {reports.length === 0 ? (
            <Empty text="Отчётов по пациенту пока нет." />
          ) : (
            <ul className="space-y-3">
              {reports.map((r) => (
                <li key={r.id} className="surface-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <div className="text-row font-semibold tabular-nums">Отчёт от {formatDateTime(r.generatedAt)}</div>
                    <div className="text-meta">
                      Доступ к отчёту: служебная ссылка скрыта · до {formatDateTime(getReportLinkExpiry(r))}
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] font-medium text-muted-foreground">Текст для пациента</div>
                  <p className="mt-1 text-row">{getReportSafeText(r)}</p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProductionPatientState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={title} subtitle={text} />
      <div className="p-4">
        <Button asChild size="sm" variant="secondary" className="min-h-11 text-[12px] sm:min-h-8">
          <Link to="/self-hosted/login">К входу в систему клиники</Link>
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`surface-card overflow-hidden ${className ?? ""}`}>
      <div className="section-bar">
        <h2 className="h-section">{title}</h2>
      </div>
      <div className="space-y-2 px-4 pb-4 text-row">{children}</div>
    </section>
  );
}

function Field({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-border pb-1.5 last:border-b-0 last:pb-0">
      <dt className="shrink-0 text-meta">{term}</dt>
      <dd className="min-w-0 text-right">{value}</dd>
    </div>
  );
}

function Stat({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="surface-card p-12 text-center text-row text-muted-foreground">
      {text}
    </div>
  );
}
