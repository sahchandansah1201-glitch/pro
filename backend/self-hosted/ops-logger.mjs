const SENSITIVE_KEY_RE = /authorization|cookie|password|secret|token|access[_-]?token|refresh[_-]?token|jwt|database[_-]?url|object[_-]?(key|bucket)|storage[_-]?object[_-]?path|patient[_-]?full[_-]?name|full[_-]?name|email/i;
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi;
const URL_SECRET_RE = /\b(access_token|refresh_token|sig|signature|token|password|secret)=([^&\s]+)/gi;
const STORAGE_PATH_RE = /\b(?:storage_object_path|object_key|object_path|bucket)[:=][^\s,}]+/gi;

export function redactOpsText(value) {
  return String(value)
    .replace(BEARER_RE, "Bearer [redacted]")
    .replace(URL_SECRET_RE, "$1=[redacted]")
    .replace(EMAIL_RE, "[redacted-email]")
    .replace(STORAGE_PATH_RE, "[redacted-storage]");
}

export function sanitizeOpsPayload(value, key = "") {
  if (SENSITIVE_KEY_RE.test(key)) return "[redacted]";
  if (value == null) return value;
  if (typeof value === "string") return redactOpsText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((item) => sanitizeOpsPayload(item));
  if (typeof value === "object") {
    const out = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      out[entryKey] = sanitizeOpsPayload(entryValue, entryKey);
    }
    return out;
  }
  return String(value);
}

export function safeRequestPath(rawUrl = "") {
  try {
    const url = new URL(String(rawUrl || "/"), "http://stage4n.local");
    return url.pathname || "/";
  } catch {
    return "/";
  }
}

export function extractCorrelationId(response, fallback = "stage4n-local") {
  const headerValue = response?.headers?.["x-correlation-id"];
  if (headerValue) return String(headerValue);
  try {
    const parsed = JSON.parse(response?.body || "{}");
    return String(parsed.correlationId || fallback);
  } catch {
    return String(fallback);
  }
}

export function createOpsLogger({
  service = "dermatolog-pro-self-hosted-api",
  sink = process.stdout,
  now = () => new Date().toISOString(),
} = {}) {
  function write(level, event, payload = {}) {
    const entry = sanitizeOpsPayload({
      ts: now(),
      level,
      event,
      service,
      stage: "4N",
      ...payload,
    });
    sink.write(`${JSON.stringify(entry)}\n`);
  }

  return {
    info(event, payload) {
      write("info", event, payload);
    },
    warn(event, payload) {
      write("warn", event, payload);
    },
    error(event, payload) {
      write("error", event, payload);
    },
  };
}
