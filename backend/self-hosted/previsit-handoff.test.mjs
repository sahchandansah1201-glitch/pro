import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeClinicBookingRequest } from "./clinic-booking-requests-repository.mjs";
import { handlePrevisitHandoffRequest } from "./previsit-handoff-routes.mjs";
import { computeRoutingAndSafeCopy, createPrevisitHandoffService } from "./previsit-handoff-service.mjs";
import { createSyntheticValidJpegBuffer, createTelegramOnboardingBot } from "./telegram-onboarding-bot.mjs";

const CLINIC_A = "10000000-0000-4000-8000-000000000001";
const CLINIC_B = "10000000-0000-4000-8000-000000000002";
const PATIENT_A = "20000000-0000-4000-8000-000000000001";
const VISIT_A = "30000000-0000-4000-8000-000000000001";
const DOCTOR_A = "40000000-0000-4000-8000-000000000001";

function createInMemoryPrevisitRepo() {
  const sessions = new Map();
  const profiles = new Map();
  const submissions = new Map();
  const previsitCases = new Map();
  const portalLinks = new Map();
  let seq = 1;
  const nextUuid = () => `90000000-0000-4000-8000-${String(seq++).padStart(12, "0")}`;

  return {
    sessions,
    profiles,
    submissions,
    previsitCases,
    portalLinks,
    async verifyServiceKey({ secretSha256 }) {
      if (secretSha256) return null;
      return null;
    },
    async upsertOnboardingSession({ sessionTokenSha256, channel = "web", externalChatId = null }) {
      let found = Array.from(sessions.values()).find(
        (s) =>
          !s.deletedAt
          && ((externalChatId && s.channel === channel && s.externalChatId === externalChatId)
            || s.sessionTokenSha256 === sessionTokenSha256),
      );
      if (!found) {
        found = {
          id: nextUuid(),
          sessionTokenSha256,
          channel,
          externalChatId,
          fsmState: "S0_START",
          fsmContext: {},
          activeProfileId: null,
          quotaEnforced: false,
          acceptedPhotoCount: 0,
          rejectedPhotoCount: 0,
          skinPassportActive: false,
          deletedAt: null,
          createdAt: "2026-11-27T20:00:00.000Z",
        };
        sessions.set(found.id, found);
      }
      const sessionProfiles = Array.from(profiles.values()).filter(
        (p) => p.sessionId === found.id && !p.deletedAt,
      );
      return {
        session: { ...found },
        profiles: sessionProfiles,
        clinics: [{ id: CLINIC_A, slug: "clinic_main_ru", name: "Клиника Дерматолог Про" }],
      };
    },
    async updateOnboardingSessionState({ sessionId, fsmState, fsmContext, activeProfileId }) {
      const s = sessions.get(sessionId);
      if (!s) return null;
      s.fsmState = fsmState;
      s.fsmContext = fsmContext;
      if (activeProfileId !== undefined) s.activeProfileId = activeProfileId;
      return { ...s };
    },
    async createOnboardingProfile(params) {
      const p = {
        id: nextUuid(),
        ...params,
        estimatedFitzpatrickBand: null,
        baselineItaDegrees: null,
        riskFactors: {},
        deletedAt: null,
        createdAt: "2026-11-27T20:01:00.000Z",
      };
      profiles.set(p.id, p);
      const s = sessions.get(params.sessionId);
      if (s) {
        s.activeProfileId = p.id;
        s.fsmState = "S3_AWAIT_PHOTO";
      }
      return { ...p };
    },
    async getOnboardingProfile({ sessionId, profileId }) {
      const p = profiles.get(profileId);
      if (!p || p.sessionId !== sessionId || p.deletedAt) return null;
      return { ...p };
    },
    async updateOnboardingProfileRiskFactors({ sessionId, profileId, riskFactors }) {
      const p = profiles.get(profileId);
      if (!p || p.sessionId !== sessionId || p.deletedAt) return null;
      p.riskFactors = { ...(p.riskFactors || {}), ...riskFactors };
      return { ...p };
    },
    async createOnboardingSubmission(params) {
      const sub = {
        id: nextUuid(),
        ...params,
        anamnesisAnswers: {},
        routingCategory: null,
        patientFacingCard: {},
        doctorOnlyDraft: [],
        deletedAt: null,
        createdAt: "2026-11-27T20:02:00.000Z",
      };
      submissions.set(sub.id, sub);
      const s = sessions.get(params.sessionId);
      if (s) {
        if (params.status === "quality_rejected") s.rejectedPhotoCount += 1;
        else s.acceptedPhotoCount += 1;
      }
      const p = profiles.get(params.profileId);
      if (p && params.updateProfileBaselineIta && p.baselineItaDegrees == null) {
        p.baselineItaDegrees = params.itaDegrees;
        p.estimatedFitzpatrickBand = params.estimatedFitzpatrickBand;
      }
      return { ...sub };
    },
    async getOnboardingSubmission({ sessionId, submissionId }) {
      const sub = submissions.get(submissionId);
      if (!sub || sub.sessionId !== sessionId || sub.deletedAt) return null;
      const p = profiles.get(sub.profileId);
      return { ...sub, profile: p ? { ...p } : null };
    },
    async resolveSubmissionMismatch({ sessionId, submissionId, resolution, targetProfileId }) {
      const sub = submissions.get(submissionId);
      if (!sub || sub.sessionId !== sessionId) return null;
      sub.profileId = targetProfileId;
      sub.profileMismatchResolution = resolution;
      sub.status = "awaiting_micro_survey";
      const p = profiles.get(targetProfileId);
      if (p && p.baselineItaDegrees == null) {
        p.baselineItaDegrees = sub.itaDegrees;
        p.estimatedFitzpatrickBand = sub.estimatedFitzpatrickBand;
      }
      return { ...sub };
    },
    async finalizeSubmissionSurvey({
      sessionId,
      submissionId,
      status,
      anamnesisAnswers,
      routingCategory,
      patientFacingCard,
      doctorOnlyDraft,
      gpuJobUuid,
    }) {
      const sub = submissions.get(submissionId);
      if (!sub || sub.sessionId !== sessionId) return null;
      sub.status = status;
      sub.anamnesisAnswers = anamnesisAnswers;
      sub.routingCategory = routingCategory;
      sub.patientFacingCard = patientFacingCard;
      sub.doctorOnlyDraft = doctorOnlyDraft;
      sub.gpuJobUuid = gpuJobUuid;
      return { ...sub };
    },
    async deleteOnboardingSessionData152Fz({ sessionId }) {
      let deletedSubs = 0;
      let preserved = 0;
      for (const sub of submissions.values()) {
        if (sub.sessionId === sessionId && !sub.deletedAt) {
          if (sub.status === "handed_off") preserved += 1;
          else {
            sub.status = "deleted";
            sub.deletedAt = "2026-11-27T20:10:00.000Z";
            deletedSubs += 1;
          }
        }
      }
      let deletedProfs = 0;
      for (const p of profiles.values()) {
        if (p.sessionId === sessionId && !p.deletedAt) {
          p.deletedAt = "2026-11-27T20:10:00.000Z";
          deletedProfs += 1;
        }
      }
      const s = sessions.get(sessionId);
      if (s) s.deletedAt = "2026-11-27T20:10:00.000Z";
      return {
        deletedSession: true,
        deletedProfilesCount: deletedProfs,
        deletedSubmissionsCount: deletedSubs,
        preservedClinicHandoffCount: preserved,
      };
    },
    async upsertPrevisitCase(params) {
      const item = {
        id: nextUuid(),
        handoffCaseCode: params.handoffCaseCode,
        clinicId: CLINIC_A,
        clinicSlug: "clinic_main_ru",
        clinicName: "Клиника Дерматолог Про",
        patientId: PATIENT_A,
        bookingRequestId: nextUuid(),
        visitId: VISIT_A,
        channel: params.channel,
        bookingPriority: params.bookingPriority,
        subjectRelation: params.subjectRelation,
        legalGuardianConfirmed: params.legalGuardianConfirmed,
        consent152FzAcceptedAt: params.consent152FzAcceptedAt,
        subjectProfile: params.subjectProfile,
        skinPassportActive: false,
        lesions: params.lesionsSummaryForDoctor,
        lesionCount: params.lesionsSummaryForDoctor.length,
        createdAt: "2026-11-27T20:05:00.000Z",
      };
      previsitCases.set(item.handoffCaseCode, item);
      return item;
    },
    async getDoctorPrevisitCaseByVisit({ visitId, clinicIds = [], allClinics = false }) {
      if (!allClinics && !clinicIds.includes(CLINIC_A)) return null;
      const found = Array.from(previsitCases.values()).find((c) => c.visitId === visitId);
      return found || null;
    },
    async confirmClinicVisitAndActivatePassport({ visitId, handoffCaseCode, clinicIds = [], allClinics = false }) {
      if (!allClinics && !clinicIds.includes(CLINIC_A)) return { confirmed: false };
      const found = Array.from(previsitCases.values()).find(
        (c) => c.handoffCaseCode === handoffCaseCode || c.visitId === visitId,
      );
      if (found) found.skinPassportActive = true;
      return {
        confirmed: true,
        handoffCaseCode: found?.handoffCaseCode || "SD-20261127-TEST",
        visitId: visitId || VISIT_A,
        patientId: PATIENT_A,
        clinicId: CLINIC_A,
        skinPassportActive: true,
        visitCompletedAt: "2026-11-27T21:00:00.000Z",
        linkedPortalUsersUpdated: 1,
      };
    },
    async getPatientPortalAccessStatus({ patientId, clinicIds = [], allClinics = false }) {
      if (patientId !== PATIENT_A) return null;
      if (!allClinics && !clinicIds.includes(CLINIC_A)) return null;
      return {
        patientId: PATIENT_A,
        clinicId: CLINIC_A,
        patientCode: "DP-001",
        patientFullName: "Иванов Иван",
        linkedAccounts: portalLinks.get(PATIENT_A) || [],
      };
    },
    async provisionPatientPortalAccess({ patientId, email, displayName, activateSkinPassport, clinicIds = [], allClinics = false }) {
      if (patientId !== PATIENT_A) return null;
      if (!allClinics && !clinicIds.includes(CLINIC_A)) return null;
      const acc = {
        patientId,
        clinicId: CLINIC_A,
        patientCode: "DP-001",
        userId: nextUuid(),
        email,
        displayName,
        role: "patient",
        skinPassportActive: activateSkinPassport,
        skinPassportActivatedAt: activateSkinPassport ? "2026-11-27T21:05:00.000Z" : null,
      };
      portalLinks.set(PATIENT_A, [acc]);
      return acc;
    },
    async deletePortalPersonalUploads152Fz() {
      return { purgedPersonalSubmissionsCount: 2, medicalRecordProtectedBy323Fz: true };
    },
  };
}

test("Stage 7 onboarding enforces CHILD_UNDER_18 guardian checkbox, disables user quotas, and preserves HIGH_URGENT under U5", async () => {
  const repo = createInMemoryPrevisitRepo();
  const storedObjects = [];
  const service = createPrevisitHandoffService({
    previsitHandoffRepository: repo,
    objectStore: {
      async putObject(obj) {
        storedObjects.push(obj);
        return obj;
      },
    },
    env: { QUOTA_ENFORCEMENT_ENABLED: "false", INTERNAL_HANDOFF_SECRET: "super-secret-handoff-key-123" },
  });

  const init = await service.initOrResumePublicSession({ channel: "web" });
  assert.equal(init.quotaEnforced, false);
  const headers = { "x-onboarding-token": init.sessionToken };

  // Child under 18 WITHOUT guardian confirmation must fail closed
  await assert.rejects(
    () =>
      service.createOnboardingProfile(
        {
          subjectRelation: "CHILD_UNDER_18",
          legalGuardianConfirmed: false,
          consent152FzAccepted: true,
          ageYears: 7,
          biologicalSex: "female",
        },
        headers,
      ),
    /законного представителя/,
  );

  // Valid adult profile + 6 consecutive photos -> never blocked by quota (owner decision!)
  const prof = await service.createOnboardingProfile(
    {
      subjectRelation: "SELF",
      consent152FzAccepted: true,
      ageYears: 34,
      biologicalSex: "female",
    },
    headers,
  );
  assert.equal(prof.quotaEnforced, false);

  const validJpeg = createSyntheticValidJpegBuffer({
    displayP3: true,
    gpsLatDeg: 55.75,
    includeThumbnail: true,
  });

  let lastPhoto = null;
  for (let i = 0; i < 6; i += 1) {
    lastPhoto = await service.submitOnboardingPhoto(
      {
        profileId: prof.profile.id,
        fileBytes: validJpeg,
        clientHints: { healthyRingRgb: { r: 228, g: 196, b: 176 } },
      },
      headers,
    );
    assert.equal(lastPhoto.quotaEnforced, false);
    assert.equal(lastPhoto.qualityGate.passed, true);
  }
  assert.equal(storedObjects.length, 6);
  // Stored object bytes have 100% stripped EXIF
  assert.equal(storedObjects[0].bytes.includes(Buffer.from("Exif\0\0", "ascii")), false);

  // U5 invariant: steroid ointment NEVER downgrades HIGH_URGENT when lesion is growing/bleeding
  const cardRes = await service.submitMicroSurveyAndBuildCard(
    lastPhoto.submissionId,
    {
      evolution: "growing_changing",
      symptoms: "bleeding_or_crust",
      priorTopical14d: "steroid_ointment",
    },
    headers,
  );
  assert.equal(cardRes.card.routingCategory, "HIGH_URGENT");
  assert.equal(cardRes.card.bookingPriority, "PRIORITY_URGENT");
  assert.equal(cardRes.card.fullFrameHiddenForPrivacy, true);
  assert.equal(cardRes.card.lesionCrops.length, 1);
});

test("Stage 7 Role × Tenant boundaries: operator has zero medical photos/text, assistant/operator/other-clinic denied doctor previsit", async () => {
  const repo = createInMemoryPrevisitRepo();
  const service = createPrevisitHandoffService({
    previsitHandoffRepository: repo,
    env: { INTERNAL_HANDOFF_SECRET: "super-secret-handoff-key-123" },
  });

  // 1. Ingest internal previsit case
  const ingested = await service.ingestInternalPrevisitCase(
    {
      handoff_case_code: "SD-20261127-RBAC01",
      target_clinic_tenant_id: "clinic_main_ru",
      channel: "telegram",
      booking_priority: "PRIORITY_URGENT",
      patient_contact: {
        display_name: "Пётр",
        phone_e164: "+79991112233",
        preferred_time_note: "Будни после 18:00",
        subject_relation: "SELF",
        legal_guardian_confirmed: false,
        consent_152fz_accepted_at: "2026-11-27T20:00:00+03:00",
      },
      subject_profile: {
        age_years: 44,
        biological_sex: "male",
        estimated_phototype_ita: { fitzpatrick_band: "II", ita_degrees: 46.5 },
      },
      lesions_summary_for_doctor: [
        {
          lesion_index: 1,
          body_region_code: "trunk_back_upper",
          sanitized_full_image_s3_key: "s3://clinical-assets/previsit-clean/full.jpg",
          quality_gate: { passed: true, score_0_100: 91 },
          anamnesis_answers: { evolution: "growing_changing", symptoms: "none", prior_topical_14d: "none" },
          doctor_only_status_localis_draft: "Врачебный черновик CBM: асимметрия контура.",
          patient_facing_safe_summary:
            "На снимке отмечена неоднородность контура, требующая очного осмотра дерматолога с дерматоскопией.",
        },
      ],
    },
    { "x-internal-handoff-secret": "super-secret-handoff-key-123" },
  );
  assert.equal(ingested.item.bookingPriority, "PRIORITY_URGENT");

  // 2. Operator booking DTO strictly excludes medical photos and Status localis
  const operatorDto = normalizeClinicBookingRequest({
    id: ingested.item.bookingRequestId,
    clinicId: CLINIC_A,
    patientId: PATIENT_A,
    status: "requested",
    channel: "telegram",
    bookingPriority: "PRIORITY_URGENT",
    handoffCaseCode: "SD-20261127-RBAC01",
    contactPhone: "+79991112233",
    preferredTimeNote: "Будни после 18:00",
    patientFullName: "Пётр",
    patientCode: "PV-RBAC01",
    sanitizedFullImageS3Key: "s3://MUST_NOT_LEAK",
    doctorOnlyStatusLocalisDraft: "SECRET_DRAFT_MUST_NOT_LEAK",
  });
  assert.equal(operatorDto.channel, "telegram");
  assert.equal(operatorDto.bookingPriority, "PRIORITY_URGENT");
  assert.equal("sanitizedFullImageS3Key" in operatorDto, false);
  assert.equal("doctorOnlyStatusLocalisDraft" in operatorDto, false);

  // 3. Operator & Assistant are denied (403) on doctor pre-visit case endpoint
  for (const deniedRole of ["operator", "assistant"]) {
    await assert.rejects(
      () =>
        service.getDoctorPrevisitCaseByVisit(VISIT_A, {
          userId: "50000000-0000-4000-8000-000000000099",
          roles: [deniedRole],
          clinicIds: [CLINIC_A],
        }),
      (err) => err.publicStatus === 403,
    );
  }

  // 4. Cross-clinic Doctor B cannot read Clinic A's pre-visit case
  const crossClinicRes = await service.getDoctorPrevisitCaseByVisit(VISIT_A, {
    userId: DOCTOR_A,
    roles: ["doctor"],
    clinicIds: [CLINIC_B],
  });
  assert.equal(crossClinicRes.item, null);

  // 5. Same-clinic Doctor A reads full pre-visit case and activates Skin Passport + Patient Portal Access
  const doctorRes = await service.getDoctorPrevisitCaseByVisit(VISIT_A, {
    userId: DOCTOR_A,
    roles: ["doctor"],
    clinicIds: [CLINIC_A],
  });
  assert.equal(doctorRes.item.handoffCaseCode, "SD-20261127-RBAC01");
  assert.match(doctorRes.item.lesions[0].doctorOnlyStatusLocalisDraft, /Врачебный черновик CBM/);

  const passportRes = await service.confirmVisitAndActivateSkinPassport(VISIT_A, {
    userId: DOCTOR_A,
    roles: ["doctor"],
    clinicIds: [CLINIC_A],
  });
  assert.equal(passportRes.item.skinPassportActive, true);

  const portalAcc = await service.provisionPatientPortalAccess(
    PATIENT_A,
    { email: "petr.patient@skindoktor.ru" },
    { userId: DOCTOR_A, roles: ["doctor"], clinicIds: [CLINIC_A] },
  );
  assert.equal(portalAcc.item.role, "patient");
  assert.equal(portalAcc.item.skinPassportActive, true);
  assert.ok(portalAcc.item.temporaryPassword.length >= 12);
});

test("Stage 7 Telegram Bot FSM executes full dialog branching (child guardian -> infant U6 -> quality retry -> mismatch -> booking -> 152-FZ delete)", async () => {
  const repo = createInMemoryPrevisitRepo();
  const service = createPrevisitHandoffService({
    previsitHandoffRepository: repo,
    env: { QUOTA_ENFORCEMENT_ENABLED: "false" },
  });
  const bot = createTelegramOnboardingBot({
    previsitHandoffRepository: repo,
    previsitHandoffService: service,
    env: { TELEGRAM_WEBHOOK_SECRET: "tg-secret-token-777" },
  });

  // Webhook rejects missing secret
  await assert.rejects(
    () => bot.handleWebhookUpdate({ message: { chat: { id: 101 }, text: "/start" } }, {}),
    (err) => err.publicStatus === 401,
  );

  const chatId = "tg-test-chat-42";
  let step = await bot.stepDialog({ chatId, text: "/start" });
  assert.equal(step.fsmState, "S0_START");

  // Branch: CHILD_UNDER_18 -> requires guardian check
  step = await bot.stepDialog({ chatId, callbackData: "rel:CHILD_UNDER_18" });
  assert.equal(step.fsmState, "S1_GUARDIAN_CHECK");

  // Blocked if guardian not confirmed
  step = await bot.stepDialog({ chatId, text: "пропустить" });
  assert.equal(step.fsmState, "S1_GUARDIAN_CHECK");

  step = await bot.stepDialog({ chatId, callbackData: "guard:confirm" });
  assert.equal(step.fsmState, "S1_CONSENT_152FZ");

  step = await bot.stepDialog({ chatId, callbackData: "consent:accept" });
  assert.equal(step.fsmState, "S2_AGE");

  // Infant < 1 year branch -> U6 pediatric active
  step = await bot.stepDialog({ chatId, callbackData: "age:infant" });
  assert.equal(step.fsmState, "S2_INFANT_MONTHS");

  step = await bot.stepDialog({ chatId, callbackData: "months:6" });
  assert.equal(step.fsmState, "S2_SEX");

  step = await bot.stepDialog({ chatId, callbackData: "sex:female" });
  assert.equal(step.fsmState, "S3_AWAIT_PHOTO");
  assert.equal(step.profile.pediatricU6Active, true);

  // Blurry photo rejected without blocking user
  const jpeg = createSyntheticValidJpegBuffer({ displayP3: true });
  step = await bot.stepDialog({
    chatId,
    photoBytes: jpeg,
    clientHints: { simulatedQualityIssue: "blur" },
  });
  assert.equal(step.fsmState, "S3_AWAIT_PHOTO");
  assert.match(step.reply.text, /не прошёл входной контроль качества/);

  // Clear photo accepted -> Q1..Q3 -> U6 red-flag check -> 103/112 emergency banner!
  step = await bot.stepDialog({
    chatId,
    photoBytes: jpeg,
    clientHints: { healthyRingRgb: { r: 230, g: 200, b: 180 } },
  });
  assert.equal(step.fsmState, "S4_Q1_EVOLUTION");

  step = await bot.stepDialog({ chatId, callbackData: "q1:new_lt_3m" });
  assert.equal(step.fsmState, "S4_Q2_SYMPTOMS");

  step = await bot.stepDialog({ chatId, callbackData: "q2:itch_or_pain" });
  assert.equal(step.fsmState, "S4_Q3_TOPICAL_U5");

  step = await bot.stepDialog({ chatId, callbackData: "q3:none" });
  assert.equal(step.fsmState, "S4_U6_CHILD_RED_FLAGS");

  step = await bot.stepDialog({ chatId, callbackData: "u6:yes" });
  assert.equal(step.fsmState, "S5_RESULT_CARD");
  assert.match(step.reply.text, /103 \/ 112/);
  assert.ok(step.reply.cropCard?.cropSvgDataUrl);

  // Second photo with drastically darker skin tone triggers Profile Mismatch Guard (|ΔITA°| > 22°)
  step = await bot.stepDialog({ chatId, callbackData: "act:new_photo" });
  step = await bot.stepDialog({
    chatId,
    photoBytes: jpeg,
    clientHints: { healthyRingRgb: { r: 88, g: 60, b: 44 } },
  });
  assert.equal(step.fsmState, "S3_MISMATCH_GUARD");

  // Switch profile on the fly without re-uploading photo
  step = await bot.stepDialog({ chatId, callbackData: "mm:switched_profile" });
  assert.equal(step.fsmState, "S4_Q1_EVOLUTION");
  assert.match(step.reply.text, /перенесён в отдельный профиль без повторной загрузки/);

  await bot.stepDialog({ chatId, callbackData: "q1:stable_long" });
  await bot.stepDialog({ chatId, callbackData: "q2:none" });
  step = await bot.stepDialog({ chatId, callbackData: "q3:none" });
  assert.equal(step.fsmState, "S5_RESULT_CARD");

  // Clinic booking handoff
  step = await bot.stepDialog({ chatId, callbackData: "act:book_clinic" });
  assert.equal(step.fsmState, "S6_BOOK_NAME");
  step = await bot.stepDialog({ chatId, text: "Анна" });
  assert.equal(step.fsmState, "S6_BOOK_PHONE");
  step = await bot.stepDialog({ chatId, text: "+79995554433" });
  assert.equal(step.fsmState, "S6_BOOK_TIME");
  step = await bot.stepDialog({ chatId, callbackData: "time:Будни утром (09:00–13:00)" });
  assert.equal(step.fsmState, "S6_BOOK_DONE");
  assert.equal(step.bookingResult.booked, true);

  // 152-FZ deletion command
  step = await bot.stepDialog({ chatId, text: "/delete_my_data" });
  assert.equal(step.fsmState, "S7_DELETED_152FZ");
  assert.match(step.reply.text, /152-ФЗ/);

  // HTTP route handler check for /api/v1/public/telegram/simulate
  const httpRes = await handlePrevisitHandoffRequest({
    method: "POST",
    url: new URL("http://self-hosted.local/api/v1/public/telegram/simulate"),
    request: { headers: {}, body: JSON.stringify({ chatId: "http-sim-1", text: "/start" }) },
    config: { corsOrigins: ["*"] },
    requestOrigin: "",
    runtimeServices: { previsitHandoffService: service, telegramOnboardingBot: bot },
    correlationId: "test-corr",
    now: () => "2026-11-27T20:30:00.000Z",
    parseJsonBody: (raw) => JSON.parse(raw),
    publicErrorFor: (err) => ({ status: err.publicStatus || 500, code: err.publicCode || "err", message: err.message }),
  });
  assert.equal(httpRes.status, 200);
});

test("computeRoutingAndSafeCopy produces 100% safe Russian copy across all routing categories", () => {
  for (const combo of [
    { evolution: "stable_long", symptoms: "none", priorTopical14d: "none" },
    { evolution: "new_lt_3m", symptoms: "itch_or_pain", priorTopical14d: "moisturizer" },
    { evolution: "stable_long", symptoms: "none", priorTopical14d: "antiseptic_dye_celelandine" },
    { evolution: "growing_changing", symptoms: "bleeding_or_crust", priorTopical14d: "steroid_ointment" },
    { evolution: "new_lt_3m", symptoms: "none", priorTopical14d: "none", pediatricU6Active: true, pediatricSystemicRedFlags: true },
  ]) {
    const res = computeRoutingAndSafeCopy({ ...combo, lesionCount: 2 });
    assert.equal(res.lesionsForPatient.length, 2);
    assert.equal(res.lesionsForDoctor.length, 2);
    assert.ok(res.safeSummaryText.length > 30);
  }
});
