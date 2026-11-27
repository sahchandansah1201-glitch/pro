import { useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, FileSearch, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RoleContext } from "@/context/role-context";
import { formatDateTime } from "@/lib/format";
import {
  confirmDoctorVisitAndActivatePassport,
  fetchDoctorPrevisitCaseByVisit,
  type DoctorPrevisitCaseDTO,
} from "@/lib/self-hosted-onboarding-api";
import {
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";

interface VisitPrevisitCaseCardProps {
  visitId: string;
}

const CHANNEL_LABEL: Record<string, string> = {
  telegram: "Telegram-бот",
  whatsapp: "WhatsApp",
  max: "MAX",
  web: "Веб-сайт",
};

const RELATION_LABEL: Record<string, string> = {
  SELF: "Лично пациент",
  CHILD_UNDER_18: "Ребёнок до 18 лет (согласие законного представителя)",
  ADULT_RELATIVE: "Близкий взрослый",
};

const EVOLUTION_LABEL: Record<string, string> = {
  stable_long: "Давно, без заметных изменений",
  new_lt_3m: "Появилось недавно (< 3 мес)",
  growing_changing: "Заметно растёт или меняет цвет/форму",
  unsure: "Трудно уточнить давность",
};

const SYMPTOMS_LABEL: Record<string, string> = {
  none: "Не беспокоит",
  itch_or_pain: "Зудит или болит",
  bleeding_or_crust: "Кровит или покрывается корочкой без травмы",
};

const TOPICAL_LABEL: Record<string, string> = {
  none: "Ничем не обрабатывали за 14 дней",
  steroid_ointment: "Гормональная мазь за 14 дней (предохранитель U5)",
  antiseptic_dye_celelandine: "Красящий антисептик / йод / чистотел (предохранитель U5)",
  moisturizer: "Увлажняющий крем",
};

export function VisitPrevisitCaseCard({ visitId }: VisitPrevisitCaseCardProps) {
  const roleCtx = useContext(RoleContext);
  const session = useSelfHostedApiSession();
  const isConfigured = isSelfHostedApiConfigured(session);

  const activeRole = roleCtx?.role ?? null;
  const sessionRoles = session.user?.roles ?? [];
  const isDoctorAllowed =
    activeRole !== "assistant"
    && activeRole !== "operator"
    && (
      activeRole === "doctor"
      || activeRole === "private_doctor"
      || activeRole === "system_admin"
      || sessionRoles.some((r) => r === "doctor" || r === "private_doctor" || r === "system_admin")
    );

  const [item, setItem] = useState<DoctorPrevisitCaseDTO | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmNote, setConfirmNote] = useState<string | null>(null);

  const loadPrevisit = useCallback(async () => {
    if (!isConfigured || !isDoctorAllowed) return;
    const res = await fetchDoctorPrevisitCaseByVisit({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      visitId,
    });
    if (res.ok) {
      setItem(res.value ?? null);
    }
  }, [isConfigured, isDoctorAllowed, session.apiBaseUrl, session.apiToken, visitId]);

  useEffect(() => {
    void loadPrevisit();
  }, [loadPrevisit]);

  if (!isConfigured || !isDoctorAllowed) {
    return null;
  }

  async function handleConfirmVisitPassport() {
    setConfirmBusy(true);
    setConfirmNote(null);
    const res = await confirmDoctorVisitAndActivatePassport({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      visitId,
    });
    setConfirmBusy(false);
    if (!res.ok) {
      setConfirmNote(res.error?.message || "Не удалось подтвердить активацию Паспорта кожи.");
      return;
    }
    setConfirmNote("Очный приём подтверждён: пациенту активирован бессрочный Паспорт контроля кожи.");
    await loadPrevisit();
  }

  if (!item) {
    return (
      <section
        aria-label="Подтверждение визита для Паспорта контроля кожи"
        className="mb-4 rounded-md border border-border bg-surface p-4 text-[13px]"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-semibold">Паспорт контроля кожи пациента</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Предвизитная анкета из бота или сайта для этого приёма не прикреплена. После очного осмотра вы можете активировать пациенту бессрочный Паспорт контроля кожи.
            </p>
            {confirmNote ? (
              <p role="status" className="mt-2 text-[12px] font-medium text-primary">
                {confirmNote}
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={confirmBusy}
            onClick={() => void handleConfirmVisitPassport()}
            className="min-h-11 text-[12px]"
          >
            {confirmBusy ? "Активируем…" : "Подтвердить визит и открыть Паспорт кожи"}
          </Button>
        </div>
      </section>
    );
  }

  const phototype = item.subjectProfile?.estimated_phototype_ita;
  const riskFactors = item.subjectProfile?.risk_factors ?? {};
  const activeRiskLabels: string[] = [];
  if (riskFactors.sunburns_childhood || riskFactors.sunburnsChildhood) {
    activeRiskLabels.push("Солнечные ожоги в детстве");
  }
  if (riskFactors.tanning_bed || riskFactors.tanningBed) {
    activeRiskLabels.push("Посещение солярия");
  }
  if (riskFactors.family_melanoma_history || riskFactors.familyMelanomaHistory) {
    activeRiskLabels.push("Семейный онкоанамнез кожи");
  }
  if (riskFactors.nevi_over_50 || riskFactors.neviOver50) {
    activeRiskLabels.push("> 50 невусов на теле");
  }
  if (riskFactors.immunosuppression || riskFactors.immunosuppressionOrDiabetes) {
    activeRiskLabels.push("Иммуносупрессия / СД");
  }
  if (riskFactors.smoking || riskFactors.smokingOrChronicTrauma) {
    activeRiskLabels.push("Курение / хроническая травматизация");
  }

  return (
    <section
      aria-label="Предвизитный кейс пациента (только для врача)"
      className="mb-4 surface-card overflow-hidden"
    >
      <header className="section-bar">
        <div className="flex items-center gap-2">
          <FileSearch className="h-4 w-4 text-primary" aria-hidden />
          <h2 className="h-section">
            Предвизитный кейс пациента · {CHANNEL_LABEL[item.channel] || item.channel}
          </h2>
        </div>
        <span className="h-section-hint">
          {item.bookingPriority === "PRIORITY_URGENT" ? "Приоритетное окно" : "Плановый приём"}
        </span>
      </header>

      <div className="space-y-4 p-4 text-[13px]">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12px]">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            <span>
              Врачебный контур: черновик <em>Status localis</em> сформирован автоматически перед визитом и требует обязательной очной верификации и дерматоскопии.
            </span>
          </div>
          {item.skinPassportActive ? (
            <span className="inline-flex items-center gap-1 font-medium text-primary">
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Паспорт кожи активен
            </span>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={confirmBusy}
              onClick={() => void handleConfirmVisitPassport()}
              className="min-h-11 text-[12px]"
            >
              {confirmBusy ? "Подтверждаем…" : "Подтвердить визит и открыть Паспорт кожи"}
            </Button>
          )}
        </div>

        {confirmNote ? (
          <p role="status" className="text-[12px] font-medium text-primary">
            {confirmNote}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-border p-3">
            <div className="text-[11px] uppercase text-muted-foreground">Профиль и согласие</div>
            <div className="mt-1 font-medium">{RELATION_LABEL[item.subjectRelation] || item.subjectRelation}</div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">
              Согласие 152-ФЗ: {formatDateTime(item.consent152FzAcceptedAt)}
            </div>
          </div>

          <div className="rounded-md border border-border p-3">
            <div className="text-[11px] uppercase text-muted-foreground">Авто-фототип по кольцу кожи (ITA°)</div>
            <div className="mt-1 font-medium">
              Фототип {phototype?.fitzpatrick_band || "не оценён"}
              {phototype?.ita_degrees != null ? ` · ITA° ${phototype.ita_degrees}°` : ""}
            </div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">
              Определён после нормализации Display P3 → sRGB
            </div>
          </div>

          <div className="rounded-md border border-border p-3">
            <div className="text-[11px] uppercase text-muted-foreground">Факторы риска анамнеза</div>
            <div className="mt-1 text-[12px]">
              {activeRiskLabels.length > 0 ? activeRiskLabels.join(" · ") : "Дополнительные факторы не отмечены"}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {item.lesions.map((lesion) => (
            <div
              key={lesion.id}
              className="grid gap-4 rounded-md border border-border p-3 lg:grid-cols-[240px_minmax(0,1fr)]"
            >
              <div>
                {lesion.cropSvgDataUrl ? (
                  <img
                    src={lesion.cropSvgDataUrl}
                    alt={`Локальный кроп очага №${lesion.lesionIndex}`}
                    className="w-full rounded-md border border-border"
                  />
                ) : null}
                <div className="mt-1.5 text-[11px] text-muted-foreground">
                  Очаг №{lesion.lesionIndex} · качество снимка {lesion.qualityGate?.score_0_100 ?? 88}/100
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-[12px] text-muted-foreground">
                  <span className="font-medium text-foreground">Ответы пациента по очагу: </span>
                  {EVOLUTION_LABEL[lesion.anamnesisAnswers?.evolution || ""] || "—"} ·{" "}
                  {SYMPTOMS_LABEL[lesion.anamnesisAnswers?.symptoms || ""] || "—"} ·{" "}
                  {TOPICAL_LABEL[lesion.anamnesisAnswers?.prior_topical_14d || ""] || "—"}
                </div>

                <div className="rounded-md bg-surface-muted p-3 text-[13px]">
                  <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Черновик Status localis для врача
                  </div>
                  <p className="mt-1 leading-relaxed text-foreground">
                    {lesion.doctorOnlyStatusLocalisDraft}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
