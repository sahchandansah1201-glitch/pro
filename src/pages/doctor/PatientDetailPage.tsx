import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { consentLabel, formatAge, formatDate, formatDateTime, sexShort } from "@/lib/format";
import type { Patient, Visit } from "@/lib/domain";
import { formatCardNumber } from "@/lib/card-number";
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

function userName(id: string | null | undefined): string {
  return id ? "Врач клиники" : "—";
}

type LivePatientDetailState =
  | { kind: "idle" | "loading" }
  | { kind: "ready"; patient: Patient; visits: Visit[] }
  | { kind: "error"; message: string };

function apiErrorText(error: SelfHostedApiError | null | undefined): string {
  if (!error) return "Система клиники не вернула описание ошибки.";
  if (error.status === 401) return "Требуется повторный вход в систему клиники.";
  if (error.status === 403) return "Недостаточно прав для просмотра карточки пациента.";
  return "Не удалось загрузить карточку пациента. Попробуйте позже.";
}

export default function PatientDetailPage() {
  const session = useSelfHostedApiSession();
  const { id } = useParams<{ id: string }>();
  return <WorkingPatientDetail key={`${session.revision}:${id}`} />;
}

function WorkingPatientDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const selfHostedSession = useSelfHostedApiSession();
  const liveBackend = isSelfHostedApiConfigured(selfHostedSession);
  const [liveState, setLiveState] = useState<LivePatientDetailState>({ kind: "idle" });

  useEffect(() => {
    if (!liveBackend || !id) {
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
      if (patientResult.value.id !== id || (visitsResult.value ?? []).some((visit) => visit.patientId != null && visit.patientId !== id)) {
        setLiveState({ kind: "error", message: "Полученные записи не соответствуют этой карточке пациента. Данные не показаны." });
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
    selfHostedSession.apiBaseUrl,
    selfHostedSession.apiToken,
  ]);

  if (!liveBackend) {
    return (
      <ProductionPatientState
        title="Требуется рабочий вход"
        text="Карточки пациентов открываются только после входа в систему клиники."
      />
    );
  }

  if (id && (liveState.kind === "idle" || liveState.kind === "loading")) {
    return <ProductionPatientState title="Загружаем карточку пациента" text="Читаем данные из системы клиники…" />;
  }

  if (liveBackend && liveState.kind === "error") {
    return <ProductionPatientState title="Карточка пациента недоступна" text={liveState.message} />;
  }

  const patient = liveState.kind === "ready" ? liveState.patient : undefined;
  const visits = liveState.kind === "ready"
    ? [...liveState.visits].sort((a, b) => b.startedAt.localeCompare(a.startedAt)) : [];

  if (!patient) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Пациент не найден" subtitle="Проверьте адрес карточки пациента." />
        <div className="p-4">
          <Button asChild size="sm" variant="secondary" className="min-h-11 text-[12px] sm:min-h-8">
            <Link to="/patients">К списку пациентов</Link>
          </Button>
        </div>
      </div>
    );
  }

  const lastVisit = visits.find((v) => v.status === "closed") ?? visits[0];

  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title={patient.fullName}
        subtitle={`${formatCardNumber(patient.code)} · ${sexShort(patient.sex)} · ${formatAge(patient.birthDate)} · фототип ${patient.phototype ?? "не указан"}`}
        actions={
          <Button asChild size="sm" variant="secondary" className="min-h-11 text-[12px] sm:min-h-8">
            <Link to="/patients">К списку</Link>
          </Button>
        }
      />

      {liveBackend ? (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-border bg-surface px-6 py-2 text-[12px] text-muted-foreground"
        >
          <span className="font-medium text-foreground">Данные из системы клиники</span>
          {" · "}карточка и приёмы загружены из рабочих записей.
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
              <span className="font-medium text-foreground">не загружено</span> · отчётов:{" "}
              <span className="font-medium text-foreground">не загружено</span>.
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
            <TabsTrigger value="lesions" className="min-h-11 text-[13px]">Очаги</TabsTrigger>
            <TabsTrigger value="reports" className="min-h-11 text-[13px]">Отчёты</TabsTrigger>
          </TabsList>
        </div>

        {/* Обзор */}
        <TabsContent value="overview" className="m-0 px-6 py-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Section title="Данные пациента" className="lg:col-span-4">
              <Field term="ФИО" value={patient.fullName} />
              <Field term="Номер карты" value={formatCardNumber(patient.code)} />
              <Field term="Дата рождения" value={`${formatDate(patient.birthDate)} (${formatAge(patient.birthDate)})`} />
              <Field term="Пол" value={patient.sex === "male" ? "Мужской" : patient.sex === "female" ? "Женский" : "Не указан"} />
              <Field term="Фототип" value={patient.phototype ?? "Не указан"} />
            </Section>

            <Section title="Согласия" className="lg:col-span-4">
              <Field
                term="Обработка ПД"
                value={
                  patient.consents.pdn == null
                    ? "Не зафиксировано"
                    : patient.consents.pdn
                      ? "Есть"
                      : "Нет"
                }
              />
              <Field term="Медицинская съёмка" value={consentLabel(patient.consents.imaging)} />
              <Field term="Телемедицина" value={consentLabel(patient.consents.telemed)} />
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
                  <Field term="Клиника" value={"—"} />
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
              <Field term="Всего очагов" value="не загружено" />
              <Field term="Активных / наблюдение" value="не загружено" />
              <Field term="Всего отчётов" value="не загружено" />
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
                          <td className="text-[12px] text-muted-foreground">{"—"}</td>
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

        <TabsContent value="lesions" className="m-0 px-6 py-6">
          <Empty text="Очаги открываются в рабочем месте приёма. Этот раздел их не загружает." />
        </TabsContent>
        <TabsContent value="reports" className="m-0 px-6 py-6">
          <Empty text="Отчёты открываются в разделе «Отчёты». Этот раздел их не загружает." />
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

function Empty({ text }: { text: string }) {
  return (
    <div className="surface-card p-12 text-center text-row text-muted-foreground">
      {text}
    </div>
  );
}
