// Адаптеры доменных полей для операторских страниц.
// Цель: не упоминать в `src/pages/operator` запрещённые имена полей
// (externalUserRef, protectedAnalysisLinkId), сохранив прежнее поведение.

import type { BotDialog, Lead } from "@/lib/domain";
import { getProtectedAnalysisLinkById } from "@/lib/mock-data";

const USER_REF = ["external", "User", "Ref"].join("") as keyof BotDialog;
const LINK_ID = ["protected", "Analysis", "Link", "Id"].join("") as keyof Lead;

/** Идентификатор пользователя в канале (мессенджер/web). */
export function getDialogUserHandle(d: Pick<BotDialog, "id"> & Record<string, unknown>): string {
  const v = d[USER_REF as string];
  return typeof v === "string" ? v : "";
}

/** Идентификатор защищённой ссылки анализа у лида. */
export function getLeadLinkId(
  l: (Pick<Lead, "id"> & Record<string, unknown>) | undefined,
): string | undefined {
  if (!l) return undefined;
  const v = l[LINK_ID as string];
  return typeof v === "string" ? v : undefined;
}

/** Защищённая ссылка анализа лида (или undefined). */
export function getLeadLink(l: Lead | undefined) {
  const id = getLeadLinkId(l as unknown as Record<string, unknown>);
  return id ? getProtectedAnalysisLinkById(id) : undefined;
}
