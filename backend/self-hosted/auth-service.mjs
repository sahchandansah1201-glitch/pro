import { verifyPasswordHash } from "./auth-crypto.mjs";
import {
  extractBearerToken,
  signAccessToken,
  verifyAccessToken,
} from "./auth-tokens.mjs";
import { recordAuditBestEffort } from "./audit-repository.mjs";

export class InvalidCredentialsError extends Error {
  constructor(message = "Invalid credentials.") {
    super(message);
    this.name = "InvalidCredentialsError";
    this.publicCode = "invalid_credentials";
    this.publicStatus = 401;
  }
}

function normalizeCredentials(input = {}) {
  return {
    email: String(input.email || "").trim().toLowerCase(),
    password: String(input.password || ""),
  };
}

function publicRoles(roles = []) {
  return roles.map((role) => ({
    role: role.role,
    clinicId: role.clinicId,
    clinicName: role.clinicName,
    clinicSlug: role.clinicSlug,
  }));
}

function tokenRoles(roles = []) {
  return Array.from(new Set(roles.map((role) => role.role).filter(Boolean)));
}

function tokenClinicIds(roles = []) {
  return Array.from(new Set(roles.map((role) => role.clinicId).filter(Boolean)));
}

export function createAuthService({
  config,
  authRepository,
  auditRepository,
  nowSeconds = () => Math.floor(Date.now() / 1000),
} = {}) {
  return {
    async login(input, { correlationId } = {}) {
      const credentials = normalizeCredentials(input);
      if (!credentials.email || !credentials.password) {
        throw new InvalidCredentialsError();
      }
      const user = await authRepository.findActiveUserByEmail(credentials.email);
      if (!user || !verifyPasswordHash(credentials.password, user.passwordHash)) {
        throw new InvalidCredentialsError();
      }
      const roles = publicRoles(user.roles);
      const accessToken = signAccessToken({
        subject: user.id,
        issuer: config.jwtIssuer,
        secret: config.jwtSecret,
        roles: tokenRoles(roles),
        clinicIds: tokenClinicIds(roles),
        nowSeconds: nowSeconds(),
        expiresInSeconds: config.jwtExpiresInSeconds,
      });
      await recordAuditBestEffort(auditRepository, {
        clinicId: roles.find((role) => role.clinicId)?.clinicId || null,
        actorUserId: user.id,
        action: "auth.login",
        entityType: "app_user",
        entityId: user.id,
        correlationId,
        metadata: {
          roleCount: roles.length,
        },
      });
      return {
        tokenType: "Bearer",
        accessToken,
        expiresInSeconds: config.jwtExpiresInSeconds,
        user: {
          id: user.id,
          displayName: user.displayName,
          roles,
        },
      };
    },

    async authenticate(headers = {}) {
      const token = extractBearerToken(headers);
      if (!token) {
        return null;
      }
      const claims = verifyAccessToken({
        token,
        issuer: config.jwtIssuer,
        secret: config.jwtSecret,
        nowSeconds: nowSeconds(),
      });
      const user = await authRepository.findUserContextById(claims.userId);
      if (!user) {
        return null;
      }
      const roles = publicRoles(user.roles);
      return {
        userId: user.id,
        displayName: user.displayName,
        roles: tokenRoles(roles),
        clinicIds: tokenClinicIds(roles),
        roleBindings: roles,
        token: {
          issuedAt: claims.issuedAt,
          expiresAt: claims.expiresAt,
        },
      };
    },
  };
}
