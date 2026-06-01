import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  KeyRound,
  ListChecks,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  executeSelfHostedPatientPhotoProtocolGovernanceBlockMissingExpiry,
  executeSelfHostedPatientPhotoProtocolGovernanceBlockUnapprovedRetention,
  executeSelfHostedPatientPhotoProtocolGovernanceRevokeExpired,
  getSelfHostedPatientPhotoProtocolReleaseGovernance,
  type SelfHostedPatientPhotoProtocolGovernanceOperationResultDTO,
  type SelfHostedPatientPhotoProtocolReleaseGovernanceDTO,
  type SelfHostedPatientPhotoProtocolReleaseGovernanceQueueRow,
} from "@/lib/self-hosted-clinical-report-package-api";
import {
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";

type LoadStatus = "demo" | "loading" | "ready" | "error";

const DEMO_GOVERNANCE: SelfHostedPatientPhotoProtocolReleaseGovernanceDTO = {
  summary: {
    releasesTotal: 12,
    prepared: 5,
    blocked: 4,
    revoked: 3,
    retentionMissing: 4,
    patientCopyMissing: 3,
    fileProxyMissing: 2,
    expiryMissing: 4,
    activeAccessWindows: 5,
    expiringIn24h: 2,
  },
  queue: [
    {
      queueNumber: 1,
      status: "prepared",
      policyStatus: "retention_required",
      selectedPhotoCount: 4,
      blockerCount: 1,
      expiresAt: "2026-06-01T10:00:00.000Z",
      updatedAt: "2026-05-31T10:00:00.000Z",
      patientFileProxyEnabled: true,
      patientCopyApproved: true,
      retentionPolicyApproved: false,
      attention: ["retention_required", "expires_soon"],
    },
    {
      queueNumber: 2,
      status: "prepared",
      policyStatus: "patient_copy_required",
      selectedPhotoCount: 3,
      blockerCount: 1,
      expiresAt: "2026-06-04T12:00:00.000Z",
      updatedAt: "2026-05-31T09:20:00.000Z",
      patientFileProxyEnabled: true,
      patientCopyApproved: false,
      retentionPolicyApproved: true,
      attention: ["patient_copy_required"],
    },
    {
      queueNumber: 3,
      status: "blocked",
      policyStatus: "blocked",
      selectedPhotoCount: 0,
      blockerCount: 3,
      expiresAt: null,
      updatedAt: "2026-05-31T08:40:00.000Z",
      patientFileProxyEnabled: false,
      patientCopyApproved: false,
      retentionPolicyApproved: false,
      attention: ["blocked_release", "file_proxy_required", "expiry_required"],
    },
  ],
  boundaries: {
    metadataOnly: true,
    patientNamesExposed: false,
    rawIdentifiersExposed: false,
    rawTokensExposed: false,
    rawFilesExposed: false,
    storagePathsExposed: false,
    signedUrlsIssued: false,
    doctorOnlyTextExposed: false,
    rawPolicyPayloadExposed: false,
  },
  operations: {
    retention: {
      reviewDue: 4,
      ready: 1,
      blocked: 4,
      requiresClinicSignoff: true,
      nextAction: "review_retention_policy",
    },
    revokeReadiness: {
      activeWindows: 5,
      expiringIn24h: 2,
      revoked: 3,
      canPrepareRevokeReview: 5,
      requiresManualReason: true,
      revokeReasonExposed: false,
    },
    sessionLifecycle: {
      active: 5,
      expiringIn24h: 2,
      missingExpiry: 4,
      revoked: 3,
      temporaryCredentialsExposed: false,
      qrTokensExposed: false,
      sessionIdsExposed: false,
    },
    allowedOperations: [
      "review_retention_policy",
      "review_patient_copy",
      "prepare_revoke_review",
      "inspect_session_lifecycle",
    ],
    blockedOperations: [
      "block_secret_issue",
      "block_external_link_issue",
      "block_file_location_exposure",
      "block_patient_identity_view",
      "block_clinical_text_view",
      "direct_patient_delivery",
    ],
  },
};

const POLICY_LABEL: Record<string, string> = {
  ready_for_access_window: "Окно доступа готово",
  retention_required: "Нужно хранение",
  patient_copy_required: "Нужна копия",
  file_proxy_required: "Нужен file proxy",
  blocked: "Заблокировано",
  revoked: "Отозвано",
};

const ATTENTION_LABEL: Record<string, string> = {
  retention_required: "retention",
  patient_copy_required: "копия",
  file_proxy_required: "file proxy",
  expiry_required: "срок",
  expires_soon: "истекает",
  blocked_release: "блокер",
  revoked_release: "отзыв",
};

const STATUS_TONE: Record<string, string> = {
  ready_for_access_window: "border-success/40 bg-success/10 text-success",
  retention_required: "border-warning/40 bg-warning/10 text-warning",
  patient_copy_required: "border-warning/40 bg-warning/10 text-warning",
  file_proxy_required: "border-warning/40 bg-warning/10 text-warning",
  blocked: "border-destructive/40 bg-destructive/10 text-destructive",
  revoked: "border-muted bg-muted/60 text-muted-foreground",
};

function formatDateTime(value: string | null): string {
  if (!value) return "не задан";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "не задан";
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="min-w-0 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

function Metric({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof ShieldCheck;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      </div>
      <div className="mt-1 text-[22px] font-semibold leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function PolicyBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] ${STATUS_TONE[status] ?? STATUS_TONE.blocked}`}>
      {POLICY_LABEL[status] ?? status}
    </span>
  );
}

function QueueRow({ item, onReview }: { item: SelfHostedPatientPhotoProtocolReleaseGovernanceQueueRow; onReview: () => void }) {
  return (
    <div className="grid gap-2 rounded-md border p-3 md:grid-cols-[64px_minmax(0,1fr)_120px_130px_150px] md:items-center">
      <div className="text-[12px] font-semibold tabular-nums">#{item.queueNumber}</div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <PolicyBadge status={item.policyStatus} />
          <Badge variant="outline" className="text-[10px]">Фото: {item.selectedPhotoCount}</Badge>
          <Badge variant="outline" className="text-[10px]">Блокеры: {item.blockerCount}</Badge>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {item.attention.map((attention) => (
            <span key={attention} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {ATTENTION_LABEL[attention] ?? attention}
            </span>
          ))}
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground">
        Срок<br />
        <span className="text-foreground">{formatDateTime(item.expiresAt)}</span>
      </div>
      <div className="text-[11px] text-muted-foreground">
        Обновлено<br />
        <span className="text-foreground">{formatDateTime(item.updatedAt)}</span>
      </div>
      <Button variant="outline" className="min-h-[44px] justify-center sm:min-h-[36px]" onClick={onReview}>
        Зафиксировать разбор
      </Button>
    </div>
  );
}

function BoundaryList({ governance }: { governance: SelfHostedPatientPhotoProtocolReleaseGovernanceDTO }) {
  const items = [
    ["Metadata-only", governance.boundaries.metadataOnly],
    ["Имена пациентов скрыты", !governance.boundaries.patientNamesExposed],
    ["Raw ID скрыты", !governance.boundaries.rawIdentifiersExposed],
    ["Токены скрыты", !governance.boundaries.rawTokensExposed],
    ["Файлы скрыты", !governance.boundaries.rawFilesExposed],
    ["Врачебный текст скрыт", !governance.boundaries.doctorOnlyTextExposed],
  ] as const;
  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, ok]) => (
        <div key={label} className="flex min-h-[44px] items-center gap-2 rounded-md border px-3 py-2 text-[12px]">
          {ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden />
          )}
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}

function OperationLine({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warning" | "success";
}) {
  const toneClass = tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-foreground";
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold tabular-nums ${toneClass}`}>{value}</span>
    </div>
  );
}

function GovernanceOperations({
  governance,
  operationResult,
  missingExpiryOperationBusy,
  retentionOperationBusy,
  revokeOperationBusy,
  onRetentionReview,
  onBlockMissingExpiry,
  onBlockUnapprovedRetention,
  onRevokeReview,
}: {
  governance: SelfHostedPatientPhotoProtocolReleaseGovernanceDTO;
  operationResult: SelfHostedPatientPhotoProtocolGovernanceOperationResultDTO | null;
  missingExpiryOperationBusy: boolean;
  retentionOperationBusy: boolean;
  revokeOperationBusy: boolean;
  onRetentionReview: () => void;
  onBlockMissingExpiry: () => void;
  onBlockUnapprovedRetention: () => void;
  onRevokeReview: () => void;
}) {
  const { retention, revokeReadiness, sessionLifecycle } = governance.operations;
  return (
    <SectionCard title="Операционный контур" hint="Batch AF · production-safe хранение, отзыв, сессии">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="grid gap-2 rounded-md border p-3">
          <div className="flex items-center gap-2 text-[12px] font-semibold">
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            Разбор хранения
          </div>
          <OperationLine label="Требуют разбора" value={retention.reviewDue} tone={retention.reviewDue > 0 ? "warning" : "success"} />
          <OperationLine label="Готовы по хранению" value={retention.ready} tone="success" />
          <OperationLine label="Блокированы" value={retention.blocked} />
          <Button variant="outline" className="mt-1 min-h-[44px] justify-center sm:min-h-[36px]" onClick={onRetentionReview}>
            Подготовить разбор хранения
          </Button>
          <Button
            variant="outline"
            className="min-h-[44px] justify-center sm:min-h-[36px]"
            onClick={onBlockUnapprovedRetention}
            disabled={retentionOperationBusy}
          >
            {retentionOperationBusy ? "Блокируем окна..." : "Заблокировать без политики"}
          </Button>
        </div>

        <div className="grid gap-2 rounded-md border p-3">
          <div className="flex items-center gap-2 text-[12px] font-semibold">
            <LockKeyhole className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            Отзыв доступа
          </div>
          <OperationLine label="Окна доступа" value={revokeReadiness.activeWindows} />
          <OperationLine label="Истекают за 24ч" value={revokeReadiness.expiringIn24h} tone={revokeReadiness.expiringIn24h > 0 ? "warning" : "default"} />
          <OperationLine label="Причина отзыва" value={revokeReadiness.revokeReasonExposed ? "видна" : "скрыта"} tone="success" />
          <Button
            variant="outline"
            className="mt-1 min-h-[44px] justify-center sm:min-h-[36px]"
            onClick={onRevokeReview}
            disabled={revokeOperationBusy}
          >
            {revokeOperationBusy ? "Отзываем окна..." : "Отозвать истёкшие окна"}
          </Button>
        </div>

        <div className="grid gap-2 rounded-md border p-3">
          <div className="flex items-center gap-2 text-[12px] font-semibold">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            Жизненный цикл сессий
          </div>
          <OperationLine label="Активные" value={sessionLifecycle.active} />
          <OperationLine label="Без срока" value={sessionLifecycle.missingExpiry} tone={sessionLifecycle.missingExpiry > 0 ? "warning" : "success"} />
          <OperationLine label="QR/токены/ID" value="скрыты" tone="success" />
          <div className="text-[11px] text-muted-foreground">
            Разрешены только операционные проверки. Секреты доступа, внешние ссылки и файловые пути заблокированы контрактом.
          </div>
          <Button
            variant="outline"
            className="mt-1 min-h-[44px] justify-center sm:min-h-[36px]"
            onClick={onBlockMissingExpiry}
            disabled={missingExpiryOperationBusy}
          >
            {missingExpiryOperationBusy ? "Блокируем окна..." : "Заблокировать без срока"}
          </Button>
        </div>
      </div>
      {operationResult && (
        <div role="status" className="mt-3 rounded-md border px-3 py-2 text-[12px] text-muted-foreground">
          <div className="font-semibold text-foreground">Последняя backend-операция</div>
          <div className="mt-1 grid gap-1 sm:grid-cols-3">
            <span>Изменено: <b className="tabular-nums text-foreground">{operationResult.affectedCount}</b></span>
            <span>Активные пропущены: <b className="tabular-nums text-foreground">{operationResult.skippedActiveCount}</b></span>
            <span>Без срока: <b className="tabular-nums text-foreground">{operationResult.skippedMissingExpiryCount}</b></span>
          </div>
          <div className="mt-1">
            Только агрегаты: пациентские строки, причина отзыва, QR/токены, ID сессий и файловые пути не раскрывались.
          </div>
        </div>
      )}
    </SectionCard>
  );
}

export default function AdminGovernancePage() {
  const session = useSelfHostedApiSession();
  const configured = isSelfHostedApiConfigured(session);
  const [status, setStatus] = useState<LoadStatus>(() => (configured ? "loading" : "demo"));
  const [governance, setGovernance] = useState<SelfHostedPatientPhotoProtocolReleaseGovernanceDTO>(DEMO_GOVERNANCE);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [operationResult, setOperationResult] =
    useState<SelfHostedPatientPhotoProtocolGovernanceOperationResultDTO | null>(null);
  const [revokeOperationBusy, setRevokeOperationBusy] = useState(false);
  const [missingExpiryOperationBusy, setMissingExpiryOperationBusy] = useState(false);
  const [retentionOperationBusy, setRetentionOperationBusy] = useState(false);

  const loadGovernance = useCallback(async () => {
    if (!isSelfHostedApiConfigured(session)) {
      setStatus("demo");
      setGovernance(DEMO_GOVERNANCE);
      setError(null);
      return;
    }
    setStatus("loading");
    const result = await getSelfHostedPatientPhotoProtocolReleaseGovernance({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
    });
    if (!result.ok || !result.value) {
      setStatus("error");
      setGovernance(DEMO_GOVERNANCE);
      setError(result.error?.message ?? "Self-hosted backend не вернул контур управления доступом.");
      return;
    }
    setStatus("ready");
    setGovernance(result.value);
    setError(null);
  }, [session]);

  useEffect(() => {
    void loadGovernance();
  }, [loadGovernance]);

  const policyReady = useMemo(
    () => governance.queue.filter((item) => item.policyStatus === "ready_for_access_window").length,
    [governance.queue],
  );

  function recordReview(item: SelfHostedPatientPhotoProtocolReleaseGovernanceQueueRow) {
    setLastAction(`Разбор политики подготовлен локально: строка #${item.queueNumber}`);
  }

  function recordRetentionReview() {
    setLastAction("Разбор хранения подготовлен локально: без пациентских строк и без raw ID");
  }

  async function recordBlockUnapprovedRetention() {
    if (!configured) {
      setLastAction("Demo: окна без политики хранения заблокированы локально, patient access не расширялся");
      setOperationResult({
        operation: "block_unapproved_retention_windows",
        status: "no_op",
        affectedCount: 0,
        skippedActiveCount: governance.operations.revokeReadiness.activeWindows,
        expiringIn24hCount: governance.operations.revokeReadiness.expiringIn24h,
        skippedMissingExpiryCount: governance.operations.sessionLifecycle.missingExpiry,
        limit: 15,
        auditAction: "patient_photo_protocol.release_governance.block_unapproved_retention",
        boundaries: {
          metadataOnly: true,
          patientRowsExposed: false,
          rawIdentifiersExposed: false,
          revokeReasonExposed: false,
          temporaryCredentialsExposed: false,
          qrTokensExposed: false,
          sessionIdsExposed: false,
          storagePathsExposed: false,
          signedUrlsIssued: false,
          patientDeliveryAllowed: false,
        },
      });
      return;
    }
    setRetentionOperationBusy(true);
    const result = await executeSelfHostedPatientPhotoProtocolGovernanceBlockUnapprovedRetention({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: { confirm: true, limit: 15 },
    });
    setRetentionOperationBusy(false);
    if (!result.ok || !result.value) {
      setLastAction(result.error?.message ?? "Backend не заблокировал окна без политики хранения.");
      return;
    }
    setOperationResult(result.value);
    setLastAction(
      `Окна без политики хранения заблокированы: ${result.value.affectedCount} изменено, patient access не расширялся`,
    );
    await loadGovernance();
  }

  async function recordRevokeReview() {
    if (!configured) {
      setLastAction("Demo: отзыв истёкших окон подготовлен локально, причина остаётся скрытой");
      setOperationResult({
        operation: "revoke_expired_access_windows",
        status: "no_op",
        affectedCount: 0,
        skippedActiveCount: governance.operations.revokeReadiness.activeWindows,
        expiringIn24hCount: governance.operations.revokeReadiness.expiringIn24h,
        skippedMissingExpiryCount: governance.operations.sessionLifecycle.missingExpiry,
        limit: 50,
        auditAction: "patient_photo_protocol.release_governance.revoke_expired",
        boundaries: {
          metadataOnly: true,
          patientRowsExposed: false,
          rawIdentifiersExposed: false,
          revokeReasonExposed: false,
          temporaryCredentialsExposed: false,
          qrTokensExposed: false,
          sessionIdsExposed: false,
          storagePathsExposed: false,
          signedUrlsIssued: false,
          patientDeliveryAllowed: false,
        },
      });
      return;
    }
    setRevokeOperationBusy(true);
    const result = await executeSelfHostedPatientPhotoProtocolGovernanceRevokeExpired({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: { confirm: true, limit: 50 },
    });
    setRevokeOperationBusy(false);
    if (!result.ok || !result.value) {
      setLastAction(result.error?.message ?? "Backend не выполнил отзыв истёкших окон доступа.");
      return;
    }
    setOperationResult(result.value);
    setLastAction(
      `Отзыв истёкших окон выполнен: ${result.value.affectedCount} отозвано, причина и пациентские строки скрыты`,
    );
    await loadGovernance();
  }

  async function recordBlockMissingExpiry() {
    if (!configured) {
      setLastAction("Demo: окна без срока заблокированы локально, QR/токены/ID не раскрыты");
      setOperationResult({
        operation: "block_missing_expiry_access_windows",
        status: "no_op",
        affectedCount: 0,
        skippedActiveCount: governance.operations.sessionLifecycle.active,
        expiringIn24hCount: governance.operations.sessionLifecycle.expiringIn24h,
        skippedMissingExpiryCount: governance.operations.sessionLifecycle.missingExpiry,
        limit: 20,
        auditAction: "patient_photo_protocol.release_governance.block_missing_expiry",
        boundaries: {
          metadataOnly: true,
          patientRowsExposed: false,
          rawIdentifiersExposed: false,
          revokeReasonExposed: false,
          temporaryCredentialsExposed: false,
          qrTokensExposed: false,
          sessionIdsExposed: false,
          storagePathsExposed: false,
          signedUrlsIssued: false,
          patientDeliveryAllowed: false,
        },
      });
      return;
    }
    setMissingExpiryOperationBusy(true);
    const result = await executeSelfHostedPatientPhotoProtocolGovernanceBlockMissingExpiry({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: { confirm: true, limit: 20 },
    });
    setMissingExpiryOperationBusy(false);
    if (!result.ok || !result.value) {
      setLastAction(result.error?.message ?? "Backend не заблокировал окна без срока доступа.");
      return;
    }
    setOperationResult(result.value);
    setLastAction(
      `Окна без срока заблокированы: ${result.value.affectedCount} изменено, QR/токены/ID скрыты`,
    );
    await loadGovernance();
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Управление доступом"
        subtitle="Пациентская выдача фото-протокола: политики, сроки хранения и аудит."
      />
      <div className="space-y-3 p-3 sm:p-4">
        <section
          aria-label="Граница данных"
          className="rounded-md border px-3 py-3 text-[12px]"
          style={{
            background: "hsl(var(--success) / 0.08)",
            borderColor: "hsl(var(--success) / 0.30)",
            color: "hsl(var(--success))",
          }}
        >
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <div className="min-w-0">
              <div className="font-semibold">Только агрегаты</div>
              <p className="mt-0.5 text-[12px]">
                Без токенов, ссылок, фото, диагнозов и пациентских строк. Страница показывает только readiness,
                политики выдачи, сроки доступа и блокеры production.
              </p>
            </div>
          </div>
        </section>

        {status === "loading" && (
          <Card className="p-3 text-[12px] text-muted-foreground">Загружаем self-hosted governance…</Card>
        )}
        {status === "error" && (
          <Card className="p-3">
            <div role="alert" className="text-[12px] text-destructive">{error}</div>
            <Button variant="outline" className="mt-2 min-h-[44px] sm:min-h-[36px]" onClick={() => void loadGovernance()}>
              <RotateCcw className="mr-2 h-3.5 w-3.5" aria-hidden />
              Повторить
            </Button>
          </Card>
        )}
        {status === "demo" && (
          <Card className="p-3 text-[12px] text-muted-foreground">
            Self-hosted сессия не подключена. Показан demo-срез без сетевых действий и без пациентских данных.
          </Card>
        )}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={FileCheck2}
            label="Политики выдачи"
            value={policyReady}
            hint="готовы к окну доступа"
          />
          <Metric
            icon={Clock3}
            label="Сессии пациента"
            value={governance.summary.activeAccessWindows}
            hint={`${governance.summary.expiringIn24h} истекают за 24ч`}
          />
          <Metric
            icon={LockKeyhole}
            label="Хранение"
            value={governance.summary.retentionMissing}
            hint="требуют утверждения хранения"
          />
          <Metric
            icon={AlertTriangle}
            label="Блокеры"
            value={governance.summary.blocked}
            hint="не готовы к выдаче"
          />
        </div>

        <GovernanceOperations
          governance={governance}
          operationResult={operationResult}
          missingExpiryOperationBusy={missingExpiryOperationBusy}
          retentionOperationBusy={retentionOperationBusy}
          revokeOperationBusy={revokeOperationBusy}
          onRetentionReview={recordRetentionReview}
          onBlockMissingExpiry={() => void recordBlockMissingExpiry()}
          onBlockUnapprovedRetention={() => void recordBlockUnapprovedRetention()}
          onRevokeReview={() => void recordRevokeReview()}
        />

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <SectionCard title="Очередь утверждений" hint="metadata-only строки без пациентов и raw ID">
            <div className="space-y-2">
              {governance.queue.map((item) => (
                <QueueRow key={item.queueNumber} item={item} onReview={() => recordReview(item)} />
              ))}
            </div>
            {lastAction && <div className="mt-3 text-[12px] text-success">{lastAction}</div>}
          </SectionCard>

          <div className="grid gap-3">
            <SectionCard title="Сессии пациента" hint="сроки и отзывы">
              <div className="grid gap-2 text-[12px]">
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span>Подготовлено</span>
                  <span className="font-semibold tabular-nums">{governance.summary.prepared}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span>Отозвано</span>
                  <span className="font-semibold tabular-nums">{governance.summary.revoked}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span>Без срока</span>
                  <span className="font-semibold tabular-nums">{governance.summary.expiryMissing}</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Границы данных" hint="Batch AB · SD-MF-045/046/022">
              <BoundaryList governance={governance} />
            </SectionCard>

            <SectionCard title="Блокеры production" hint="что нельзя считать закрытым">
              <ul className="grid gap-2 text-[12px] text-muted-foreground">
                <li className="flex gap-2">
                  <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  Нужна утверждённая retention-политика и срок доступа.
                </li>
                <li className="flex gap-2">
                  <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  Нужна проверенная пациентская копия без врачебной версии.
                </li>
                <li className="flex gap-2">
                  <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  Файловая выдача работает только через self-hosted proxy.
                </li>
              </ul>
            </SectionCard>
          </div>
        </div>
      </div>
    </div>
  );
}
