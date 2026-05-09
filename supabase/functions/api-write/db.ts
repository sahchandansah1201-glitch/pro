// Stage 1C · DB error mapping. Per-request Supabase client provided by auth.ts.
// Wraps insert/update/select-row patterns to translate Postgres errors into
// canonical HttpError values.

import { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "./errors.ts";

interface PgErrorLike {
  code?: string;
  message?: string;
  details?: string | null;
}

const NOT_FOUND_MESSAGES = new Set<string>([
  "patient_not_found",
  "visit_not_found",
  "lesion_not_found",
  "report_not_found",
]);

export function mapPgError(err: PgErrorLike): never {
  const code = err.code ?? "";
  const msg = err.message ?? "";

  // PostgREST "no rows" code — treat as not_found at the route layer.
  if (code === "PGRST116") {
    throw new HttpError("not_found", "Resource not found");
  }

  // RLS / privilege-denied (column or row).
  if (code === "42501") {
    // The trigger raises 42501 explicitly when the caller is not a doctor;
    // any other 42501 (column grant, RLS WITH CHECK) is also a forbidden.
    throw new HttpError("forbidden", "Operation not permitted", {
      pg_code: code,
      pg_message: msg,
    });
  }

  // Unique violation.
  if (code === "23505") {
    throw new HttpError("conflict", "Unique constraint violation", {
      pg_code: code,
    });
  }

  // FK violation (parent absent).
  if (code === "23503") {
    throw new HttpError("not_found", "Referenced resource not found", {
      pg_code: code,
    });
  }

  // Check / type errors when safe to surface as validation.
  if (code === "23514" || code === "22P02" || code === "22023") {
    throw new HttpError("validation_error", "Invalid value", {
      pg_code: code,
    });
  }

  // Trigger-raised P0001: distinguish "*_not_found" parents from conflicts.
  if (code === "P0001") {
    // The trigger sets `message` to the SQLSTATE-attached condition_name; we
    // detect the not-found family explicitly so RLS-hidden parents return 404.
    for (const tag of NOT_FOUND_MESSAGES) {
      if (msg.includes(tag)) {
        throw new HttpError("not_found", "Parent resource not found", {
          pg_code: code,
        });
      }
    }
    if (msg.includes("stage1c_doctor_role_required")) {
      throw new HttpError("forbidden", "Doctor role required", {
        pg_code: code,
      });
    }
    throw new HttpError("conflict", msg || "Conflict", { pg_code: code });
  }

  throw new HttpError("internal_error", msg || "Database error", {
    pg_code: code,
  });
}

export async function insertRow(
  client: SupabaseClient,
  table: string,
  values: Record<string, unknown>,
  selectCols: string,
): Promise<Record<string, unknown>> {
  const res = await client.from(table).insert(values).select(selectCols).single();
  if (res.error) mapPgError(res.error);
  return expectRecordRow(res.data);
}

export async function updateRow(
  client: SupabaseClient,
  table: string,
  id: string,
  values: Record<string, unknown>,
  selectCols: string,
): Promise<Record<string, unknown>> {
  if (Object.keys(values).length === 0) {
    throw new HttpError("validation_error", "No updatable fields", {});
  }
  const res = await client
    .from(table)
    .update(values)
    .eq("id", id)
    .select(selectCols)
    .single();
  if (res.error) mapPgError(res.error);
  return expectRecordRow(res.data);
}

function expectRecordRow(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new HttpError("internal_error", "Expected database row");
  }
  return data as Record<string, unknown>;
}
