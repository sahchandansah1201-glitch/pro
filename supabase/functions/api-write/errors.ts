// Stage 1C · Canonical error envelope (write surface).
import { corsHeaders } from "./cors.ts";

export type ErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "validation_error"
  | "conflict"
  | "internal_error";

export interface ApiError {
  error: {
    code: ErrorCode;
    message: string;
    details: Record<string, unknown>;
    correlationId: string;
  };
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  validation_error: 422,
  conflict: 409,
  internal_error: 500,
};

export class HttpError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  correlationId: string,
  details: Record<string, unknown> = {},
): Response {
  const body: ApiError = {
    error: { code, message, details, correlationId },
  };
  return new Response(JSON.stringify(body), {
    status: STATUS_BY_CODE[code],
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      "x-correlation-id": correlationId,
    },
  });
}

export function jsonResponse(
  status: number,
  body: unknown,
  correlationId: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
      "x-correlation-id": correlationId,
    },
  });
}
