// Детерминированные мок-данные для UX-демо «Дерматолог Про».
// Все имена, телефоны, адреса и идентификаторы вымышлены.
// Реальные пациенты, фото и диагнозы НЕ ИСПОЛЬЗУЮТСЯ.
// Эти данные не отправляются ни в какие внешние системы.

import {
  AI_SUPPORT_DISCLAIMER,
  RESTRICTIVE_DATA_POLICY,
  type AnalysisCard,
  type Appointment,
  type Assessment,
  type AuditLog,
  type BotDialog,
  type BotMessage,
  type Clinic,
  type ClinicalImage,
  type Device,
  type Integration,
  type Lead,
  type Lesion,
  type Patient,
  type ProtectedAnalysisLink,
  type Report,
  type Visit,
} from "@/lib/domain";
import { DEMO_USERS } from "@/lib/users";

// ───────── Клиники ─────────

export const CLINICS: Clinic[] = [
  {
    id: "clinic-demo-001",
    name: "Дерма-Про · Центр",
    address: "Москва, ул. Тверская, 18",
    phone: "+7 (495) 555-01-10",
    partnerTier: "owned",
    routingPriority: 1,
  },
  {
    id: "clinic-demo-002",
    name: "Дерма-Про · Север",
    address: "Москва, Ленинградский пр-т, 74",
    phone: "+7 (495) 555-02-20",
    partnerTier: "owned",
    routingPriority: 2,
  },
  {
    id: "clinic-private-007",
    name: "Кабинет Морозова Д. И.",
    address: "Санкт-Петербург, Невский пр-т, 102",
    phone: "+7 (812) 555-07-07",
    partnerTier: "partner",
    routingPriority: 3,
  },
];

// ───────── Пациенты ─────────

const DOCTOR_ID = DEMO_USERS.doctor.id;
const ASSISTANT_ID = DEMO_USERS.assistant.id;
const PRIVATE_DOCTOR_ID = DEMO_USERS.private_doctor.id;
const OPERATOR_ID = DEMO_USERS.operator.id;
const SYS_ID = DEMO_USERS.system_admin.id;
const CLINIC_MAIN = CLINICS[0].id;
const CLINIC_NORTH = CLINICS[1].id;
const CLINIC_PRIVATE = CLINICS[2].id;

export const PROTECTED_RENDER_QA_IDS = {
  patientId: "11111111-1111-4111-8111-111111111111",
  visitId: "33333333-3333-4333-8333-333333333333",
  lesionId: "22222222-2222-4222-8222-222222222222",
  imageAId: "44444444-4444-4444-8444-444444444441",
  imageBId: "44444444-4444-4444-8444-444444444442",
} as const;

export const CALIBRATED_VIEWER_QA_IDS = {
  patientId: "55555555-5555-4555-8555-555555555551",
  visitId: "55555555-5555-4555-8555-555555555552",
  lesionId: "55555555-5555-4555-8555-555555555553",
  imageAId: "55555555-5555-4555-8555-555555555554",
  imageBId: "55555555-5555-4555-8555-555555555555",
} as const;

export const PATIENTS: Patient[] = [
  {
    id: "p-001",
    code: "DP-2026-0001",
    fullName: "Иванова Наталья Олеговна",
    birthDate: "1984-03-12",
    sex: "female",
    phototype: "II",
    riskFactors: ["семейный анамнез меланомы", "более 50 невусов"],
    consents: { pdn: true, imaging: true, telemed: true },
    createdBy: ASSISTANT_ID,
    createdAt: "2026-01-12T09:15:00Z",
  },
  {
    id: "p-002",
    code: "DP-2026-0002",
    fullName: "Кузнецов Павел Андреевич",
    birthDate: "1972-11-04",
    sex: "male",
    phototype: "III",
    riskFactors: ["длительная инсоляция"],
    consents: { pdn: true, imaging: true, telemed: false },
    createdBy: ASSISTANT_ID,
    createdAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "p-003",
    code: "DP-2026-0003",
    fullName: "Смирнова Ольга Викторовна",
    birthDate: "1990-07-22",
    sex: "female",
    phototype: "I",
    riskFactors: ["светлая кожа", "веснушки"],
    consents: { pdn: true, imaging: true, telemed: true },
    createdBy: DOCTOR_ID,
    createdAt: "2026-02-01T08:40:00Z",
  },
  {
    id: "p-004",
    code: "DP-2026-0004",
    fullName: "Новиков Артём Сергеевич",
    birthDate: "1965-05-30",
    sex: "male",
    phototype: "IV",
    riskFactors: ["возраст > 60", "ранее удалённое образование"],
    consents: { pdn: true, imaging: true, telemed: false },
    createdBy: ASSISTANT_ID,
    createdAt: "2026-02-05T11:20:00Z",
  },
  {
    id: "p-005",
    code: "DP-2026-0005",
    fullName: "Григорьева Анна Михайловна",
    birthDate: "1998-09-18",
    sex: "female",
    phototype: "II",
    riskFactors: ["множественные диспластические невусы"],
    consents: { pdn: true, imaging: true, telemed: true },
    createdBy: DOCTOR_ID,
    createdAt: "2026-02-10T14:05:00Z",
  },
  {
    id: "p-006",
    code: "DP-2026-0006",
    fullName: "Тимофеев Игорь Валерьевич",
    birthDate: "1979-12-01",
    sex: "male",
    phototype: "III",
    riskFactors: [],
    consents: { pdn: true, imaging: true, telemed: false },
    createdBy: PRIVATE_DOCTOR_ID,
    createdAt: "2026-02-14T09:30:00Z",
  },
  {
    id: "p-007",
    code: "DP-2026-0007",
    fullName: "Беляева Елена Сергеевна",
    birthDate: "1955-04-09",
    sex: "female",
    phototype: "II",
    riskFactors: ["возраст > 60", "актинический кератоз в анамнезе"],
    consents: { pdn: true, imaging: true, telemed: true },
    createdBy: ASSISTANT_ID,
    createdAt: "2026-02-18T12:00:00Z",
  },
  {
    id: "p-008",
    code: "DP-2026-0008",
    fullName: "Захаров Михаил Юрьевич",
    birthDate: "1988-08-25",
    sex: "male",
    phototype: "II",
    riskFactors: ["частые солнечные ожоги в детстве"],
    consents: { pdn: true, imaging: false, telemed: false },
    createdBy: PRIVATE_DOCTOR_ID,
    createdAt: "2026-02-22T16:45:00Z",
  },
  {
    id: PROTECTED_RENDER_QA_IDS.patientId,
    code: "DP-2026-0101",
    fullName: "Пациент контрольного доступа",
    birthDate: "1976-06-14",
    sex: "female",
    phototype: "III",
    riskFactors: ["учебный набор: проверка защищённого доступа"],
    consents: { pdn: true, imaging: true, telemed: false },
    createdBy: DOCTOR_ID,
    createdAt: "2026-03-15T08:00:00Z",
  },
  {
    id: CALIBRATED_VIEWER_QA_IDS.patientId,
    code: "DP-2026-0102",
    fullName: "Пациент проверки калибровки",
    birthDate: "1981-10-19",
    sex: "male",
    phototype: "III",
    riskFactors: ["учебный набор: проверка калибровки"],
    consents: { pdn: true, imaging: true, telemed: false },
    createdBy: DOCTOR_ID,
    createdAt: "2026-03-16T08:00:00Z",
  },
];

// ───────── Визиты ─────────

export const VISITS: Visit[] = [
  {
    id: "v-001",
    patientId: "p-001",
    doctorId: DOCTOR_ID,
    assistantId: ASSISTANT_ID,
    clinicId: CLINIC_MAIN,
    status: "closed",
    startedAt: "2026-03-02T08:30:00Z",
    closedAt: "2026-03-02T09:10:00Z",
    complaint: "Контроль множественных невусов на спине.",
  },
  {
    id: "v-002",
    patientId: "p-001",
    doctorId: DOCTOR_ID,
    assistantId: ASSISTANT_ID,
    clinicId: CLINIC_MAIN,
    status: "scheduled",
    startedAt: "2026-06-02T08:30:00Z",
    closedAt: null,
    complaint: "Плановый контроль через 3 месяца.",
  },
  {
    id: "v-003",
    patientId: "p-002",
    doctorId: DOCTOR_ID,
    assistantId: null,
    clinicId: CLINIC_MAIN,
    status: "closed",
    startedAt: "2026-03-04T10:00:00Z",
    closedAt: "2026-03-04T10:35:00Z",
    complaint: "Изменение цвета невуса на плече.",
  },
  {
    id: "v-004",
    patientId: "p-003",
    doctorId: DOCTOR_ID,
    assistantId: ASSISTANT_ID,
    clinicId: CLINIC_MAIN,
    status: "closed",
    startedAt: "2026-03-06T11:15:00Z",
    closedAt: "2026-03-06T11:50:00Z",
    complaint: "Новый элемент на щеке, обратилась через бот.",
  },
  {
    id: "v-005",
    patientId: "p-004",
    doctorId: DOCTOR_ID,
    assistantId: ASSISTANT_ID,
    clinicId: CLINIC_NORTH,
    status: "closed",
    startedAt: "2026-03-09T09:00:00Z",
    closedAt: "2026-03-09T09:40:00Z",
    complaint: "Плановый осмотр после удаления образования.",
  },
  {
    id: "v-011",
    patientId: "p-004",
    doctorId: DOCTOR_ID,
    assistantId: ASSISTANT_ID,
    clinicId: CLINIC_NORTH,
    status: "closed",
    startedAt: "2026-02-20T10:00:00Z",
    closedAt: "2026-02-20T10:28:00Z",
    complaint: "Предыдущая фотосъёмка очага для мониторинга.",
  },
  {
    id: "v-006",
    patientId: "p-005",
    doctorId: DOCTOR_ID,
    assistantId: ASSISTANT_ID,
    clinicId: CLINIC_MAIN,
    status: "in_progress",
    startedAt: "2026-03-11T13:20:00Z",
    closedAt: null,
    complaint: "Скрининг диспластических невусов.",
  },
  {
    id: PROTECTED_RENDER_QA_IDS.visitId,
    patientId: PROTECTED_RENDER_QA_IDS.patientId,
    doctorId: DOCTOR_ID,
    assistantId: ASSISTANT_ID,
    clinicId: CLINIC_NORTH,
    status: "closed",
    startedAt: "2026-03-15T08:10:00Z",
    closedAt: "2026-03-15T08:42:00Z",
    complaint: "QA-проверка защищённого backend proxy просмотра снимков.",
  },
  {
    id: CALIBRATED_VIEWER_QA_IDS.visitId,
    patientId: CALIBRATED_VIEWER_QA_IDS.patientId,
    doctorId: DOCTOR_ID,
    assistantId: ASSISTANT_ID,
    clinicId: CLINIC_NORTH,
    status: "closed",
    startedAt: "2026-03-16T08:10:00Z",
    closedAt: "2026-03-16T08:45:00Z",
    complaint: "QA-проверка calibrated production viewer workflow.",
  },
  {
    id: "v-007",
    patientId: "p-006",
    doctorId: PRIVATE_DOCTOR_ID,
    assistantId: null,
    clinicId: CLINIC_PRIVATE,
    status: "closed",
    startedAt: "2026-03-12T15:00:00Z",
    closedAt: "2026-03-12T15:30:00Z",
    complaint: "Зуд в области образования на предплечье.",
  },
  {
    id: "v-008",
    patientId: "p-007",
    doctorId: DOCTOR_ID,
    assistantId: ASSISTANT_ID,
    clinicId: CLINIC_NORTH,
    status: "closed",
    startedAt: "2026-03-13T08:45:00Z",
    closedAt: "2026-03-13T09:25:00Z",
    complaint: "Контроль очага актинического кератоза.",
  },
  {
    id: "v-009",
    patientId: "p-008",
    doctorId: PRIVATE_DOCTOR_ID,
    assistantId: null,
    clinicId: CLINIC_PRIVATE,
    status: "scheduled",
    startedAt: "2026-04-01T10:00:00Z",
    closedAt: null,
    complaint: "Первичный приём, направление от терапевта.",
  },
  {
    id: "v-010",
    patientId: "p-002",
    doctorId: DOCTOR_ID,
    assistantId: ASSISTANT_ID,
    clinicId: CLINIC_MAIN,
    status: "scheduled",
    startedAt: "2026-09-04T10:00:00Z",
    closedAt: null,
    complaint: "Контроль через 6 месяцев.",
  },
];

// ───────── Образования (lesions) ─────────

export const LESIONS: Lesion[] = [
  {
    id: "l-001",
    patientId: "p-001",
    bodyZone: "спина, верхняя треть",
    mapPoint: { view: "back", x: 0.42, y: 0.28 },
    label: "Невус N1",
    firstSeenAt: "2025-09-05",
    status: "monitoring",
  },
  {
    id: "l-002",
    patientId: "p-001",
    bodyZone: "спина, лопаточная область",
    mapPoint: { view: "back", x: 0.55, y: 0.32 },
    label: "Невус N2",
    firstSeenAt: "2025-09-05",
    status: "monitoring",
  },
  {
    id: "l-003",
    patientId: "p-001",
    bodyZone: "плечо левое",
    mapPoint: { view: "back", x: 0.30, y: 0.22 },
    label: "Невус N3",
    firstSeenAt: "2026-01-12",
    status: "active",
  },
  {
    id: "l-004",
    patientId: "p-002",
    bodyZone: "плечо правое",
    mapPoint: { view: "front", x: 0.68, y: 0.24 },
    label: "Очаг A",
    firstSeenAt: "2026-01-15",
    status: "active",
  },
  {
    id: "l-005",
    patientId: "p-003",
    bodyZone: "щека правая",
    mapPoint: { view: "front", x: 0.56, y: 0.10 },
    label: "Элемент F1",
    firstSeenAt: "2026-02-25",
    status: "active",
  },
  {
    id: "l-006",
    patientId: "p-003",
    bodyZone: "предплечье левое",
    mapPoint: { view: "front", x: 0.32, y: 0.45 },
    label: "Невус F2",
    firstSeenAt: "2026-02-25",
    status: "monitoring",
  },
  {
    id: "l-007",
    patientId: "p-004",
    bodyZone: "голень правая",
    mapPoint: { view: "front", x: 0.58, y: 0.82 },
    label: "Послеоперационная зона",
    firstSeenAt: "2025-11-10",
    status: "monitoring",
  },
  {
    id: "l-008",
    patientId: "p-004",
    bodyZone: "висок левый",
    mapPoint: { view: "left", x: 0.24, y: 0.14 },
    label: "Очаг B",
    firstSeenAt: "2026-02-05",
    status: "active",
  },
  {
    id: "l-009",
    patientId: "p-005",
    bodyZone: "грудь, центральная зона",
    mapPoint: { view: "front", x: 0.50, y: 0.30 },
    label: "Невус D1",
    firstSeenAt: "2026-02-10",
    status: "active",
  },
  {
    id: "l-010",
    patientId: "p-005",
    bodyZone: "живот, левый квадрант",
    mapPoint: { view: "front", x: 0.42, y: 0.50 },
    label: "Невус D2",
    firstSeenAt: "2026-02-10",
    status: "monitoring",
  },
  {
    id: "l-011",
    patientId: "p-006",
    bodyZone: "предплечье правое",
    mapPoint: { view: "front", x: 0.66, y: 0.46 },
    label: "Очаг T1",
    firstSeenAt: "2026-02-14",
    status: "active",
  },
  {
    id: "l-012",
    patientId: "p-007",
    bodyZone: "лоб",
    mapPoint: { view: "front", x: 0.50, y: 0.06 },
    label: "Актинический очаг",
    firstSeenAt: "2025-08-20",
    status: "monitoring",
  },
  {
    id: "l-013",
    patientId: "p-007",
    bodyZone: "тыл правой кисти",
    mapPoint: { view: "front", x: 0.74, y: 0.55 },
    label: "Очаг K2",
    firstSeenAt: "2026-02-18",
    status: "active",
  },
  {
    id: "l-014",
    patientId: "p-008",
    bodyZone: "спина, поясничная область",
    mapPoint: { view: "back", x: 0.50, y: 0.55 },
    label: "Невус Z1",
    firstSeenAt: "2026-02-22",
    status: "active",
  },
  {
    id: PROTECTED_RENDER_QA_IDS.lesionId,
    patientId: PROTECTED_RENDER_QA_IDS.patientId,
    bodyZone: "предплечье левое",
    mapPoint: { view: "front", x: 0.34, y: 0.46 },
    label: "Очаг защищённого доступа",
    firstSeenAt: "2026-03-15",
    status: "active",
  },
  {
    id: CALIBRATED_VIEWER_QA_IDS.lesionId,
    patientId: CALIBRATED_VIEWER_QA_IDS.patientId,
    bodyZone: "плечо правое",
    mapPoint: { view: "front", x: 0.62, y: 0.28 },
    label: "Очаг проверки калибровки",
    firstSeenAt: "2026-03-16",
    status: "active",
  },
];

// ───────── Изображения ─────────

const exif = (w: number, h: number): ClinicalImage["exifMeta"] => ({
  width: w,
  height: h,
  iso: 200,
  shutter: "1/125",
  aperture: "f/4",
  focalLength: "60mm",
});

export const IMAGES: ClinicalImage[] = [
  { id: "i-001", visitId: "v-001", lesionId: "l-001", kind: "overview",   source: "phone",         storagePath: "mock://images/v-001/i-001.jpg", capturedAt: "2026-03-02T08:32:00Z", deviceId: null,        quality: { score: 0.86, issues: [] },                       exifMeta: exif(4032, 3024) },
  { id: "i-002", visitId: "v-001", lesionId: "l-001", kind: "dermoscopy", source: "device_bridge", storagePath: "mock://images/v-001/i-002.jpg", capturedAt: "2026-03-02T08:34:00Z", deviceId: "d-001",     quality: { score: 0.92, issues: [] },                       exifMeta: exif(2048, 2048) },
  { id: "i-003", visitId: "v-001", lesionId: "l-002", kind: "dermoscopy", source: "device_bridge", storagePath: "mock://images/v-001/i-003.jpg", capturedAt: "2026-03-02T08:38:00Z", deviceId: "d-001",     quality: { score: 0.78, issues: ["лёгкие блики"] },         exifMeta: exif(2048, 2048) },
  { id: "i-004", visitId: "v-001", lesionId: "l-003", kind: "macro",      source: "camera",        storagePath: "mock://images/v-001/i-004.jpg", capturedAt: "2026-03-02T08:42:00Z", deviceId: null,        quality: { score: 0.71, issues: ["размытие"] },             exifMeta: exif(3000, 2000) },
  { id: "i-005", visitId: "v-003", lesionId: "l-004", kind: "overview",   source: "phone",         storagePath: "mock://images/v-003/i-005.jpg", capturedAt: "2026-03-04T10:05:00Z", deviceId: null,        quality: { score: 0.83, issues: [] },                       exifMeta: exif(4032, 3024) },
  { id: "i-006", visitId: "v-003", lesionId: "l-004", kind: "dermoscopy", source: "device_bridge", storagePath: "mock://images/v-003/i-006.jpg", capturedAt: "2026-03-04T10:08:00Z", deviceId: "d-002",     quality: { score: 0.88, issues: [] },                       exifMeta: exif(2048, 2048) },
  { id: "i-007", visitId: "v-004", lesionId: "l-005", kind: "overview",   source: "phone",         storagePath: "mock://images/v-004/i-007.jpg", capturedAt: "2026-03-06T11:18:00Z", deviceId: null,        quality: { score: 0.74, issues: ["неравномерное освещение"] }, exifMeta: exif(4032, 3024) },
  { id: "i-008", visitId: "v-004", lesionId: "l-005", kind: "dermoscopy", source: "device_bridge", storagePath: "mock://images/v-004/i-008.jpg", capturedAt: "2026-03-06T11:21:00Z", deviceId: "d-001",     quality: { score: 0.90, issues: [] },                       exifMeta: exif(2048, 2048) },
  { id: "i-009", visitId: "v-004", lesionId: "l-006", kind: "dermoscopy", source: "device_bridge", storagePath: "mock://images/v-004/i-009.jpg", capturedAt: "2026-03-06T11:25:00Z", deviceId: "d-001",     quality: { score: 0.81, issues: [] },                       exifMeta: exif(2048, 2048) },
  { id: "i-010", visitId: "v-005", lesionId: "l-007", kind: "overview",   source: "phone",         storagePath: "mock://images/v-005/i-010.jpg", capturedAt: "2026-03-09T09:05:00Z", deviceId: null,        quality: { score: 0.85, issues: [] },                       exifMeta: exif(4032, 3024) },
  { id: "i-011", visitId: "v-005", lesionId: "l-008", kind: "dermoscopy", source: "device_bridge", storagePath: "mock://images/v-005/i-011.jpg", capturedAt: "2026-03-09T09:10:00Z", deviceId: "d-003",     quality: { score: 0.79, issues: ["лёгкие блики"] },         exifMeta: exif(2048, 2048) },
  { id: "i-012", visitId: "v-005", lesionId: "l-008", kind: "macro",      source: "camera",        storagePath: "mock://images/v-005/i-012.jpg", capturedAt: "2026-03-09T09:12:00Z", deviceId: null,        quality: { score: 0.67, issues: ["размытие", "тени"] },     exifMeta: exif(3000, 2000) },
  { id: "i-021", visitId: "v-011", lesionId: "l-008", kind: "dermoscopy", source: "device_bridge", storagePath: "mock://images/v-011/i-021.jpg", capturedAt: "2026-02-20T10:10:00Z", deviceId: "d-003",     quality: { score: 0.86, issues: [] },                       exifMeta: exif(2048, 2048) },
  { id: "i-022", visitId: "v-011", lesionId: "l-008", kind: "macro",      source: "camera",        storagePath: "mock://images/v-011/i-022.jpg", capturedAt: "2026-02-20T10:12:00Z", deviceId: null,        quality: { score: 0.78, issues: [] },                       exifMeta: exif(3000, 2000) },
  { id: PROTECTED_RENDER_QA_IDS.imageAId, visitId: PROTECTED_RENDER_QA_IDS.visitId, lesionId: PROTECTED_RENDER_QA_IDS.lesionId, kind: "dermoscopy", source: "device_bridge", storagePath: "mock://images/protected-render-qa/a.jpg", capturedAt: "2026-03-15T08:18:00Z", deviceId: "d-003", quality: { score: 0.91, issues: [] }, exifMeta: exif(2048, 2048) },
  { id: PROTECTED_RENDER_QA_IDS.imageBId, visitId: PROTECTED_RENDER_QA_IDS.visitId, lesionId: PROTECTED_RENDER_QA_IDS.lesionId, kind: "dermoscopy", source: "device_bridge", storagePath: "mock://images/protected-render-qa/b.jpg", capturedAt: "2026-03-15T08:20:00Z", deviceId: "d-003", quality: { score: 0.89, issues: [] }, exifMeta: exif(2048, 2048) },
  { id: CALIBRATED_VIEWER_QA_IDS.imageAId, visitId: CALIBRATED_VIEWER_QA_IDS.visitId, lesionId: CALIBRATED_VIEWER_QA_IDS.lesionId, kind: "dermoscopy", source: "device_bridge", storagePath: "mock://images/calibrated-viewer-qa/a.jpg", capturedAt: "2026-03-16T08:18:00Z", deviceId: "d-003", quality: { score: 0.94, issues: [] }, exifMeta: exif(2048, 2048), viewerCalibration: { scaleMarkerDetected: true, millimetersAvailable: true } },
  { id: CALIBRATED_VIEWER_QA_IDS.imageBId, visitId: CALIBRATED_VIEWER_QA_IDS.visitId, lesionId: CALIBRATED_VIEWER_QA_IDS.lesionId, kind: "dermoscopy", source: "device_bridge", storagePath: "mock://images/calibrated-viewer-qa/b.jpg", capturedAt: "2026-03-16T08:20:00Z", deviceId: "d-003", quality: { score: 0.93, issues: [] }, exifMeta: exif(2048, 2048), viewerCalibration: { scaleMarkerDetected: true, millimetersAvailable: true } },
  { id: "i-013", visitId: "v-006", lesionId: "l-009", kind: "overview",   source: "phone",         storagePath: "mock://images/v-006/i-013.jpg", capturedAt: "2026-03-11T13:25:00Z", deviceId: null,        quality: { score: 0.88, issues: [] },                       exifMeta: exif(4032, 3024) },
  { id: "i-014", visitId: "v-006", lesionId: "l-009", kind: "dermoscopy", source: "device_bridge", storagePath: "mock://images/v-006/i-014.jpg", capturedAt: "2026-03-11T13:28:00Z", deviceId: "d-002",     quality: { score: 0.93, issues: [] },                       exifMeta: exif(2048, 2048) },
  { id: "i-015", visitId: "v-006", lesionId: "l-010", kind: "dermoscopy", source: "device_bridge", storagePath: "mock://images/v-006/i-015.jpg", capturedAt: "2026-03-11T13:32:00Z", deviceId: "d-002",     quality: { score: 0.84, issues: [] },                       exifMeta: exif(2048, 2048) },
  { id: "i-016", visitId: "v-007", lesionId: "l-011", kind: "overview",   source: "phone",         storagePath: "mock://images/v-007/i-016.jpg", capturedAt: "2026-03-12T15:05:00Z", deviceId: null,        quality: { score: 0.76, issues: [] },                       exifMeta: exif(4032, 3024) },
  { id: "i-017", visitId: "v-007", lesionId: "l-011", kind: "dermoscopy", source: "local_transfer", storagePath: "mock://images/v-007/i-017.jpg", capturedAt: "2026-03-12T15:08:00Z", deviceId: "d-004",     quality: { score: 0.82, issues: [] },                       exifMeta: exif(2048, 2048) },
  { id: "i-018", visitId: "v-008", lesionId: "l-012", kind: "overview",   source: "phone",         storagePath: "mock://images/v-008/i-018.jpg", capturedAt: "2026-03-13T08:50:00Z", deviceId: null,        quality: { score: 0.80, issues: [] },                       exifMeta: exif(4032, 3024) },
  { id: "i-019", visitId: "v-008", lesionId: "l-013", kind: "dermoscopy", source: "device_bridge", storagePath: "mock://images/v-008/i-019.jpg", capturedAt: "2026-03-13T08:55:00Z", deviceId: "d-003",     quality: { score: 0.87, issues: [] },                       exifMeta: exif(2048, 2048) },
  { id: "i-020", visitId: "v-001", lesionId: null,    kind: "body_map",   source: "file",          storagePath: "mock://images/v-001/i-020.jpg", capturedAt: "2026-03-02T08:31:00Z", deviceId: null,        quality: { score: 0.95, issues: [] },                       exifMeta: exif(1600, 2400) },
];

// ───────── Оценки (assessments) ─────────

const aiNeutral = (riskLevel: Assessment["aiSupport"]["riskLevel"], confidence: number, features: string[], notes: string[], xai: string) => ({
  riskLevel,
  confidence,
  suspectedFeatures: features,
  uncertaintyNotes: notes,
  xaiNotes: xai,
  disclaimer: AI_SUPPORT_DISCLAIMER,
});

export const ASSESSMENTS: Assessment[] = [
  {
    id: "a-001",
    visitId: "v-001",
    lesionId: "l-001",
    abcd: { asymmetry: 0.4, border: 1.0, color: 1.5, diameter: 1.0, total: 3.9 },
    sevenPoint: { major: 0, minor: 1, total: 1 },
    aiSupport: aiNeutral("low", 0.74, ["равномерная пигментация"], ["низкое разрешение по краям"], "Карта внимания не выявила атипичных зон."),
    doctorConclusion: "Доброкачественный невус. Рекомендован контроль через 6 месяцев.",
    followUpPlan: "Контрольная дерматоскопия через 6 месяцев.",
    decidedBy: DOCTOR_ID,
    decidedAt: "2026-03-02T09:05:00Z",
  },
  {
    id: "a-002",
    visitId: "v-001",
    lesionId: "l-002",
    abcd: { asymmetry: 0.8, border: 2.0, color: 2.0, diameter: 1.0, total: 5.8 },
    sevenPoint: { major: 1, minor: 1, total: 4 },
    aiSupport: aiNeutral("moderate", 0.62, ["неровная граница", "две зоны цвета"], ["возможны артефакты сжатия"], "Подсветка зон неровной границы."),
    doctorConclusion: "Необходимо динамическое наблюдение. Очное повторное фото через 3 месяца.",
    followUpPlan: "Фотомониторинг через 3 месяца, при изменении — очный осмотр.",
    decidedBy: DOCTOR_ID,
    decidedAt: "2026-03-02T09:08:00Z",
  },
  {
    id: "a-003",
    visitId: "v-003",
    lesionId: "l-004",
    abcd: { asymmetry: 1.2, border: 3.0, color: 3.0, diameter: 4.0, total: 9.2 },
    sevenPoint: { major: 2, minor: 2, total: 6 },
    aiSupport: aiNeutral("high", 0.81, ["асимметрия", "атипичная пигментная сеть"], ["требуется очный осмотр"], "Высокая активность XAI-карты в центре очага."),
    doctorConclusion: "Подозрение на атипичный невус. Рекомендована биопсия в профильном центре.",
    followUpPlan: "Направление к дерматоонкологу в течение 14 дней.",
    decidedBy: DOCTOR_ID,
    decidedAt: "2026-03-04T10:30:00Z",
  },
  {
    id: "a-004",
    visitId: "v-004",
    lesionId: "l-005",
    abcd: { asymmetry: 0.0, border: 0.5, color: 1.0, diameter: 1.0, total: 2.5 },
    sevenPoint: { major: 0, minor: 0, total: 0 },
    aiSupport: aiNeutral("low", 0.88, ["однородная структура"], [], "XAI-карта без значимых очагов внимания."),
    doctorConclusion: "Себорейный кератоз. Удаление по эстетическим показаниям не требуется.",
    followUpPlan: "Рутинный осмотр через 12 месяцев.",
    decidedBy: DOCTOR_ID,
    decidedAt: "2026-03-06T11:45:00Z",
  },
  {
    id: "a-005",
    visitId: "v-005",
    lesionId: "l-008",
    abcd: { asymmetry: 1.0, border: 2.5, color: 2.5, diameter: 3.0, total: 9.0 },
    sevenPoint: { major: 1, minor: 3, total: 5 },
    aiSupport: aiNeutral("high", 0.72, ["асимметрия", "регрессия"], ["качество фото снижено"], "Подсветка зоны регрессии."),
    doctorConclusion: "Подозрение на атипичные изменения. Назначена эксцизионная биопсия.",
    followUpPlan: "Эксцизионная биопсия в течение 10 дней.",
    decidedBy: DOCTOR_ID,
    decidedAt: "2026-03-09T09:35:00Z",
  },
  {
    id: "a-006",
    visitId: "v-006",
    lesionId: "l-009",
    abcd: { asymmetry: 0.4, border: 1.0, color: 1.5, diameter: 1.0, total: 3.9 },
    sevenPoint: { major: 0, minor: 1, total: 1 },
    aiSupport: aiNeutral("low", 0.79, ["равномерная пигментация"], [], "Без значимых XAI-сигналов."),
    doctorConclusion: "Доброкачественный невус. Контроль в плановом порядке.",
    followUpPlan: "Контроль через 12 месяцев.",
    decidedBy: DOCTOR_ID,
    decidedAt: "2026-03-11T13:55:00Z",
  },
  {
    id: "a-007",
    visitId: "v-007",
    lesionId: "l-011",
    abcd: { asymmetry: 0.8, border: 1.5, color: 2.0, diameter: 1.0, total: 5.3 },
    sevenPoint: { major: 1, minor: 1, total: 4 },
    aiSupport: aiNeutral("moderate", 0.65, ["лёгкая асимметрия", "две зоны цвета"], ["небольшое размытие"], "Слабая активность XAI на границе."),
    doctorConclusion: "Динамическое наблюдение. Контрольная дерматоскопия через 3 месяца.",
    followUpPlan: "Очный приём через 3 месяца.",
    decidedBy: PRIVATE_DOCTOR_ID,
    decidedAt: "2026-03-12T15:25:00Z",
  },
  {
    id: "a-008",
    visitId: "v-008",
    lesionId: "l-013",
    abcd: { asymmetry: 0.4, border: 1.0, color: 1.0, diameter: 1.0, total: 3.4 },
    sevenPoint: { major: 0, minor: 1, total: 1 },
    aiSupport: aiNeutral("moderate", 0.51, ["неоднородная текстура"], ["высокая неопределённость", "низкое качество фото", "блики"], "XAI-карта неоднозначна, требуется повтор фото."),
    doctorConclusion: "Требуется повторная дерматоскопия с улучшенным качеством фото.",
    followUpPlan: "Повторное фото в течение 2 недель.",
    decidedBy: DOCTOR_ID,
    decidedAt: "2026-03-13T09:20:00Z",
  },
];

// ───────── Отчёты ─────────

export const REPORTS: Report[] = [
  {
    id: "r-001",
    visitId: "v-001",
    patientSafeText: "По итогам осмотра выявленные элементы соответствуют доброкачественным изменениям. Рекомендован плановый контроль.",
    doctorVersionText: "Невусы N1, N2: ABCD 3.9 и 5.8. N2 — фотомониторинг 3 мес.",
    sharedLink: { token: "tok-r001-demo", expiresAt: "2026-04-02T09:10:00Z" },
    generatedAt: "2026-03-02T09:12:00Z",
  },
  {
    id: "r-002",
    visitId: "v-003",
    patientSafeText: "По данным осмотра требуется дополнительная очная консультация у профильного специалиста. Подробности обсудит лечащий врач.",
    doctorVersionText: "Очаг A: ABCD 9.2, 7-point 6. Подозрение на атипичный невус. Биопсия в течение 14 дней.",
    sharedLink: { token: "tok-r002-demo", expiresAt: "2026-04-04T10:35:00Z" },
    generatedAt: "2026-03-04T10:38:00Z",
  },
  {
    id: "r-003",
    visitId: "v-004",
    patientSafeText: "Выявленные элементы не требуют срочных действий. Рекомендован рутинный профилактический осмотр.",
    doctorVersionText: "Элемент F1 — себорейный кератоз. F2 — мониторинг 12 мес.",
    sharedLink: { token: "tok-r003-demo", expiresAt: "2026-04-06T11:50:00Z" },
    generatedAt: "2026-03-06T11:55:00Z",
  },
  {
    id: "r-004",
    visitId: "v-005",
    patientSafeText: "Рекомендована дополнительная процедура для уточнения. С деталями ознакомит лечащий врач.",
    doctorVersionText: "Очаг B (висок): ABCD 9.0, 7-point 5. Эксцизионная биопсия 10 дней.",
    sharedLink: { token: "tok-r004-demo", expiresAt: "2026-04-09T09:40:00Z" },
    generatedAt: "2026-03-09T09:42:00Z",
  },
  {
    id: "r-005",
    visitId: "v-008",
    patientSafeText: "По текущим снимкам требуется повторная съёмка с лучшим качеством. Это уточнит дальнейший план.",
    doctorVersionText: "Очаг K2: качество фото недостаточно, повтор через 2 недели.",
    sharedLink: { token: "tok-r005-demo", expiresAt: "2026-04-13T09:25:00Z" },
    generatedAt: "2026-03-13T09:28:00Z",
  },
];

// ───────── Бот: диалоги и сообщения ─────────

export const BOT_DIALOGS: BotDialog[] = [
  { id: "bd-001", channel: "telegram", externalUserRef: "tg:1001", state: "recommendation_sent", lastMessageAt: "2026-03-01T18:20:00Z", assignedOperatorId: null },
  { id: "bd-002", channel: "telegram", externalUserRef: "tg:1002", state: "with_operator",       lastMessageAt: "2026-03-03T09:45:00Z", assignedOperatorId: OPERATOR_ID },
  { id: "bd-003", channel: "telegram", externalUserRef: "tg:1003", state: "booked",              lastMessageAt: "2026-03-05T14:00:00Z", assignedOperatorId: OPERATOR_ID },
  { id: "bd-004", channel: "whatsapp", externalUserRef: "wa:2001", state: "awaiting_photo",      lastMessageAt: "2026-03-08T11:10:00Z", assignedOperatorId: null },
  { id: "bd-005", channel: "telegram", externalUserRef: "tg:1004", state: "awaiting_quality",    lastMessageAt: "2026-03-10T16:30:00Z", assignedOperatorId: null },
  { id: "bd-006", channel: "web",      externalUserRef: "web:3001", state: "closed",             lastMessageAt: "2026-02-28T20:00:00Z", assignedOperatorId: OPERATOR_ID },
];

export const BOT_MESSAGES: BotMessage[] = [
  { id: "bm-001", dialogId: "bd-001", direction: "in",  kind: "text",   payload: "Здравствуйте, можно проверить родинку?",                            createdAt: "2026-03-01T18:10:00Z" },
  { id: "bm-002", dialogId: "bd-001", direction: "out", kind: "text",   payload: "Здравствуйте! Пришлите, пожалуйста, фото общего вида и крупный план.", createdAt: "2026-03-01T18:11:00Z" },
  { id: "bm-003", dialogId: "bd-001", direction: "in",  kind: "photo",  payload: "mock://bot/bd-001/photo-1.jpg",                                      createdAt: "2026-03-01T18:14:00Z" },
  { id: "bm-004", dialogId: "bd-001", direction: "out", kind: "cta",    payload: "Рекомендована очная консультация. Записаться?",                     createdAt: "2026-03-01T18:18:00Z" },
  { id: "bm-005", dialogId: "bd-002", direction: "in",  kind: "text",   payload: "Беспокоит зуд в области родинки.",                                  createdAt: "2026-03-03T09:30:00Z" },
  { id: "bm-006", dialogId: "bd-002", direction: "out", kind: "system", payload: "Эскалация оператору поддержки.",                                   createdAt: "2026-03-03T09:35:00Z" },
  { id: "bm-007", dialogId: "bd-002", direction: "out", kind: "text",   payload: "С вами свяжется оператор клиники.",                                 createdAt: "2026-03-03T09:40:00Z" },
  { id: "bm-008", dialogId: "bd-003", direction: "in",  kind: "text",   payload: "Хочу записаться на приём.",                                          createdAt: "2026-03-05T13:50:00Z" },
  { id: "bm-009", dialogId: "bd-003", direction: "out", kind: "cta",    payload: "Открыть запись в Mini App.",                                         createdAt: "2026-03-05T13:52:00Z" },
  { id: "bm-010", dialogId: "bd-004", direction: "in",  kind: "text",   payload: "Появилось новое пятно на руке.",                                     createdAt: "2026-03-08T11:00:00Z" },
  { id: "bm-011", dialogId: "bd-004", direction: "out", kind: "text",   payload: "Пришлите фото с расстояния 15 см при дневном свете.",               createdAt: "2026-03-08T11:05:00Z" },
  { id: "bm-012", dialogId: "bd-005", direction: "in",  kind: "photo",  payload: "mock://bot/bd-005/photo-1.jpg",                                      createdAt: "2026-03-10T16:25:00Z" },
];

// ───────── Предварительный бот-анализ (AnalysisCard) ─────────

export const ANALYSIS_CARDS: AnalysisCard[] = [
  {
    id: "ac-001",
    dialogId: "bd-001",
    photoRef: "mock://bot/bd-001/photo-1.jpg",
    qualityGate: { passed: true, score: 0.82, issues: [] },
    aiSupport: {
      risk: "low",
      uncertainty: 0.22,
      features: ["равномерная пигментация", "чёткая граница"],
      modelVersion: "triage-v0.4.1",
    },
    safeSummary:
      "Признаков, требующих срочной реакции, не выявлено. Предварительная оценка не является диагнозом, рекомендована плановая очная оценка врача.",
    routingRisk: "low",
    recommendedClinicId: CLINIC_MAIN,
    ctaType: "book",
    createdAt: "2026-03-01T18:18:00Z",
  },
  {
    id: "ac-002",
    dialogId: "bd-002",
    patientRef: "p-002",
    photoRef: "mock://bot/bd-002/photo-1.jpg",
    qualityGate: { passed: true, score: 0.74, issues: ["лёгкие блики"] },
    aiSupport: {
      risk: "moderate",
      uncertainty: 0.41,
      features: ["неоднородная пигментация"],
      modelVersion: "triage-v0.4.1",
    },
    safeSummary:
      "Есть признаки, требующие внимания специалиста. Требуется очная оценка врача. Предварительная оценка не является диагнозом.",
    routingRisk: "moderate",
    recommendedClinicId: CLINIC_MAIN,
    ctaType: "book",
    createdAt: "2026-03-03T09:40:00Z",
  },
  {
    id: "ac-003",
    dialogId: "bd-003",
    patientRef: "p-003",
    photoRef: "mock://bot/bd-003/photo-1.jpg",
    qualityGate: { passed: true, score: 0.88, issues: [] },
    aiSupport: {
      risk: "high",
      uncertainty: 0.18,
      features: ["асимметрия", "несколько зон цвета"],
      modelVersion: "triage-v0.4.1",
    },
    safeSummary:
      "Выявлены признаки, требующие срочной очной оценки врача. Предварительная оценка не является диагнозом.",
    routingRisk: "urgent",
    recommendedClinicId: CLINIC_MAIN,
    ctaType: "urgent",
    createdAt: "2026-03-05T13:55:00Z",
  },
  {
    id: "ac-004",
    dialogId: "bd-004",
    photoRef: "mock://bot/bd-004/photo-1.jpg",
    qualityGate: { passed: false, score: 0.41, issues: ["размытие", "недостаточное освещение"] },
    aiSupport: {
      risk: "low",
      uncertainty: 0.92,
      features: [],
      modelVersion: "triage-v0.4.1",
    },
    safeSummary:
      "Снимок требует повторения: качество фото недостаточно для предварительной оценки.",
    routingRisk: "low",
    recommendedClinicId: CLINIC_NORTH,
    ctaType: "repeat_photo",
    createdAt: "2026-03-08T11:10:00Z",
  },
  {
    id: "ac-005",
    dialogId: "bd-005",
    photoRef: "mock://bot/bd-005/photo-1.jpg",
    qualityGate: { passed: true, score: 0.69, issues: ["лёгкое размытие"] },
    aiSupport: {
      risk: "moderate",
      uncertainty: 0.55,
      features: ["неоднородная текстура"],
      modelVersion: "triage-v0.4.1",
    },
    safeSummary:
      "Есть признаки, требующие внимания специалиста. Требуется очная оценка врача. Предварительная оценка не является диагнозом.",
    routingRisk: "moderate",
    recommendedClinicId: CLINIC_NORTH,
    ctaType: "book",
    createdAt: "2026-03-10T16:30:00Z",
  },
];

// ───────── Защищённые ссылки на AnalysisCard ─────────

export const PROTECTED_ANALYSIS_LINKS: ProtectedAnalysisLink[] = [
  {
    id: "pal-001",
    analysisCardId: "ac-001",
    token: "pal-tok-ac001-demo",
    expiresAt: "2026-04-01T18:18:00Z",
    accessLog: [
      { accessedAt: "2026-03-02T07:45:00Z", actorRef: OPERATOR_ID, ip: "10.0.0.11" },
    ],
  },
  {
    id: "pal-002",
    analysisCardId: "ac-002",
    token: "pal-tok-ac002-demo",
    expiresAt: "2026-06-03T09:40:00Z",
    accessLog: [
      { accessedAt: "2026-03-03T10:05:00Z", actorRef: OPERATOR_ID, ip: "10.0.0.12" },
      { accessedAt: "2026-03-03T11:20:00Z", actorRef: DOCTOR_ID, ip: "10.0.0.21" },
    ],
  },
  {
    id: "pal-003",
    analysisCardId: "ac-003",
    token: "pal-tok-ac003-demo",
    expiresAt: "2026-06-05T13:55:00Z",
    accessLog: [
      { accessedAt: "2026-03-05T14:00:00Z", actorRef: OPERATOR_ID, ip: "10.0.0.12" },
    ],
  },
  {
    id: "pal-004",
    analysisCardId: "ac-004",
    token: "pal-tok-ac004-demo",
    expiresAt: "2026-06-08T11:10:00Z",
    accessLog: [],
  },
  {
    id: "pal-005",
    analysisCardId: "ac-005",
    token: "pal-tok-ac005-demo",
    expiresAt: "2026-03-12T16:30:00Z",
    accessLog: [
      { accessedAt: "2026-03-11T08:10:00Z", actorRef: OPERATOR_ID, ip: "10.0.0.12" },
    ],
  },
];

// ───────── Лиды ─────────

export const LEADS: Lead[] = [
  { id: "ld-001", dialogId: "bd-001", patientId: null,    source: "telegram", utm: { source: "tg", medium: "bot", campaign: "skincheck_q1" }, status: "qualified", clinicId: CLINIC_MAIN,    createdAt: "2026-03-01T18:20:00Z", protectedAnalysisLinkId: "pal-001" },
  { id: "ld-002", dialogId: "bd-002", patientId: "p-002", source: "telegram", utm: { source: "tg", medium: "bot" },                            status: "new",       clinicId: CLINIC_MAIN,    createdAt: "2026-03-03T09:45:00Z", protectedAnalysisLinkId: "pal-002" },
  { id: "ld-003", dialogId: "bd-003", patientId: "p-003", source: "telegram", utm: { source: "tg", medium: "miniapp" },                        status: "booked",    clinicId: CLINIC_MAIN,    createdAt: "2026-03-05T14:05:00Z", protectedAnalysisLinkId: "pal-003" },
  { id: "ld-004", dialogId: "bd-004", patientId: null,    source: "whatsapp", utm: { source: "wa" },                                           status: "new",       clinicId: CLINIC_NORTH,   createdAt: "2026-03-08T11:10:00Z", protectedAnalysisLinkId: "pal-004" },
  { id: "ld-005", dialogId: "bd-006", patientId: null,    source: "site",     utm: { source: "site", medium: "form" },                         status: "lost",      clinicId: CLINIC_NORTH,   createdAt: "2026-02-28T20:05:00Z" },
  { id: "ld-006", dialogId: null,     patientId: "p-006", source: "operator", utm: {},                                                         status: "qualified", clinicId: CLINIC_PRIVATE, createdAt: "2026-03-11T10:00:00Z" },
];

// ───────── Записи на приём ─────────

export const APPOINTMENTS: Appointment[] = [
  { id: "ap-001", leadId: "ld-003", patientId: "p-003", clinicId: CLINIC_MAIN,    doctorId: DOCTOR_ID,         slotAt: "2026-03-06T11:15:00Z", status: "completed", channel: "bot" },
  { id: "ap-002", leadId: null,     patientId: "p-001", clinicId: CLINIC_MAIN,    doctorId: DOCTOR_ID,         slotAt: "2026-06-02T08:30:00Z", status: "planned",   channel: "portal" },
  { id: "ap-003", leadId: "ld-002", patientId: "p-002", clinicId: CLINIC_MAIN,    doctorId: DOCTOR_ID,         slotAt: "2026-09-04T10:00:00Z", status: "planned",   channel: "operator" },
  { id: "ap-004", leadId: null,     patientId: "p-008", clinicId: CLINIC_PRIVATE, doctorId: PRIVATE_DOCTOR_ID, slotAt: "2026-04-01T10:00:00Z", status: "confirmed", channel: "phone" },
  { id: "ap-005", leadId: "ld-006", patientId: "p-006", clinicId: CLINIC_PRIVATE, doctorId: PRIVATE_DOCTOR_ID, slotAt: "2026-03-12T15:00:00Z", status: "completed", channel: "operator" },
];

// ───────── Устройства ─────────

export const DEVICES: Device[] = [
  { id: "d-001", model: "DermLite DL5",           serial: "DL5-AX-1042", firmware: "2.4.1", magnification: "x10", polarization: "polarized",     calibrationProfile: "DL5-std-A", lastSeenAt: "2026-03-13T09:00:00Z", bridgeId: "br-msk-01" },
  { id: "d-002", model: "Heine Delta 30",         serial: "HD30-99182",  firmware: "1.7.0", magnification: "x10", polarization: "both",           calibrationProfile: "HD-clin-2", lastSeenAt: "2026-03-12T18:20:00Z", bridgeId: "br-msk-01" },
  { id: "d-003", model: "FotoFinder Handyscope",  serial: "FF-HS-77321", firmware: "3.2.5", magnification: "x20", polarization: "polarized",     calibrationProfile: "FF-screen", lastSeenAt: "2026-03-13T08:55:00Z", bridgeId: "br-msk-02" },
  { id: "d-004", model: "DermLite DL3N",          serial: "DL3-NB-5510", firmware: "1.9.3", magnification: "x10", polarization: "non_polarized", calibrationProfile: "DL3-base",  lastSeenAt: "2026-03-12T15:10:00Z", bridgeId: "br-spb-01" },
];

// ───────── Интеграции ─────────

export const INTEGRATIONS: Integration[] = [
  {
    id: "int-001",
    kind: "crm",
    provider: "Bitrix24",
    status: "connected",
    fieldMap: { fullName: "TITLE", phone: "PHONE", source: "SOURCE_ID", utmSource: "UTM_SOURCE" },
    dataPolicy: { ...RESTRICTIVE_DATA_POLICY },
    lastSyncAt: "2026-03-13T07:30:00Z",
  },
  {
    id: "int-002",
    kind: "crm",
    provider: "amoCRM",
    status: "draft",
    fieldMap: { fullName: "name", phone: "custom_phone", source: "pipeline" },
    dataPolicy: { ...RESTRICTIVE_DATA_POLICY },
    lastSyncAt: null,
  },
  {
    id: "int-003",
    kind: "erp",
    provider: "1С: Медицина",
    status: "connected",
    fieldMap: { service: "Услуга", price: "Цена", clinic: "Подразделение" },
    dataPolicy: { ...RESTRICTIVE_DATA_POLICY },
    lastSyncAt: "2026-03-12T22:00:00Z",
  },
  {
    id: "int-004",
    kind: "mis",
    provider: "Demo MIS",
    status: "disabled",
    fieldMap: { patientCode: "MRN", visitId: "EncounterID" },
    dataPolicy: { ...RESTRICTIVE_DATA_POLICY },
    lastSyncAt: null,
  },
  {
    id: "int-005",
    kind: "messenger",
    provider: "Telegram Bot API",
    status: "connected",
    fieldMap: { externalUserRef: "telegram_user_id", channel: "chat_type" },
    dataPolicy: { ...RESTRICTIVE_DATA_POLICY },
    lastSyncAt: "2026-03-13T09:50:00Z",
  },
];

// ───────── Аудит ─────────

export const AUDIT_LOGS: AuditLog[] = [
  { id: "al-001", actorId: DOCTOR_ID,         action: "visit.open",         entity: "visit",       entityId: "v-001", payload: { clinicId: CLINIC_MAIN }, createdAt: "2026-03-02T08:30:00Z" },
  { id: "al-002", actorId: ASSISTANT_ID,      action: "image.capture",      entity: "image",       entityId: "i-002", payload: { kind: "dermoscopy", deviceId: "d-001" }, createdAt: "2026-03-02T08:34:00Z" },
  { id: "al-003", actorId: DOCTOR_ID,         action: "assessment.submit",  entity: "assessment",  entityId: "a-001", payload: { lesionId: "l-001" }, createdAt: "2026-03-02T09:05:00Z" },
  { id: "al-004", actorId: DOCTOR_ID,         action: "report.generate",    entity: "report",      entityId: "r-001", payload: { visitId: "v-001" }, createdAt: "2026-03-02T09:12:00Z" },
  { id: "al-005", actorId: DOCTOR_ID,         action: "report.share",       entity: "report",      entityId: "r-002", payload: { tokenIssued: true, expiresInDays: 31 }, createdAt: "2026-03-04T10:39:00Z" },
  { id: "al-006", actorId: OPERATOR_ID,       action: "dialog.escalate",    entity: "bot_dialog",  entityId: "bd-002", payload: { to: "doctor", reason: "симптомы" }, createdAt: "2026-03-03T09:35:00Z" },
  { id: "al-007", actorId: OPERATOR_ID,       action: "lead.create",        entity: "lead",        entityId: "ld-003", payload: { source: "telegram", clinicId: CLINIC_MAIN }, createdAt: "2026-03-05T14:05:00Z" },
  { id: "al-008", actorId: DOCTOR_ID,         action: "appointment.book",   entity: "appointment", entityId: "ap-001", payload: { channel: "bot" }, createdAt: "2026-03-05T14:10:00Z" },
  { id: "al-009", actorId: SYS_ID,            action: "device.register",    entity: "device",      entityId: "d-003", payload: { model: "FotoFinder Handyscope" }, createdAt: "2026-02-20T12:00:00Z" },
  { id: "al-010", actorId: SYS_ID,            action: "integration.update", entity: "integration", entityId: "int-001", payload: { status: "connected" }, createdAt: "2026-03-01T07:00:00Z" },
  { id: "al-011", actorId: PRIVATE_DOCTOR_ID, action: "visit.close",        entity: "visit",       entityId: "v-007", payload: { durationMin: 30 }, createdAt: "2026-03-12T15:30:00Z" },
  { id: "al-012", actorId: DOCTOR_ID,         action: "lesion.update",      entity: "lesion",      entityId: "l-008", payload: { status: "active" }, createdAt: "2026-03-09T09:36:00Z" },
];

// ───────── Хелперы (детерминированные, чистые) ─────────

export const getClinics = (): Clinic[] => CLINICS;
export const getClinicById = (id: string): Clinic | undefined => CLINICS.find((c) => c.id === id);

export const getPatients = (): Patient[] => PATIENTS;
export const getPatientById = (id: string): Patient | undefined => PATIENTS.find((p) => p.id === id);

export const getVisits = (): Visit[] => VISITS;
export const getVisitById = (id: string): Visit | undefined => VISITS.find((v) => v.id === id);
export const getVisitsByPatientId = (patientId: string): Visit[] =>
  VISITS.filter((v) => v.patientId === patientId);

export const getLesions = (): Lesion[] => LESIONS;
export const getLesionById = (id: string): Lesion | undefined => LESIONS.find((l) => l.id === id);
export const getLesionsByPatientId = (patientId: string): Lesion[] =>
  LESIONS.filter((l) => l.patientId === patientId);

export const getImages = (): ClinicalImage[] => IMAGES;
export const getImagesByVisitId = (visitId: string): ClinicalImage[] =>
  IMAGES.filter((i) => i.visitId === visitId);
export const getImagesByLesionId = (lesionId: string): ClinicalImage[] =>
  IMAGES.filter((i) => i.lesionId === lesionId);

export const getAssessments = (): Assessment[] => ASSESSMENTS;
export const getAssessmentsByVisitId = (visitId: string): Assessment[] =>
  ASSESSMENTS.filter((a) => a.visitId === visitId);
export const getAssessmentsByLesionId = (lesionId: string): Assessment[] =>
  ASSESSMENTS.filter((a) => a.lesionId === lesionId);

export const getReports = (): Report[] => REPORTS;
export const getReportByVisitId = (visitId: string): Report | undefined =>
  REPORTS.find((r) => r.visitId === visitId);
export const getReportsByPatientId = (patientId: string): Report[] => {
  const visitIds = new Set(VISITS.filter((v) => v.patientId === patientId).map((v) => v.id));
  return REPORTS.filter((r) => visitIds.has(r.visitId));
};

export const getDialogs = (): BotDialog[] => BOT_DIALOGS;
export const getDialogById = (id: string): BotDialog | undefined => BOT_DIALOGS.find((d) => d.id === id);
export const getMessagesByDialogId = (dialogId: string): BotMessage[] =>
  BOT_MESSAGES.filter((m) => m.dialogId === dialogId);

export const getLeads = (): Lead[] => LEADS;
export const getAppointments = (): Appointment[] => APPOINTMENTS;
export const getDevices = (): Device[] => DEVICES;
export const getIntegrations = (): Integration[] => INTEGRATIONS;
export const getAuditLogs = (): AuditLog[] => AUDIT_LOGS;

export const getAnalysisCards = (): AnalysisCard[] => ANALYSIS_CARDS;
export const getAnalysisCardById = (id: string): AnalysisCard | undefined =>
  ANALYSIS_CARDS.find((a) => a.id === id);
export const getAnalysisCardsByDialogId = (dialogId: string): AnalysisCard[] =>
  ANALYSIS_CARDS.filter((a) => a.dialogId === dialogId);

export const getProtectedAnalysisLinkById = (id: string): ProtectedAnalysisLink | undefined =>
  PROTECTED_ANALYSIS_LINKS.find((p) => p.id === id);
export const getProtectedAnalysisLinkByToken = (token: string): ProtectedAnalysisLink | undefined =>
  PROTECTED_ANALYSIS_LINKS.find((p) => p.token === token);

export const getAnalysisCardForLead = (leadId: string): AnalysisCard | undefined => {
  const lead = LEADS.find((l) => l.id === leadId);
  if (!lead?.protectedAnalysisLinkId) return undefined;
  const link = getProtectedAnalysisLinkById(lead.protectedAnalysisLinkId);
  if (!link) return undefined;
  return getAnalysisCardById(link.analysisCardId);
};

// ───────── Внутренние проверки целостности ─────────

/**
 * Проверяет внутреннюю целостность мок-датасета. Бросает Error при несоответствии.
 * Используется в тестах. В рантайме UI вызывать не обязательно.
 */
export function assertMockDataIntegrity(): void {
  const clinicIds = new Set(CLINICS.map((c) => c.id));
  const patientIds = new Set(PATIENTS.map((p) => p.id));
  const visitIds = new Set(VISITS.map((v) => v.id));
  const lesionIds = new Set(LESIONS.map((l) => l.id));
  const dialogIds = new Set(BOT_DIALOGS.map((d) => d.id));

  for (const v of VISITS) {
    if (!patientIds.has(v.patientId)) throw new Error(`visit ${v.id} -> unknown patient ${v.patientId}`);
    if (!clinicIds.has(v.clinicId)) throw new Error(`visit ${v.id} -> unknown clinic ${v.clinicId}`);
  }
  for (const l of LESIONS) {
    if (!patientIds.has(l.patientId)) throw new Error(`lesion ${l.id} -> unknown patient ${l.patientId}`);
  }
  for (const i of IMAGES) {
    if (!visitIds.has(i.visitId)) throw new Error(`image ${i.id} -> unknown visit ${i.visitId}`);
    if (i.lesionId !== null && !lesionIds.has(i.lesionId)) {
      throw new Error(`image ${i.id} -> unknown lesion ${i.lesionId}`);
    }
  }
  for (const a of ASSESSMENTS) {
    if (!visitIds.has(a.visitId)) throw new Error(`assessment ${a.id} -> unknown visit ${a.visitId}`);
    if (!lesionIds.has(a.lesionId)) throw new Error(`assessment ${a.id} -> unknown lesion ${a.lesionId}`);
  }
  for (const r of REPORTS) {
    if (!visitIds.has(r.visitId)) throw new Error(`report ${r.id} -> unknown visit ${r.visitId}`);
  }
  for (const m of BOT_MESSAGES) {
    if (!dialogIds.has(m.dialogId)) throw new Error(`bot message ${m.id} -> unknown dialog ${m.dialogId}`);
  }
  const analysisCardIds = new Set(ANALYSIS_CARDS.map((a) => a.id));
  for (const ac of ANALYSIS_CARDS) {
    if (!dialogIds.has(ac.dialogId)) throw new Error(`analysis card ${ac.id} -> unknown dialog ${ac.dialogId}`);
    if (ac.patientRef && !patientIds.has(ac.patientRef)) {
      throw new Error(`analysis card ${ac.id} -> unknown patient ${ac.patientRef}`);
    }
    if (!clinicIds.has(ac.recommendedClinicId)) {
      throw new Error(`analysis card ${ac.id} -> unknown clinic ${ac.recommendedClinicId}`);
    }
  }
  const protectedLinkIds = new Set(PROTECTED_ANALYSIS_LINKS.map((p) => p.id));
  for (const link of PROTECTED_ANALYSIS_LINKS) {
    if (!analysisCardIds.has(link.analysisCardId)) {
      throw new Error(`protected analysis link ${link.id} -> unknown analysis card ${link.analysisCardId}`);
    }
  }
  for (const ld of LEADS) {
    if (ld.protectedAnalysisLinkId && !protectedLinkIds.has(ld.protectedAnalysisLinkId)) {
      throw new Error(`lead ${ld.id} -> unknown protected analysis link ${ld.protectedAnalysisLinkId}`);
    }
  }
  for (const ap of APPOINTMENTS) {
    if (!clinicIds.has(ap.clinicId)) throw new Error(`appointment ${ap.id} -> unknown clinic ${ap.clinicId}`);
    if (!patientIds.has(ap.patientId)) throw new Error(`appointment ${ap.id} -> unknown patient ${ap.patientId}`);
  }
  for (const integ of INTEGRATIONS) {
    const p = integ.dataPolicy;
    if (p.sendPhotos || p.sendDiagnosis || p.sendAIDetails || p.sendPHI) {
      throw new Error(`integration ${integ.id} dataPolicy must block photos, diagnosis, AI details and PHI`);
    }
  }
}
