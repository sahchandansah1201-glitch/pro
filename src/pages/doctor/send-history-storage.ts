/**
 * Persistent local-only history of "send to patient (demo)" attempts.
 *
 * Storage: localStorage, keyed by visit + lesion. No PHI guarantees beyond
 * what the doctor types into "Текст для пациента" (already validated/normalized).
 * Survives page reload, never leaves the browser.
 */

export type SendStatus = "idle" | "sending" | "sent" | "failed";

export interface SendRecord {
  status: SendStatus;
  at: string; // ISO datetime (demo NOW)
  patientTextPreview: string;
  reason?: string;
}

const STORAGE_PREFIX = "derm-pro:report-send-log:v1";
export const SEND_HISTORY_MAX = 20;

function storageKey(visitId: string, lesionId: string | null): string {
  return `${STORAGE_PREFIX}:${visitId}:${lesionId ?? "_none"}`;
}

function safeStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function isSendStatus(v: unknown): v is SendStatus {
  return v === "idle" || v === "sending" || v === "sent" || v === "failed";
}

function isSendRecord(v: unknown): v is SendRecord {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    isSendStatus(r.status) &&
    typeof r.at === "string" &&
    typeof r.patientTextPreview === "string" &&
    (r.reason === undefined || typeof r.reason === "string")
  );
}

export function loadSendHistory(
  visitId: string,
  lesionId: string | null,
): SendRecord[] {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(storageKey(visitId, lesionId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSendRecord).slice(0, SEND_HISTORY_MAX);
  } catch {
    return [];
  }
}

export function saveSendHistory(
  visitId: string,
  lesionId: string | null,
  records: SendRecord[],
): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    const trimmed = records.slice(0, SEND_HISTORY_MAX);
    storage.setItem(storageKey(visitId, lesionId), JSON.stringify(trimmed));
  } catch {
    // ignore quota / serialization errors
  }
}

export function appendSendHistory(
  visitId: string,
  lesionId: string | null,
  record: SendRecord,
): SendRecord[] {
  const next = [record, ...loadSendHistory(visitId, lesionId)].slice(
    0,
    SEND_HISTORY_MAX,
  );
  saveSendHistory(visitId, lesionId, next);
  return next;
}

export function clearSendHistory(
  visitId: string,
  lesionId: string | null,
): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey(visitId, lesionId));
  } catch {
    // ignore
  }
}
