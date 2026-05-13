const DEFAULT_PORT = 3001;
const DEFAULT_CORS_ORIGINS = ["http://localhost:8080", "http://127.0.0.1:8080"];
const DEFAULT_JWT_EXPIRES_IN_SECONDS = 60 * 60;

function parsePort(value) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) {
    return DEFAULT_PORT;
  }
  return parsed;
}

function parseOrigins(value) {
  if (!value) return DEFAULT_CORS_ORIGINS;
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function readSelfHostedConfig(env = process.env) {
  return {
    serviceName: "dermatolog-pro-backend",
    deploymentMode: "self-hosted",
    port: parsePort(env.BACKEND_PORT),
    databaseUrl: env.DATABASE_URL || "",
    objectStorageEndpoint: env.OBJECT_STORAGE_ENDPOINT || "",
    objectStorageBucket: env.OBJECT_STORAGE_BUCKET || "clinical-assets",
    objectStorageLocalDir: env.OBJECT_STORAGE_LOCAL_DIR || ".self-hosted/object-storage",
    jwtIssuer: env.JWT_ISSUER || "dermatolog-pro",
    jwtSecret: env.JWT_SECRET || "",
    jwtExpiresInSeconds: parsePositiveInteger(
      env.JWT_EXPIRES_IN_SECONDS,
      DEFAULT_JWT_EXPIRES_IN_SECONDS,
    ),
    corsOrigins: parseOrigins(env.CORS_ORIGINS),
  };
}

export function dependencyStatus(config) {
  return [
    {
      name: "postgres",
      configured: Boolean(config.databaseUrl),
      detail: config.databaseUrl ? "DATABASE_URL configured" : "DATABASE_URL missing",
    },
    {
      name: "jwt-signing-key",
      configured: Boolean(config.jwtSecret && config.jwtSecret.length >= 16),
      detail:
        config.jwtSecret && config.jwtSecret.length >= 16
          ? "token signing key configured"
          : "token signing key missing or too short",
    },
    {
      name: "object-storage",
      configured: Boolean(config.objectStorageEndpoint || config.objectStorageLocalDir),
      detail: config.objectStorageEndpoint
        ? "OBJECT_STORAGE_ENDPOINT configured"
        : config.objectStorageLocalDir
          ? "OBJECT_STORAGE_LOCAL_DIR configured"
          : "object storage missing",
    },
  ];
}

export function readinessStatus(config) {
  const dependencies = dependencyStatus(config);
  const ready = dependencies.every((item) => item.configured);
  return {
    ready,
    status: ready ? "ready" : "degraded",
    dependencies,
  };
}

export function publicConfig(config) {
  return {
    serviceName: config.serviceName,
    deploymentMode: config.deploymentMode,
    port: config.port,
    objectStorageBucket: config.objectStorageBucket,
    objectStorageMode: config.objectStorageEndpoint ? "external-endpoint" : "local-filesystem",
    jwtIssuer: config.jwtIssuer,
    jwtExpiresInSeconds: config.jwtExpiresInSeconds,
    corsOrigins: config.corsOrigins,
    dependencies: dependencyStatus(config),
  };
}
