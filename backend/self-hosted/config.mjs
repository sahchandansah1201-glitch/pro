const DEFAULT_PORT = 3001;
const DEFAULT_CORS_ORIGINS = ["http://localhost:8080", "http://127.0.0.1:8080"];

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

export function readSelfHostedConfig(env = process.env) {
  return {
    serviceName: "dermatolog-pro-backend",
    deploymentMode: "self-hosted",
    port: parsePort(env.BACKEND_PORT),
    databaseUrl: env.DATABASE_URL || "",
    objectStorageEndpoint: env.OBJECT_STORAGE_ENDPOINT || "",
    objectStorageBucket: env.OBJECT_STORAGE_BUCKET || "clinical-assets",
    jwtIssuer: env.JWT_ISSUER || "dermatolog-pro",
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
      name: "object-storage",
      configured: Boolean(config.objectStorageEndpoint),
      detail: config.objectStorageEndpoint
        ? "OBJECT_STORAGE_ENDPOINT configured"
        : "OBJECT_STORAGE_ENDPOINT missing",
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
    jwtIssuer: config.jwtIssuer,
    corsOrigins: config.corsOrigins,
    dependencies: dependencyStatus(config),
  };
}
