// Stage 6 · public analysis service.
// No authenticated user context is required; the token is a high-entropy link
// secret and is compared only by hash.

import { hashPublicAnalysisToken } from "./public-analysis-repository.mjs";

class PublicAnalysisValidationError extends Error {
  constructor(message = "Public analysis token is invalid.") {
    super(message);
    this.name = "PublicAnalysisValidationError";
    this.publicCode = "invalid_public_link";
    this.publicStatus = 404;
  }
}

function normalizeToken(value) {
  const token = String(value || "").trim();
  if (token.length < 16 || token.length > 256 || /\s/.test(token)) {
    throw new PublicAnalysisValidationError();
  }
  return token;
}

export function createPublicAnalysisService({ publicAnalysisRepository }) {
  return {
    async getPublicAnalysis(token, { nowIso = new Date().toISOString() } = {}) {
      const normalizedToken = normalizeToken(token);
      const analysis = await publicAnalysisRepository.getByTokenHash({
        tokenHash: hashPublicAnalysisToken(normalizedToken),
        nowIso,
      });
      return { analysis };
    },
  };
}

export { PublicAnalysisValidationError };
