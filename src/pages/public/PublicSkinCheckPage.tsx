import { useCallback, useEffect, useId, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  bookClinicFromPublicSubmission,
  deletePublicOnboardingMyData,
  fetchPublicFlowConfig,
  initPublicOnboardingSession,
  readOriginalFileAsDataUrl,
  resolvePublicProfileMismatch,
  savePublicRiskFactors,
  submitPublicMicroSurvey,
  submitPublicOnboardingPhoto,
  type BiologicalSex,
  type EvolutionChoice,
  type OnboardingClinicChoiceDTO,
  type OnboardingProfileDTO,
  type PatientFacingResultCardDTO,
  type PhotoSubmitResultDTO,
  type SymptomsChoice,
  type TopicalChoice,
} from "@/lib/self-hosted-onboarding-api";
import { TelegramMiroDialogPanel } from "./TelegramMiroDialogPanel";

const STORAGE_TOKEN_KEY = "skindoctor.onboarding.token.v1";

// Compact valid 1x1 JPEG data URL for instant 1-click check on Web without selecting a local file
const SAMPLE_VALID_JPEG_DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AV//Z";

type WebMiroStep = "photo_first" | "mismatch" | "post_photo_lead" | "traffic_light_result";

export default function PublicSkinCheckPage({ embedded = false }: { embedded?: boolean }) {
  const fileInputId = useId();
  const [sessionToken, setSessionToken] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(STORAGE_TOKEN_KEY) || "";
  });
  const [profiles, setProfiles] = useState<OnboardingProfileDTO[]>([]);
  const [clinics, setClinics] = useState<OnboardingClinicChoiceDTO[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [instructionSvg, setInstructionSvg] = useState<string>("");
  const [followupDaysCfg, setFollowupDaysCfg] = useState<number>(30);
  const [step, setStep] = useState<WebMiroStep>("photo_first");

  // Screen 1: Photo-first (1-tap 152-FZ + immediate photo upload, zero questionnaire barrier)
  const [consent152Fz, setConsent152Fz] = useState(true);
  const [verificationOfSubmissionId, setVerificationOfSubmissionId] = useState<string | null>(null);

  // Screen 2: Post-photo Lead & Profile capture at peak user motivation
  const [photoResult, setPhotoResult] = useState<PhotoSubmitResultDTO | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [ageInput, setAgeInput] = useState("34");
  const [isInfantUnder1Year, setIsInfantUnder1Year] = useState(false);
  const [guardianConfirmed, setGuardianConfirmed] = useState(false);
  const [sex, setSex] = useState<BiologicalSex>("female");
  const [evolution, setEvolution] = useState<EvolutionChoice>("stable_long");
  const [symptoms, setSymptoms] = useState<SymptomsChoice>("none");
  const [priorTopical, setPriorTopical] = useState<TopicalChoice>("none");
  const [pediatricRedFlags, setPediatricRedFlags] = useState(false);

  // Screen 3: Traffic-light result & 1-tap clinic slot booking
  const [resultCard, setResultCard] = useState<PatientFacingResultCardDTO | null>(null);
  const [preferredTimeNote, setPreferredTimeNote] = useState("Ближайшее свободное окно");
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [bookingConfirmation, setBookingConfirmation] = useState<string | null>(null);
  const [riskSavedNote, setRiskSavedNote] = useState<string | null>(null);
  const [riskFactors, setRiskFactors] = useState({
    bodyRegionCode: "trunk_anterior",
    sunburnsChildhood: false,
    tanningBed: false,
    familyMelanomaHistory: false,
    neviOver50: false,
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const parsedAge = Number.parseInt(ageInput, 10);
  const isChildUnder18 = isInfantUnder1Year || (Number.isFinite(parsedAge) && parsedAge < 18);
  const isToddlerU6 = isInfantUnder1Year || (Number.isFinite(parsedAge) && parsedAge < 3);

  const bootstrapSession = useCallback(async () => {
    const [sessionRes, cfgRes] = await Promise.all([
      initPublicOnboardingSession({
        sessionToken: sessionToken || null,
        channel: "web",
      }),
      fetchPublicFlowConfig(),
    ]);
    if (cfgRes.ok && cfgRes.value) {
      setInstructionSvg(cfgRes.value.instructionVisualSvgDataUrl || "");
      if (cfgRes.value.item?.flowRules?.lowRiskFollowupDays) {
        setFollowupDaysCfg(cfgRes.value.item.flowRules.lowRiskFollowupDays);
      }
    }
    if (sessionRes.ok && sessionRes.value) {
      setSessionToken(sessionRes.value.sessionToken);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_TOKEN_KEY, sessionRes.value.sessionToken);
      }
      setProfiles(sessionRes.value.profiles);
      setClinics(sessionRes.value.clinics);
      if (sessionRes.value.clinics[0] && !selectedClinicId) {
        setSelectedClinicId(sessionRes.value.clinics[0].id);
      }
      const firstProf = sessionRes.value.profiles[0];
      if (firstProf) {
        setActiveProfileId((prev) => prev || firstProf.id);
        if (firstProf.contactName) setContactName((prev) => prev || firstProf.contactName || "");
        if (firstProf.contactPhone) setContactPhone((prev) => prev || firstProf.contactPhone || "");
      }
    }
  }, [selectedClinicId, sessionToken]);

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  async function processUploadedDataUrl(
    dataUrl: string | undefined,
    clientHints: Record<string, unknown> = {},
    simulatePhotoPreset?: "clear_skin",
  ) {
    if (!consent152Fz) {
      setError("Отметьте согласие на обработку данных (152-ФЗ) перед отправкой фотографии.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatusBanner(null);
    const res = await submitPublicOnboardingPhoto({
      sessionToken,
      profileId: activeProfileId,
      consent152FzAccepted: true,
      imageBase64: dataUrl,
      simulatePhotoPreset,
      clientHints,
    });
    setBusy(false);
    if (!res.ok || !res.value) {
      setError(res.error?.message || "Не удалось проверить файл снимка.");
      return;
    }
    setPhotoResult(res.value);
    setActiveProfileId(res.value.profileId);
    if (res.value.instructionVisualSvgDataUrl) {
      setInstructionSvg(res.value.instructionVisualSvgDataUrl);
    }
    if (res.value.savedContact?.contactName) {
      setContactName((prev) => prev || res.value!.savedContact!.contactName || "");
    }
    if (res.value.savedContact?.contactPhone) {
      setContactPhone((prev) => prev || res.value!.savedContact!.contactPhone || "");
    }
    if (!res.value.qualityGate.passed) {
      setStep("photo_first");
      return;
    }
    if (res.value.status === "awaiting_mismatch_confirm") {
      setStep("mismatch");
      return;
    }
    setStep("post_photo_lead");
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await readOriginalFileAsDataUrl(file);
      await processUploadedDataUrl(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка чтения файла.");
    }
  }

  async function handleResolveMismatch(resolution: "same_person_lighting" | "switched_profile") {
    if (!photoResult) return;
    setBusy(true);
    setError(null);
    const res = await resolvePublicProfileMismatch({
      sessionToken,
      submissionId: photoResult.submissionId,
      resolution,
    });
    setBusy(false);
    if (!res.ok || !res.value) {
      setError(res.error?.message || "Не удалось применить выбор профиля.");
      return;
    }
    setActiveProfileId(res.value.submission.profileId);
    if (resolution === "switched_profile") {
      setContactName("");
    }
    setStep("post_photo_lead");
  }

  async function handleSubmitPostPhotoLeadAndSurvey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photoResult) return;
    setError(null);

    if (contactName.trim().length < 2) {
      setError("Укажите Ваше имя или имя обследуемого пациента (не короче 2 букв).");
      return;
    }
    if (contactPhone.replace(/\D/g, "").length < 10) {
      setError("Укажите контактный номер телефона для связи по результату (не менее 10 цифр).");
      return;
    }
    if (isChildUnder18 && !guardianConfirmed) {
      setError("Подтвердите галочкой статус родителя или законного представителя ребёнка.");
      return;
    }

    setBusy(true);
    const res = await submitPublicMicroSurvey({
      sessionToken,
      submissionId: photoResult.submissionId,
      payload: {
        requireLeadContact: true,
        contactName: contactName.trim(),
        contactPhone: contactPhone.trim(),
        subjectRelation: isChildUnder18 ? "CHILD_UNDER_18" : "SELF",
        legalGuardianConfirmed: isChildUnder18 ? guardianConfirmed : false,
        isInfantUnder1Year,
        ...(isInfantUnder1Year
          ? { ageYears: 0, ageMonths: Math.max(1, Math.min(11, parsedAge || 6)) }
          : { ageYears: Math.max(1, Math.min(120, parsedAge || 34)) }),
        biologicalSex: sex,
        verificationOfSubmissionId,
        evolution,
        symptoms,
        priorTopical14d: priorTopical,
        pediatricSystemicRedFlags: Boolean(isToddlerU6 && pediatricRedFlags),
      },
    });
    setBusy(false);
    if (!res.ok || !res.value) {
      setError(res.error?.message || "Не удалось сформировать карточку маршрутизации.");
      return;
    }
    setResultCard(res.value.card);
    setBookingConfirmation(null);
    setStep("traffic_light_result");
  }

  async function handleOneTapBookClinic() {
    if (!photoResult) return;
    setBusy(true);
    setError(null);
    const res = await bookClinicFromPublicSubmission({
      sessionToken,
      submissionId: photoResult.submissionId,
      payload: {
        displayName: contactName.trim() || undefined,
        phone: contactPhone.trim() || undefined,
        preferredTimeNote,
        clinicId: selectedClinicId || undefined,
        bodyRegionCode: riskFactors.bodyRegionCode,
      },
    });
    setBusy(false);
    if (!res.ok || !res.value) {
      setError(res.error?.message || "Не удалось передать заявку в клинику.");
      return;
    }
    setBookingConfirmation(`${res.value.messageRu} (${res.value.bookingPriorityLabelRu}, окно: ${preferredTimeNote})`);
  }

  async function handleSaveRiskFactors() {
    const targetProfId = activeProfileId || photoResult?.profileId;
    if (!targetProfId) return;
    setBusy(true);
    const res = await savePublicRiskFactors({
      sessionToken,
      profileId: targetProfId,
      riskFactors,
    });
    setBusy(false);
    if (res.ok) {
      setRiskSavedNote("Факторы риска сохранены и будут переданы врачу на очном приёме.");
    }
  }

  async function handleDeleteMyData152Fz() {
    if (!sessionToken) return;
    setBusy(true);
    const res = await deletePublicOnboardingMyData({ sessionToken });
    setBusy(false);
    if (res.ok && res.value) {
      setProfiles([]);
      setActiveProfileId(null);
      setPhotoResult(null);
      setResultCard(null);
      setBookingConfirmation(null);
      setVerificationOfSubmissionId(null);
      setStep("photo_first");
      setStatusBanner(res.value.messageRu);
    }
  }

  function startNewAnalysis(secondAngleForSubmissionId: string | null = null) {
    setVerificationOfSubmissionId(secondAngleForSubmissionId);
    setResultCard(null);
    setBookingConfirmation(null);
    setError(null);
    setStep("photo_first");
  }

  const trafficLight = resultCard?.trafficLight || "GREEN_LOW";
  const trafficLightConfig =
    trafficLight === "RED_HIGH"
      ? {
          title: "🔴 Высокий уровень внимания — нужен очный осмотр врача",
          boxClass: "border-destructive/50 bg-destructive/10",
        }
      : trafficLight === "YELLOW_MEDIUM"
        ? {
            title: "⚠️ Средний уровень — рекомендуется плановая консультация дерматолога",
            boxClass: "border-amber-500/50 bg-amber-500/10",
          }
        : {
            title: "✅ Низкий уровень — спокойная визуальная картина",
            boxClass: "border-emerald-600/40 bg-emerald-500/10",
          };

  return (
    <div className={embedded ? "space-y-4 p-4" : "min-h-screen bg-surface-muted p-4 sm:p-6"}>
      <div className="mx-auto max-w-5xl space-y-4">
        {!embedded ? (
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Дерматолог Про · Фото-первая проверка и запись в клинику
              </p>
              <h1 className="text-[18px] font-semibold">
                Проверка снимка кожи по шагам и подготовка к очному осмотру врача
              </h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="min-h-11 text-[12px]">
                <Link to="/self-hosted/login">Вход в кабинет пациента / клиники</Link>
              </Button>
            </div>
          </header>
        ) : null}

        <div className="flex items-start gap-2 rounded-md border border-border bg-surface px-4 py-3 text-[12px] text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>
            Сервис помогает оценить качество снимка и выбрать срочность очного приёма дерматолога (не является медицинским диагнозом; самолечение опасно). При сохранении на сервере из файла автоматически удаляются EXIF, GPS и встроенные превью. Ограничения по числу проверок для пользователей отключены.
          </span>
        </div>

        {statusBanner ? (
          <div role="status" className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-[13px] text-foreground">
            {statusBanner}
          </div>
        ) : null}

        <Tabs defaultValue={embedded ? "telegram" : "web"} className="space-y-4">
          <TabsList className="h-auto min-h-11 flex-wrap justify-start gap-1 bg-surface p-1">
            <TabsTrigger value="web" className="min-h-11 gap-1.5 text-[13px]">
              <Camera className="h-4 w-4" aria-hidden />
              Веб-проверка снимка (сразу с фото · без сжатия)
            </TabsTrigger>
            <TabsTrigger value="telegram" className="min-h-11 gap-1.5 text-[13px]">
              <MessageSquare className="h-4 w-4" aria-hidden />
              Канал Telegram-бот (меню 2×3 и ветвление Miro)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: MIRO PHOTO-FIRST WEB FUNNEL */}
          <TabsContent value="web" className="m-0 space-y-4">
            {error ? (
              <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                <span>{error}</span>
              </div>
            ) : null}

            {/* ЭКРАН 1: СРАЗУ ПАМЯТКА ХОРОШО / ПЛОХО (~10 СМ) И ОТПРАВКА ФОТО */}
            {step === "photo_first" ? (
              <Card className="space-y-4 border-border bg-surface p-5">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    {verificationOfSubmissionId
                      ? "Проверка устойчивости · 2-е фото этого же участка под другим углом"
                      : "Шаг 1 · Отправьте фото для проверки прямо сейчас (без предварительных анкет)"}
                  </span>
                  <h2 className="text-[16px] font-semibold">
                    Правильное фото — точный результат!
                  </h2>
                  <p className="text-[13px] text-muted-foreground">
                    Поместите родинку или участок кожи в центр кадра с расстояния около 10 см при ровном дневном свете. Уберите из кадра одежду, волосы и пёстрый фон позади.
                  </p>
                </div>

                {instructionSvg ? (
                  <div className="overflow-hidden rounded-md border border-border bg-surface-muted p-2">
                    <img
                      src={instructionSvg}
                      alt="Наглядная памятка: ХОРОШО крупно в центре около 10 см, ПЛОХО издалека"
                      className="mx-auto w-full max-w-[520px] rounded"
                    />
                  </div>
                ) : null}

                {photoResult && !photoResult.qualityGate.passed ? (
                  <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-[13px]">
                    <p className="font-semibold text-foreground">
                      Плохое фото — нужен повторный кадр: {photoResult.qualityGate.reasonRu}
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-[12px] text-muted-foreground">
                      {photoResult.qualityGate.recoveryTipsRu.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-surface-muted p-3 text-[13px]">
                  <input
                    type="checkbox"
                    checked={consent152Fz}
                    onChange={(e) => setConsent152Fz(e.target.checked)}
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>
                    Соглашаюсь на обработку персональных и биометрических данных (152-ФЗ) для информационной подготовки к очному приёму дерматолога. Вы можете удалить свои снимки и данные одной кнопкой в любой момент.
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-3">
                  <input
                    id={fileInputId}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    onChange={(e) => void handleFileSelected(e)}
                    className="sr-only"
                  />
                  <Button asChild disabled={busy} className="min-h-11 cursor-pointer gap-2">
                    <label htmlFor={fileInputId}>
                      <Upload className="h-4 w-4" aria-hidden />
                      {busy ? "Проверяем резкость и очищаем EXIF…" : "Выбрать оригинальный снимок кожи (~10 см)"}
                    </label>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void processUploadedDataUrl(
                        SAMPLE_VALID_JPEG_DATA_URL,
                        { healthyRingRgb: { r: 228, g: 196, b: 176 } },
                        "clear_skin",
                      )
                    }
                    className="h-auto min-h-11 whitespace-normal py-2 text-[12px]"
                  >
                    Проверить сценарий на тестовом чётком снимке
                  </Button>
                </div>

                {profiles.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[12px] text-muted-foreground">
                    <span>Сохранённых профилей в сессии: {profiles.length}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void handleDeleteMyData152Fz()}
                      className="min-h-11 gap-1.5 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      Удалить мои снимки и данные (152-ФЗ)
                    </Button>
                  </div>
                ) : null}
              </Card>
            ) : null}

            {/* ПРЕДОХРАНИТЕЛЬ НЕСОВПАДЕНИЯ ТОНОВ КОЖИ (|ΔITA°| > 22°) */}
            {step === "mismatch" && photoResult?.mismatchPrompt ? (
              <Card className="space-y-4 border-border bg-surface p-5">
                <h2 className="text-[16px] font-semibold">
                  1 шаг: Детектированы важные участки · уточните профиль
                </h2>
                {photoResult.analysisStagesVisuals?.step1DetectionSvgDataUrl ? (
                  <img
                    src={photoResult.analysisStagesVisuals.step1DetectionSvgDataUrl}
                    alt="1 шаг: Детектированы важные участки"
                    className="w-full max-w-[360px] rounded border border-border"
                  />
                ) : null}
                <p className="text-[13px] text-muted-foreground">
                  {photoResult.mismatchPrompt.questionRu}
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {photoResult.mismatchPrompt.options.map((opt) => (
                    <Button
                      key={opt.code}
                      type="button"
                      variant={opt.code === "switched_profile" ? "default" : "outline"}
                      disabled={busy}
                      onClick={() => void handleResolveMismatch(opt.code)}
                      className="h-auto min-h-11 whitespace-normal py-2.5 text-left text-[13px]"
                    >
                      {opt.labelRu}
                    </Button>
                  ))}
                </div>
              </Card>
            ) : null}

            {/* ЭКРАН 2: СРАЗУ ПОСЛЕ ЧЁТКОГО ФОТО — 1 ШАГ ДЕТЕКЦИИ + СБОР ИМЕНИ, ТЕЛЕФОНА, ВОЗРАСТА И ПОЛА */}
            {step === "post_photo_lead" && photoResult ? (
              <Card className="space-y-4 border-border bg-surface p-5">
                <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)] md:items-center">
                  {photoResult.analysisStagesVisuals?.step1DetectionSvgDataUrl ? (
                    <img
                      src={photoResult.analysisStagesVisuals.step1DetectionSvgDataUrl}
                      alt="1 шаг: Детектированы важные участки кожи"
                      className="w-full rounded-md border border-border bg-surface-muted"
                    />
                  ) : null}
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        1 шаг: Детектированы важные участки ({photoResult.qualityGate.score0To100}/100)
                      </span>
                      <span className="rounded bg-primary/10 px-2.5 py-0.5 font-medium text-primary">
                        2 шаг: Анализ нейросети запущен…
                      </span>
                    </div>
                    <h2 className="text-[16px] font-semibold">
                      Пока готовится карточка результата — представьтесь, пожалуйста
                    </h2>
                    <p className="text-[12px] text-muted-foreground">
                      Автоматическая калибровка тона здоровой кожи вокруг очага: фототип {photoResult.phototypeEstimate.fitzpatrickBand} (ITA° {photoResult.phototypeEstimate.itaDegrees}°). Контакт сохраняется сразу, чтобы при необходимости записаться к врачу в 1 нажатие.
                    </p>
                  </div>
                </div>

                <form onSubmit={(e) => void handleSubmitPostPhotoLeadAndSurvey(e)} className="space-y-4 border-t border-border pt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="miro-lead-name">Как Вас зовут (или имя обследуемого пациента)?</Label>
                      <Input
                        id="miro-lead-name"
                        required
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Например: Анна"
                        className="min-h-11"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="miro-lead-phone">По какому номеру телефона можно связаться по результату?</Label>
                      <Input
                        id="miro-lead-phone"
                        type="tel"
                        required
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="+7 999 123-45-67"
                        className="min-h-11"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="miro-age-input">
                          {isInfantUnder1Year ? "Возраст младенца (полных месяцев, 1–11)" : "Возраст пациента (полных лет)"}
                        </Label>
                        <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={isInfantUnder1Year}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setIsInfantUnder1Year(checked);
                              setAgeInput(checked ? "6" : "34");
                            }}
                            className="h-4 w-4"
                          />
                          Младенец до 1 года
                        </label>
                      </div>
                      <Input
                        id="miro-age-input"
                        type="number"
                        min={1}
                        max={isInfantUnder1Year ? 11 : 120}
                        required
                        value={ageInput}
                        onChange={(e) => setAgeInput(e.target.value)}
                        className="min-h-11"
                      />
                    </div>

                    <fieldset className="space-y-1.5">
                      <legend className="text-[14px] font-medium">Пол пациента</legend>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            { value: "female", label: "Женский" },
                            { value: "male", label: "Мужской" },
                          ] as const
                        ).map((item) => (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => setSex(item.value)}
                            aria-pressed={sex === item.value}
                            className={`min-h-11 rounded-md border px-3 text-[13px] font-medium ${
                              sex === item.value
                                ? "border-primary bg-primary/10 text-foreground"
                                : "border-border bg-surface"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  </div>

                  {isChildUnder18 ? (
                    <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3.5">
                      <label className="flex cursor-pointer items-start gap-2.5 text-[13px]">
                        <input
                          type="checkbox"
                          checked={guardianConfirmed}
                          onChange={(e) => setGuardianConfirmed(e.target.checked)}
                          className="mt-0.5 h-4 w-4"
                        />
                        <span className="font-medium text-foreground">
                          Подтверждаю, что являюсь родителем или законным представителем ребёнка (обязательно для пациентов младше 18 лет).
                        </span>
                      </label>
                      {isToddlerU6 ? (
                        <label className="flex cursor-pointer items-start gap-2.5 text-[12px] text-foreground">
                          <input
                            type="checkbox"
                            checked={pediatricRedFlags}
                            onChange={(e) => setPediatricRedFlags(e.target.checked)}
                            className="mt-0.5 h-4 w-4"
                          />
                          <span>
                            У ребёнка сейчас есть повышенная температура, вялость или быстрое распространение высыпаний
                          </span>
                        </label>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label htmlFor="miro-evolution" className="text-[12px]">Динамика за 1–3 мес</Label>
                      <select
                        id="miro-evolution"
                        value={evolution}
                        onChange={(e) => setEvolution(e.target.value as EvolutionChoice)}
                        className="min-h-11 w-full rounded-md border border-border bg-surface px-2.5 text-[13px]"
                      >
                        <option value="stable_long">Существует давно, не меняется</option>
                        <option value="new_lt_3m">Появилось недавно (&lt; 3 мес)</option>
                        <option value="growing_changing">Заметно растёт или меняет цвет</option>
                        <option value="unsure">Затрудняюсь ответить</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="miro-symptoms" className="text-[12px]">Ощущения в области очага</Label>
                      <select
                        id="miro-symptoms"
                        value={symptoms}
                        onChange={(e) => setSymptoms(e.target.value as SymptomsChoice)}
                        className="min-h-11 w-full rounded-md border border-border bg-surface px-2.5 text-[13px]"
                      >
                        <option value="none">Не беспокоит</option>
                        <option value="itch_or_pain">Периодический зуд или болезненность</option>
                        <option value="bleeding_or_crust">Кровоточивость или корочка</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="miro-topical" className="text-[12px]">Наносили ли средства за 14 дней?</Label>
                      <select
                        id="miro-topical"
                        value={priorTopical}
                        onChange={(e) => setPriorTopical(e.target.value as TopicalChoice)}
                        className="min-h-11 w-full rounded-md border border-border bg-surface px-2.5 text-[13px]"
                      >
                        <option value="none">Ничем не мазали</option>
                        <option value="steroid_ointment">Гормональная мазь / крем</option>
                        <option value="antiseptic_dye_celelandine">Фукорцин / зелёнка / чистотел</option>
                        <option value="moisturizer">Обычный увлажняющий крем</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => startNewAnalysis(null)}
                      className="min-h-11"
                    >
                      Выбрать другое фото
                    </Button>
                    <Button type="submit" disabled={busy} className="min-h-11">
                      {busy ? "Формируем карточку светофора…" : "Показать результат проверки"}
                    </Button>
                  </div>
                </form>
              </Card>
            ) : null}

            {/* ЭКРАН 3: КАРТОЧКА СВЕТОФОРА (🔴 / ⚠️ / ✅) + 30 ДНЕЙ / 2-Е ФОТО + ЗАПИСЬ В 1 НАЖАТИЕ */}
            {step === "traffic_light_result" && resultCard ? (
              <div className="space-y-4">
                <Card className="space-y-4 border-border bg-surface p-5">
                  {resultCard.emergency103Banner ? (
                    <div role="alert" className="rounded-md border-2 border-destructive bg-destructive/10 p-4 text-[13px] font-medium text-destructive">
                      Экстренное предупреждение: при сочетании кожных высыпаний у ребёнка с температурой, вялостью или быстрым распространением элементов незамедлительно вызовите скорую помощь 103 или 112.
                    </div>
                  ) : null}

                  <div className={`space-y-1.5 rounded-md border p-4 ${trafficLightConfig.boxClass}`}>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      2 шаг: Анализ нейросети завершён · приватная карточка без полного кадра
                    </p>
                    <h2 className="text-[17px] font-semibold text-foreground">
                      {trafficLightConfig.title}
                    </h2>
                    <p className="text-[13px] leading-relaxed text-foreground">
                      {resultCard.safeSummaryRu || resultCard.statusMessageRu}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {resultCard.analysisStagesVisuals?.step2AttentionSvgDataUrl ? (
                      <div className="space-y-1.5 rounded-md border border-border bg-surface-muted p-3">
                        <img
                          src={resultCard.analysisStagesVisuals.step2AttentionSvgDataUrl}
                          alt="2 шаг: Анализ нейросети — выделение контура"
                          className="w-full rounded"
                        />
                        <p className="text-[12px] text-muted-foreground">
                          2 шаг: Выделение области внимания и локального контура без показа лица и фона.
                        </p>
                      </div>
                    ) : null}

                    {resultCard.lesionCrops?.map((crop) => (
                      <div key={crop.lesionIndex} className="space-y-1.5 rounded-md border border-border bg-surface-muted p-3">
                        <img
                          src={crop.cropSvgDataUrl}
                          alt={`${crop.title} — локальный участок с отступом +${crop.surroundingSkinMarginPercent}%`}
                          className="w-full rounded"
                        />
                        <p className="text-[12px] text-muted-foreground">
                          {crop.title}: показан только локальный участок (+{crop.surroundingSkinMarginPercent}% здоровой кожи вокруг). Чёткость: {crop.qualityScore0To100}/100.
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Ветка Miro для ✅ Низкого уровня: таймер повторного осмотра через 30 дней */}
                  {trafficLight === "GREEN_LOW" ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-600/30 bg-emerald-500/5 p-3.5 text-[13px]">
                      <div className="flex items-start gap-2.5">
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
                        <span>
                          {resultCard.followupTimerMessageRu ||
                            `Активировано плановое напоминание на ${followupDaysCfg} дней для повторного фотоконтроля родинки в динамике. Сразу отправляйте новое фото, если заметите любые изменения или травму.`}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {/* Ветка Miro для ⚠️ Среднего уровня: «Удостоверься в результате — отправь 2-е фото этого места» */}
                  {trafficLight === "YELLOW_MEDIUM" ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3.5 text-[13px]">
                      <span className="max-w-xl">
                        {resultCard.secondPhotoVerificationPromptRu ||
                          "Удостоверьтесь в результате: сделайте 2-е фото этого же участка чуть под другим углом (~10 см) и отправьте на проверку снова."}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => startNewAnalysis(photoResult?.submissionId || null)}
                        className="h-auto min-h-11 gap-1.5 whitespace-normal py-2 text-[12px]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                        Отправить 2-е фото этого места
                      </Button>
                    </div>
                  ) : null}

                  {/* ЗАПИСЬ НА ПРИЁМ В 1 НАЖАТИЕ (имя и телефон уже сохранены!) */}
                  {bookingConfirmation ? (
                    <div role="status" className="rounded-md border border-primary/40 bg-primary/10 p-4 text-[13px]">
                      <p className="font-semibold text-foreground">{bookingConfirmation}</p>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        Администратор записи видит только контакт ({contactName}, {contactPhone}) и желаемое окно. Снимки и клиническая сводка скрыты от оператора и откроются только врачу на очном приёме.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-md border border-border bg-surface-muted p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="text-[14px] font-semibold">
                            Запись на очный приём в 1 нажатие
                          </h3>
                          <p className="text-[12px] text-muted-foreground">
                            Контакт для связи уже сохранён: <span className="font-medium text-foreground">{contactName} ({contactPhone})</span>
                          </p>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label htmlFor="miro-slot-select" className="text-[12px]">Желаемое окно приёма</Label>
                          <select
                            id="miro-slot-select"
                            value={preferredTimeNote}
                            onChange={(e) => setPreferredTimeNote(e.target.value)}
                            className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-[13px]"
                          >
                            <option value="Ближайшее свободное окно">Ближайшее свободное окно</option>
                            <option value="Будни утром (09:00–13:00)">Будни утром (09:00–13:00)</option>
                            <option value="Будни вечером (после 18:00)">Будни вечером (после 18:00)</option>
                            <option value="Выходной день">Выходной день</option>
                          </select>
                        </div>
                        {clinics.length > 0 ? (
                          <div className="space-y-1">
                            <Label htmlFor="miro-clinic-select" className="text-[12px]">Клиника-партнёр</Label>
                            <select
                              id="miro-clinic-select"
                              value={selectedClinicId}
                              onChange={(e) => setSelectedClinicId(e.target.value)}
                              className="min-h-11 w-full rounded-md border border-border bg-surface px-3 text-[13px]"
                            >
                              {clinics.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleOneTapBookClinic()}
                          className="min-h-11 gap-2"
                        >
                          <PhoneCall className="h-4 w-4" aria-hidden />
                          {resultCard.primaryCtaLabelRu || "Записаться на приём сейчас"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy}
                          onClick={() => startNewAnalysis(null)}
                          className="min-h-11"
                        >
                          Новый анализ
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => void handleDeleteMyData152Fz()}
                          className="min-h-11 gap-1.5 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                          {resultCard.deleteDataLabelRu || "Удалить мои снимки и данные"}
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>

                {/* НЕНАВЯЗЧИВОЕ ДОПОЛНЕНИЕ ДЛЯ ВРАЧА ПОСЛЕ РЕЗУЛЬТАТА */}
                <Card className="space-y-3 border-border bg-surface p-5">
                  <div>
                    <h3 className="text-[14px] font-semibold">
                      Дополнить карточку для врача (по желанию)
                    </h3>
                    <p className="text-[12px] text-muted-foreground">
                      Отметьте индивидуальные факторы — врач увидит их уже заполненными на очном осмотре:
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 text-[13px]">
                    {(
                      [
                        { key: "sunburnsChildhood", label: "Солнечные ожоги с пузырями в прошлом" },
                        { key: "tanningBed", label: "Посещение солярия" },
                        { key: "neviOver50", label: "Более 50 родинок на теле" },
                        { key: "familyMelanomaHistory", label: "Опухоли кожи у кровных родственников" },
                      ] as const
                    ).map((item) => (
                      <label key={item.key} className="flex cursor-pointer items-center gap-2 rounded border border-border px-3 py-2">
                        <input
                          type="checkbox"
                          checked={riskFactors[item.key]}
                          onChange={(e) => setRiskFactors((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                          className="h-4 w-4"
                        />
                        <span>{item.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" variant="outline" disabled={busy} onClick={() => void handleSaveRiskFactors()} className="min-h-11">
                      Сохранить факторы для врача
                    </Button>
                    {riskSavedNote ? <span className="text-[12px] text-muted-foreground">{riskSavedNote}</span> : null}
                  </div>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          {/* TAB 2: TELEGRAM BOT MIRO DIALOG & 2x3 PERSISTENT MENU */}
          <TabsContent value="telegram" className="m-0 space-y-4">
            <TelegramMiroDialogPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
