// Stage 4G · Live banner that surfaces self-hosted backend visit data.
// Renders read-only counts/status so doctors can confirm the live source.
// In demo mode (no self-hosted token) the banner stays hidden.

import { useEffect, useState } from "react";

import {
  getSelfHostedVisit,
  listSelfHostedVisitAssets,
  listSelfHostedVisitLesions,
  type SelfHostedVisitAssetDTO,
  type SelfHostedVisitDetailDTO,
  type SelfHostedVisitLesionDTO,
} from "@/lib/self-hosted-visit-api";
import {
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";

interface VisitWorkspaceLiveBannerProps {
  visitId: string | undefined;
}

type LoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | {
      kind: "ready";
      visit: SelfHostedVisitDetailDTO;
      lesions: SelfHostedVisitLesionDTO[];
      assets: SelfHostedVisitAssetDTO[];
    }
  | { kind: "error"; code: string; message: string };

export function VisitWorkspaceLiveBanner({ visitId }: VisitWorkspaceLiveBannerProps) {
  const session = useSelfHostedApiSession();
  const [state, setState] = useState<LoadState>({ kind: "idle" });

  useEffect(() => {
    if (!visitId || !isSelfHostedApiConfigured(session)) {
      setState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    void (async () => {
      const [visit, lesions, assets] = await Promise.all([
        getSelfHostedVisit({
          apiBaseUrl: session.apiBaseUrl,
          apiToken: session.apiToken,
          visitId,
        }),
        listSelfHostedVisitLesions({
          apiBaseUrl: session.apiBaseUrl,
          apiToken: session.apiToken,
          visitId,
        }),
        listSelfHostedVisitAssets({
          apiBaseUrl: session.apiBaseUrl,
          apiToken: session.apiToken,
          visitId,
        }),
      ]);
      if (cancelled) return;
      if (!visit.ok || !visit.value) {
        setState({
          kind: "error",
          code: visit.error?.code ?? "unknown",
          message: visit.error?.message ?? "Не удалось загрузить визит",
        });
        return;
      }
      setState({
        kind: "ready",
        visit: visit.value,
        lesions: lesions.value ?? [],
        assets: assets.value ?? [],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [
    session.apiBaseUrl,
    session.apiToken,
    session.status,
    visitId,
  ]);

  if (!isSelfHostedApiConfigured(session)) {
    return (
      <div
        role="status"
        data-testid="visit-workspace-live-banner"
        data-mode="demo"
        className="border-b border-border bg-muted/40 px-4 py-2 text-[12px] text-muted-foreground"
      >
        Демо-режим: визит читается из демонстрационных данных. Войдите в систему клиники, чтобы видеть рабочие данные.
      </div>
    );
  }

  if (state.kind === "loading" || state.kind === "idle") {
    return (
      <div
        role="status"
        data-testid="visit-workspace-live-banner"
        data-mode="loading"
        className="border-b border-border bg-surface px-4 py-2 text-[12px] text-muted-foreground"
      >
        Система клиники подключена. Загружаем визит…
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div
        role="alert"
        data-testid="visit-workspace-live-banner"
        data-mode="error"
        className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-[12px] text-destructive"
      >
        Система клиники вернула ошибку: {state.code}. {state.message}
      </div>
    );
  }

  return (
    <div
      role="status"
      data-testid="visit-workspace-live-banner"
      data-mode="live"
      className="border-b border-border bg-surface px-4 py-2 text-[12px] text-foreground"
    >
      <span className="mr-3 font-medium">Система клиники</span>
      <span className="mr-3 text-muted-foreground">
        Визит открыт · статус {visitStatusLabel(state.visit.status)}
      </span>
      <span className="mr-3 text-muted-foreground">
        Очаги: {state.lesions.length}
      </span>
      <span className="text-muted-foreground">
        Снимки: {state.assets.length}
      </span>
    </div>
  );
}

function visitStatusLabel(status: string): string {
  if (status === "draft") return "черновик";
  if (status === "in_progress") return "в работе";
  if (status === "signed") return "подписан";
  if (status === "cancelled") return "отменён";
  return "статус уточняется";
}
