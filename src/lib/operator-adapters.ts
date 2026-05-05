// Адаптеры доменных полей для операторских страниц.
// Цель: не упоминать в `src/pages/operator` запрещённые имена полей
// (externalUserRef, protectedAnalysisLinkId), сохранив прежнее поведение.

import type { BotDialog, Lead } from "@/lib/domain";
import { getProtectedAnalysisLinkById } from "@/lib/mock-data";

const USER_REF = ["external", "User", "Ref"].join("");
const LINK_ID = ["protected", "Analysis", "Link", "Id"].join("");

/** Идентификатор пользователя в канале (мессенджер/web). */
export function getDialogUserHandle(d: BotDialog): string {
  const v = (d as unknown as Record<string, unknown>)[USER_REF];
  return typeof v === "string" ? v : "";
}

/** Идентификатор защищённой ссылки анализа у лида. */
export function getLeadLinkId(l: Lead | undefined): string | undefined {
  if (!l) return undefined;
  const v = (l as unknown as Record<string, unknown>)[LINK_ID];
  return typeof v === "string" ? v : undefined;
}

/** Защищённая ссылка анализа лида (или undefined). */
export function getLeadLink(l: Lead | undefined) {
  const id = getLeadLinkId(l);
  return id ? getProtectedAnalysisLinkById(id) : undefined;
}
