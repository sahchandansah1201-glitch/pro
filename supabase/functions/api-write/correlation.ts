// Stage 1C · Correlation ID helper.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getCorrelationId(req: Request): string {
  const incoming = req.headers.get("x-correlation-id");
  if (incoming && UUID_RE.test(incoming)) return incoming.toLowerCase();
  return crypto.randomUUID();
}
