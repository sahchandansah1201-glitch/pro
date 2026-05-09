// Stage 1E-C · Doctor/private_doctor asset upload.
//
// POST /doctor/visits/:visitId/assets/upload
//
// Accepts multipart/form-data:
//   - file (image/*) REQUIRED
//   - kind, source, capturedAt, qualityScore  REQUIRED metadata
//   - lesionId, deviceId, qualityIssues (JSON array), exif (JSON object) OPTIONAL
//
// The function uses ONLY the per-request caller-JWT Supabase client provided by
// `auth.ts`. There is no service role here. Storage RLS (Stage 1E-A) enforces
// that the upload path begins with `clinic/{clinic_id}/visit/{visit_id}/`.
//
// The storage object path is generated server-side: clients cannot supply it.
// The response DTO never returns the raw storage path or EXIF.

import { CallerContext } from "./auth.ts";
import { HttpError } from "./errors.ts";
import { assertUuid } from "./validators.ts";
import { ASSET_COLS, toAssetDTO } from "./projections.ts";
import { mapPgError } from "./db.ts";
import { recordWrite } from "./audit.ts";

const ASSET_KIND = ["overview", "dermoscopy", "macro", "body_map"] as const;
const ASSET_SOURCE = [
  "phone", "file", "camera", "device_bridge", "local_transfer",
] as const;

// Mapping of accepted image MIME types → file extension used in storage path.
// Anything outside this allow-list is rejected as 422 validation_error.
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/bmp": "bmp",
  "image/tiff": "tiff",
};

export function extForMime(mime: string): string | undefined {
  return EXT_BY_MIME[mime.toLowerCase()];
}

const ALLOWED_FORM_KEYS = new Set([
  "file",
  "kind",
  "source",
  "capturedAt",
  "qualityScore",
  "lesionId",
  "deviceId",
  "qualityIssues",
  "exif",
]);

// Anything in this set is server-controlled and must never be accepted in the
// multipart body — including any client-supplied storage path.
const FORBIDDEN_FORM_KEYS = new Set([
  "id",
  "clinicId",
  "clinic_id",
  "createdAt",
  "created_at",
  "createdBy",
  "created_by",
  "visitId",
  "visit_id",
  "storageObjectPath",
  "storage_object_path",
  "path",
]);

function mustEnum<T extends string>(
  v: string | undefined,
  key: string,
  vals: readonly T[],
): T {
  if (v === undefined) {
    throw new HttpError("validation_error", `Missing ${key}`, { field: key });
  }
  if (!(vals as readonly string[]).includes(v)) {
    throw new HttpError(
      "validation_error",
      `${key} must be one of ${vals.join("|")}`,
      { field: key, allowed: vals },
    );
  }
  return v as T;
}

function mustString(v: string | undefined, key: string): string {
  if (v === undefined || v === "") {
    throw new HttpError("validation_error", `Missing ${key}`, { field: key });
  }
  return v;
}

function mustNumber(
  v: string | undefined,
  key: string,
  min: number,
  max: number,
): number {
  if (v === undefined || v === "") {
    throw new HttpError("validation_error", `Missing ${key}`, { field: key });
  }
  const n = Number(v);
  if (!Number.isFinite(n)) {
    throw new HttpError("validation_error", `${key} must be a number`, {
      field: key,
    });
  }
  if (n < min || n > max) {
    throw new HttpError("validation_error", `${key} out of range`, {
      field: key,
    });
  }
  return n;
}

function mustTimestamp(v: string | undefined, key: string): string {
  const s = mustString(v, key);
  if (Number.isNaN(Date.parse(s))) {
    throw new HttpError(
      "validation_error",
      `${key} must be an ISO timestamp`,
      { field: key },
    );
  }
  return s;
}

export function parseJsonField(
  v: string | undefined,
  key: string,
  shape: "array" | "object",
): unknown {
  if (v === undefined || v === "") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(v);
  } catch {
    throw new HttpError("validation_error", `${key} must be JSON`, {
      field: key,
    });
  }
  if (shape === "array") {
    if (!Array.isArray(parsed) || parsed.some((x) => typeof x !== "string")) {
      throw new HttpError(
        "validation_error",
        `${key} must be a JSON array of strings`,
        { field: key },
      );
    }
  } else {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new HttpError(
        "validation_error",
        `${key} must be a JSON object`,
        { field: key },
      );
    }
  }
  return parsed;
}

export interface UploadResult {
  status: number;
  data: unknown;
}

export async function handleAssetUpload(
  ctx: CallerContext,
  visitIdRaw: string,
  req: Request,
  correlationId: string,
): Promise<UploadResult> {
  const visitId = assertUuid(visitIdRaw, "visitId");

  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  if (!ct.startsWith("multipart/form-data")) {
    throw new HttpError(
      "validation_error",
      "Content-Type must be multipart/form-data",
      { reason: "expected_multipart" },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError("validation_error", "Malformed multipart body", {
      reason: "multipart_parse_failed",
    });
  }

  // Reject server-controlled / unknown keys early.
  const seen = new Set<string>();
  for (const k of form.keys()) {
    if (seen.has(k)) continue;
    seen.add(k);
    if (FORBIDDEN_FORM_KEYS.has(k)) {
      throw new HttpError(
        "validation_error",
        `Field "${k}" is not allowed (server-controlled)`,
        { field: k, reason: "server_controlled" },
      );
    }
    if (!ALLOWED_FORM_KEYS.has(k)) {
      throw new HttpError(
        "validation_error",
        `Unknown field "${k}"`,
        { field: k, reason: "unknown_key" },
      );
    }
  }

  const fileEntry = form.get("file");
  if (!(fileEntry instanceof File)) {
    throw new HttpError("validation_error", "Missing file field", {
      field: "file",
      reason: "required",
    });
  }
  const file = fileEntry;
  if (file.size === 0) {
    throw new HttpError("validation_error", "Empty file", {
      field: "file",
      reason: "empty",
    });
  }

  const contentType = (file.type || "").toLowerCase();
  if (!contentType.startsWith("image/")) {
    throw new HttpError(
      "validation_error",
      "Only image/* uploads are accepted",
      { field: "file", reason: "unsupported_content_type", contentType },
    );
  }
  const ext = extForMime(contentType);
  if (!ext) {
    throw new HttpError(
      "validation_error",
      `Unsupported image content type: ${contentType}`,
      { field: "file", reason: "unsupported_content_type" },
    );
  }

  const getStr = (k: string): string | undefined => {
    const v = form.get(k);
    if (v === null) return undefined;
    if (typeof v !== "string") {
      throw new HttpError("validation_error", `${k} must be a string`, {
        field: k,
      });
    }
    return v;
  };

  const kind = mustEnum(getStr("kind"), "kind", ASSET_KIND);
  const source = mustEnum(getStr("source"), "source", ASSET_SOURCE);
  const capturedAt = mustTimestamp(getStr("capturedAt"), "capturedAt");
  const qualityScore = mustNumber(getStr("qualityScore"), "qualityScore", 0, 1);

  const lesionIdRaw = getStr("lesionId");
  const lesionId = lesionIdRaw ? assertUuid(lesionIdRaw, "lesionId") : null;
  const deviceIdRaw = getStr("deviceId");
  const deviceId = deviceIdRaw ? assertUuid(deviceIdRaw, "deviceId") : null;
  const qualityIssues = parseJsonField(
    getStr("qualityIssues"),
    "qualityIssues",
    "array",
  ) as string[] | undefined;
  const exif = parseJsonField(getStr("exif"), "exif", "object") as
    | Record<string, unknown>
    | undefined;

  // Resolve clinic_id via RLS-bound client. RLS-hidden visit → 404.
  const visitLookup = await ctx.client
    .from("visits")
    .select("clinic_id")
    .eq("id", visitId)
    .maybeSingle();
  if (visitLookup.error) {
    mapPgError(visitLookup.error);
  }
  if (!visitLookup.data) {
    throw new HttpError("not_found", "Visit not found");
  }
  const clinicId = String(
    (visitLookup.data as { clinic_id: string }).clinic_id,
  );

  const assetId = crypto.randomUUID();
  const objectPath =
    `clinic/${clinicId}/visit/${visitId}/${assetId}.${ext}`;

  // Upload to private bucket. Storage RLS additionally enforces caller is a
  // doctor/private_doctor of `clinicId` and that the path is under the visit.
  const uploadRes = await ctx.client.storage
    .from("clinical-assets")
    .upload(objectPath, file, {
      upsert: false,
      contentType,
    });

  if (uploadRes.error) {
    const sErr = uploadRes.error as {
      message?: string;
      statusCode?: string | number;
    };
    const sc = String(sErr.statusCode ?? "");
    const msg = sErr.message ?? "";
    if (sc === "409" || /exists|duplicate/i.test(msg)) {
      throw new HttpError("conflict", "Storage object already exists", {
        storage_status: sc,
      });
    }
    if (sc === "403" || /not authorized|permission|denied/i.test(msg)) {
      throw new HttpError("forbidden", "Storage upload denied", {
        storage_status: sc,
      });
    }
    throw new HttpError("internal_error", "Storage upload failed", {
      storage_status: sc,
      storage_message: msg,
    });
  }

  // Insert metadata row. If this fails, best-effort delete the just-uploaded
  // object to avoid orphaning storage. We do NOT expose a public delete API.
  const insertCols: Record<string, unknown> = {
    id: assetId,
    visit_id: visitId,
    kind,
    source,
    storage_object_path: objectPath,
    captured_at: capturedAt,
    quality_score: qualityScore,
  };
  if (lesionId !== null) insertCols.lesion_id = lesionId;
  if (deviceId !== null) insertCols.device_id = deviceId;
  if (qualityIssues !== undefined) insertCols.quality_issues = qualityIssues;
  if (exif !== undefined) insertCols.exif = exif;

  let row: Record<string, unknown>;
  try {
    const ins = await ctx.client
      .from("assets")
      .insert(insertCols)
      .select(ASSET_COLS)
      .single();
    if (ins.error) mapPgError(ins.error);
    row = ins.data as Record<string, unknown>;
  } catch (err) {
    try {
      await ctx.client.storage
        .from("clinical-assets")
        .remove([objectPath]);
    } catch {
      // Cleanup is best-effort; the orphan is recoverable out-of-band.
    }
    throw err;
  }

  // Audit log: safe top-level keys only. Storage path is intentionally NOT in
  // changedFields or parentIds.
  const changedFields: string[] = [
    "kind",
    "source",
    "capturedAt",
    "qualityScore",
  ];
  if (lesionId !== null) changedFields.push("lesionId");
  if (deviceId !== null) changedFields.push("deviceId");
  if (qualityIssues !== undefined) changedFields.push("qualityIssues");

  await recordWrite(ctx.client, ctx, {
    clinicId,
    action: "create",
    entity: "asset",
    entityId: assetId,
    correlationId,
    route: "POST /doctor/visits/:visitId/assets/upload",
    changedFields,
    parentIds: {
      visitId,
      lesionId: lesionId ?? undefined,
    },
  });

  return { status: 201, data: toAssetDTO(row) };
}
