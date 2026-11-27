// Stage 7 · Progressive 2-step onboarding, Split-Vault photo intake,
// clinic pre-visit handoff, Skin Passport activation, and patient portal provisioning.

import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { hashPassword } from "./auth-crypto.mjs";
import {
  AuthRequiredError,
  ForbiddenError,
  patientPortalScope,
  requireAnyRole,
  visitWriteScope,
} from "./rbac.mjs";
import {
  assertPatientFacingCopySafe,
  buildPrivateLesionCropSvgDataUrl,
  inspectAndSanitizeSplitVault,
  stripForbiddenPublicFields,
} from "./split-vault-inspector.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHANNELS = new Set(["telegram", "whatsapp", "max", "web"]);
const SUBJECT_RELATIONS = new Set(["SELF", "CHILD_UNDER_18", "ADULT_RELATIVE"]);
const BIOLOGICAL_SEXES = new Set(["male", "female"]);
const BOOKING_PRIORITIES = new Set(["PRIORITY_URGENT", "PLANNED_STANDARD"]);
const EVOLUTION_VALUES = new Set(["stable_long", "new_lt_3m", "growing_changing", "unsure"]);
const SYMPTOM_VALUES = new Set(["none", "itch_or_pain", "bleeding_or_crust"]);
const TOPICAL_VALUES = new Set(["none", "steroid_ointment", "antiseptic_dye_celelandine", "moisturizer"]);

const DOCTOR_PREVISIT_READ_ROLES = ["system_admin", "doctor", "private_doctor"];
const PORTAL_PROVISION_ROLES = ["system_admin", "clinic_admin", "doctor"];

export class PrevisitValidationError extends Error {
  constructor(details = [], message = "Проверьте заполнение полей запроса.") {
    super(message);
    this.name = "PrevisitValidationError";
    this.publicCode = "validation_error";
    this.publicStatus = 422;
    this.publicDetails = details;
  }
}

export class PrevisitNotFoundError extends Error {
  constructor(message = "Запрошенная запись не найдена в доступной области клиники.") {
    super(message);
    this.name = "PrevisitNotFoundError";
    this.publicCode = "not_found";
    this.publicStatus = 404;
  }
}

function sha256Hex(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function cleanString(value, max = 240) {
  if (value == null) return null;
  const cleaned = String(value).trim().replace(/\s+/g, " ").slice(0, max);
  return cleaned || null;
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function assertUuid(value, field = "id") {
  const str = String(value || "").trim();
  if (!UUID_PATTERN.test(str)) {
    throw new PrevisitValidationError([{ field, message: "Требуется корректный идентификатор UUID." }]);
  }
  return str;
}

function clinicScopeForRoles(authContext, allowedRoles) {
  const scoped = requireAnyRole(authContext, allowedRoles);
  // Explicitly reject assistant/operator even if combined unexpectedly unless allowed
  if (scoped.roles.includes("system_admin")) {
    return { allClinics: true, clinicIds: [], roles: scoped.roles };
  }
  const bindings = Array.isArray(scoped.roleBindings) ? scoped.roleBindings : null;
  const clinicIds = bindings
    ? bindings
        .filter((b) => allowedRoles.includes(String(b?.role || "")))
        .map((b) => String(b?.clinicId || "").trim())
        .filter((id) => UUID_PATTERN.test(id))
    : (Array.isArray(scoped.clinicIds) ? scoped.clinicIds : [])
        .map((id) => String(id || "").trim())
        .filter((id) => UUID_PATTERN.test(id));
  if (clinicIds.length === 0) {
    throw new ForbiddenError("Не назначена область клиники для данной роли.");
  }
  return { allClinics: false, clinicIds: Array.from(new Set(clinicIds)), roles: scoped.roles };
}

function defaultRelationLabel(relation) {
  if (relation === "CHILD_UNDER_18") return "Ребёнку (до 18 лет)";
  if (relation === "ADULT_RELATIVE") return "Близкому взрослому";
  return "Себе";
}

function buildBirthDateFromProfile(profile = {}, nowIso = new Date().toISOString()) {
  const nowDate = new Date(nowIso);
  if (!Number.isFinite(nowDate.getTime())) return null;
  if (typeof profile.ageMonths === "number" && profile.ageMonths >= 0 && profile.ageMonths < 12) {
    const d = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth() - profile.ageMonths, 15));
    return d.toISOString().slice(0, 10);
  }
  if (typeof profile.ageYears === "number" && profile.ageYears >= 0 && profile.ageYears <= 120) {
    const d = new Date(Date.UTC(nowDate.getUTCFullYear() - profile.ageYears, 5, 15));
    return d.toISOString().slice(0, 10);
  }
  return null;
}

function generateReadablePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  let out = "SD-";
  for (let i = 0; i < bytes.length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function generateHandoffCode(nowIso = new Date().toISOString()) {
  const ymd = String(nowIso).slice(0, 10).replace(/-/g, "");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `SD-${ymd}-${suffix}`;
}

export function computeRoutingAndSafeCopy({
  evolution = "stable_long",
  symptoms = "none",
  priorTopical14d = "none",
  pediatricU6Active = false,
  pediatricSystemicRedFlags = false,
  lesionCount = 1,
  qualityScore = 88,
  fitzpatrickBand = "II",
  itaDegrees = 45,
}) {
  const safeCount = Math.max(1, Math.min(4, Number.parseInt(String(lesionCount || 1), 10) || 1));
  const usedTopicalModifier =
    priorTopical14d === "steroid_ointment" || priorTopical14d === "antiseptic_dye_celelandine";
  const highVisualOrClinicalSignal =
    evolution === "growing_changing" || symptoms === "bleeding_or_crust";

  let routingCategory = "LOW_OBSERVATION";
  let bookingPriority = "PLANNED_STANDARD";
  let badgeLabelRu = "Спокойная визуальная картина — плановое наблюдение";
  let sentences = [];

  if (pediatricU6Active && pediatricSystemicRedFlags) {
    routingCategory = "U6_PEDIATRIC_RED_FLAG";
    bookingPriority = "PRIORITY_URGENT";
    badgeLabelRu = "Детский красный флаг — требуется неотложная очная помощь";
    sentences = [
      "У ребёнка отмечены системные настораживающие признаки на фоне кожных проявлений: дистанционная проверка по фото в такой ситуации недостаточна.",
      "При повышении температуры, вялости или быстром распространении элементов незамедлительно обратитесь за скорой медицинской помощью (103 или 112).",
      "До осмотра врача не наносите красящие антисептики (зелёнку, фукорцин, йод), чтобы не скрыть картину кожи.",
    ];
  } else if (highVisualOrClinicalSignal) {
    // Crucial U5 invariant: topical ointment answers NEVER downgrade HIGH_URGENT!
    routingCategory = "HIGH_URGENT";
    bookingPriority = "PRIORITY_URGENT";
    badgeLabelRu = "Приоритетный очный осмотр дерматолога / дерматоонколога";
    sentences = [
      "Отмеченные изменения динамики или контактной кровоточивости требуют приоритетного очного осмотра врача с дерматоскопией.",
      usedTopicalModifier
        ? "Нанесение гормональных мазей или красящих растворов дополнительно меняет внешний вид очага, поэтому очная проверка особенно важна."
        : "Сервис не ставит диагноз по фотографии, но рекомендует выбрать ближайшее приоритетное окно приёма.",
      "До визита не травмируйте участок и не обрабатывайте его красящими растворами или прижигающими средствами.",
    ];
  } else if (usedTopicalModifier) {
    routingCategory = "U5_MODIFIED_SKIN";
    bookingPriority = "PLANNED_STANDARD";
    badgeLabelRu = "Нужна очная дерматоскопия из-за изменённого фона кожи";
    sentences = [
      "За последние 14 дней на участок наносились гормональные средства или красящие растворы, которые маскируют естественный рисунок и оттенок кожи.",
      "Чтобы не пропустить важные признаки на изменённом фоне, рекомендуем запланировать очный осмотр дерматолога с дерматоскопией.",
      "Перед приёмом воздержитесь от повторного нанесения красящих антисептиков.",
    ];
  } else if (evolution === "new_lt_3m" || evolution === "unsure" || symptoms === "itch_or_pain" || pediatricU6Active) {
    routingCategory = "PLANNED_REVIEW";
    bookingPriority = "PLANNED_STANDARD";
    badgeLabelRu = "Плановый очный осмотр дерматолога";
    sentences = [
      "По внешнему виду и ответам об очаге показана плановая очная консультация дерматолога с дерматоскопией для фиксации исходной картины.",
      "Это информационная маршрутизация для подготовки к приёму, а не медицинский диагноз.",
      "Запишитесь в удобное плановое окно и сохраните карточку для сравнения в динамике после осмотра врача.",
    ];
  } else {
    routingCategory = "LOW_OBSERVATION";
    bookingPriority = "PLANNED_STANDARD";
    badgeLabelRu = "Спокойная визуальная картина — плановое наблюдение";
    sentences = [
      "На локальном снимке и по вашим ответам нет признаков, требующих срочного внепланового обращения.",
      "Для надёжного базового контроля рекомендуем показать участок дерматологу на плановом профилактическом осмотре с дерматоскопией.",
      "При появлении быстрого изменения формы, цвета, зуда или кровоточивости запишитесь на очный приём раньше.",
    ];
  }

  const safeSummaryText = assertPatientFacingCopySafe(sentences.join(" "), "patientFacingSafeSummary");

  const evolutionRuMap = {
    stable_long: "существует давно, без заметной динамики",
    new_lt_3m: "появилось недавно (< 3 мес)",
    growing_changing: "отмечается рост / изменение цвета или контура",
    unsure: "давность и динамику пациент затрудняется уточнить",
  };
  const symptomsRuMap = {
    none: "субъективно не беспокоит",
    itch_or_pain: "периодический зуд или болезненность",
    bleeding_or_crust: "эпизоды кровоточивости / корочки без травмы",
  };
  const topicalRuMap = {
    none: "наружные препараты за 14 дней отрицает",
    steroid_ointment: "применялась топическая кортикостероидная мазь за последние 14 дней (флаг U5)",
    antiseptic_dye_celelandine: "обработка анилиновыми красителями / йодом / чистотелом за 14 дней (флаг U5)",
    moisturizer: "только базовый увлажняющий крем",
  };

  const lesionsForPatient = [];
  const lesionsForDoctor = [];
  for (let idx = 1; idx <= safeCount; idx += 1) {
    const cropSvgDataUrl = buildPrivateLesionCropSvgDataUrl({
      lesionIndex: idx,
      qualityScore,
    });
    lesionsForPatient.push({
      lesionIndex: idx,
      title: `Очаг №${idx}`,
      cropSvgDataUrl,
      surroundingSkinMarginPercent: 25,
      qualityScore0To100: qualityScore,
      safeSummary: safeSummaryText,
    });
    lesionsForDoctor.push({
      lesionIndex: idx,
      cropSvgDataUrl,
      qualityGate: { passed: true, score_0_100: qualityScore },
      anamnesisAnswers: {
        evolution,
        symptoms,
        prior_topical_14d: priorTopical14d,
      },
      doctorOnlyStatusLocalisDraft:
        `Предвизитный ИИ-черновик очага №${idx} (требует очной верификации и дерматоскопии): `
        + `оценочный фототип здоровой кожи вокруг очага ${fitzpatrickBand} (ITA° ${itaDegrees}°); `
        + `анамнез: ${evolutionRuMap[evolution] || evolution}, ${symptomsRuMap[symptoms] || symptoms}, `
        + `${topicalRuMap[priorTopical14d] || priorTopical14d}. `
        + `Рекомендована очная дерматоскопическая оценка структуры пигментной сети, сосудистого рисунка и границ.`,
      patientFacingSafeSummary: safeSummaryText,
    });
  }

  return {
    routingCategory,
    bookingPriority,
    badgeLabelRu,
    emergency103Banner: routingCategory === "U6_PEDIATRIC_RED_FLAG",
    safeSummaryText,
    lesionsForPatient,
    lesionsForDoctor,
  };
}

export function createPrevisitHandoffService({
  previsitHandoffRepository,
  objectStore,
  auditRepository,
  config = {},
  env = process.env,
} = {}) {
  const quotaEnforcementEnabled = String(env.QUOTA_ENFORCEMENT_ENABLED || "false").toLowerCase() === "true";
  const internalHandoffSecret = String(env.INTERNAL_HANDOFF_SECRET || "").trim();

  async function authenticateInternalServiceRequest(headers = {}) {
    const rawHeader =
      headers["x-internal-handoff-secret"]
      || headers["X-Internal-Handoff-Secret"]
      || headers["x-service-key"]
      || headers["X-Service-Key"]
      || "";
    const bearerRaw = String(headers.authorization || headers.Authorization || "");
    const bearerToken = bearerRaw.startsWith("Bearer ") ? bearerRaw.slice(7).trim() : "";
    const candidate = String(rawHeader || bearerToken).trim();

    if (!candidate) {
      throw new AuthRequiredError("Требуется межсервисный ключ доступа.");
    }

    if (internalHandoffSecret && internalHandoffSecret.length >= 12) {
      const a = Buffer.from(sha256Hex(candidate), "utf8");
      const b = Buffer.from(sha256Hex(internalHandoffSecret), "utf8");
      if (a.length === b.length && timingSafeEqual(a, b)) {
        return { actorType: "internal_secret", keyLabel: "env:INTERNAL_HANDOFF_SECRET" };
      }
    }

    const verifiedKey = await previsitHandoffRepository.verifyServiceKey({
      secretSha256: sha256Hex(candidate),
    });
    if (!verifiedKey) {
      throw new ForbiddenError("Межсервисный ключ недействителен или отозван.");
    }
    const scopes = Array.isArray(verifiedKey.scopes) ? verifiedKey.scopes : [];
    if (!scopes.includes("booking:write") && !scopes.includes("previsit:write")) {
      throw new ForbiddenError("Сервисный ключ не имеет права записи предвизитных кейсов (booking:write).");
    }
    return {
      actorType: "service_api_key",
      serviceKeyId: verifiedKey.id,
      keyLabel: verifiedKey.label,
    };
  }

  function extractOnboardingToken(headers = {}, body = {}) {
    const headerToken =
      headers["x-onboarding-token"]
      || headers["X-Onboarding-Token"]
      || body?.sessionToken
      || "";
    const cleaned = String(headerToken).trim();
    if (cleaned.length >= 16) return cleaned;
    return null;
  }

  return {
    quotaEnforcementEnabled,

    async initOrResumePublicSession(input = {}, headers = {}) {
      const existingToken = extractOnboardingToken(headers, input);
      const rawToken = existingToken || `sd_onb_${randomBytes(24).toString("base64url")}`;
      const channel = CHANNELS.has(String(input.channel || "web")) ? String(input.channel || "web") : "web";
      const data = await previsitHandoffRepository.upsertOnboardingSession({
        sessionTokenSha256: sha256Hex(rawToken),
        channel,
      });
      return {
        sessionToken: rawToken,
        quotaEnforced: false,
        session: data?.session || null,
        profiles: Array.isArray(data?.profiles) ? data.profiles : [],
        clinics: Array.isArray(data?.clinics) ? data.clinics : [],
      };
    },

    async createOnboardingProfile(input = {}, headers = {}, { nowIso = new Date().toISOString() } = {}) {
      if (!isPlainObject(input)) {
        throw new PrevisitValidationError([{ field: "body", message: "Ожидается JSON-объект." }]);
      }
      const rawToken = extractOnboardingToken(headers, input);
      if (!rawToken) {
        throw new AuthRequiredError("Сессия онбординга не инициализирована.");
      }
      const sessionBundle = await previsitHandoffRepository.upsertOnboardingSession({
        sessionTokenSha256: sha256Hex(rawToken),
        channel: CHANNELS.has(String(input.channel || "web")) ? String(input.channel || "web") : "web",
      });
      const sessionId = sessionBundle?.session?.id;
      if (!sessionId) throw new PrevisitNotFoundError("Сессия онбординга не найдена.");

      const subjectRelation = String(input.subjectRelation || "").trim();
      const legalGuardianConfirmed = Boolean(input.legalGuardianConfirmed);
      const consent152FzAccepted = Boolean(input.consent152FzAccepted);
      const biologicalSex = String(input.biologicalSex || "").trim();
      const isInfantUnder1Year = Boolean(input.isInfantUnder1Year);

      const details = [];
      if (!SUBJECT_RELATIONS.has(subjectRelation)) {
        details.push({ field: "subjectRelation", message: "Выберите профиль: Себе, Ребёнку (до 18 лет) или Близкому взрослому." });
      }
      if (subjectRelation === "CHILD_UNDER_18" && !legalGuardianConfirmed) {
        details.push({
          field: "legalGuardianConfirmed",
          message: "Для проверки снимка ребёнка необходимо подтвердить статус родителя или законного представителя.",
        });
      }
      if (!consent152FzAccepted) {
        details.push({
          field: "consent152FzAccepted",
          message: "Необходимо согласие на обработку персональных данных (152-ФЗ) и условия информационного сервиса.",
        });
      }
      if (!BIOLOGICAL_SEXES.has(biologicalSex)) {
        details.push({ field: "biologicalSex", message: "Укажите биологический пол (Мужской или Женский)." });
      }

      let ageYears = null;
      let ageMonths = null;
      if (isInfantUnder1Year) {
        const parsedMonths = Number.parseInt(String(input.ageMonths ?? ""), 10);
        if (!Number.isFinite(parsedMonths) || parsedMonths < 0 || parsedMonths > 11) {
          details.push({ field: "ageMonths", message: "Для младенца до 1 года укажите возраст в месяцах (от 0 до 11)." });
        } else {
          ageMonths = parsedMonths;
          ageYears = 0;
        }
      } else {
        const parsedYears = Number.parseInt(String(input.ageYears ?? ""), 10);
        if (!Number.isFinite(parsedYears) || parsedYears < 0 || parsedYears > 120) {
          details.push({ field: "ageYears", message: "Укажите возраст полных лет (от 1 до 120, либо отметьте «до 1 года»)." });
        } else if (subjectRelation === "CHILD_UNDER_18" && parsedYears >= 18) {
          details.push({ field: "ageYears", message: "Для детского профиля возраст должен быть младше 18 лет." });
        } else {
          ageYears = parsedYears;
        }
      }

      if (details.length > 0) {
        throw new PrevisitValidationError(details, details[0].message);
      }

      const pediatricU6Active =
        subjectRelation === "CHILD_UNDER_18"
        && (isInfantUnder1Year || (ageYears != null && ageYears < 3));

      const label =
        cleanString(input.label, 80) || defaultRelationLabel(subjectRelation);

      const profile = await previsitHandoffRepository.createOnboardingProfile({
        sessionId,
        subjectRelation,
        label,
        legalGuardianConfirmed: subjectRelation === "CHILD_UNDER_18" ? true : legalGuardianConfirmed,
        consent152FzAcceptedAt: nowIso,
        ageYears,
        ageMonths,
        pediatricU6Active,
        biologicalSex,
      });

      return { profile, quotaEnforced: false };
    },

    async submitOnboardingPhoto(input = {}, headers = {}) {
      if (!isPlainObject(input)) {
        throw new PrevisitValidationError([{ field: "body", message: "Ожидается JSON-объект." }]);
      }
      const rawToken = extractOnboardingToken(headers, input);
      if (!rawToken) {
        throw new AuthRequiredError("Сессия онбординга не инициализирована.");
      }
      const sessionBundle = await previsitHandoffRepository.upsertOnboardingSession({
        sessionTokenSha256: sha256Hex(rawToken),
        channel: CHANNELS.has(String(input.channel || "web")) ? String(input.channel || "web") : "web",
      });
      const session = sessionBundle?.session;
      if (!session?.id) throw new PrevisitNotFoundError("Сессия онбординга не найдена.");

      const profileId = assertUuid(input.profileId || session.activeProfileId, "profileId");
      const profile = await previsitHandoffRepository.getOnboardingProfile({
        sessionId: session.id,
        profileId,
      });
      if (!profile) {
        throw new PrevisitNotFoundError("Профиль не найден в текущей сессии.");
      }
      if (profile.subjectRelation === "CHILD_UNDER_18" && !profile.legalGuardianConfirmed) {
        throw new PrevisitValidationError([
          { field: "legalGuardianConfirmed", message: "Подтвердите статус родителя или законного представителя." },
        ]);
      }

      // Decode raw original file bytes (no client-side recompression or blind EXIF stripping)
      let fileBytes = null;
      if (Buffer.isBuffer(input.fileBytes) || input.fileBytes instanceof Uint8Array) {
        fileBytes = Buffer.from(input.fileBytes);
      } else if (typeof input.imageBase64 === "string" && input.imageBase64.trim()) {
        const rawB64 = input.imageBase64.includes(",")
          ? input.imageBase64.split(",").pop()
          : input.imageBase64;
        fileBytes = Buffer.from(rawB64.trim(), "base64");
      }
      if (!fileBytes || fileBytes.length === 0) {
        throw new PrevisitValidationError([{ field: "imageBase64", message: "Прикрепите файл снимка." }]);
      }

      const inspected = inspectAndSanitizeSplitVault({
        bytes: fileBytes,
        baselineItaDegrees: profile.baselineItaDegrees,
        clientHints: isPlainObject(input.clientHints) ? input.clientHints : {},
      });

      const bucket = config.objectStorageBucket || "clinical-assets";
      let sanitizedKey = null;

      if (inspected.qualityGate.passed && objectStore?.putObject) {
        const ext =
          inspected.container === "png"
            ? "png"
            : inspected.container === "webp"
              ? "webp"
              : inspected.container === "heic"
                ? "heic"
                : "jpg";
        sanitizedKey = `previsit-clean/${session.id}/${randomUUID()}_srgb_noexif.${ext}`;
        await objectStore.putObject({
          bucket,
          key: sanitizedKey,
          bytes: inspected.sanitizedBytes,
          contentType: inspected.contentType,
          checksumSha256: inspected.sanitizedSha256,
        });
      }

      let status = "quality_rejected";
      if (inspected.qualityGate.passed) {
        status = inspected.phototypeEstimate.profileMismatchTriggered
          ? "awaiting_mismatch_confirm"
          : "awaiting_micro_survey";
      }

      const submission = await previsitHandoffRepository.createOnboardingSubmission({
        sessionId: session.id,
        profileId: profile.id,
        channel: session.channel || "web",
        status,
        qualityGate: inspected.qualityGate,
        opticalExif: inspected.opticalExif,
        coarseUvBelt: inspected.coarseUvBelt,
        itaDegrees: inspected.phototypeEstimate.itaDegrees,
        estimatedFitzpatrickBand: inspected.phototypeEstimate.fitzpatrickBand,
        profileMismatchDeltaIta: inspected.phototypeEstimate.deltaItaFromProfile,
        antifraudSummary: inspected.antifraud,
        sanitizedObjectBucket: sanitizedKey ? bucket : null,
        sanitizedFullImageKey: sanitizedKey,
        updateProfileBaselineIta:
          inspected.qualityGate.passed && !inspected.phototypeEstimate.profileMismatchTriggered,
      });

      return stripForbiddenPublicFields({
        submissionId: submission.id,
        status: submission.status,
        quotaEnforced: false,
        qualityGate: inspected.qualityGate,
        privacyGuarantee: {
          colorSpaceNormalized: inspected.opticalExif.colorSpaceNormalized,
          exifAndGpsStrippedBeforeStorage: true,
          exactGpsDiscardedInRam: true,
          embeddedThumbnailStripped: true,
        },
        phototypeEstimate: {
          itaDegrees: inspected.phototypeEstimate.itaDegrees,
          fitzpatrickBand: inspected.phototypeEstimate.fitzpatrickBand,
          profileMismatchTriggered: inspected.phototypeEstimate.profileMismatchTriggered,
          deltaItaFromProfile: inspected.phototypeEstimate.deltaItaFromProfile,
        },
        mismatchPrompt: inspected.phototypeEstimate.profileMismatchTriggered
          ? {
              questionRu:
                "Тон кожи на этом снимке заметно отличается от предыдущих фото вашего профиля. Уточните, чей это снимок:",
              options: [
                {
                  code: "same_person_lighting",
                  labelRu: "Это моё фото (другое освещение или загар)",
                },
                {
                  code: "switched_profile",
                  labelRu: "Проверяю другого человека (выбрать/создать профиль)",
                },
              ],
            }
          : null,
      });
    },

    async resolveProfileMismatch(submissionId, input = {}, headers = {}, { nowIso = new Date().toISOString() } = {}) {
      const rawToken = extractOnboardingToken(headers, input);
      if (!rawToken) throw new AuthRequiredError("Сессия онбординга не инициализирована.");
      const sessionBundle = await previsitHandoffRepository.upsertOnboardingSession({
        sessionTokenSha256: sha256Hex(rawToken),
      });
      const session = sessionBundle?.session;
      if (!session?.id) throw new PrevisitNotFoundError("Сессия онбординга не найдена.");

      const safeSubmissionId = assertUuid(submissionId, "submissionId");
      const existing = await previsitHandoffRepository.getOnboardingSubmission({
        sessionId: session.id,
        submissionId: safeSubmissionId,
      });
      if (!existing) throw new PrevisitNotFoundError("Снимок не найден в текущей сессии.");

      const resolution = String(input.resolution || "").trim();
      if (resolution !== "same_person_lighting" && resolution !== "switched_profile") {
        throw new PrevisitValidationError([
          { field: "resolution", message: "Выберите один из двух вариантов уточнения профиля." },
        ]);
      }

      let targetProfileId = existing.profileId;
      if (resolution === "switched_profile") {
        if (input.targetProfileId && UUID_PATTERN.test(String(input.targetProfileId))) {
          const target = await previsitHandoffRepository.getOnboardingProfile({
            sessionId: session.id,
            profileId: String(input.targetProfileId),
          });
          if (!target) throw new PrevisitNotFoundError("Выбранный профиль не найден.");
          targetProfileId = target.id;
        } else {
          // Create separate subprofile on the fly without re-uploading the photo!
          const newProfile = await this.createOnboardingProfile(
            {
              sessionToken: rawToken,
              subjectRelation: input.subjectRelation || "ADULT_RELATIVE",
              label: input.label || "Близкому взрослому",
              legalGuardianConfirmed: Boolean(input.legalGuardianConfirmed),
              consent152FzAccepted: true,
              ageYears: input.ageYears ?? 35,
              biologicalSex: input.biologicalSex || existing.profile?.biologicalSex || "female",
            },
            headers,
            { nowIso },
          );
          targetProfileId = newProfile.profile.id;
        }
      }

      const updated = await previsitHandoffRepository.resolveSubmissionMismatch({
        sessionId: session.id,
        submissionId: safeSubmissionId,
        resolution,
        targetProfileId,
      });
      return { submission: updated };
    },

    async submitMicroSurveyAndBuildCard(submissionId, input = {}, headers = {}) {
      const rawToken = extractOnboardingToken(headers, input);
      if (!rawToken) throw new AuthRequiredError("Сессия онбординга не инициализирована.");
      const sessionBundle = await previsitHandoffRepository.upsertOnboardingSession({
        sessionTokenSha256: sha256Hex(rawToken),
      });
      const session = sessionBundle?.session;
      if (!session?.id) throw new PrevisitNotFoundError("Сессия онбординга не найдена.");

      const safeSubmissionId = assertUuid(submissionId, "submissionId");
      const existing = await previsitHandoffRepository.getOnboardingSubmission({
        sessionId: session.id,
        submissionId: safeSubmissionId,
      });
      if (!existing) throw new PrevisitNotFoundError("Снимок не найден в текущей сессии.");
      if (existing.status === "quality_rejected") {
        throw new PrevisitValidationError([
          { field: "submissionId", message: "Снимок не прошёл контроль качества. Отправьте новый чёткий кадр." },
        ]);
      }

      const evolution = EVOLUTION_VALUES.has(String(input.evolution || ""))
        ? String(input.evolution)
        : "stable_long";
      const symptoms = SYMPTOM_VALUES.has(String(input.symptoms || ""))
        ? String(input.symptoms)
        : "none";
      const priorTopical14d = TOPICAL_VALUES.has(String(input.priorTopical14d || ""))
        ? String(input.priorTopical14d)
        : "none";
      const pediatricSystemicRedFlags = Boolean(input.pediatricSystemicRedFlags);
      const lesionCount = Number.parseInt(String(input.lesionCount || 1), 10) || 1;
      const simulateGpuQueue = Boolean(input.simulateGpuTimeout);

      const anamnesisAnswers = {
        evolution,
        symptoms,
        priorTopical14d,
        pediatricSystemicRedFlags,
      };

      if (simulateGpuQueue) {
        const gpuJobUuid = randomUUID();
        const queuedCard = {
          queued: true,
          statusMessageRu:
            "Снимок прошёл проверку чёткости и поставлен в очередь анализа. Мы автоматически пришлём готовую карточку прямо в этот чат в течение нескольких минут.",
          primaryCtaLabelRu: "Оставить контакт для записи в клинику",
        };
        await previsitHandoffRepository.finalizeSubmissionSurvey({
          sessionId: session.id,
          submissionId: safeSubmissionId,
          status: "queued_gpu",
          anamnesisAnswers,
          routingCategory: "PLANNED_REVIEW",
          patientFacingCard: queuedCard,
          doctorOnlyDraft: [],
          gpuJobUuid,
        });
        return stripForbiddenPublicFields({
          submissionId: safeSubmissionId,
          status: "queued_gpu",
          quotaEnforced: false,
          card: queuedCard,
        });
      }

      const evaluated = computeRoutingAndSafeCopy({
        evolution,
        symptoms,
        priorTopical14d,
        pediatricU6Active: Boolean(existing.profile?.pediatricU6Active),
        pediatricSystemicRedFlags,
        lesionCount,
        qualityScore: Number(existing.qualityGate?.score0To100 || 88),
        fitzpatrickBand: existing.estimatedFitzpatrickBand || "II",
        itaDegrees: Number(existing.itaDegrees || 45),
      });

      const patientFacingCard = {
        queued: false,
        routingCategory: evaluated.routingCategory,
        bookingPriority: evaluated.bookingPriority,
        badgeLabelRu: evaluated.badgeLabelRu,
        emergency103Banner: evaluated.emergency103Banner,
        safeSummaryRu: evaluated.safeSummaryText,
        lesionCrops: evaluated.lesionsForPatient,
        fullFrameHiddenForPrivacy: true,
        primaryCtaLabelRu: "Записаться к дерматологу",
        deleteDataLabelRu: "Удалить мои снимки и данные",
      };

      await previsitHandoffRepository.finalizeSubmissionSurvey({
        sessionId: session.id,
        submissionId: safeSubmissionId,
        status: "ready",
        anamnesisAnswers,
        routingCategory: evaluated.routingCategory,
        patientFacingCard,
        doctorOnlyDraft: evaluated.lesionsForDoctor,
      });

      return stripForbiddenPublicFields({
        submissionId: safeSubmissionId,
        status: "ready",
        quotaEnforced: false,
        card: patientFacingCard,
      });
    },

    async updateProfileRiskFactors(profileId, input = {}, headers = {}) {
      const rawToken = extractOnboardingToken(headers, input);
      if (!rawToken) throw new AuthRequiredError("Сессия онбординга не инициализирована.");
      const sessionBundle = await previsitHandoffRepository.upsertOnboardingSession({
        sessionTokenSha256: sha256Hex(rawToken),
      });
      const session = sessionBundle?.session;
      if (!session?.id) throw new PrevisitNotFoundError("Сессия онбординга не найдена.");

      const safeProfileId = assertUuid(profileId, "profileId");
      const rawFactors = isPlainObject(input.riskFactors) ? input.riskFactors : input;
      const riskFactors = {
        bodyRegionCode: cleanString(rawFactors.bodyRegionCode, 64),
        sunburnsChildhood: Boolean(rawFactors.sunburnsChildhood),
        tanningBed: Boolean(rawFactors.tanningBed),
        familyMelanomaHistory: Boolean(rawFactors.familyMelanomaHistory),
        neviOver50: Boolean(rawFactors.neviOver50),
        immunosuppressionOrDiabetes: Boolean(rawFactors.immunosuppressionOrDiabetes),
        smokingOrChronicTrauma: Boolean(rawFactors.smokingOrChronicTrauma),
      };

      const updated = await previsitHandoffRepository.updateOnboardingProfileRiskFactors({
        sessionId: session.id,
        profileId: safeProfileId,
        riskFactors,
      });
      if (!updated) throw new PrevisitNotFoundError("Профиль не найден.");
      return { profile: updated };
    },

    async bookClinicFromSubmission(
      submissionId,
      input = {},
      headers = {},
      { nowIso = new Date().toISOString(), correlationId = "stage7-book" } = {},
    ) {
      const rawToken = extractOnboardingToken(headers, input);
      if (!rawToken) throw new AuthRequiredError("Сессия онбординга не инициализирована.");
      const sessionBundle = await previsitHandoffRepository.upsertOnboardingSession({
        sessionTokenSha256: sha256Hex(rawToken),
      });
      const session = sessionBundle?.session;
      if (!session?.id) throw new PrevisitNotFoundError("Сессия онбординга не найдена.");

      const safeSubmissionId = assertUuid(submissionId, "submissionId");
      const existing = await previsitHandoffRepository.getOnboardingSubmission({
        sessionId: session.id,
        submissionId: safeSubmissionId,
      });
      if (!existing) throw new PrevisitNotFoundError("Снимок не найден.");

      const displayName = cleanString(input.displayName, 120);
      const phoneE164 = cleanString(input.phone, 32);
      const preferredTimeNote = cleanString(input.preferredTimeNote, 180) || "Ближайшее доступное окно";
      const targetClinic = cleanString(input.clinicId || input.clinicSlug, 80) || "clinic_main_ru";

      const details = [];
      if (!displayName || displayName.length < 2) {
        details.push({ field: "displayName", message: "Укажите имя для связи оператора клиники." });
      }
      if (!phoneE164 || phoneE164.replace(/\D/g, "").length < 10) {
        details.push({ field: "phone", message: "Укажите контактный телефон для подтверждения записи." });
      }
      if (details.length > 0) throw new PrevisitValidationError(details, details[0].message);

      const handoffCaseCode = generateHandoffCode(nowIso);
      const bookingPriority =
        existing.routingCategory === "HIGH_URGENT" || existing.routingCategory === "U6_PEDIATRIC_RED_FLAG"
          ? "PRIORITY_URGENT"
          : "PLANNED_STANDARD";

      const doctorDraftArray = Array.isArray(existing.doctorOnlyDraft) && existing.doctorOnlyDraft.length > 0
        ? existing.doctorOnlyDraft
        : computeRoutingAndSafeCopy({
            evolution: existing.anamnesisAnswers?.evolution || "stable_long",
            symptoms: existing.anamnesisAnswers?.symptoms || "none",
            priorTopical14d: existing.anamnesisAnswers?.priorTopical14d || "none",
            pediatricU6Active: Boolean(existing.profile?.pediatricU6Active),
            qualityScore: Number(existing.qualityGate?.score0To100 || 88),
            fitzpatrickBand: existing.estimatedFitzpatrickBand || "II",
            itaDegrees: Number(existing.itaDegrees || 45),
          }).lesionsForDoctor;

      const bodyRegionCode =
        cleanString(input.bodyRegionCode, 64)
        || cleanString(existing.profile?.riskFactors?.bodyRegionCode, 64)
        || "trunk_anterior";

      const lesionsSummaryForDoctor = doctorDraftArray.map((item, idx) => ({
        lesionIndex: item.lesionIndex || idx + 1,
        bodyRegionCode,
        sanitizedFullImageS3Key: existing.sanitizedFullImageKey
          ? `s3://${existing.sanitizedObjectBucket || "clinical-assets"}/${existing.sanitizedFullImageKey}`
          : null,
        privateCropCardS3Key: null,
        cropSvgDataUrl: item.cropSvgDataUrl || null,
        qualityGate: item.qualityGate || existing.qualityGate || { passed: true, score_0_100: 88 },
        anamnesisAnswers: item.anamnesisAnswers || existing.anamnesisAnswers || {},
        doctorOnlyStatusLocalisDraft: item.doctorOnlyStatusLocalisDraft,
        patientFacingSafeSummary: assertPatientFacingCopySafe(item.patientFacingSafeSummary),
      }));

      const profile = existing.profile || {};
      const createdCase = await previsitHandoffRepository.upsertPrevisitCase({
        handoffCaseCode,
        targetClinicSlugOrId: targetClinic,
        channel: existing.channel || session.channel || "web",
        bookingPriority,
        patientDisplayName: displayName,
        patientPhoneE164: phoneE164,
        preferredTimeNote,
        preferredFromIso: nowIso,
        subjectRelation: profile.subjectRelation || "SELF",
        legalGuardianConfirmed: Boolean(profile.legalGuardianConfirmed),
        consent152FzAcceptedAt: profile.consent152FzAcceptedAt || nowIso,
        subjectProfile: {
          age_years: profile.ageYears,
          age_months: profile.ageMonths,
          biological_sex: profile.biologicalSex,
          estimated_phototype_ita: {
            fitzpatrick_band: existing.estimatedFitzpatrickBand || profile.estimatedFitzpatrickBand || "II",
            ita_degrees: Number(existing.itaDegrees ?? profile.baselineItaDegrees ?? 45),
          },
          risk_factors: profile.riskFactors || {},
        },
        lesionsSummaryForDoctor,
        onboardingSessionId: session.id,
        patientBirthDate: buildBirthDateFromProfile(profile, nowIso),
        patientSex: profile.biologicalSex || "unknown",
        patientPhototype: existing.estimatedFitzpatrickBand || profile.estimatedFitzpatrickBand || null,
      });

      await previsitHandoffRepository.finalizeSubmissionSurvey({
        sessionId: session.id,
        submissionId: safeSubmissionId,
        status: "handed_off",
        anamnesisAnswers: existing.anamnesisAnswers || {},
        routingCategory: existing.routingCategory || "PLANNED_REVIEW",
        patientFacingCard: existing.patientFacingCard || {},
        doctorOnlyDraft: existing.doctorOnlyDraft || [],
      });

      await recordAuditBestEffort(auditRepository, {
        clinicId: createdCase?.clinicId || null,
        actorUserId: null,
        action: "previsit_case.created_from_onboarding",
        entityType: "previsit_case",
        entityId: createdCase?.id || null,
        correlationId,
        metadata: {
          channel: createdCase?.channel,
          bookingPriority,
          handoffCaseCode,
        },
      });

      return {
        booked: true,
        handoffCaseCode: createdCase.handoffCaseCode,
        clinicName: createdCase.clinicName,
        bookingPriority: createdCase.bookingPriority,
        bookingPriorityLabelRu:
          createdCase.bookingPriority === "PRIORITY_URGENT"
            ? "Приоритетное окно приёма"
            : "Плановый приём",
        messageRu:
          "Заявка передана администратору записи выбранной клиники. Медицинские снимки и предвизитная сводка скрыты от оператора и откроются только врачу на приёме.",
      };
    },

    async deleteOnboardingMyData(input = {}, headers = {}, { correlationId = "stage7-152fz" } = {}) {
      const rawToken = extractOnboardingToken(headers, input);
      if (!rawToken) throw new AuthRequiredError("Сессия онбординга не инициализирована.");
      const sessionBundle = await previsitHandoffRepository.upsertOnboardingSession({
        sessionTokenSha256: sha256Hex(rawToken),
      });
      const session = sessionBundle?.session;
      if (!session?.id) throw new PrevisitNotFoundError("Сессия онбординга не найдена.");

      const deleted = await previsitHandoffRepository.deleteOnboardingSessionData152Fz({
        sessionId: session.id,
      });

      await recordAuditBestEffort(auditRepository, {
        clinicId: null,
        actorUserId: null,
        action: "onboarding.152fz_data_deleted",
        entityType: "onboarding_session",
        entityId: session.id,
        correlationId,
        metadata: {
          deletedProfilesCount: deleted?.deletedProfilesCount || 0,
          deletedSubmissionsCount: deleted?.deletedSubmissionsCount || 0,
          preservedClinicHandoffCount: deleted?.preservedClinicHandoffCount || 0,
        },
      });

      return {
        deleted: true,
        deletedProfilesCount: deleted?.deletedProfilesCount || 0,
        deletedSubmissionsCount: deleted?.deletedSubmissionsCount || 0,
        preservedClinicHandoffCount: deleted?.preservedClinicHandoffCount || 0,
        messageRu:
          "Ваши пользовательские снимки и анкетные данные удалены по запросу (152-ФЗ). Сведения, ранее переданные в медицинскую карту клиники, хранятся по правилам 323-ФЗ.",
      };
    },

    // POST /internal/v1/previsit-cases (AI Gateway -> dermatolog-pro-backend)
    async ingestInternalPrevisitCase(
      input = {},
      headers = {},
      { nowIso = new Date().toISOString(), correlationId = "stage7-internal-handoff" } = {},
    ) {
      const serviceAuth = await authenticateInternalServiceRequest(headers);
      if (!isPlainObject(input)) {
        throw new PrevisitValidationError([{ field: "body", message: "Ожидается JSON-объект." }]);
      }

      const handoffCaseCode = cleanString(input.handoff_case_code, 80);
      const targetClinic = cleanString(input.target_clinic_tenant_id, 80);
      const channel = String(input.channel || "").trim();
      const bookingPriority = String(input.booking_priority || "").trim();
      const contact = isPlainObject(input.patient_contact) ? input.patient_contact : {};
      const subjectProfile = isPlainObject(input.subject_profile) ? input.subject_profile : {};
      const rawLesions = Array.isArray(input.lesions_summary_for_doctor)
        ? input.lesions_summary_for_doctor
        : [];

      const subjectRelation = String(contact.subject_relation || "SELF").trim();
      const legalGuardianConfirmed = Boolean(contact.legal_guardian_confirmed);
      const consentAcceptedAt = cleanString(contact.consent_152fz_accepted_at, 64);
      const displayName = cleanString(contact.display_name, 140);
      const phoneE164 = cleanString(contact.phone_e164, 40);

      const details = [];
      if (!handoffCaseCode) details.push({ field: "handoff_case_code", message: "Обязателен код предвизитного кейса." });
      if (!targetClinic) details.push({ field: "target_clinic_tenant_id", message: "Укажите целевую клинику." });
      if (!CHANNELS.has(channel)) details.push({ field: "channel", message: "Канал должен быть telegram, whatsapp, max или web." });
      if (!BOOKING_PRIORITIES.has(bookingPriority)) {
        details.push({ field: "booking_priority", message: "booking_priority должен быть PRIORITY_URGENT или PLANNED_STANDARD." });
      }
      if (!SUBJECT_RELATIONS.has(subjectRelation)) {
        details.push({ field: "patient_contact.subject_relation", message: "Некорректный тип профиля субъекта." });
      }
      if (subjectRelation === "CHILD_UNDER_18" && !legalGuardianConfirmed) {
        details.push({
          field: "patient_contact.legal_guardian_confirmed",
          message: "Для ребёнка до 18 лет обязателен подтверждённый статус законного представителя.",
        });
      }
      if (!consentAcceptedAt) {
        details.push({ field: "patient_contact.consent_152fz_accepted_at", message: "Обязательна отметка согласия 152-ФЗ." });
      }
      if (!displayName) details.push({ field: "patient_contact.display_name", message: "Укажите имя контакта." });
      if (rawLesions.length === 0) {
        details.push({ field: "lesions_summary_for_doctor", message: "Требуется хотя бы один очаг в предвизитной сводке." });
      }
      if (details.length > 0) throw new PrevisitValidationError(details, details[0].message);

      const lesionsSummaryForDoctor = rawLesions.map((lesion, idx) => {
        const safePatientSummary = assertPatientFacingCopySafe(
          lesion.patient_facing_safe_summary,
          `lesions_summary_for_doctor[${idx}].patient_facing_safe_summary`,
        );
        const doctorDraft =
          cleanString(lesion.doctor_only_status_localis_draft, 4000)
          || "Предвизитный черновик Status localis (требует очной верификации врачом).";
        return {
          lesionIndex: Number.parseInt(String(lesion.lesion_index ?? idx + 1), 10) || idx + 1,
          bodyRegionCode: cleanString(lesion.body_region_code, 80),
          sanitizedFullImageS3Key: cleanString(lesion.sanitized_full_image_s3_key, 500),
          privateCropCardS3Key: cleanString(lesion.private_crop_card_s3_key, 500),
          cropSvgDataUrl:
            cleanString(lesion.crop_svg_data_url, 32000)
            || buildPrivateLesionCropSvgDataUrl({
              lesionIndex: idx + 1,
              qualityScore: Number(lesion.quality_gate?.score_0_100 || 88),
            }),
          qualityGate: isPlainObject(lesion.quality_gate) ? lesion.quality_gate : { passed: true, score_0_100: 88 },
          anamnesisAnswers: isPlainObject(lesion.anamnesis_answers) ? lesion.anamnesis_answers : {},
          doctorOnlyStatusLocalisDraft: doctorDraft,
          patientFacingSafeSummary: safePatientSummary,
        };
      });

      const sexRaw = String(subjectProfile.biological_sex || "").toLowerCase();
      const patientSex = sexRaw === "male" || sexRaw === "female" ? sexRaw : "unknown";
      const fitzBand = cleanString(subjectProfile.estimated_phototype_ita?.fitzpatrick_band, 8);
      const ageYears = Number.isFinite(Number(subjectProfile.age_years))
        ? Number(subjectProfile.age_years)
        : null;

      const upserted = await previsitHandoffRepository.upsertPrevisitCase({
        handoffCaseCode,
        targetClinicSlugOrId: targetClinic,
        channel,
        bookingPriority,
        patientDisplayName: displayName,
        patientPhoneE164: phoneE164,
        preferredTimeNote: cleanString(contact.preferred_time_note, 180),
        preferredFromIso: nowIso,
        subjectRelation,
        legalGuardianConfirmed,
        consent152FzAcceptedAt: consentAcceptedAt,
        subjectProfile,
        lesionsSummaryForDoctor,
        patientBirthDate: ageYears != null ? buildBirthDateFromProfile({ ageYears }, nowIso) : null,
        patientSex,
        patientPhototype: ["I", "II", "III", "IV", "V", "VI"].includes(String(fitzBand)) ? fitzBand : null,
      });

      await recordAuditBestEffort(auditRepository, {
        clinicId: upserted?.clinicId || null,
        actorUserId: null,
        action: "previsit_case.internal_ingest",
        entityType: "previsit_case",
        entityId: upserted?.id || null,
        correlationId,
        metadata: {
          actorType: serviceAuth.actorType,
          keyLabel: serviceAuth.keyLabel,
          handoffCaseCode,
          channel,
          bookingPriority,
          lesionCount: upserted?.lesionCount || lesionsSummaryForDoctor.length,
        },
      });

      return { item: upserted };
    },

    // POST /internal/v1/clinic-visit-confirmed
    async confirmInternalClinicVisit(
      input = {},
      headers = {},
      { correlationId = "stage7-visit-confirmed" } = {},
    ) {
      const serviceAuth = await authenticateInternalServiceRequest(headers);
      const handoffCaseCode = cleanString(input.handoff_case_code || input.handoffCaseCode, 80);
      const visitId = input.visit_id || input.visitId ? assertUuid(input.visit_id || input.visitId, "visit_id") : null;
      if (!handoffCaseCode && !visitId) {
        throw new PrevisitValidationError([
          { field: "handoff_case_code", message: "Укажите handoff_case_code или visit_id." },
        ]);
      }
      const confirmed = await previsitHandoffRepository.confirmClinicVisitAndActivatePassport({
        visitId,
        handoffCaseCode,
        allClinics: true,
      });
      if (!confirmed?.confirmed) {
        throw new PrevisitNotFoundError("Предвизитный кейс или визит не найден.");
      }
      await recordAuditBestEffort(auditRepository, {
        clinicId: confirmed.clinicId || null,
        actorUserId: null,
        action: "previsit_case.visit_confirmed_passport_activated",
        entityType: "previsit_case",
        correlationId,
        metadata: {
          actorType: serviceAuth.actorType,
          handoffCaseCode: confirmed.handoffCaseCode,
          visitId: confirmed.visitId,
          skinPassportActive: true,
        },
      });
      return { item: confirmed };
    },

    // GET /api/v1/visits/:id/previsit-case — strictly doctor / private_doctor / system_admin (403 for operator & assistant!)
    async getDoctorPrevisitCaseByVisit(visitId, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = clinicScopeForRoles(authContext, DOCTOR_PREVISIT_READ_ROLES);
      const previsitCase = await previsitHandoffRepository.getDoctorPrevisitCaseByVisit({
        visitId: safeVisitId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (previsitCase) {
        await recordAuditBestEffort(auditRepository, {
          clinicId: previsitCase.clinicId || null,
          actorUserId: authContext.userId,
          action: "previsit_case.doctor_read",
          entityType: "previsit_case",
          entityId: previsitCase.id,
          correlationId,
          metadata: {
            visitId: safeVisitId,
            handoffCaseCode: previsitCase.handoffCaseCode,
          },
        });
      }
      return { item: previsitCase, scope };
    },

    // POST /api/v1/visits/:id/confirm-previsit-passport — doctor confirms completed visit & unlocks unlimited Skin Passport
    async confirmVisitAndActivateSkinPassport(visitId, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const confirmed = await previsitHandoffRepository.confirmClinicVisitAndActivatePassport({
        visitId: safeVisitId,
        confirmedByUserId: authContext.userId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!confirmed?.confirmed) {
        throw new PrevisitNotFoundError("Визит не найден в области вашей клиники.");
      }

      // Optional outbound webhook notification to AI Gateway when configured
      const gatewayWebhookUrl = String(env.AI_GATEWAY_CLINIC_CONFIRMED_URL || "").trim();
      if (gatewayWebhookUrl && typeof fetch === "function") {
        try {
          await fetch(gatewayWebhookUrl, {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(internalHandoffSecret ? { "x-internal-handoff-secret": internalHandoffSecret } : {}),
            },
            body: JSON.stringify({
              handoff_case_code: confirmed.handoffCaseCode,
              visit_id: confirmed.visitId,
              visit_completed_at: confirmed.visitCompletedAt,
              skin_passport_active: true,
            }),
          });
        } catch {
          // Best-effort outbound notification; local PostgreSQL state is authoritative
        }
      }

      await recordAuditBestEffort(auditRepository, {
        clinicId: confirmed.clinicId || null,
        actorUserId: authContext.userId,
        action: "visit.skin_passport_activated",
        entityType: "visit",
        entityId: safeVisitId,
        correlationId,
        metadata: {
          handoffCaseCode: confirmed.handoffCaseCode,
          linkedPortalUsersUpdated: confirmed.linkedPortalUsersUpdated,
        },
      });
      return { item: confirmed, scope };
    },

    // GET /api/v1/patients/:id/portal-access
    async getPatientPortalAccess(patientId, authContext) {
      const safePatientId = assertUuid(patientId, "patientId");
      const scope = clinicScopeForRoles(authContext, PORTAL_PROVISION_ROLES);
      const status = await previsitHandoffRepository.getPatientPortalAccessStatus({
        patientId: safePatientId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!status) throw new PrevisitNotFoundError("Пациент не найден в вашей клинике.");
      return { item: status, scope };
    },

    // POST /api/v1/patients/:id/portal-access — creates/resets patient login + patient_user_links
    async provisionPatientPortalAccess(patientId, input = {}, authContext, { correlationId } = {}) {
      const safePatientId = assertUuid(patientId, "patientId");
      const scope = clinicScopeForRoles(authContext, PORTAL_PROVISION_ROLES);
      const current = await previsitHandoffRepository.getPatientPortalAccessStatus({
        patientId: safePatientId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!current) throw new PrevisitNotFoundError("Пациент не найден в вашей клинике.");

      const defaultEmail = `${String(current.patientCode || "patient")
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, "")}@patient.skindoktor.local`;
      const email = (cleanString(input.email, 180) || current.linkedAccounts?.[0]?.email || defaultEmail).toLowerCase();
      if (!EMAIL_PATTERN.test(email)) {
        throw new PrevisitValidationError([{ field: "email", message: "Укажите корректный адрес эл. почты для входа пациента." }]);
      }

      const plainPassword =
        typeof input.password === "string" && input.password.trim().length >= 10
          ? input.password.trim()
          : generateReadablePassword();
      const displayName = cleanString(input.displayName, 160) || current.patientFullName || "Пациент клиники";
      const activateSkinPassport =
        input.activateSkinPassport === undefined ? true : Boolean(input.activateSkinPassport);

      const provisioned = await previsitHandoffRepository.provisionPatientPortalAccess({
        patientId: safePatientId,
        email,
        displayName,
        passwordHash: hashPassword(plainPassword),
        activateSkinPassport,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!provisioned) throw new PrevisitNotFoundError("Не удалось выдать доступ пациенту.");

      await recordAuditBestEffort(auditRepository, {
        clinicId: provisioned.clinicId || null,
        actorUserId: authContext.userId,
        action: "patient.portal_access_provisioned",
        entityType: "patient",
        entityId: safePatientId,
        correlationId,
        metadata: {
          patientUserId: provisioned.userId,
          skinPassportActive: provisioned.skinPassportActive,
        },
      });

      return {
        item: {
          ...provisioned,
          temporaryPassword: plainPassword,
          loginPath: "/self-hosted/login",
          portalPath: "/me",
        },
        scope,
      };
    },

    // DELETE /api/v1/me/personal-uploads — 152-ФЗ patient self-service deletion
    async deletePortalPersonalUploads(authContext, { correlationId } = {}) {
      const scope = patientPortalScope(authContext);
      const purged = await previsitHandoffRepository.deletePortalPersonalUploads152Fz({
        userId: scope.userId,
      });
      await recordAuditBestEffort(auditRepository, {
        clinicId: null,
        actorUserId: scope.userId,
        action: "patient_portal.152fz_personal_uploads_deleted",
        entityType: "app_user",
        entityId: scope.userId,
        correlationId,
        metadata: {
          purgedPersonalSubmissionsCount: purged?.purgedPersonalSubmissionsCount || 0,
        },
      });
      return {
        deleted: true,
        purgedPersonalSubmissionsCount: purged?.purgedPersonalSubmissionsCount || 0,
        medicalRecordProtectedBy323Fz: true,
        messageRu:
          "Пользовательские черновые снимки удалены по 152-ФЗ. Подписанные медицинские заключения клиники сохранены в соответствии с 323-ФЗ.",
      };
    },
  };
}
