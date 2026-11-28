// Stage 7 · HTTP routes for public 2-step onboarding, Telegram bot webhook/simulator,
// internal pre-visit handoff, doctor pre-visit case & Skin Passport activation,
// clinic patient portal provisioning, and 152-FZ deletion.

import { errorResponse, jsonResponse } from "./api-response.mjs";
import { createPrevisitHandoffRepository } from "./previsit-handoff-repository.mjs";
import { createPrevisitHandoffService } from "./previsit-handoff-service.mjs";
import { requireAnyRole } from "./rbac.mjs";
import {
  createSyntheticValidJpegBuffer,
  createTelegramOnboardingBot,
} from "./telegram-onboarding-bot.mjs";

function requireAdminOrClinicAdmin(authContext) {
  return requireAnyRole(authContext, ["system_admin", "clinic_admin"]);
}

export function isLargePrevisitBodyPath(url = "") {
  return (
    /^\/api\/v1\/public\/onboarding\/photos(?:\?|$)/.test(url)
    || /^\/api\/v1\/public\/telegram\/(?:webhook|simulate)(?:\?|$)/.test(url)
    || /^\/(?:api\/v1\/)?internal\/(?:v1\/)?previsit-cases(?:\?|$)/.test(url)
  );
}

export function createPrevisitHandoffRuntime({
  dbClient,
  objectStore,
  auditRepository,
  config,
  runtime = {},
  env = process.env,
}) {
  const previsitHandoffRepository =
    runtime.previsitHandoffRepository || createPrevisitHandoffRepository(dbClient);
  const previsitHandoffService =
    runtime.previsitHandoffService
    || createPrevisitHandoffService({
      previsitHandoffRepository,
      objectStore,
      auditRepository,
      config,
      env,
    });
  const telegramOnboardingBot =
    runtime.telegramOnboardingBot
    || createTelegramOnboardingBot({
      previsitHandoffRepository,
      previsitHandoffService,
      env,
    });

  return {
    previsitHandoffRepository,
    previsitHandoffService,
    telegramOnboardingBot,
  };
}

export async function handlePrevisitHandoffRequest({
  method,
  url,
  request,
  config,
  requestOrigin,
  runtimeServices,
  correlationId,
  now,
  parseJsonBody,
  publicErrorFor,
}) {
  const pathname = url.pathname;

  try {
    // 1. Inter-service handoff endpoints (both /internal/v1/* and /api/v1/internal/*)
    if (
      (pathname === "/internal/v1/previsit-cases" || pathname === "/api/v1/internal/previsit-cases")
      && method === "POST"
    ) {
      const result = await runtimeServices.previsitHandoffService.ingestInternalPrevisitCase(
        parseJsonBody(request.body),
        request.headers,
        { nowIso: now(), correlationId },
      );
      return jsonResponse(
        201,
        {
          stage: "7",
          source: "postgres",
          item: result.item,
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    }

    if (
      (pathname === "/internal/v1/clinic-visit-confirmed"
        || pathname === "/api/v1/internal/clinic-visit-confirmed")
      && method === "POST"
    ) {
      const result = await runtimeServices.previsitHandoffService.confirmInternalClinicVisit(
        parseJsonBody(request.body),
        request.headers,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "7",
          source: "postgres",
          item: result.item,
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    }

    // 2. Public Web photo-first onboarding & flow config endpoints (quotas disabled: quotaEnforced=false)
    if (pathname === "/api/v1/public/onboarding/flow-config" && method === "GET") {
      const result = await runtimeServices.previsitHandoffService.getOmnichannelConfig();
      return jsonResponse(
        200,
        {
          stage: "7B",
          ...result,
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    }

    if (pathname === "/api/v1/admin/channel-configurator" && (method === "GET" || method === "PUT")) {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      if (method === "GET") {
        requireAdminOrClinicAdmin(authContext);
        const result = await runtimeServices.previsitHandoffService.getOmnichannelConfig();
        return jsonResponse(
          200,
          {
            stage: "7B",
            source: "postgres",
            ...result,
            generatedAt: now(),
            correlationId,
          },
          config,
          requestOrigin,
        );
      }
      const result = await runtimeServices.previsitHandoffService.updateOmnichannelConfig(
        parseJsonBody(request.body),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "7B",
          source: "postgres",
          ...result,
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    }

    if (pathname === "/api/v1/public/onboarding/session" && method === "POST") {
      const result = await runtimeServices.previsitHandoffService.initOrResumePublicSession(
        request.body ? parseJsonBody(request.body) : {},
        request.headers,
      );
      return jsonResponse(
        200,
        {
          stage: "7",
          ...result,
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    }

    if (pathname === "/api/v1/public/onboarding/profiles" && method === "POST") {
      const result = await runtimeServices.previsitHandoffService.createOnboardingProfile(
        parseJsonBody(request.body),
        request.headers,
        { nowIso: now() },
      );
      return jsonResponse(
        201,
        {
          stage: "7",
          ...result,
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    }

    if (pathname === "/api/v1/public/onboarding/photos" && method === "POST") {
      const result = await runtimeServices.previsitHandoffService.submitOnboardingPhoto(
        parseJsonBody(request.body),
        request.headers,
      );
      return jsonResponse(
        200,
        {
          stage: "7",
          ...result,
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    }

    const mismatchMatch = pathname.match(/^\/api\/v1\/public\/onboarding\/submissions\/([^/]+)\/mismatch$/);
    if (mismatchMatch && method === "POST") {
      const result = await runtimeServices.previsitHandoffService.resolveProfileMismatch(
        decodeURIComponent(mismatchMatch[1]),
        parseJsonBody(request.body),
        request.headers,
        { nowIso: now() },
      );
      return jsonResponse(
        200,
        {
          stage: "7",
          ...result,
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    }

    const surveyMatch = pathname.match(/^\/api\/v1\/public\/onboarding\/submissions\/([^/]+)\/survey$/);
    if (surveyMatch && method === "POST") {
      const result = await runtimeServices.previsitHandoffService.submitMicroSurveyAndBuildCard(
        decodeURIComponent(surveyMatch[1]),
        parseJsonBody(request.body),
        request.headers,
      );
      return jsonResponse(
        200,
        {
          stage: "7",
          ...result,
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    }

    const riskMatch = pathname.match(/^\/api\/v1\/public\/onboarding\/profiles\/([^/]+)\/risk-factors$/);
    if (riskMatch && method === "POST") {
      const result = await runtimeServices.previsitHandoffService.updateProfileRiskFactors(
        decodeURIComponent(riskMatch[1]),
        parseJsonBody(request.body),
        request.headers,
      );
      return jsonResponse(
        200,
        {
          stage: "7",
          ...result,
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    }

    const bookMatch = pathname.match(/^\/api\/v1\/public\/onboarding\/submissions\/([^/]+)\/book$/);
    if (bookMatch && method === "POST") {
      const result = await runtimeServices.previsitHandoffService.bookClinicFromSubmission(
        decodeURIComponent(bookMatch[1]),
        parseJsonBody(request.body),
        request.headers,
        { nowIso: now(), correlationId },
      );
      return jsonResponse(
        201,
        {
          stage: "7",
          ...result,
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    }

    if (pathname === "/api/v1/public/onboarding/my-data" && method === "DELETE") {
      const body = request.body ? parseJsonBody(request.body) : {};
      const result = await runtimeServices.previsitHandoffService.deleteOnboardingMyData(
        body,
        request.headers,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "7",
          ...result,
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    }

    // 3. Telegram Bot Webhook & Interactive Dialog Tester
    if (pathname === "/api/v1/public/telegram/webhook" && method === "POST") {
      const result = await runtimeServices.telegramOnboardingBot.handleWebhookUpdate(
        parseJsonBody(request.body),
        request.headers,
        { nowIso: now() },
      );
      return jsonResponse(200, result, config, requestOrigin);
    }

    if (pathname === "/api/v1/public/telegram/simulate" && method === "POST") {
      const body = parseJsonBody(request.body);
      let photoBytes = null;
      if (body.simulatePhotoPreset) {
        photoBytes = createSyntheticValidJpegBuffer({
          displayP3: true,
          gpsLatDeg: 55.75,
          includeThumbnail: true,
        });
      }
      const clientHints = {
        ...(body.clientHints && typeof body.clientHints === "object" ? body.clientHints : {}),
      };
      if (body.simulatePhotoPreset === "blur") clientHints.simulatedQualityIssue = "blur";
      if (body.simulatePhotoPreset === "glare") clientHints.simulatedQualityIssue = "glare";
      if (body.simulatePhotoPreset === "dark") clientHints.simulatedQualityIssue = "dark";
      if (body.simulatePhotoPreset === "mismatch_skin") {
        clientHints.healthyRingRgb = { r: 92, g: 64, b: 48 };
      } else if (body.simulatePhotoPreset === "clear_skin") {
        clientHints.healthyRingRgb = { r: 228, g: 194, b: 172 };
      }

      const stepped = await runtimeServices.telegramOnboardingBot.stepDialog({
        chatId: body.chatId || "web-tg-tester",
        text: body.text ?? null,
        callbackData: body.callbackData ?? null,
        photoBytes,
        imageBase64: body.imageBase64 ?? null,
        clientHints,
        nowIso: now(),
      });
      return jsonResponse(
        200,
        {
          stage: "7",
          ...stepped,
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    }

    // 4. Doctor Pre-visit Case & Skin Passport Activation
    const visitPrevisitMatch = pathname.match(/^\/api\/v1\/visits\/([^/]+)\/previsit-case$/);
    if (visitPrevisitMatch && method === "GET") {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.previsitHandoffService.getDoctorPrevisitCaseByVisit(
        decodeURIComponent(visitPrevisitMatch[1]),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "7",
          source: "postgres",
          item: result.item,
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    }

    const visitConfirmPassportMatch = pathname.match(/^\/api\/v1\/visits\/([^/]+)\/confirm-previsit-passport$/);
    if (visitConfirmPassportMatch && method === "POST") {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.previsitHandoffService.confirmVisitAndActivateSkinPassport(
        decodeURIComponent(visitConfirmPassportMatch[1]),
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "7",
          source: "postgres",
          item: result.item,
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    }

    // 5. Clinic Patient Portal Provisioning ("Выдать доступ пациенту")
    const patientPortalAccessMatch = pathname.match(/^\/api\/v1\/patients\/([^/]+)\/portal-access$/);
    if (patientPortalAccessMatch && (method === "GET" || method === "POST")) {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const patientId = decodeURIComponent(patientPortalAccessMatch[1]);
      if (method === "GET") {
        const result = await runtimeServices.previsitHandoffService.getPatientPortalAccess(
          patientId,
          authContext,
        );
        return jsonResponse(
          200,
          {
            stage: "7",
            source: "postgres",
            item: result.item,
            generatedAt: now(),
            correlationId,
          },
          config,
          requestOrigin,
        );
      }
      const result = await runtimeServices.previsitHandoffService.provisionPatientPortalAccess(
        patientId,
        request.body ? parseJsonBody(request.body) : {},
        authContext,
        { correlationId },
      );
      return jsonResponse(
        201,
        {
          stage: "7",
          source: "postgres",
          item: result.item,
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    }

    // 6. Patient Portal 152-FZ personal uploads deletion
    if (pathname === "/api/v1/me/personal-uploads" && method === "DELETE") {
      const authContext = await runtimeServices.authService.authenticate(request.headers);
      const result = await runtimeServices.previsitHandoffService.deletePortalPersonalUploads(
        authContext,
        { correlationId },
      );
      return jsonResponse(
        200,
        {
          stage: "7",
          source: "postgres",
          ...result,
          generatedAt: now(),
          correlationId,
        },
        config,
        requestOrigin,
      );
    }

    return null;
  } catch (error) {
    const publicError = publicErrorFor(error);
    return errorResponse({
      ...publicError,
      correlationId,
      config,
      requestOrigin,
    });
  }
}
