import { useCallback, useEffect, useId, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  MessageSquare,
  PhoneCall,
  ShieldCheck,
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
  createPublicOnboardingProfile,
  deletePublicOnboardingMyData,
  initPublicOnboardingSession,
  readOriginalFileAsDataUrl,
  resolvePublicProfileMismatch,
  savePublicRiskFactors,
  stepTelegramBotDialogSimulator,
  submitPublicMicroSurvey,
  submitPublicOnboardingPhoto,
  type BiologicalSex,
  type EvolutionChoice,
  type LesionCropCardItemDTO,
  type OnboardingClinicChoiceDTO,
  type OnboardingProfileDTO,
  type PatientFacingResultCardDTO,
  type PhotoSubmitResultDTO,
  type SubjectRelation,
  type SymptomsChoice,
  type TelegramBotInlineButtonDTO,
  type TopicalChoice,
} from "@/lib/self-hosted-onboarding-api";

const STORAGE_TOKEN_KEY = "skindoctor.onboarding.token.v1";

type WebFlowStep = "profile" | "photo" | "mismatch" | "survey" | "result";

interface TgChatBubble {
  id: string;
  side: "bot" | "user";
  text: string;
  cropCard?: LesionCropCardItemDTO | null;
}

const TG_STATE_LABEL_RU: Record<string, string> = {
  S0_START: "Выбор профиля",
  S1_GUARDIAN_CHECK: "Подтверждение законного представителя",
  S1_CONSENT_152FZ: "Согласие 152-ФЗ",
  S2_AGE: "Ввод возраста",
  S2_INFANT_MONTHS: "Возраст младенца (месяцы)",
  S2_SEX: "Выбор пола",
  S3_AWAIT_PHOTO: "Ожидание снимка кожи",
  S3_MISMATCH_GUARD: "Сверка тона кожи с профилем",
  S4_Q1_EVOLUTION: "Вопрос 1 из 3 (динамика)",
  S4_Q2_SYMPTOMS: "Вопрос 2 из 3 (симптомы)",
  S4_Q3_TOPICAL_U5: "Вопрос 3 из 3 (наружные средства)",
  S4_U6_CHILD_RED_FLAGS: "Педиатрическая проверка",
  S5_RESULT_CARD: "Приватная карточка маршрутизации",
  S5_QUEUED_GPU: "Очередь расчёта",
  S5_RISK_FACTORS: "Факторы риска",
  S6_BOOK_NAME: "Запись в клинику · имя",
  S6_BOOK_PHONE: "Запись в клинику · телефон",
  S6_BOOK_TIME: "Запись в клинику · время",
  S6_BOOK_DONE: "Заявка передана в клинику",
  S7_DELETED_152FZ: "Данные удалены по 152-ФЗ",
};

const RELATION_OPTIONS: Array<{ value: SubjectRelation; title: string; hint: string }> = [
  { value: "SELF", title: "Себе", hint: "Личный профиль проверки кожи" },
  { value: "CHILD_UNDER_18", title: "Ребёнку (до 18 лет)", hint: "С подтверждением статуса родителя" },
  { value: "ADULT_RELATIVE", title: "Близкому взрослому", hint: "Отдельный профиль супруга или родственника" },
];

export default function PublicSkinCheckPage({ embedded = false }: { embedded?: boolean }) {
  const fileInputId = useId();
  const [sessionToken, setSessionToken] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(STORAGE_TOKEN_KEY) || "";
  });
  const [profiles, setProfiles] = useState<OnboardingProfileDTO[]>([]);
  const [clinics, setClinics] = useState<OnboardingClinicChoiceDTO[]>([]);
  const [activeProfile, setActiveProfile] = useState<OnboardingProfileDTO | null>(null);
  const [step, setStep] = useState<WebFlowStep>("profile");

  // Step 1 form state
  const [relation, setRelation] = useState<SubjectRelation>("SELF");
  const [guardianConfirmed, setGuardianConfirmed] = useState(false);
  const [consent152Fz, setConsent152Fz] = useState(false);
  const [isInfant, setIsInfant] = useState(false);
  const [ageInput, setAgeInput] = useState("34");
  const [sex, setSex] = useState<BiologicalSex>("female");

  // Step 2 state
  const [photoResult, setPhotoResult] = useState<PhotoSubmitResultDTO | null>(null);
  const [evolution, setEvolution] = useState<EvolutionChoice>("stable_long");
  const [symptoms, setSymptoms] = useState<SymptomsChoice>("none");
  const [priorTopical, setPriorTopical] = useState<TopicalChoice>("none");
  const [pediatricRedFlags, setPediatricRedFlags] = useState(false);

  // Result & booking state
  const [resultCard, setResultCard] = useState<PatientFacingResultCardDTO | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [preferredTimeNote, setPreferredTimeNote] = useState("Ближайшее доступное окно");
  const [selectedClinicId, setSelectedClinicId] = useState("");
  const [bookingConfirmation, setBookingConfirmation] = useState<string | null>(null);

  // Post-result optional risk factors
  const [riskSavedNote, setRiskSavedNote] = useState<string | null>(null);
  const [riskFactors, setRiskFactors] = useState({
    bodyRegionCode: "trunk_anterior",
    sunburnsChildhood: false,
    tanningBed: false,
    familyMelanomaHistory: false,
    neviOver50: false,
    immunosuppressionOrDiabetes: false,
    smokingOrChronicTrauma: false,
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Telegram first-channel interactive dialog state
  const [tgChatId] = useState(() => `tg-web-${Math.random().toString(36).slice(2, 9)}`);
  const [tgState, setTgState] = useState("S0_START");
  const [tgButtons, setTgButtons] = useState<TelegramBotInlineButtonDTO[][]>([]);
  const [tgInput, setTgInput] = useState("");
  const [tgBusy, setTgBusy] = useState(false);
  const [tgBubbles, setTgBubbles] = useState<TgChatBubble[]>([]);

  const bootstrapSession = useCallback(async () => {
    const res = await initPublicOnboardingSession({
      sessionToken: sessionToken || null,
      channel: "web",
    });
    if (res.ok && res.value) {
      setSessionToken(res.value.sessionToken);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_TOKEN_KEY, res.value.sessionToken);
      }
      setProfiles(res.value.profiles);
      setClinics(res.value.clinics);
      if (res.value.clinics[0] && !selectedClinicId) {
        setSelectedClinicId(res.value.clinics[0].id);
      }
      if (res.value.profiles[0] && !activeProfile) {
        setActiveProfile(res.value.profiles[0]);
      }
    }
  }, [activeProfile, selectedClinicId, sessionToken]);

  const startTelegramDialog = useCallback(async () => {
    setTgBusy(true);
    const res = await stepTelegramBotDialogSimulator({
      chatId: tgChatId,
      text: "/start",
    });
    setTgBusy(false);
    if (res.ok && res.value) {
      setTgState(res.value.fsmState);
      setTgButtons(res.value.reply.buttons);
      setTgBubbles([
        {
          id: "tg-init",
          side: "bot",
          text: res.value.reply.text,
          cropCard: res.value.reply.cropCard,
        },
      ]);
    }
  }, [tgChatId]);

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  useEffect(() => {
    if (tgBubbles.length === 0) {
      void startTelegramDialog();
    }
  }, [startTelegramDialog, tgBubbles.length]);

  async function handleCreateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatusBanner(null);

    if (relation === "CHILD_UNDER_18" && !guardianConfirmed) {
      setError("Подтвердите галочкой статус родителя или законного представителя ребёнка.");
      return;
    }
    if (!consent152Fz) {
      setError("Примите согласие на обработку данных (152-ФЗ) для продолжения.");
      return;
    }

    const numericAge = Number.parseInt(ageInput, 10);
    setBusy(true);
    const res = await createPublicOnboardingProfile({
      sessionToken,
      payload: {
        subjectRelation: relation,
        legalGuardianConfirmed: relation === "CHILD_UNDER_18" ? guardianConfirmed : false,
        consent152FzAccepted: consent152Fz,
        isInfantUnder1Year: relation === "CHILD_UNDER_18" && isInfant,
        ...(relation === "CHILD_UNDER_18" && isInfant
          ? { ageMonths: numericAge }
          : { ageYears: numericAge }),
        biologicalSex: sex,
      },
    });
    setBusy(false);

    if (!res.ok || !res.value) {
      setError(res.error?.message || "Проверьте заполнение анкеты профиля.");
      return;
    }

    setActiveProfile(res.value.profile);
    setProfiles((prev) => [...prev.filter((p) => p.id !== res.value!.profile.id), res.value.profile]);
    setStep("photo");
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !activeProfile) return;

    setBusy(true);
    setError(null);
    try {
      // Original raw file without client-side canvas recompression or EXIF stripping!
      const dataUrl = await readOriginalFileAsDataUrl(file);
      const res = await submitPublicOnboardingPhoto({
        sessionToken,
        profileId: activeProfile.id,
        imageBase64: dataUrl,
      });
      setBusy(false);
      if (!res.ok || !res.value) {
        setError(res.error?.message || "Не удалось проверить файл снимка.");
        return;
      }
      setPhotoResult(res.value);
      if (!res.value.qualityGate.passed) {
        setStep("photo");
        return;
      }
      if (res.value.status === "awaiting_mismatch_confirm") {
        setStep("mismatch");
        return;
      }
      setStep("survey");
    } catch (err) {
      setBusy(false);
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
    if (!res.ok) {
      setError(res.error?.message || "Не удалось применить выбор профиля.");
      return;
    }
    setStep("survey");
  }

  async function handleSubmitSurvey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photoResult) return;
    setBusy(true);
    setError(null);
    const res = await submitPublicMicroSurvey({
      sessionToken,
      submissionId: photoResult.submissionId,
      payload: {
        evolution,
        symptoms,
        priorTopical14d: priorTopical,
        pediatricSystemicRedFlags: Boolean(activeProfile?.pediatricU6Active && pediatricRedFlags),
      },
    });
    setBusy(false);
    if (!res.ok || !res.value) {
      setError(res.error?.message || "Не удалось сформировать карточку маршрутизации.");
      return;
    }
    setResultCard(res.value.card);
    setStep("result");
  }

  async function handleSaveRiskFactors() {
    if (!activeProfile) return;
    setBusy(true);
    const res = await savePublicRiskFactors({
      sessionToken,
      profileId: activeProfile.id,
      riskFactors,
    });
    setBusy(false);
    if (res.ok) {
      setRiskSavedNote("Индивидуальные факторы риска сохранены для врача клиники.");
    }
  }

  async function handleBookClinic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photoResult) return;
    setBusy(true);
    setError(null);
    const res = await bookClinicFromPublicSubmission({
      sessionToken,
      submissionId: photoResult.submissionId,
      payload: {
        displayName: contactName,
        phone: contactPhone,
        preferredTimeNote,
        clinicId: selectedClinicId || undefined,
        bodyRegionCode: riskFactors.bodyRegionCode,
      },
    });
    setBusy(false);
    if (!res.ok || !res.value) {
      setError(res.error?.message || "Проверьте имя и телефон для записи.");
      return;
    }
    setBookingConfirmation(`${res.value.messageRu} (${res.value.bookingPriorityLabelRu})`);
    setBookingOpen(false);
  }

  async function handleDeleteMyData152Fz() {
    if (!sessionToken) return;
    setBusy(true);
    const res = await deletePublicOnboardingMyData({ sessionToken });
    setBusy(false);
    if (res.ok && res.value) {
      setProfiles([]);
      setActiveProfile(null);
      setPhotoResult(null);
      setResultCard(null);
      setBookingConfirmation(null);
      setStep("profile");
      setStatusBanner(res.value.messageRu);
    }
  }

  async function sendTelegramAction(opts: {
    userLabel: string;
    text?: string | null;
    callbackData?: string | null;
    simulatePhotoPreset?: "clear_skin" | "blur" | "glare" | "dark" | "mismatch_skin" | null;
    clientHints?: Record<string, unknown>;
  }) {
    setTgBubbles((prev) => [
      ...prev,
      { id: `u-${Date.now()}-${Math.random()}`, side: "user", text: opts.userLabel },
    ]);
    setTgBusy(true);
    const res = await stepTelegramBotDialogSimulator({
      chatId: tgChatId,
      text: opts.text ?? null,
      callbackData: opts.callbackData ?? null,
      simulatePhotoPreset: opts.simulatePhotoPreset ?? null,
      clientHints: opts.clientHints ?? {},
    });
    setTgBusy(false);
    if (res.ok && res.value) {
      setTgState(res.value.fsmState);
      setTgButtons(res.value.reply.buttons);
      setTgBubbles((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}-${Math.random()}`,
          side: "bot",
          text: res.value.reply.text,
          cropCard: res.value.reply.cropCard,
        },
      ]);
    }
  }

  return (
    <div className={embedded ? "space-y-4 p-4" : "min-h-screen bg-surface-muted p-4 sm:p-6"}>
      <div className="mx-auto max-w-5xl space-y-4">
        {!embedded ? (
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface p-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Дерматолог Про · Предварительная проверка и запись в клинику
              </p>
              <h1 className="text-[18px] font-semibold">
                Проверка снимка кожи и подготовка к очному осмотру врача
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
            Сервис помогает оценить качество снимка и выбрать срочность очного приёма дерматолога (не является медицинским диагнозом). При сохранении на сервере из файла автоматически удаляются EXIF, GPS и встроенные превью. Ограничения по числу проверок для пользователей отключены.
          </span>
        </div>

        {statusBanner ? (
          <div role="status" className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-[13px] text-foreground">
            {statusBanner}
          </div>
        ) : null}

        <Tabs defaultValue="web" className="space-y-4">
          <TabsList className="h-auto min-h-11 flex-wrap justify-start gap-1 bg-surface p-1">
            <TabsTrigger value="web" className="min-h-11 gap-1.5 text-[13px]">
              <Camera className="h-4 w-4" aria-hidden />
              Веб-проверка снимка (оригинал без сжатия)
            </TabsTrigger>
            <TabsTrigger value="telegram" className="min-h-11 gap-1.5 text-[13px]">
              <MessageSquare className="h-4 w-4" aria-hidden />
              Канал Telegram-бот (диалог и ветвление)
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PUBLIC WEB 2-STEP ONBOARDING */}
          <TabsContent value="web" className="m-0 space-y-4">
            {error ? (
              <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
                {error}
              </div>
            ) : null}

            {step === "profile" ? (
              <Card className="space-y-5 p-5">
                <div>
                  <div className="text-[11px] font-semibold uppercase text-muted-foreground">Шаг 1 из 2 · Профиль</div>
                  <h2 className="mt-1 text-[16px] font-semibold">Кому проверяем кожу?</h2>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    Отдельные профили нужны, чтобы не смешивать возраст, пол и автоматический расчёт фототипа кожи (ITA°).
                  </p>
                </div>

                {profiles.length > 0 ? (
                  <div className="rounded-md border border-border bg-surface-muted p-3">
                    <div className="text-[12px] font-medium">Быстрый выбор сохранённого профиля:</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {profiles.map((p) => (
                        <Button
                          key={p.id}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11 text-[12px]"
                          onClick={() => {
                            setActiveProfile(p);
                            setStep("photo");
                          }}
                        >
                          {p.label} ({p.biologicalSex === "male" ? "муж." : "жен."})
                          {p.estimatedFitzpatrickBand ? ` · фототип ${p.estimatedFitzpatrickBand}` : ""}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <form onSubmit={handleCreateProfile} className="space-y-4">
                  <fieldset className="space-y-2">
                    <legend className="text-[13px] font-medium">Выберите профиль</legend>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {RELATION_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setRelation(opt.value);
                            if (opt.value === "CHILD_UNDER_18") {
                              const cur = Number.parseInt(ageInput, 10);
                              if (!Number.isFinite(cur) || cur >= 18) {
                                setAgeInput(isInfant ? "6" : "7");
                              }
                            } else {
                              setIsInfant(false);
                              const cur = Number.parseInt(ageInput, 10);
                              if (!Number.isFinite(cur) || cur < 18) {
                                setAgeInput("34");
                              }
                            }
                          }}
                          aria-pressed={relation === opt.value}
                          className={`min-h-[56px] rounded-md border p-3 text-left transition ${
                            relation === opt.value
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border bg-surface hover:bg-surface-muted"
                          }`}
                        >
                          <div className="text-[13px] font-semibold">{opt.title}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">{opt.hint}</div>
                        </button>
                      ))}
                    </div>
                  </fieldset>

                  {relation === "CHILD_UNDER_18" ? (
                    <label className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-[13px]">
                      <input
                        type="checkbox"
                        checked={guardianConfirmed}
                        onChange={(e) => setGuardianConfirmed(e.target.checked)}
                        className="mt-0.5 h-4 w-4"
                      />
                      <span>
                        Подтверждаю, что являюсь родителем или иным законным представителем ребёнка (обязательно для загрузки детского снимка).
                      </span>
                    </label>
                  ) : null}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="onb-age" className="text-[13px]">
                        {relation === "CHILD_UNDER_18" && isInfant
                          ? "Возраст младенца (полных месяцев, 0–11)"
                          : "Возраст (полных лет)"}
                      </Label>
                      <Input
                        id="onb-age"
                        type="number"
                        min={0}
                        max={relation === "CHILD_UNDER_18" ? (isInfant ? 11 : 17) : 120}
                        value={ageInput}
                        onChange={(e) => setAgeInput(e.target.value)}
                        className="min-h-11 text-[14px]"
                        required
                      />
                      {relation === "CHILD_UNDER_18" ? (
                        <label className="flex min-h-11 items-center gap-2 text-[12px] text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={isInfant}
                            onChange={(e) => {
                              setIsInfant(e.target.checked);
                              setAgeInput(e.target.checked ? "6" : "5");
                            }}
                            className="h-4 w-4"
                          />
                          Ребёнку меньше 1 года (включить педиатрические правила безопасности)
                        </label>
                      ) : null}
                    </div>

                    <fieldset className="space-y-2">
                      <legend className="text-[13px] font-medium">Биологический пол</legend>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={sex === "female" ? "default" : "outline"}
                          className="min-h-11 text-[13px]"
                          onClick={() => setSex("female")}
                        >
                          Женский
                        </Button>
                        <Button
                          type="button"
                          variant={sex === "male" ? "default" : "outline"}
                          className="min-h-11 text-[13px]"
                          onClick={() => setSex("male")}
                        >
                          Мужской
                        </Button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Фототип кожи вручную указывать не нужно — сервер рассчитает угол пигментации ITA° автоматически по здоровому участку вокруг очага.
                      </p>
                    </fieldset>
                  </div>

                  <label className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-md border border-border p-3 text-[13px]">
                    <input
                      type="checkbox"
                      checked={consent152Fz}
                      onChange={(e) => setConsent152Fz(e.target.checked)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>
                      Даю согласие на обработку персональных данных согласно 152-ФЗ (ст. 9, ст. 10) и подтверждаю понимание, что сервис носит информационно-маршрутизирующий характер и не заменяет очный осмотр врача.
                    </span>
                  </label>

                  <Button type="submit" disabled={busy} className="min-h-11 w-full text-[14px] sm:w-auto sm:px-6">
                    {busy ? "Сохраняем профиль…" : "Перейти к загрузке снимка"}
                  </Button>
                </form>
              </Card>
            ) : null}

            {step === "photo" ? (
              <Card className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                      Шаг 2 из 2 · Оригинальный снимок без сжатия
                    </div>
                    <h2 className="mt-1 text-[16px] font-semibold">
                      Загрузите чёткое фото участка кожи ({activeProfile?.label})
                    </h2>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11 text-[12px]"
                    onClick={() => setStep("profile")}
                  >
                    Сменить профиль
                  </Button>
                </div>

                <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
                  <li>Снимайте при мягком дневном освещении у окна без прямой вспышки с расстояния 10–15 см.</li>
                  <li>Файл передаётся на сервер в оригинальном качестве (Display P3 → sRGB), после чего EXIF и GPS полностью очищаются.</li>
                </ul>

                {photoResult && !photoResult.qualityGate.passed ? (
                  <div role="alert" className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-[13px]">
                    <div className="font-semibold text-foreground">
                      Снимок отклонён входным контролем чёткости: {photoResult.qualityGate.reasonRu}
                    </div>
                    <ul className="list-disc pl-5 text-[12px] text-muted-foreground">
                      {photoResult.qualityGate.recoveryTipsRu.map((tip) => (
                        <li key={tip}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div>
                  <input
                    id={fileInputId}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    onChange={(e) => void handleFileSelected(e)}
                    className="sr-only"
                  />
                  <Button asChild disabled={busy} className="min-h-11 cursor-pointer gap-2 text-[14px]">
                    <label htmlFor={fileInputId}>
                      <Upload className="h-4 w-4" aria-hidden />
                      {busy
                        ? "Проверяем чёткость и цветовой профиль…"
                        : photoResult && !photoResult.qualityGate.passed
                          ? "Отправить новый снимок"
                          : "Выбрать оригинальный файл снимка"}
                    </label>
                  </Button>
                </div>
              </Card>
            ) : null}

            {step === "mismatch" && photoResult?.mismatchPrompt ? (
              <Card className="space-y-4 p-5">
                <div className="text-[11px] font-semibold uppercase text-amber-600">
                  Проверка совпадения профиля (ΔITA° {photoResult.phototypeEstimate.deltaItaFromProfile}°)
                </div>
                <h2 className="text-[16px] font-semibold">{photoResult.mismatchPrompt.questionRu}</h2>
                <div className="flex flex-wrap gap-3">
                  {photoResult.mismatchPrompt.options.map((opt) => (
                    <Button
                      key={opt.code}
                      type="button"
                      variant={opt.code === "same_person_lighting" ? "default" : "outline"}
                      disabled={busy}
                      className="min-h-11 text-[13px]"
                      onClick={() => void handleResolveMismatch(opt.code)}
                    >
                      {opt.labelRu}
                    </Button>
                  ))}
                </div>
              </Card>
            ) : null}

            {step === "survey" ? (
              <Card className="space-y-5 p-5">
                <div>
                  <div className="flex items-center gap-1.5 text-[12px] font-medium text-primary">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Снимок принят (чёткость {photoResult?.qualityGate.score0To100}/100 · авто-фототип {photoResult?.phototypeEstimate.fitzpatrickBand})
                  </div>
                  <h2 className="mt-1 text-[16px] font-semibold">Ответьте на 3 коротких вопроса по очагу</h2>
                </div>

                <form onSubmit={handleSubmitSurvey} className="space-y-4">
                  <fieldset className="space-y-2">
                    <legend className="text-[13px] font-medium">1. Динамика и давность</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        ["stable_long", "Давно и не меняется"],
                        ["new_lt_3m", "Появилось недавно (< 3 мес)"],
                        ["growing_changing", "Заметно растёт или меняет цвет/форму"],
                        ["unsure", "Трудно сказать"],
                      ].map(([val, label]) => (
                        <Button
                          key={val}
                          type="button"
                          variant={evolution === val ? "default" : "outline"}
                          className="min-h-11 justify-start text-left text-[13px]"
                          onClick={() => setEvolution(val as EvolutionChoice)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="space-y-2">
                    <legend className="text-[13px] font-medium">2. Ощущения в области очага</legend>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {[
                        ["none", "Не беспокоит"],
                        ["itch_or_pain", "Зудит или болит"],
                        ["bleeding_or_crust", "Кровит или корочка без травмы"],
                      ].map(([val, label]) => (
                        <Button
                          key={val}
                          type="button"
                          variant={symptoms === val ? "default" : "outline"}
                          className="min-h-11 justify-start text-left text-[13px]"
                          onClick={() => setSymptoms(val as SymptomsChoice)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="space-y-2">
                    <legend className="text-[13px] font-medium">3. Чем обрабатывали участок за последние 14 дней?</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {[
                        ["none", "Ничем не мазали"],
                        ["steroid_ointment", "Гормональная мазь (Целестодерм, Тридерм, Акридерм и др.)"],
                        ["antiseptic_dye_celelandine", "Зелёнка, фукорцин, йод, чистотел"],
                        ["moisturizer", "Увлажняющий или обычный крем"],
                      ].map(([val, label]) => (
                        <Button
                          key={val}
                          type="button"
                          variant={priorTopical === val ? "default" : "outline"}
                          className="min-h-11 justify-start text-left text-[13px]"
                          onClick={() => setPriorTopical(val as TopicalChoice)}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </fieldset>

                  {activeProfile?.pediatricU6Active ? (
                    <label className="flex min-h-11 items-start gap-2.5 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-[13px]">
                      <input
                        type="checkbox"
                        checked={pediatricRedFlags}
                        onChange={(e) => setPediatricRedFlags(e.target.checked)}
                        className="mt-0.5 h-4 w-4"
                      />
                      <span>
                        У ребёнка сейчас есть повышенная температура, выраженная вялость или быстрое распространение высыпаний
                      </span>
                    </label>
                  ) : null}

                  <Button type="submit" disabled={busy} className="min-h-11 w-full text-[14px] sm:w-auto sm:px-6">
                    {busy ? "Готовим карточку маршрутизации…" : "Получить предварительную сводку"}
                  </Button>
                </form>
              </Card>
            ) : null}

            {step === "result" && resultCard ? (
              <Card className="space-y-5 p-5">
                {resultCard.emergency103Banner ? (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-md border border-destructive bg-destructive/10 p-4 text-[13px] font-medium text-destructive"
                  >
                    <PhoneCall className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                    <span>
                      Экстренное предупреждение: при температуре, вялости или быстром распространении сыпи у ребёнка незамедлительно обратитесь за скорой медицинской помощью по номеру 103 или 112.
                    </span>
                  </div>
                ) : null}

                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[12px] font-semibold text-primary">
                    {resultCard.badgeLabelRu || "Предварительная маршрутизация готова"}
                  </div>
                  <p className="mt-3 text-[14px] leading-relaxed text-foreground">
                    {resultCard.safeSummaryRu || resultCard.statusMessageRu}
                  </p>
                </div>

                {resultCard.lesionCrops && resultCard.lesionCrops.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {resultCard.lesionCrops.map((crop) => (
                      <div key={crop.lesionIndex} className="rounded-md border border-border bg-surface-muted p-3">
                        <img
                          src={crop.cropSvgDataUrl}
                          alt={`${crop.title} — локальный кроп +25%`}
                          className="w-full rounded-md"
                        />
                        <div className="mt-2 text-[12px] text-muted-foreground">
                          Приватная карточка: показан только локальный участок (+{crop.surroundingSkinMarginPercent}% кожи вокруг контура) без полного лица или тела.
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {bookingConfirmation ? (
                  <div role="status" className="rounded-md border border-primary/40 bg-primary/5 p-4 text-[13px] font-medium">
                    {bookingConfirmation}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      className="min-h-11 text-[14px] px-6"
                      onClick={() => setBookingOpen(true)}
                    >
                      {resultCard.primaryCtaLabelRu}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 text-[13px]"
                      onClick={() => {
                        setPhotoResult(null);
                        setResultCard(null);
                        setStep("photo");
                      }}
                    >
                      Проверить ещё снимок
                    </Button>
                  </div>
                )}

                {bookingOpen ? (
                  <form onSubmit={handleBookClinic} className="space-y-3 rounded-md border border-border bg-surface-muted p-4">
                    <h3 className="text-[14px] font-semibold">Заявка на очный приём к дерматологу</h3>
                    <p className="text-[12px] text-muted-foreground">
                      Администратор записи увидит только ваше имя, телефон, желаемое время и приоритет окна. Снимки и предвизитная анкета откроются только врачу на приёме.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-[12px] font-medium">
                        Ваше имя
                        <Input
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="Иван"
                          className="min-h-11"
                          required
                        />
                      </label>
                      <label className="grid gap-1 text-[12px] font-medium">
                        Контактный телефон
                        <Input
                          type="tel"
                          value={contactPhone}
                          onChange={(e) => setContactPhone(e.target.value)}
                          placeholder="+7 999 000-00-00"
                          className="min-h-11"
                          required
                        />
                      </label>
                      <label className="grid gap-1 text-[12px] font-medium">
                        Клиника
                        <select
                          value={selectedClinicId}
                          onChange={(e) => setSelectedClinicId(e.target.value)}
                          className="min-h-11 rounded-md border border-input bg-background px-3 text-[13px]"
                        >
                          {clinics.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1 text-[12px] font-medium">
                        Удобное время визита
                        <Input
                          value={preferredTimeNote}
                          onChange={(e) => setPreferredTimeNote(e.target.value)}
                          className="min-h-11"
                        />
                      </label>
                    </div>
                    <Button type="submit" disabled={busy} className="min-h-11 text-[13px]">
                      {busy ? "Отправляем заявку…" : "Подтвердить отправку заявки в клинику"}
                    </Button>
                  </form>
                ) : null}

                {/* Post-card non-intrusive risk factors */}
                <div className="space-y-3 rounded-md border border-border p-4">
                  <div className="text-[13px] font-semibold">
                    Дополнительно (по желанию): уточнить индивидуальные факторы для врача и Паспорта кожи
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 text-[12px]">
                    {[
                      ["sunburnsChildhood", "Солнечные ожоги с пузырями в детстве"],
                      ["tanningBed", "Посещение солярия"],
                      ["familyMelanomaHistory", "Меланома или рак кожи у близких родственников"],
                      ["neviOver50", "Более 50 родинок на теле"],
                      ["immunosuppressionOrDiabetes", "Приём иммуносупрессантов или сахарный диабет"],
                      ["smokingOrChronicTrauma", "Курение или постоянное натирание участка одеждой"],
                    ].map(([key, label]) => (
                      <label key={key} className="flex min-h-11 items-center gap-2 rounded border border-border px-3 py-2">
                        <input
                          type="checkbox"
                          checked={Boolean(riskFactors[key as keyof typeof riskFactors])}
                          onChange={(e) =>
                            setRiskFactors((prev) => ({ ...prev, [key]: e.target.checked }))
                          }
                          className="h-4 w-4"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      className="min-h-11 text-[12px]"
                      onClick={() => void handleSaveRiskFactors()}
                    >
                      Сохранить факторы для врача
                    </Button>
                    {riskSavedNote ? <span className="text-[12px] text-primary">{riskSavedNote}</span> : null}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border pt-3">
                  <span className="text-[12px] text-muted-foreground">
                    Управление персональными данными (152-ФЗ):
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    className="min-h-11 gap-1.5 text-[12px] text-destructive"
                    onClick={() => void handleDeleteMyData152Fz()}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Удалить мои снимки и данные
                  </Button>
                </div>
              </Card>
            ) : null}
          </TabsContent>

          {/* TAB 2: TELEGRAM FIRST-CHANNEL INTERACTIVE DIALOG & BRANCHING */}
          <TabsContent value="telegram" className="m-0">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Card className="flex h-[620px] flex-col overflow-hidden">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <div className="text-[14px] font-semibold">Telegram-бот «Дерматолог Про»</div>
                    <div className="text-[11px] text-muted-foreground">
                      Живой серверный диалог · Этап: {TG_STATE_LABEL_RU[tgState] || "Диалог"}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-11 text-[12px]"
                    onClick={() => void startTelegramDialog()}
                  >
                    Перезапустить /start
                  </Button>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto bg-surface-muted p-4">
                  {tgBubbles.map((b) => (
                    <div
                      key={b.id}
                      className={`max-w-[86%] rounded-lg px-3.5 py-2.5 text-[13px] whitespace-pre-line ${
                        b.side === "user"
                          ? "ml-auto bg-primary text-primary-foreground"
                          : "mr-auto border border-border bg-surface text-foreground"
                      }`}
                    >
                      {b.cropCard ? (
                        <img
                          src={b.cropCard.cropSvgDataUrl}
                          alt={b.cropCard.title}
                          className="mb-2 w-full max-w-[280px] rounded"
                        />
                      ) : null}
                      {b.text}
                    </div>
                  ))}
                </div>

                {tgButtons.length > 0 ? (
                  <div className="space-y-1.5 border-t border-border bg-surface p-3">
                    {tgButtons.map((row, rIdx) => (
                      <div key={rIdx} className="flex flex-wrap gap-1.5">
                        {row.map((btn) => (
                          <Button
                            key={btn.callbackData}
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={tgBusy}
                            className="min-h-11 flex-1 text-[12px]"
                            onClick={() =>
                              void sendTelegramAction({
                                userLabel: btn.text,
                                callbackData: btn.callbackData,
                              })
                            }
                          >
                            {btn.text}
                          </Button>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!tgInput.trim()) return;
                    const txt = tgInput.trim();
                    setTgInput("");
                    void sendTelegramAction({ userLabel: txt, text: txt });
                  }}
                  className="flex gap-2 border-t border-border bg-surface p-3"
                >
                  <Input
                    value={tgInput}
                    onChange={(e) => setTgInput(e.target.value)}
                    placeholder="Введите ответ (возраст, имя, телефон или /start)…"
                    aria-label="Сообщение в Telegram-бот"
                    className="min-h-11 text-[13px]"
                  />
                  <Button type="submit" disabled={tgBusy || !tgInput.trim()} className="min-h-11 text-[13px]">
                    Отправить
                  </Button>
                </form>
              </Card>

              <Card className="space-y-3 p-4 text-[12px]">
                <div className="text-[13px] font-semibold">Быстрая отправка снимка для проверки веток</div>
                <p className="text-muted-foreground">
                  На шаге ожидания снимка нажмите любую кнопку ниже, чтобы протестировать ветвление бота:
                </p>
                <div className="grid gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={tgBusy}
                    className="min-h-11 justify-start text-left text-[12px]"
                    onClick={() =>
                      void sendTelegramAction({
                        userLabel: "[Отправлено чёткое фото Display P3]",
                        simulatePhotoPreset: "clear_skin",
                      })
                    }
                  >
                    1. Чёткий снимок кожи (проходит PAD-DIQA)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={tgBusy}
                    className="min-h-11 justify-start text-left text-[12px]"
                    onClick={() =>
                      void sendTelegramAction({
                        userLabel: "[Отправлено смазанное фото]",
                        simulatePhotoPreset: "blur",
                      })
                    }
                  >
                    2. Смазанный кадр (отказ PAD-DIQA + совет)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={tgBusy}
                    className="min-h-11 justify-start text-left text-[12px]"
                    onClick={() =>
                      void sendTelegramAction({
                        userLabel: "[Фото другого человека · ΔITA° > 22°]",
                        simulatePhotoPreset: "mismatch_skin",
                      })
                    }
                  >
                    3. Несовпадение тона кожи (Profile Mismatch Guard)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={tgBusy}
                    className="min-h-11 justify-start text-left text-[12px]"
                    onClick={() =>
                      void sendTelegramAction({
                        userLabel: "/delete_my_data",
                        text: "/delete_my_data",
                      })
                    }
                  >
                    <AlertTriangle className="mr-1.5 h-3.5 w-3.5 text-destructive" aria-hidden />
                    4. Команда удаления данных (152-ФЗ)
                  </Button>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
