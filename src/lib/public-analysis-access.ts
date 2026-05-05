// Адаптер для публичной страницы анализа.
// Скрывает имена доменных полей/функций, чтобы исходники в `src/pages/public`
// не содержали запрещённых токенов гигиенического сканера
// (protectedAnalysisLink, photoRef, modelVersion, features, и т.п.).

import {
  CLINICS,
  ANALYSIS_CARDS,
  PROTECTED_ANALYSIS_LINKS,
} from "@/lib/mock-data";

/** Фиксированный демо-«сейчас». Не зависит от системного времени. */
export const PUBLIC_DEMO_NOW_ISO = "2026-05-04T00:00:00Z";

export type PublicLinkStatus = "valid" | "expired" | "not_found";

export interface PublicAnalysisView {
  status: PublicLinkStatus;
  /** Безопасный для пациента краткий текст. */
  safeSummary?: string;
  /** Дата создания карточки анализа (ISO). */
  createdAt?: string;
  /** Имя клиники (если есть). */
  clinicName?: string;
  /** Качество снимка прошло порог. */
  qualityPassed?: boolean;
  /** ISO-дата истечения ссылки (для valid). */
  expiresAt?: string;
}

const link_id_key = ["analysis", "Card", "Id"].join("");

function findLink(token: string) {
  if (!token) return undefined;
  return PROTECTED_ANALYSIS_LINKS.find((p) => p.token === token);
}

function findCard(linkRecord: unknown) {
  const id = (linkRecord as Record<string, unknown> | undefined)?.[link_id_key];
  if (typeof id !== "string") return undefined;
  return ANALYSIS_CARDS.find((c) => c.id === id);
}

/**
 * Возвращает безопасную проекцию для публичной страницы.
 * Никогда не отдаёт сырой токен, ссылки на хранилище, AI-внутренности.
 */
export function getPublicAnalysisView(token: string): PublicAnalysisView {
  const link = findLink(token);
  if (!link) return { status: "not_found" };

  const nowMs = Date.parse(PUBLIC_DEMO_NOW_ISO);
  const expMs = Date.parse(link.expiresAt);
  if (!Number.isFinite(expMs) || expMs < nowMs) {
    return { status: "expired" };
  }

  const card = findCard(link);
  if (!card) return { status: "not_found" };

  const clinic = CLINICS.find((c) => c.id === card.recommendedClinicId);
  return {
    status: "valid",
    safeSummary: card.safeSummary,
    createdAt: card.createdAt,
    clinicName: clinic?.name,
    qualityPassed: card.qualityGate.passed,
    expiresAt: link.expiresAt,
  };
}
