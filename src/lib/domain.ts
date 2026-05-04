// Типы доменной модели «Дерматолог Про». Только TypeScript-описания.
// Никаких реальных данных, бекенда и API. Используется моками и будущими экранами.

import type { Role } from "@/lib/roles";

// ───────── Базовые перечисления ─────────

export type Sex = "male" | "female";
export type Phototype = "I" | "II" | "III" | "IV" | "V" | "VI";

export type VisitStatus =
  | "scheduled"
  | "in_progress"
  | "closed"
  | "cancelled";

export type LesionStatus = "active" | "monitoring" | "removed" | "archived";

export type ImageKind = "overview" | "dermoscopy" | "macro" | "body_map";
export type ImageSource =
  | "phone"
  | "file"
  | "camera"
  | "device_bridge"
  | "local_transfer";

export type RiskLevel = "low" | "moderate" | "high" | "urgent";

export type BotChannel = "telegram" | "whatsapp" | "web";
export type BotDirection = "in" | "out";
export type BotMessageKind = "text" | "photo" | "system" | "cta";

export type LeadStatus =
  | "new"
  | "qualified"
  | "booked"
  | "lost"
  | "duplicate";

export type AppointmentStatus =
  | "planned"
  | "confirmed"
  | "completed"
  | "no_show"
  | "cancelled";

export type AppointmentChannel = "bot" | "portal" | "phone" | "operator";

export type IntegrationKind = "crm" | "erp" | "mis" | "telephony" | "messenger";
export type IntegrationStatus = "connected" | "draft" | "error" | "disabled";

export type PartnerTier = "owned" | "partner" | "external";

// ───────── Сущности ─────────

export interface Clinic {
  id: string;
  name: string;
  address: string;
  phone: string;
  partnerTier: PartnerTier;
  /** Чем меньше число, тем выше приоритет в маршрутизации лидов. */
  routingPriority: number;
}

export interface Consents {
  /** Согласие на обработку персональных данных. */
  pdn: boolean;
  /** Согласие на медицинскую съёмку и хранение фото. */
  imaging: boolean;
  /** Согласие на телемедицинскую консультацию. */
  telemed: boolean;
}

export interface Patient {
  id: string;
  /** Внутренний код пациента в клинике, отображается в UI. */
  code: string;
  fullName: string;
  /** ISO-дата YYYY-MM-DD. */
  birthDate: string;
  sex: Sex;
  phototype: Phototype;
  riskFactors: string[];
  consents: Consents;
  /** Идентификатор пользователя, который создал карточку. */
  createdBy: string;
  createdAt: string;
}

export interface Visit {
  id: string;
  patientId: string;
  doctorId: string;
  assistantId: string | null;
  clinicId: string;
  status: VisitStatus;
  startedAt: string;
  closedAt: string | null;
  complaint: string;
}

export interface BodyMapPoint {
  /** Проекция тела для отрисовки на body map. */
  view: "front" | "back" | "left" | "right" | "scalp";
  /** Координаты в относительных единицах 0..1. */
  x: number;
  y: number;
}

export interface Lesion {
  id: string;
  patientId: string;
  bodyZone: string;
  mapPoint: BodyMapPoint;
  label: string;
  firstSeenAt: string;
  status: LesionStatus;
}

export interface ImageQuality {
  /** Оценка 0..1. */
  score: number;
  issues: string[];
}

export interface ExifMeta {
  width: number;
  height: number;
  iso?: number;
  shutter?: string;
  aperture?: string;
  focalLength?: string;
}

export interface ClinicalImage {
  id: string;
  visitId: string;
  lesionId: string | null;
  kind: ImageKind;
  source: ImageSource;
  storagePath: string;
  capturedAt: string;
  deviceId: string | null;
  quality: ImageQuality;
  exifMeta: ExifMeta;
}

export interface AbcdScore {
  asymmetry: number;
  border: number;
  color: number;
  diameter: number;
  /** Суммарный TDS (Total Dermoscopy Score). */
  total: number;
}

export interface SevenPointScore {
  /** Major: атипичная пигментная сеть, бело-голубая вуаль, атипичная сосудистая структура. */
  major: number;
  /** Minor: нерегулярные стрии, точки, пятна, регрессия. */
  minor: number;
  total: number;
}

export interface AiSupport {
  /** AI-поддержка решения. Не диагноз. */
  riskLevel: RiskLevel;
  /** Уверенность модели 0..1. */
  confidence: number;
  /** Подозреваемые признаки в нейтральных терминах. */
  suspectedFeatures: string[];
  /** Маркеры неопределённости. */
  uncertaintyNotes: string[];
  /** Заметки XAI-плейсхолдера. */
  xaiNotes: string;
  disclaimer: string;
}

export interface Assessment {
  id: string;
  visitId: string;
  lesionId: string;
  abcd: AbcdScore;
  sevenPoint: SevenPointScore;
  aiSupport: AiSupport;
  doctorConclusion: string;
  followUpPlan: string;
  /** Идентификатор врача, принявшего решение. */
  decidedBy: string;
  decidedAt: string;
}

export interface SharedLink {
  token: string;
  /** ISO-таймстамп окончания действия ссылки. */
  expiresAt: string;
}

export interface Report {
  id: string;
  visitId: string;
  /** Текст отчёта для пациента — безопасный, без диагноза. */
  patientSafeText: string;
  /** Расширенная версия для врача. */
  doctorVersionText: string;
  sharedLink: SharedLink;
  generatedAt: string;
}

export type BotDialogState =
  | "new"
  | "awaiting_photo"
  | "awaiting_quality"
  | "recommendation_sent"
  | "with_operator"
  | "booked"
  | "closed";

export interface BotDialog {
  id: string;
  channel: BotChannel;
  /** Внешний идентификатор пользователя в мессенджере. */
  externalUserRef: string;
  state: BotDialogState;
  lastMessageAt: string;
  assignedOperatorId: string | null;
}

export interface BotMessage {
  id: string;
  dialogId: string;
  direction: BotDirection;
  kind: BotMessageKind;
  /** Полезная нагрузка: текст, путь к фото, идентификатор CTA. */
  payload: string;
  createdAt: string;
}

export interface Utm {
  source?: string;
  medium?: string;
  campaign?: string;
}

export interface Lead {
  id: string;
  dialogId: string | null;
  patientId: string | null;
  source: BotChannel | "site" | "operator";
  utm: Utm;
  status: LeadStatus;
  clinicId: string;
  createdAt: string;
  /**
   * Опциональная ссылка на защищённую ссылку предварительного бот-анализа (AnalysisCard).
   * НЕ ссылается на Report.sharedLink: AnalysisCard и Report — раздельные сущности.
   */
  protectedAnalysisLinkId?: string;
}

// ───────── Предварительный бот-анализ (до визита) ─────────

/**
 * AnalysisCard — предварительная оценка на этапе бот-воронки/претриажа.
 * НЕ является врачебным заключением и НЕ заменяет Report.
 */
export interface AnalysisCard {
  id: string;
  dialogId: string;
  /** Опциональная связь с пациентом, если уже идентифицирован. */
  patientRef?: string;
  /** Ссылка на изображение в моковом хранилище. */
  photoRef: string;
  qualityGate: {
    passed: boolean;
    score: number;
    issues: string[];
  };
  aiSupport: {
    risk: RiskLevel;
    /** Уровень неопределённости 0..1. */
    uncertainty: number;
    features: string[];
    modelVersion: string;
  };
  /** Безопасный для пациента краткий текст. Без диагноза. */
  safeSummary: string;
  routingRisk: RiskLevel;
  recommendedClinicId: string;
  ctaType: "book" | "urgent" | "repeat_photo";
  createdAt: string;
}

/**
 * ProtectedAnalysisLink — защищённая ссылка на AnalysisCard.
 * Используется для передачи во внешние системы (CRM/ERP/MIS) минимального
 * безопасного контекста. Сами фото и AI-детали по ссылке не передаются.
 */
export interface ProtectedAnalysisLink {
  id: string;
  analysisCardId: string;
  token: string;
  expiresAt: string;
  accessLog: {
    accessedAt: string;
    actorRef?: string;
    ip?: string;
  }[];
}

export interface Appointment {
  id: string;
  leadId: string | null;
  patientId: string;
  clinicId: string;
  doctorId: string;
  slotAt: string;
  status: AppointmentStatus;
  channel: AppointmentChannel;
}

export interface Device {
  id: string;
  model: string;
  serial: string;
  firmware: string;
  /** Кратность увеличения, например "x10", "x20". */
  magnification: string;
  polarization: "polarized" | "non_polarized" | "both";
  calibrationProfile: string;
  lastSeenAt: string;
  /** Идентификатор Device Bridge, через который подключено устройство. */
  bridgeId: string | null;
}

/** Политика передачи данных во внешние системы. По умолчанию — максимально ограничительная. */
export interface IntegrationDataPolicy {
  sendPhotos: boolean;
  sendDiagnosis: boolean;
  sendAIDetails: boolean;
  sendPHI: boolean;
  sendSafeSummary: boolean;
  sendProtectedLink: boolean;
}

export interface Integration {
  id: string;
  kind: IntegrationKind;
  provider: string;
  status: IntegrationStatus;
  /** Маппинг полей source → target. */
  fieldMap: Record<string, string>;
  dataPolicy: IntegrationDataPolicy;
  lastSyncAt: string | null;
}

export interface AuditLog {
  id: string;
  actorId: string;
  /** Машиночитаемое действие, например "visit.close" или "report.share". */
  action: string;
  /** Тип сущности. */
  entity: string;
  entityId: string;
  /** Безопасный summary, без PHI и фото. */
  payload: Record<string, string | number | boolean | null>;
  createdAt: string;
}

// ───────── Защитные константы ─────────

export const RESTRICTIVE_DATA_POLICY: IntegrationDataPolicy = {
  sendPhotos: false,
  sendDiagnosis: false,
  sendAIDetails: false,
  sendPHI: false,
  sendSafeSummary: true,
  sendProtectedLink: true,
};

/** Стандартный дисклеймер для AI-поддержки. */
export const AI_SUPPORT_DISCLAIMER =
  "AI-поддержка принятия решений. Окончательное заключение делает врач.";

// Удобный реэкспорт, чтобы UI мог импортировать одно из мест.
export type { Role };
