// Stage 6 · public analysis route wiring.

import { errorResponse, jsonResponse } from "./api-response.mjs";
import { createPublicAnalysisRepository } from "./public-analysis-repository.mjs";
import { createPublicAnalysisService } from "./public-analysis-service.mjs";

export function createPublicAnalysisRuntime({ dbClient, runtime = {} }) {
  const publicAnalysisRepository =
    runtime.publicAnalysisRepository || createPublicAnalysisRepository(dbClient);
  const publicAnalysisService =
    runtime.publicAnalysisService ||
    createPublicAnalysisService({
      publicAnalysisRepository,
    });
  return { publicAnalysisRepository, publicAnalysisService };
}

export async function handlePublicAnalysisRequest({
  method,
  url,
  config,
  requestOrigin,
  runtimeServices,
  correlationId,
  now,
  publicErrorFor,
}) {
  const match = url.pathname.match(/^\/api\/v1\/public\/analysis\/([^/]+)$/);
  if (!match || method !== "GET") return null;

  try {
    const result = await runtimeServices.publicAnalysisService.getPublicAnalysis(
      decodeURIComponent(match[1]),
      {
        correlationId,
        nowIso: now(),
      },
    );
    return jsonResponse(
      200,
      {
        stage: "6P",
        source: "postgres",
        item: result.analysis,
        generatedAt: now(),
        correlationId,
      },
      config,
      requestOrigin,
    );
  } catch (error) {
    const publicError = publicErrorFor(error);
    return errorResponse({ ...publicError, correlationId, config, requestOrigin });
  }
}
