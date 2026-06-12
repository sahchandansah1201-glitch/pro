// Mock-данные для клинического рабочего места врача.
// UX-only, без бэкенда. Никаких реальных данных пациентов.

export type SourceTag = "manual" | "MIS" | "bot" | "patient" | "device";

export type IntakeFieldKey =
  | "complaints"
  | "anamnesisMorbi"
  | "anamnesisVitae"
  | "localStatus"
  | "familyMelanoma"
  | "skinOncoHistory"
  | "sunburns"
  | "region"
  | "sunExposure";

export interface IntakeField {
  key: IntakeFieldKey;
  label: string;
  filled: boolean;
}

export type MonitoringPlanState =
  | "insufficient"
  | "dermoscopy_only"
  | "ready_for_review"
  | "followup_set";

export type PhotoQuality =
  | "good"
  | "warning"
  | "retake"
  | "incomparable"
  | "unassigned";

export type PhotoSource = "phone" | "file" | "device" | "qr" | "bot";

export interface CockpitPhoto {
  id: string;
  thumbHue: number; // нейтральный цветной плейсхолдер, без людей
  source: PhotoSource;
  capturedAt: string; // HH:MM
  quality: PhotoQuality;
  reason?: string;
  lesionLabel?: string;
  bodyLocation?: string;
}

export type ReportState =
  | "not_started"
  | "draft"
  | "blocked_intake"
  | "blocked_quality"
  | "ready_for_review"
  | "confirmed";

export interface CockpitVisit {
  id: string;
  patientId: string;
  patientName: string;
  sexAge: string;
  cardNo: string;
  dob: string;
  scheduledAt: string; // HH:MM
  date: string; // DD.MM.YYYY
  reason: string;
  intakeStatus: "empty" | "partial" | "complete";
  photoStatus: "none" | "partial" | "complete" | "issues";
  reportStatus: ReportState;
  sources: SourceTag[];
  intake: IntakeField[];
  monitoring: MonitoringPlanState;
  photos: CockpitPhoto[];
  state: "scheduled" | "in_progress" | "done";
}

export interface RailPatient {
  visitId: string;
  patientName: string;
  time: string;
  reason: string;
  state: "scheduled" | "in_progress" | "done" | "recent";
}

export const todayRail: RailPatient[] = [
  { visitId: "v-1", patientName: "Пациент А.", time: "09:30", reason: "Контроль невуса спины", state: "in_progress" },
  { visitId: "v-2", patientName: "Пациент Б.", time: "10:15", reason: "Первичный осмотр", state: "scheduled" },
  { visitId: "v-3", patientName: "Пациент В.", time: "11:00", reason: "Дерматоскопия плеча", state: "scheduled" },
  { visitId: "v-4", patientName: "Пациент Г.", time: "12:30", reason: "Повторный осмотр", state: "scheduled" },
];

export const recentRail: RailPatient[] = [
  { visitId: "r-1", patientName: "Пациент Д.", time: "Вчера", reason: "Заключение готово", state: "done" },
  { visitId: "r-2", patientName: "Пациент Е.", time: "Вчера", reason: "Повторный осмотр через 3 мес.", state: "done" },
  { visitId: "r-3", patientName: "Пациент Ж.", time: "2 дня", reason: "Дерматоскопия", state: "recent" },
];

export const activeVisit: CockpitVisit = {
  id: "v-1",
  patientId: "p-1",
  patientName: "Пациент А.",
  sexAge: "Ж · 47 лет",
  cardNo: "№ 10243",
  dob: "12.03.1978",
  scheduledAt: "09:30",
  date: "29.05.2026",
  reason: "Контроль невуса спины",
  intakeStatus: "partial",
  photoStatus: "issues",
  reportStatus: "blocked_intake",
  sources: ["MIS", "bot"],
  intake: [
    { key: "complaints", label: "Жалобы", filled: true },
    { key: "anamnesisMorbi", label: "История жалобы", filled: true },
    { key: "anamnesisVitae", label: "Общий анамнез", filled: false },
    { key: "localStatus", label: "Локальный статус", filled: false },
    { key: "familyMelanoma", label: "Семейная история меланомы", filled: false },
    { key: "skinOncoHistory", label: "Онкологический анамнез кожи", filled: true },
    { key: "sunburns", label: "Солнечные ожоги", filled: false },
    { key: "region", label: "Регион / место проживания", filled: true },
    { key: "sunExposure", label: "Пребывание на солнце", filled: false },
  ],
  monitoring: "dermoscopy_only",
  photos: [
    { id: "ph-1", thumbHue: 18, source: "device", capturedAt: "09:34", quality: "good", lesionLabel: "Очаг 1", bodyLocation: "Спина, левая лопатка" },
    { id: "ph-2", thumbHue: 32, source: "device", capturedAt: "09:35", quality: "good", lesionLabel: "Очаг 1", bodyLocation: "Спина, левая лопатка" },
    { id: "ph-3", thumbHue: 200, source: "phone", capturedAt: "09:38", quality: "retake", reason: "Размыто, плохое освещение", lesionLabel: "Очаг 2", bodyLocation: "Плечо" },
    { id: "ph-4", thumbHue: 45, source: "device", capturedAt: "09:40", quality: "incomparable", reason: "Другое устройство или условия съёмки", lesionLabel: "Очаг 2", bodyLocation: "Плечо" },
    { id: "ph-5", thumbHue: 120, source: "phone", capturedAt: "09:42", quality: "unassigned", reason: "Локализация не указана" },
  ],
  state: "in_progress",
};

export const QUALITY_LABEL: Record<PhotoQuality, string> = {
  good: "Хорошо",
  warning: "Можно с предупреждением",
  retake: "Нужно переснять",
  incomparable: "Не сопоставимо",
  unassigned: "Не привязано",
};

export const SOURCE_LABEL: Record<PhotoSource, string> = {
  phone: "Телефон",
  file: "Файл",
  device: "Дерматоскоп",
  qr: "Локально",
  bot: "Бот",
};

export const SOURCE_TAG_LABEL: Record<SourceTag, string> = {
  manual: "Ручной ввод",
  MIS: "Система клиники",
  bot: "Бот",
  patient: "Пациент",
  device: "Устройство",
};

export const MONITORING_LABEL: Record<MonitoringPlanState, string> = {
  insufficient: "Недостаточно данных",
  dermoscopy_only: "Только техническая проверка снимков",
  ready_for_review: "Готово к врачебной проверке",
  followup_set: "Повторный осмотр назначен",
};

export const REPORT_LABEL: Record<ReportState, string> = {
  not_started: "Не начат",
  draft: "Черновик",
  blocked_intake: "Заблокирован: анамнез",
  blocked_quality: "Заблокирован: качество фото",
  ready_for_review: "Готов к врачебной проверке",
  confirmed: "Подтверждён врачом",
};
