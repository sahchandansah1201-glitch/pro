// Stage 7 · Self-hosted API client for progressive 2-step onboarding,
// Telegram first-channel dialog FSM, doctor pre-visit case, Skin Passport,
// clinic patient portal access provisioning, and 152-FZ personal data deletion.

import type { SelfHostedApiError, SelfHostedApiResult } from "@/lib/self-hosted-patient-api";
import { buildSelfHostedApiUrl } from "@/lib/self-hosted-patient-api";

export type SubjectRelation = "SELF" | "CHILD_UNDER_18" | "ADULT_RELATIVE";
export type BiologicalSex = "male" | "female";
export type TrafficLightLevel = "RED_HIGH" | "YELLOW_MEDIUM" | "GREEN_LOW";
export type EvolutionChoice = "stable_long" | "new_lt_3m" | "growing_changing" | "unsure";
export type SymptomsChoice = "none" | "itch_or_pain" | "bleeding_or_crust";
export type TopicalChoice =
  | "none"
  | "steroid_ointment"
  | "antiseptic_dye_celelandine"
  | "moisturizer";

export interface OmnichannelConfigDTO {
  configKey: string;
  channels: {
    telegram: { enabled: boolean; transport: string; botHandle: string };
    web: { enabled: boolean; transport: string; route: string };
    max: { enabled: boolean; transport: string; botHandle: string };
    whatsapp: { enabled: boolean; transport: string; instanceName: string };
  };
  flowRules: {
    photoFirstMode: boolean;
    postPhotoLeadCaptureEnabled: boolean;
    photoWaitNudgeMinutes: number;
    lowRiskFollowupDays: number;
    mediumRiskSecondPhotoCheckEnabled: boolean;
    persistentMenuEnabled: boolean;
  };
  greetingVariants: string[];
  updatedAt?: string | null;
}

export interface OnboardingProfileDTO {
  id: string;
  subjectRelation: SubjectRelation;
  label: string;
  contactName?: string | null;
  contactPhone?: string | null;
  legalGuardianConfirmed: boolean;
  consent152FzAcceptedAt: string;
  ageYears: number | null;
  ageMonths: number | null;
  pediatricU6Active: boolean;
  biologicalSex: BiologicalSex | null;
  estimatedFitzpatrickBand: string | null;
  baselineItaDegrees: number | null;
  riskFactors: Record<string, unknown>;
}

export interface OnboardingClinicChoiceDTO {
  id: string;
  slug: string;
  name: string;
}

export interface OnboardingSessionBundleDTO {
  sessionToken: string;
  quotaEnforced: false;
  profiles: OnboardingProfileDTO[];
  clinics: OnboardingClinicChoiceDTO[];
}

export interface PadDiqaQualityGateDTO {
  passed: boolean;
  score0To100: number;
  rejectCode: string | null;
  reasonRu: string;
  recoveryTipsRu: string[];
}

export interface AnalysisStagesVisualsDTO {
  step1DetectionSvgDataUrl: string;
  step2AttentionSvgDataUrl: string;
}

export interface PhotoSubmitResultDTO {
  submissionId: string;
  profileId: string;
  status: string;
  quotaEnforced: false;
  leadAlreadyCaptured?: boolean;
  savedContact?: {
    contactName: string | null;
    contactPhone: string | null;
  };
  qualityGate: PadDiqaQualityGateDTO;
  instructionVisualSvgDataUrl?: string;
  analysisStagesVisuals?: AnalysisStagesVisualsDTO;
  phototypeEstimate: {
    itaDegrees: number;
    fitzpatrickBand: string;
    profileMismatchTriggered: boolean;
    deltaItaFromProfile: number | null;
  };
  mismatchPrompt: {
    questionRu: string;
    options: Array<{ code: "same_person_lighting" | "switched_profile"; labelRu: string }>;
  } | null;
}

export interface LesionCropCardItemDTO {
  lesionIndex: number;
  title: string;
  cropSvgDataUrl: string;
  surroundingSkinMarginPercent: number;
  qualityScore0To100: number;
  safeSummary: string;
}

export interface PatientFacingResultCardDTO {
  queued: boolean;
  statusMessageRu?: string;
  trafficLight?: TrafficLightLevel;
  routingCategory?: string;
  bookingPriority?: "PRIORITY_URGENT" | "PLANNED_STANDARD";
  badgeLabelRu?: string;
  emergency103Banner?: boolean;
  safeSummaryRu?: string;
  lesionCrops?: LesionCropCardItemDTO[];
  analysisStagesVisuals?: AnalysisStagesVisualsDTO;
  fullFrameHiddenForPrivacy?: boolean;
  scheduledFollowupAt?: string | null;
  followupDays?: number | null;
  followupTimerMessageRu?: string | null;
  secondPhotoVerificationPromptRu?: string | null;
  contactAlreadySaved?: boolean;
  savedContactName?: string | null;
  savedContactPhone?: string | null;
  primaryCtaLabelRu: string;
  secondaryNewAnalysisLabelRu?: string;
  deleteDataLabelRu?: string;
}

export interface SurveyCardResponseDTO {
  submissionId: string;
  status: "ready" | "queued_gpu";
  quotaEnforced: false;
  card: PatientFacingResultCardDTO;
}

export interface TelegramBotInlineButtonDTO {
  text: string;
  callbackData: string;
}

export interface TelegramSimulateStepResponseDTO {
  fsmState: string;
  quotaEnforced: false;
  persistentMenu?: string[][];
  reply: {
    text: string;
    buttons: TelegramBotInlineButtonDTO[][];
    visualBannerUrl?: string | null;
    visualBannerAlt?: string | null;
    cropCard?: LesionCropCardItemDTO | null;
  };
}

export interface DoctorPrevisitLesionDTO {
  id: string;
  lesionIndex: number;
  bodyRegionCode: string | null;
  cropSvgDataUrl: string | null;
  qualityGate: { passed?: boolean; score_0_100?: number };
  anamnesisAnswers: {
    evolution?: string;
    symptoms?: string;
    prior_topical_14d?: string;
  };
  doctorOnlyStatusLocalisDraft: string;
  patientFacingSafeSummary: string;
}

export interface DoctorPrevisitCaseDTO {
  id: string;
  handoffCaseCode: string;
  clinicId: string;
  patientId: string;
  bookingRequestId: string | null;
  visitId: string | null;
  channel: string;
  bookingPriority: "PRIORITY_URGENT" | "PLANNED_STANDARD";
  subjectRelation: SubjectRelation;
  legalGuardianConfirmed: boolean;
  consent152FzAcceptedAt: string;
  subjectProfile: {
    age_years?: number | null;
    age_months?: number | null;
    biological_sex?: string | null;
    estimated_phototype_ita?: {
      fitzpatrick_band?: string | null;
      ita_degrees?: number | null;
    };
    risk_factors?: Record<string, unknown>;
  };
  skinPassportActive: boolean;
  visitConfirmedAt: string | null;
  createdAt: string;
  lesions: DoctorPrevisitLesionDTO[];
}

export interface PatientPortalAccessStatusDTO {
  patientId: string;
  clinicId: string;
  patientCode: string;
  patientFullName: string;
  linkedAccounts: Array<{
    userId: string;
    email: string;
    displayName: string;
    disabledAt: string | null;
    skinPassportActive: boolean;
    skinPassportActivatedAt: string | null;
    linkedAt: string | null;
  }>;
}

export interface ProvisionedPatientPortalAccessDTO {
  patientId: string;
  clinicId: string;
  patientCode: string;
  userId: string;
  email: string;
  displayName: string;
  role: "patient";
  skinPassportActive: boolean;
  skinPassportActivatedAt: string | null;
  temporaryPassword: string;
  loginPath: string;
  portalPath: string;
}

const DEFAULT_API_BASE = String(import.meta.env.VITE_SELF_HOSTED_API_BASE_URL ?? "").trim();

function ok<T>(value: T): SelfHostedApiResult<T> {
  return { ok: true, value, error: null };
}

function fail<T>(error: SelfHostedApiError): SelfHostedApiResult<T> {
  return { ok: false, value: null, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function toApiError(response: Response, body: unknown): SelfHostedApiError {
  const errObj = isRecord(body) && isRecord(body.error) ? body.error : null;
  return {
    kind: response.status === 422 ? "validation" : "http",
    status: response.status,
    code: String(errObj?.code ?? `http_${response.status}`),
    message: String(errObj?.message ?? `Ошибка запроса (${response.status}).`),
  };
}

function resolvePublicBaseUrl(apiBaseUrl?: string | null): string {
  const trimmed = String(apiBaseUrl ?? "").trim();
  if (trimmed) return trimmed;
  if (DEFAULT_API_BASE) return DEFAULT_API_BASE;
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://localhost:8080";
}

/** Reads original raw file bytes without client-side canvas recompression or EXIF stripping! */
export function readOriginalFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Не удалось прочитать выбранный файл."));
    reader.readAsDataURL(file);
  });
}

async function publicRequest<T>(
  path: string,
  init: {
    apiBaseUrl?: string | null;
    sessionToken?: string | null;
    method?: "GET" | "POST" | "DELETE";
    body?: unknown;
  } = {},
): Promise<SelfHostedApiResult<T>> {
  const method = init.method ?? "POST";
  const url = buildSelfHostedApiUrl(resolvePublicBaseUrl(init.apiBaseUrl), path);
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
  }
  if (init.sessionToken) {
    headers["X-Onboarding-Token"] = init.sessionToken;
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      ...(method === "GET" ? {} : { body: JSON.stringify(init.body ?? {}) }),
    });
  } catch {
    return fail({
      kind: "network",
      code: "network_error",
      message: "Не удалось связаться с сервером проверки снимков. Проверьте соединение.",
    });
  }
  const body = await parseJsonSafe(response);
  if (!response.ok) return fail(toApiError(response, body));
  return ok(body as T);
}

async function authedRequest<T>(
  path: string,
  args: {
    apiBaseUrl: string | null | undefined;
    apiToken: string | null | undefined;
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
  },
): Promise<SelfHostedApiResult<T>> {
  if (!args.apiToken) {
    return fail({
      kind: "not_configured",
      code: "not_configured",
      message: "Требуется рабочий вход в систему клиники.",
    });
  }
  const method = args.method ?? "GET";
  const url = buildSelfHostedApiUrl(resolvePublicBaseUrl(args.apiBaseUrl), path);
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${args.apiToken}`,
  };
  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
  }
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      ...(method === "GET" ? {} : { body: JSON.stringify(args.body ?? {}) }),
    });
  } catch {
    return fail({
      kind: "network",
      code: "network_error",
      message: "Сбой сети при обращении к серверу клиники.",
    });
  }
  const body = await parseJsonSafe(response);
  if (!response.ok) return fail(toApiError(response, body));
  return ok(body as T);
}

export function fetchPublicFlowConfig(args: { apiBaseUrl?: string | null } = {}) {
  return publicRequest<{
    item: OmnichannelConfigDTO;
    instructionVisualSvgDataUrl: string;
  }>("/api/v1/public/onboarding/flow-config", {
    apiBaseUrl: args.apiBaseUrl,
    method: "GET",
  });
}

export async function fetchAdminChannelConfigurator(args: {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}): Promise<SelfHostedApiResult<{ item: OmnichannelConfigDTO; instructionVisualSvgDataUrl: string }>> {
  return authedRequest<{ item: OmnichannelConfigDTO; instructionVisualSvgDataUrl: string }>(
    "/api/v1/admin/channel-configurator",
    { ...args, method: "GET" },
  );
}

export async function updateAdminChannelConfigurator(args: {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
  payload: Partial<OmnichannelConfigDTO>;
}): Promise<SelfHostedApiResult<{ item: OmnichannelConfigDTO }>> {
  return authedRequest<{ item: OmnichannelConfigDTO }>(
    "/api/v1/admin/channel-configurator",
    { ...args, method: "PUT", body: args.payload },
  );
}

export function initPublicOnboardingSession(args: {
  apiBaseUrl?: string | null;
  sessionToken?: string | null;
  channel?: "web" | "telegram";
}) {
  return publicRequest<OnboardingSessionBundleDTO>("/api/v1/public/onboarding/session", {
    apiBaseUrl: args.apiBaseUrl,
    sessionToken: args.sessionToken,
    body: { channel: args.channel ?? "web", sessionToken: args.sessionToken },
  });
}

export function createPublicOnboardingProfile(args: {
  apiBaseUrl?: string | null;
  sessionToken: string;
  payload: {
    subjectRelation: SubjectRelation;
    label?: string;
    legalGuardianConfirmed: boolean;
    consent152FzAccepted: boolean;
    isInfantUnder1Year?: boolean;
    ageYears?: number;
    ageMonths?: number;
    biologicalSex: BiologicalSex;
  };
}) {
  return publicRequest<{ profile: OnboardingProfileDTO; quotaEnforced: false }>(
    "/api/v1/public/onboarding/profiles",
    {
      apiBaseUrl: args.apiBaseUrl,
      sessionToken: args.sessionToken,
      body: args.payload,
    },
  );
}

export function submitPublicOnboardingPhoto(args: {
  apiBaseUrl?: string | null;
  sessionToken: string;
  profileId?: string | null;
  consent152FzAccepted?: boolean;
  imageBase64: string;
  clientHints?: Record<string, unknown>;
}) {
  return publicRequest<PhotoSubmitResultDTO>("/api/v1/public/onboarding/photos", {
    apiBaseUrl: args.apiBaseUrl,
    sessionToken: args.sessionToken,
    body: {
      ...(args.profileId ? { profileId: args.profileId } : {}),
      consent152FzAccepted: args.consent152FzAccepted ?? true,
      imageBase64: args.imageBase64,
      clientHints: args.clientHints ?? {},
    },
  });
}

export function resolvePublicProfileMismatch(args: {
  apiBaseUrl?: string | null;
  sessionToken: string;
  submissionId: string;
  resolution: "same_person_lighting" | "switched_profile";
}) {
  return publicRequest<{ submission: { id: string; profileId: string; status: string } }>(
    `/api/v1/public/onboarding/submissions/${encodeURIComponent(args.submissionId)}/mismatch`,
    {
      apiBaseUrl: args.apiBaseUrl,
      sessionToken: args.sessionToken,
      body: { resolution: args.resolution },
    },
  );
}

export function submitPublicMicroSurvey(args: {
  apiBaseUrl?: string | null;
  sessionToken: string;
  submissionId: string;
  payload: {
    contactName?: string;
    contactPhone?: string;
    requireLeadContact?: boolean;
    subjectRelation?: SubjectRelation;
    legalGuardianConfirmed?: boolean;
    isInfantUnder1Year?: boolean;
    ageYears?: number;
    ageMonths?: number;
    biologicalSex?: BiologicalSex;
    verificationOfSubmissionId?: string | null;
    evolution: EvolutionChoice;
    symptoms: SymptomsChoice;
    priorTopical14d: TopicalChoice;
    pediatricSystemicRedFlags?: boolean;
    lesionCount?: number;
    simulateGpuTimeout?: boolean;
  };
}) {
  return publicRequest<SurveyCardResponseDTO>(
    `/api/v1/public/onboarding/submissions/${encodeURIComponent(args.submissionId)}/survey`,
    {
      apiBaseUrl: args.apiBaseUrl,
      sessionToken: args.sessionToken,
      body: args.payload,
    },
  );
}

export function savePublicRiskFactors(args: {
  apiBaseUrl?: string | null;
  sessionToken: string;
  profileId: string;
  riskFactors: Record<string, unknown>;
}) {
  return publicRequest<{ profile: OnboardingProfileDTO }>(
    `/api/v1/public/onboarding/profiles/${encodeURIComponent(args.profileId)}/risk-factors`,
    {
      apiBaseUrl: args.apiBaseUrl,
      sessionToken: args.sessionToken,
      body: { riskFactors: args.riskFactors },
    },
  );
}

export function bookClinicFromPublicSubmission(args: {
  apiBaseUrl?: string | null;
  sessionToken: string;
  submissionId: string;
  payload: {
    displayName?: string;
    phone?: string;
    preferredTimeNote: string;
    clinicId?: string;
    bodyRegionCode?: string;
  };
}) {
  return publicRequest<{
    booked: boolean;
    handoffCaseCode: string;
    clinicName: string;
    bookingPriority: string;
    bookingPriorityLabelRu: string;
    messageRu: string;
  }>(
    `/api/v1/public/onboarding/submissions/${encodeURIComponent(args.submissionId)}/book`,
    {
      apiBaseUrl: args.apiBaseUrl,
      sessionToken: args.sessionToken,
      body: args.payload,
    },
  );
}

export function deletePublicOnboardingMyData(args: {
  apiBaseUrl?: string | null;
  sessionToken: string;
}) {
  return publicRequest<{
    deleted: boolean;
    deletedProfilesCount: number;
    deletedSubmissionsCount: number;
    preservedClinicHandoffCount: number;
    messageRu: string;
  }>("/api/v1/public/onboarding/my-data", {
    apiBaseUrl: args.apiBaseUrl,
    sessionToken: args.sessionToken,
    method: "DELETE",
    body: { sessionToken: args.sessionToken },
  });
}

export function stepTelegramBotDialogSimulator(args: {
  apiBaseUrl?: string | null;
  chatId: string;
  text?: string | null;
  callbackData?: string | null;
  simulatePhotoPreset?: "clear_skin" | "blur" | "glare" | "dark" | "mismatch_skin" | null;
  imageBase64?: string | null;
  clientHints?: Record<string, unknown>;
}) {
  return publicRequest<TelegramSimulateStepResponseDTO>("/api/v1/public/telegram/simulate", {
    apiBaseUrl: args.apiBaseUrl,
    body: {
      chatId: args.chatId,
      text: args.text ?? null,
      callbackData: args.callbackData ?? null,
      simulatePhotoPreset: args.simulatePhotoPreset ?? null,
      imageBase64: args.imageBase64 ?? null,
      clientHints: args.clientHints ?? {},
    },
  });
}

export async function fetchDoctorPrevisitCaseByVisit(args: {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
  visitId: string;
}): Promise<SelfHostedApiResult<DoctorPrevisitCaseDTO | null>> {
  const res = await authedRequest<{ item?: DoctorPrevisitCaseDTO | null }>(
    `/api/v1/visits/${encodeURIComponent(args.visitId)}/previsit-case`,
    args,
  );
  if (!res.ok) return fail(res.error);
  return ok(res.value?.item ?? null);
}

export async function confirmDoctorVisitAndActivatePassport(args: {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
  visitId: string;
}) {
  const res = await authedRequest<{
    item: {
      confirmed: boolean;
      skinPassportActive: boolean;
      handoffCaseCode: string | null;
      visitCompletedAt: string | null;
    };
  }>(`/api/v1/visits/${encodeURIComponent(args.visitId)}/confirm-previsit-passport`, {
    ...args,
    method: "POST",
    body: {},
  });
  if (!res.ok) return fail(res.error);
  return ok(res.value.item);
}

export async function fetchPatientPortalAccessStatus(args: {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
  patientId: string;
}): Promise<SelfHostedApiResult<PatientPortalAccessStatusDTO>> {
  const res = await authedRequest<{ item: PatientPortalAccessStatusDTO }>(
    `/api/v1/patients/${encodeURIComponent(args.patientId)}/portal-access`,
    args,
  );
  if (!res.ok) return fail(res.error);
  return ok(res.value.item);
}

export async function provisionPatientPortalAccess(args: {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
  patientId: string;
  email?: string;
  activateSkinPassport?: boolean;
}): Promise<SelfHostedApiResult<ProvisionedPatientPortalAccessDTO>> {
  const res = await authedRequest<{ item: ProvisionedPatientPortalAccessDTO }>(
    `/api/v1/patients/${encodeURIComponent(args.patientId)}/portal-access`,
    {
      ...args,
      method: "POST",
      body: {
        ...(args.email ? { email: args.email } : {}),
        activateSkinPassport: args.activateSkinPassport ?? true,
      },
    },
  );
  if (!res.ok) return fail(res.error);
  return ok(res.value.item);
}

export function deletePortalPersonalUploads152Fz(args: {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}) {
  return authedRequest<{
    deleted: boolean;
    purgedPersonalSubmissionsCount: number;
    medicalRecordProtectedBy323Fz: boolean;
    messageRu: string;
  }>("/api/v1/me/personal-uploads", {
    ...args,
    method: "DELETE",
    body: {},
  });
}
