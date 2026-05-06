// Stage 1B-A · Tiny hand-written validators (no Zod in this slice).
import { HttpError } from "./errors.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(value: string, field: string): string {
  if (!value || !UUID_RE.test(value)) {
    throw new HttpError("validation_error", `Invalid uuid for ${field}`, {
      field,
    });
  }
  return value.toLowerCase();
}
