import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCheck2,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  executeSelfHostedPatientPhotoProtocolGovernanceBlockUnsafeSessionArtifacts,
  executeSelfHostedPatientPhotoProtocolGovernanceBlockMissingExpiry,
  executeSelfHostedPatientPhotoProtocolGovernanceBlockUnapprovedRetention,
  executeSelfHostedPatientPhotoProtocolGovernanceIssueAccessCredentialHash,
  executeSelfHostedPatientPhotoProtocolGovernancePrepareAccessArtifactRotation,
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
import {
  ClinicDecisionPackagePanel,
  ClinicLaunchApprovalGatePanel,
  LocalReadinessHistoryPanel,
  PatientDeliveryAuditReceiptPanel,
  PreLaunchBlockerPanel,
} from "./PatientDeliveryReadinessPanels";
import { PatientDeliveryApprovalRequirementsPanel } from "./PatientDeliveryApprovalRequirementsPanel";
import { GovernanceDecisionReceiptCard } from "./GovernanceDecisionReceipt";
import { useGovernanceDecisionReceipt } from "./useGovernanceDecisionReceipt";

type LoadStatus = "demo" | "loading" | "ready" | "error";

function governancePublicError(
  error: { status?: number } | null | undefined,
  fallback: string,
): string {
  if (error?.status === 401) return "Требуется повторный вход в систему клиники.";
  if (error?.status === 403) return "Недостаточно прав для управления доступом.";
  return fallback;
}

function formatBlockerCount(count: number): string {
  if (count === 0) return "Препятствий нет";

  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun =
    mod10 === 1 && mod100 !== 11
      ? "препятствие"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "препятствия"
        : "препятствий";

  return `${count} ${noun}`;
}

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
      unsafeArtifacts: 2,
      rotationPrepared: 1,
      rotationPending: 2,
      credentialHashReady: 1,
      credentialHashPending: 2,
      credentialStoreReady: 1,
      credentialStorePending: 2,
      sessionExchangeReady: 1,
      sessionExchangePending: 2,
      sessionExchangeDenied: 1,
      sessionExchangeSuccess: 1,
      credentialRotationRequired: true,
      nextAction: "exchange_access_credential",
      temporaryCredentialsExposed: false,
      qrTokensExposed: false,
      sessionIdsExposed: false,
      rawCredentialExposed: false,
      credentialHashExposed: false,
      credentialFingerprintExposed: false,
      rawSessionIdExposed: false,
      sessionHashExposed: false,
      sessionFingerprintExposed: false,
    },
    allowedOperations: [
      "review_retention_policy",
      "review_patient_copy",
      "prepare_revoke_review",
      "inspect_session_lifecycle",
      "block_unsafe_session_artifacts",
      "prepare_access_artifact_rotation",
      "issue_access_credential_hash",
      "exchange_access_credential",
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
  file_proxy_required: "Нужна защищённая выдача",
  blocked: "Заблокировано",
  revoked: "Отозвано",
};

const ATTENTION_LABEL: Record<string, string> = {
  retention_required: "хранение",
  patient_copy_required: "копия",
  file_proxy_required: "выдача файлов",
  expiry_required: "срок",
  expires_soon: "истекает",
  session_artifacts_review: "коды доступа",
  access_rotation_required: "замена кодов",
  access_rotation_prepared: "замена готова",
  blocked_release: "препятствие",
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

function GovernanceDisclosure({
  value,
  title,
  hint,
  status,
  children,
}: {
  value: string;
  title: string;
  hint: string;
  status: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value} className="overflow-hidden rounded-lg border bg-card px-4 shadow-sm">
      <AccordionTrigger
        aria-label={`${title}: ${status}`}
        className="min-h-[64px] gap-3 py-3 text-left hover:no-underline"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold leading-tight">{title}</span>
          <span className="mt-1 block text-[12px] font-normal leading-snug text-muted-foreground">{hint}</span>
        </span>
        <Badge variant="outline" className="min-h-[28px] shrink-0 px-2.5 py-1 text-[11px]">
          {status}
        </Badge>
      </AccordionTrigger>
      <AccordionContent className="border-t pt-3">
        <div className="space-y-3">{children}</div>
      </AccordionContent>
    </AccordionItem>
  );
}

function GovernanceDestructiveAction({
  triggerLabel,
  busyLabel,
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
}: {
  triggerLabel: string;
  busyLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          className="min-h-[44px] justify-center sm:min-h-[36px]"
          disabled={busy}
        >
          {busy ? busyLabel : triggerLabel}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="leading-relaxed">
            {description} Операция не открывает доступ пациенту. Итог появится в блоке «Последнее действие системы».
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-[44px]">Отмена</AlertDialogCancel>
          <AlertDialogAction
            className="min-h-[44px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => void onConfirm()}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
          <Badge variant="outline" className="text-[10px]">Препятствия: {item.blockerCount}</Badge>
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
    ["Только служебные итоги", governance.boundaries.metadataOnly],
    ["Имена пациентов скрыты", !governance.boundaries.patientNamesExposed],
    ["Служебные коды скрыты", !governance.boundaries.rawIdentifiersExposed],
    ["Секретные ключи скрыты", !governance.boundaries.rawTokensExposed],
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

type DeliveryGate = {
  id: string;
  title: string;
  detail: string;
  blockerCount: number;
  ready: boolean;
  nextAction: string;
};

function countUnsafeBoundaries(governance: SelfHostedPatientPhotoProtocolReleaseGovernanceDTO): number {
  return [
    !governance.boundaries.metadataOnly,
    governance.boundaries.patientNamesExposed,
    governance.boundaries.rawIdentifiersExposed,
    governance.boundaries.rawTokensExposed,
    governance.boundaries.rawFilesExposed,
    governance.boundaries.storagePathsExposed,
    governance.boundaries.signedUrlsIssued,
    governance.boundaries.doctorOnlyTextExposed,
    governance.boundaries.rawPolicyPayloadExposed,
    governance.operations.sessionLifecycle.temporaryCredentialsExposed,
    governance.operations.sessionLifecycle.qrTokensExposed,
    governance.operations.sessionLifecycle.sessionIdsExposed,
    governance.operations.sessionLifecycle.rawCredentialExposed,
    governance.operations.sessionLifecycle.credentialHashExposed,
    governance.operations.sessionLifecycle.credentialFingerprintExposed,
    governance.operations.sessionLifecycle.rawSessionIdExposed,
    governance.operations.sessionLifecycle.sessionHashExposed,
    governance.operations.sessionLifecycle.sessionFingerprintExposed,
    governance.operations.revokeReadiness.revokeReasonExposed,
  ].filter(Boolean).length;
}

function buildDeliveryGates(governance: SelfHostedPatientPhotoProtocolReleaseGovernanceDTO): DeliveryGate[] {
  const sessionBlockers =
    governance.operations.sessionLifecycle.missingExpiry +
    governance.operations.sessionLifecycle.unsafeArtifacts +
    governance.operations.sessionLifecycle.rotationPending +
    governance.operations.sessionLifecycle.credentialHashPending +
    governance.operations.sessionLifecycle.sessionExchangePending +
    governance.operations.sessionLifecycle.sessionExchangeDenied;
  const unsafeBoundaryCount = countUnsafeBoundaries(governance);

  return [
    {
      id: "patient-copy",
      title: "Текст для пациента",
      detail: "проверенная копия без врачебной версии",
      blockerCount: governance.summary.patientCopyMissing,
      ready: governance.summary.patientCopyMissing === 0,
      nextAction: "Проверить текст для пациента",
    },
    {
      id: "retention",
      title: "Правила хранения",
      detail: "срок хранения утверждён клиникой",
      blockerCount: governance.summary.retentionMissing,
      ready: governance.summary.retentionMissing === 0,
      nextAction: "Подготовить разбор хранения",
    },
    {
      id: "access-window",
      title: "Срок доступа",
      detail: "каждое окно имеет дату окончания",
      blockerCount: governance.summary.expiryMissing,
      ready: governance.summary.expiryMissing === 0,
      nextAction: "Заблокировать без срока",
    },
    {
      id: "file-channel",
      title: "Защищённая выдача файлов",
      detail: "файлы идут только через канал клиники",
      blockerCount: governance.summary.fileProxyMissing,
      ready: governance.summary.fileProxyMissing === 0,
      nextAction: "Проверить защищённую выдачу",
    },
    {
      id: "session",
      title: "Сеансы доступа",
      detail: "коды, замена и обмен проверены",
      blockerCount: sessionBlockers,
      ready: sessionBlockers === 0,
      nextAction: "Проверить сеансы доступа",
    },
    {
      id: "safe-boundary",
      title: "Безопасность данных",
      detail: "секреты, файлы и врачебный текст скрыты",
      blockerCount: unsafeBoundaryCount,
      ready: unsafeBoundaryCount === 0,
      nextAction: "Проверить границу данных",
    },
  ];
}

function DeliveryDecisionPanel({
  governance,
  onDecisionAction,
  onSaveDecision,
}: {
  governance: SelfHostedPatientPhotoProtocolReleaseGovernanceDTO;
  onDecisionAction: (gate: DeliveryGate | null) => void;
  onSaveDecision: () => void;
}) {
  const gates = buildDeliveryGates(governance);
  const blockerCount = gates.reduce((sum, gate) => sum + gate.blockerCount, 0);
  const firstBlocked = gates.find((gate) => !gate.ready) ?? null;

  return (
    <Card role="region" aria-label="Решение о выдаче пациенту" className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase text-muted-foreground">
            Решение о выдаче пациенту
          </div>
          <h2 className="mt-1 text-[18px] font-semibold leading-tight">
            {firstBlocked ? "Выдача выключена" : "Готово к финальной проверке"}
          </h2>
          <p className="mt-1 max-w-3xl text-[13px] text-muted-foreground">
            Этот экран не включает выдачу сам по себе. Он показывает, какие правила, сроки, сеансы и безопасные границы
            нужно закрыть до отдельного рабочего решения.
          </p>
        </div>
        <Badge variant={firstBlocked ? "destructive" : "outline"} className="min-h-[28px] px-2.5 py-1 text-[12px]">
          {formatBlockerCount(blockerCount)}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {gates.map((gate) => (
            <div key={gate.id} className="min-w-0 rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold leading-snug">{gate.title}</div>
                  <div className="mt-1 text-[12px] leading-snug text-muted-foreground">{gate.detail}</div>
                </div>
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 text-[11px] ${
                    gate.ready
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-warning/40 bg-warning/10 text-warning"
                  }`}
                >
                  {gate.ready ? "закрыто" : gate.blockerCount}
                </span>
              </div>
              {!gate.ready && (
                <div className="mt-2 text-[12px] font-medium text-foreground">{gate.nextAction}</div>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-md border p-3">
          <div className="text-[12px] font-semibold">Что делать сейчас</div>
          <div className="mt-1 text-[13px] font-medium">
            {firstBlocked ? firstBlocked.nextAction : "Провести финальную проверку"}
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {firstBlocked
              ? "Начните с первого препятствия. Выдача пациенту остаётся выключенной."
              : "Перед включением нужен отдельный рабочий акт клиники. Пациентские строки и файлы не раскрываются."}
          </p>
          <Button
            variant="outline"
            className="mt-3 w-full min-h-[44px] justify-center sm:min-h-[36px]"
            onClick={() => onDecisionAction(firstBlocked)}
          >
            {firstBlocked ? firstBlocked.nextAction : "Зафиксировать финальную проверку"}
          </Button>
          <Button
            className="mt-2 w-full min-h-[44px] justify-center sm:min-h-[36px]"
            onClick={onSaveDecision}
          >
            Сохранить временную заметку
          </Button>
        </div>
      </div>
    </Card>
  );
}

function DeliveryGateDrilldownPanel({
  governance,
  retentionOperationBusy,
  missingExpiryOperationBusy,
  revokeOperationBusy,
  onRetentionReview,
  onBlockUnapprovedRetention,
  onBlockMissingExpiry,
  onRevokeReview,
}: {
  governance: SelfHostedPatientPhotoProtocolReleaseGovernanceDTO;
  retentionOperationBusy: boolean;
  missingExpiryOperationBusy: boolean;
  revokeOperationBusy: boolean;
  onRetentionReview: () => void;
  onBlockUnapprovedRetention: () => void;
  onBlockMissingExpiry: () => void;
  onRevokeReview: () => void;
}) {
  const { retention, revokeReadiness, sessionLifecycle } = governance.operations;
  return (
    <Card role="region" aria-label="Проверка хранения и сроков" className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase text-muted-foreground">
            Проверка хранения и сроков
          </div>
          <h2 className="mt-1 text-[16px] font-semibold leading-tight">Что закрыть перед выдачей</h2>
          <p className="mt-1 max-w-3xl text-[13px] text-muted-foreground">
            Здесь видны только итоговые числа. Имена пациентов, коды входа, номера сеансов и файловые пути скрыты.
          </p>
        </div>
        <Badge variant="outline" className="min-h-[28px] px-2.5 py-1 text-[12px]">
          выдача выключена
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="grid gap-3 rounded-md border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">Правила хранения</div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                Перед выдачей у каждого окна должен быть утверждён срок хранения.
              </div>
            </div>
            <Badge variant={governance.summary.retentionMissing > 0 ? "secondary" : "outline"} className="text-[11px]">
              {governance.summary.retentionMissing} требуют правил
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <OperationLine label="На разбор" value={retention.reviewDue} tone={retention.reviewDue > 0 ? "warning" : "success"} />
            <OperationLine label="Готово" value={retention.ready} tone="success" />
            <OperationLine label="Заблокировано" value={retention.blocked} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" className="min-h-[44px] justify-center sm:min-h-[36px]" onClick={onRetentionReview}>
              Разобрать правила хранения
            </Button>
            <GovernanceDestructiveAction
              triggerLabel="Блокировать окна без правил"
              busyLabel="Блокируем окна..."
              title="Заблокировать окна без правил хранения?"
              description="Окна без утверждённых правил хранения станут недоступны до отдельного исправления условий."
              confirmLabel="Подтвердить блокировку"
              busy={retentionOperationBusy}
              onConfirm={onBlockUnapprovedRetention}
            />
          </div>
        </div>

        <div className="grid gap-3 rounded-md border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">Срок доступа</div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                Окно доступа должно иметь дату окончания до любого рабочего решения.
              </div>
            </div>
            <Badge variant={governance.summary.expiryMissing > 0 ? "secondary" : "outline"} className="text-[11px]">
              {governance.summary.expiryMissing} без срока
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <OperationLine label="Активные" value={revokeReadiness.activeWindows} />
            <OperationLine
              label="Истекают за сутки"
              value={revokeReadiness.expiringIn24h}
              tone={revokeReadiness.expiringIn24h > 0 ? "warning" : "default"}
            />
            <OperationLine
              label="Без срока"
              value={sessionLifecycle.missingExpiry}
              tone={sessionLifecycle.missingExpiry > 0 ? "warning" : "success"}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <GovernanceDestructiveAction
              triggerLabel="Закрыть окна без срока"
              busyLabel="Блокируем окна..."
              title="Закрыть окна без срока доступа?"
              description="Окна без даты окончания будут заблокированы до назначения корректного срока."
              confirmLabel="Подтвердить закрытие"
              busy={missingExpiryOperationBusy}
              onConfirm={onBlockMissingExpiry}
            />
            <GovernanceDestructiveAction
              triggerLabel="Отозвать истёкшие окна"
              busyLabel="Отзываем окна..."
              title="Отозвать истёкшие окна доступа?"
              description="Система отзовёт только уже истёкшие окна; активные окна будут пропущены."
              confirmLabel="Подтвердить отзыв"
              busy={revokeOperationBusy}
              onConfirm={onRevokeReview}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function DeliverySessionDrilldownPanel({
  governance,
  unsafeSessionArtifactOperationBusy,
  rotationOperationBusy,
  credentialHashOperationBusy,
  onFileChannelReview,
  onBlockUnsafeSessionArtifacts,
  onPrepareAccessArtifactRotation,
  onIssueAccessCredentialHash,
}: {
  governance: SelfHostedPatientPhotoProtocolReleaseGovernanceDTO;
  unsafeSessionArtifactOperationBusy: boolean;
  rotationOperationBusy: boolean;
  credentialHashOperationBusy: boolean;
  onFileChannelReview: () => void;
  onBlockUnsafeSessionArtifacts: () => void;
  onPrepareAccessArtifactRotation: () => void;
  onIssueAccessCredentialHash: () => void;
}) {
  const { sessionLifecycle } = governance.operations;
  const photoCount = governance.queue.reduce((sum, item) => sum + item.selectedPhotoCount, 0);
  return (
    <Card role="region" aria-label="Проверка файлов и сеансов" className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase text-muted-foreground">
            Проверка файлов и сеансов
          </div>
          <h2 className="mt-1 text-[16px] font-semibold leading-tight">Как не раскрыть файлы и коды</h2>
          <p className="mt-1 max-w-3xl text-[13px] text-muted-foreground">
            Проверяются только итоговые счётчики. Фото, пути к файлам, ссылки, коды входа и номера сеансов не выводятся.
          </p>
        </div>
        <Badge variant="outline" className="min-h-[28px] px-2.5 py-1 text-[12px]">
          доступ не открыт
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="grid gap-3 rounded-md border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">Защищённая выдача файлов</div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                Файлы должны открываться только через канал клиники, без показа путей и ссылок.
              </div>
            </div>
            <Badge variant={governance.summary.fileProxyMissing > 0 ? "secondary" : "outline"} className="text-[11px]">
              {governance.summary.fileProxyMissing} требуют канала
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <OperationLine
              label="Нужен канал"
              value={governance.summary.fileProxyMissing}
              tone={governance.summary.fileProxyMissing > 0 ? "warning" : "success"}
            />
            <OperationLine label="Фото в очереди" value={photoCount} />
            <OperationLine label="Файлы и ссылки" value="скрыты" tone="success" />
          </div>
          <Button variant="outline" className="min-h-[44px] justify-center sm:min-h-[36px]" onClick={onFileChannelReview}>
            Проверить выдачу файлов
          </Button>
        </div>

        <div className="grid gap-3 rounded-md border p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[13px] font-semibold">Сеансы доступа</div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                Временные коды, замена доступа и ключ входа проверяются до отдельного рабочего решения.
              </div>
            </div>
            <Badge variant={sessionLifecycle.unsafeArtifacts > 0 ? "secondary" : "outline"} className="text-[11px]">
              {sessionLifecycle.unsafeArtifacts} временных кода
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <OperationLine
              label="Нужна замена"
              value={sessionLifecycle.rotationPending}
              tone={sessionLifecycle.rotationPending > 0 ? "warning" : "success"}
            />
            <OperationLine
              label="Ключ нужен"
              value={sessionLifecycle.credentialHashPending}
              tone={sessionLifecycle.credentialHashPending > 0 ? "warning" : "success"}
            />
            <OperationLine
              label="Обмен нужен"
              value={sessionLifecycle.sessionExchangePending}
              tone={sessionLifecycle.sessionExchangePending > 0 ? "warning" : "success"}
            />
          </div>
          <div className="grid gap-2">
            <GovernanceDestructiveAction
              triggerLabel="Закрыть временные коды"
              busyLabel="Закрываем коды..."
              title="Закрыть небезопасные временные коды?"
              description="Временные коды, не отвечающие правилам безопасного сеанса, будут заблокированы."
              confirmLabel="Подтвердить закрытие"
              busy={unsafeSessionArtifactOperationBusy}
              onConfirm={onBlockUnsafeSessionArtifacts}
            />
            <Button
              variant="outline"
              className="min-h-[44px] justify-center sm:min-h-[36px]"
              onClick={onPrepareAccessArtifactRotation}
              disabled={rotationOperationBusy}
            >
              {rotationOperationBusy ? "Готовим замену..." : "Подготовить новую выдачу"}
            </Button>
            <Button
              variant="outline"
              className="min-h-[44px] justify-center sm:min-h-[36px]"
              onClick={onIssueAccessCredentialHash}
              disabled={credentialHashOperationBusy}
            >
              {credentialHashOperationBusy ? "Готовим ключ..." : "Подготовить ключ входа"}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function DataSafetySummaryPanel({
  governance,
  onDataSafetyReview,
}: {
  governance: SelfHostedPatientPhotoProtocolReleaseGovernanceDTO;
  onDataSafetyReview: () => void;
}) {
  const gates = buildDeliveryGates(governance);
  const openGateCount = gates.filter((gate) => !gate.ready).length;
  const blockerCount = gates.reduce((sum, gate) => sum + gate.blockerCount, 0);
  const unsafeBoundaryCount = countUnsafeBoundaries(governance);
  const sessionReviewCount =
    governance.operations.sessionLifecycle.unsafeArtifacts +
    governance.operations.sessionLifecycle.rotationPending +
    governance.operations.sessionLifecycle.credentialHashPending +
    governance.operations.sessionLifecycle.sessionExchangePending;

  return (
    <Card role="region" aria-label="Итоговая проверка безопасности данных" className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase text-muted-foreground">
            Итоговая проверка безопасности данных
          </div>
          <h2 className="mt-1 text-[16px] font-semibold leading-tight">Что можно показать администратору</h2>
          <p className="mt-1 max-w-3xl text-[13px] text-muted-foreground">
            Экран показывает только готовность и препятствия. Пациентские строки, фото, ссылки, коды входа и врачебный
            текст остаются скрыты.
          </p>
        </div>
        <Badge variant={unsafeBoundaryCount === 0 ? "outline" : "secondary"} className="min-h-[28px] px-2.5 py-1 text-[12px]">
          {unsafeBoundaryCount === 0 ? "данные скрыты" : "нужна проверка"}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="grid gap-3 rounded-md border p-3">
          <div>
            <div className="text-[13px] font-semibold">Скрытые данные</div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              Что не показывается на экране управления доступом.
            </div>
          </div>
          <div className="grid gap-2 text-[12px]">
            {[
              "Имена пациентов скрыты",
              "Фото и файлы скрыты",
              "Ссылки и пути скрыты",
              "Коды входа скрыты",
              "Номера сеансов скрыты",
              "Врачебный текст скрыт",
            ].map((label) => (
              <div key={label} className="flex min-h-[40px] items-center gap-2 rounded-md border px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 rounded-md border p-3">
          <div>
            <div className="text-[13px] font-semibold">Что ещё блокирует выдачу</div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              Сводка препятствий без пациентских строк и внутренних кодов.
            </div>
          </div>
          <div className="grid gap-2">
            <OperationLine label="Открытые правила" value={openGateCount} tone={openGateCount > 0 ? "warning" : "success"} />
            <OperationLine label="Всего препятствий" value={blockerCount} tone={blockerCount > 0 ? "warning" : "success"} />
            <OperationLine
              label="Проверить сеансы"
              value={sessionReviewCount}
              tone={sessionReviewCount > 0 ? "warning" : "success"}
            />
            <OperationLine label="Опасных раскрытий" value={unsafeBoundaryCount} tone={unsafeBoundaryCount > 0 ? "warning" : "success"} />
          </div>
        </div>

        <div className="grid gap-3 rounded-md border p-3">
          <div>
            <div className="text-[13px] font-semibold">Итог для рабочего решения</div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              Этот итог не открывает доступ пациенту и не публикует файлы.
            </div>
          </div>
          <div className="rounded-md border px-3 py-2 text-[12px]">
            <div className="font-semibold">Выдача пациенту остаётся выключенной</div>
            <p className="mt-1 text-muted-foreground">
              Перед запуском нужны отдельное решение клиники, проверенная копия для пациента, правила хранения, срок
              доступа и защищённый канал файлов.
            </p>
          </div>
          <Button variant="outline" className="min-h-[44px] justify-center sm:min-h-[36px]" onClick={onDataSafetyReview}>
            Проверить безопасность данных
          </Button>
        </div>
      </div>
    </Card>
  );
}

function PreReleaseReadinessReceiptPanel({
  governance,
  onReceiptReview,
}: {
  governance: SelfHostedPatientPhotoProtocolReleaseGovernanceDTO;
  onReceiptReview: () => void;
}) {
  const gates = buildDeliveryGates(governance);
  const readyCount = gates.filter((gate) => gate.ready).length;
  const openGateCount = gates.length - readyCount;
  const blockerCount = gates.reduce((sum, gate) => sum + gate.blockerCount, 0);
  const nextGate = gates.find((gate) => !gate.ready) ?? null;
  const receiptRows = gates.map((gate) => ({
    title: gate.title,
    status: gate.ready ? "закрыто" : "нужно закрыть",
    detail: gate.ready ? gate.detail : gate.nextAction,
    blockerCount: gate.blockerCount,
  }));

  return (
    <Card role="region" aria-label="Предварительный акт готовности к выдаче" className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase text-muted-foreground">
            Предварительный акт готовности
          </div>
          <h2 className="mt-1 text-[16px] font-semibold leading-tight">Что зафиксировано перед решением</h2>
          <p className="mt-1 max-w-3xl text-[13px] text-muted-foreground">
            Это только служебная квитанция проверки. Она не открывает доступ пациенту, не публикует файлы и не меняет
            правила клиники.
          </p>
        </div>
        <Badge variant={openGateCount > 0 ? "secondary" : "outline"} className="min-h-[28px] px-2.5 py-1 text-[12px]">
          {openGateCount > 0 ? "акт не закрыт" : "готово к решению"}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {receiptRows.map((row) => (
            <div key={row.title} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold leading-snug">{row.title}</div>
                  <div className="mt-1 text-[12px] leading-snug text-muted-foreground">{row.detail}</div>
                </div>
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 text-[11px] ${
                    row.status === "закрыто"
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-warning/40 bg-warning/10 text-warning"
                  }`}
                >
                  {row.status}
                </span>
              </div>
              {row.blockerCount > 0 && (
                <div className="mt-2 text-[12px] text-muted-foreground">Препятствий: {row.blockerCount}</div>
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-3 rounded-md border p-3">
          <div>
            <div className="text-[13px] font-semibold">Итог акта</div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              Сводка нужна для рабочего решения клиники, а не для автоматической выдачи.
            </div>
          </div>
          <div className="grid gap-2">
            <OperationLine label="Закрыто проверок" value={`${readyCount}/${gates.length}`} tone={openGateCount > 0 ? "default" : "success"} />
            <OperationLine label="Открыто проверок" value={openGateCount} tone={openGateCount > 0 ? "warning" : "success"} />
            <OperationLine label="Всего препятствий" value={blockerCount} tone={blockerCount > 0 ? "warning" : "success"} />
          </div>
          <div className="rounded-md border px-3 py-2 text-[12px]">
            <div className="font-semibold">{nextGate ? "Следующий шаг" : "Ожидает решения клиники"}</div>
            <p className="mt-1 text-muted-foreground">
              {nextGate
                ? nextGate.nextAction
                : "Перед запуском всё равно нужен отдельный рабочий акт. Этот экран доступ пациенту не открывает."}
            </p>
          </div>
          <Button variant="outline" className="min-h-[44px] justify-center sm:min-h-[36px]" onClick={onReceiptReview}>
            Зафиксировать предварительный акт
          </Button>
        </div>
      </div>
    </Card>
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

function GovernanceActionFeedback({
  lastAction,
  operationResult,
}: {
  lastAction: string | null;
  operationResult: SelfHostedPatientPhotoProtocolGovernanceOperationResultDTO | null;
}) {
  if (!lastAction && !operationResult) return null;

  return (
    <div role="status" aria-live="polite" className="rounded-md border px-3 py-2 text-[12px] text-muted-foreground">
      <div className="font-semibold text-foreground">
        {operationResult ? "Последнее действие системы" : "Последнее действие"}
      </div>
      {lastAction && <div className="mt-1 text-foreground">{lastAction}</div>}
      {operationResult && (
        <>
          <div className="mt-2 grid gap-1 sm:grid-cols-3">
            <span>Изменено: <b className="tabular-nums text-foreground">{operationResult.affectedCount}</b></span>
            <span>Активные пропущены: <b className="tabular-nums text-foreground">{operationResult.skippedActiveCount}</b></span>
            <span>Без срока: <b className="tabular-nums text-foreground">{operationResult.skippedMissingExpiryCount}</b></span>
          </div>
          <div className="mt-1">
            Только итоговые числа: пациентские строки, причина отзыва, секрет доступа, коды входа, номера сеансов и файловые пути не раскрывались.
          </div>
        </>
      )}
    </div>
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
  const [unsafeSessionArtifactOperationBusy, setUnsafeSessionArtifactOperationBusy] = useState(false);
  const [rotationOperationBusy, setRotationOperationBusy] = useState(false);
  const [credentialHashOperationBusy, setCredentialHashOperationBusy] = useState(false);

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
      setError(
        governancePublicError(
          result.error,
          "Не удалось загрузить управление доступом. Повторите попытку.",
        ),
      );
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
  const deliveryGates = useMemo(() => buildDeliveryGates(governance), [governance]);
  const openGateCount = deliveryGates.filter((gate) => !gate.ready).length;
  const blockerCount = deliveryGates.reduce((sum, gate) => sum + gate.blockerCount, 0);
  const { decisionReceipt, saveGovernanceDecision } = useGovernanceDecisionReceipt({
    session,
    loading: status === "loading",
    openGateCount,
    blockerCount,
    onStatus: setLastAction,
  });

  function recordReview(item: SelfHostedPatientPhotoProtocolReleaseGovernanceQueueRow) {
    setLastAction(`Разбор правил подготовлен локально: строка #${item.queueNumber}`);
  }

  function recordRetentionReview() {
    setLastAction("Разбор хранения подготовлен локально: без пациентских строк и без служебных кодов");
  }

  function recordDeliveryDecisionAction(gate: DeliveryGate | null) {
    if (!gate) {
      setLastAction("Финальная проверка подготовлена локально: выдача пациенту не включалась");
      return;
    }
    setLastAction(`Следующий шаг подготовлен локально: ${gate.nextAction}. Выдача пациенту остаётся выключенной`);
  }

  function recordFileChannelReview() {
    setLastAction("Проверка выдачи файлов подготовлена локально: файлы, пути и ссылки не раскрывались");
  }

  function recordDataSafetyReview() {
    setLastAction(
      "Проверка безопасности данных подготовлена локально: секреты, файлы, ссылки и пациентские строки не раскрывались. Выдача пациенту остаётся выключенной",
    );
  }

  function recordPreReleaseReceiptReview() {
    setLastAction(
      "Предварительный акт готовности зафиксирован локально: доступ пациенту не открыт, файлы не опубликованы, рабочее решение клиники требуется отдельно",
    );
  }

  function recordReadinessHistoryReview() {
    setLastAction(
      "История проверки обновлена локально: пациентские строки, файлы, ссылки, коды входа и номера сеансов не раскрывались. Выдача пациенту остаётся выключенной",
    );
  }

  function recordPreLaunchBlockerReview() {
    setLastAction(
      "Список предзапусковых препятствий подготовлен локально: пациентские строки, файлы, ссылки и коды входа не раскрывались. Выдача пациенту остаётся выключенной",
    );
  }

  function recordClinicDecisionPackageReview() {
    setLastAction(
      "Пакет решения клиники подготовлен локально: доступ пациенту не открыт, файлы не опубликованы, отдельное утверждение клиники обязательно",
    );
  }

  function recordClinicLaunchApprovalReview() {
    setLastAction(
      "Запрет запуска зафиксирован локально: решение клиники не принято, выдача пациенту не включалась, файлы не опубликованы. Выдача пациенту остаётся выключенной",
    );
  }

  function recordPatientDeliveryAuditReceiptReview() {
    setLastAction(
      "Итоговый акт запрета выдачи зафиксирован локально: решение клиники не принято, доступ пациенту не открыт, файлы, ссылки, коды входа и номера сеансов не раскрывались. Выдача пациенту остаётся выключенной",
    );
  }

  function recordPatientDeliveryApprovalRequirementsReview() {
    setLastAction(
      "Требования к утверждению выдачи подготовлены локально: решение клиники не принято, доступ пациенту не открыт, файлы и ссылки не опубликованы. Выдача пациенту остаётся выключенной",
    );
  }

  async function recordBlockUnapprovedRetention() {
    if (!configured) {
      setLastAction("Учебный режим: окна без правил хранения заблокированы локально, доступ пациента не расширялся");
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
          rawCredentialExposed: false,
          credentialHashExposed: false,
          credentialFingerprintExposed: false,
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
      setLastAction(
        governancePublicError(
          result.error,
          "Не удалось заблокировать окна без правил хранения. Повторите попытку.",
        ),
      );
      return;
    }
    setOperationResult(result.value);
    setLastAction(
      `Окна без правил хранения заблокированы: ${result.value.affectedCount} изменено, доступ пациента не расширялся`,
    );
    await loadGovernance();
  }

  async function recordRevokeReview() {
    if (!configured) {
      setLastAction("Учебный режим: отзыв истёкших окон подготовлен локально, причина остаётся скрытой");
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
          rawCredentialExposed: false,
          credentialHashExposed: false,
          credentialFingerprintExposed: false,
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
      setLastAction(
        governancePublicError(
          result.error,
          "Не удалось отозвать истёкшие окна доступа. Повторите попытку.",
        ),
      );
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
      setLastAction("Учебный режим: окна без срока заблокированы локально, коды входа не раскрыты");
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
          rawCredentialExposed: false,
          credentialHashExposed: false,
          credentialFingerprintExposed: false,
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
      setLastAction(
        governancePublicError(
          result.error,
          "Не удалось заблокировать окна без срока доступа. Повторите попытку.",
        ),
      );
      return;
    }
    setOperationResult(result.value);
    setLastAction(
      `Окна без срока заблокированы: ${result.value.affectedCount} изменено, коды входа скрыты`,
    );
    await loadGovernance();
  }

  async function recordBlockUnsafeSessionArtifacts() {
    if (!configured) {
      setLastAction("Учебный режим: небезопасные временные коды заблокированы локально, коды входа не раскрыты");
      setOperationResult({
        operation: "block_unsafe_session_artifacts",
        status: "no_op",
        affectedCount: 0,
        skippedActiveCount: governance.operations.sessionLifecycle.active,
        expiringIn24hCount: governance.operations.sessionLifecycle.expiringIn24h,
        skippedMissingExpiryCount: governance.operations.sessionLifecycle.missingExpiry,
        limit: 12,
        auditAction: "patient_photo_protocol.release_governance.block_unsafe_session_artifacts",
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
          rawCredentialExposed: false,
          credentialHashExposed: false,
          credentialFingerprintExposed: false,
        },
      });
      return;
    }
    setUnsafeSessionArtifactOperationBusy(true);
    const result = await executeSelfHostedPatientPhotoProtocolGovernanceBlockUnsafeSessionArtifacts({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: { confirm: true, limit: 12 },
    });
    setUnsafeSessionArtifactOperationBusy(false);
    if (!result.ok || !result.value) {
      setLastAction(
        governancePublicError(
          result.error,
          "Не удалось закрыть небезопасные временные коды. Повторите попытку.",
        ),
      );
      return;
    }
    setOperationResult(result.value);
    setLastAction(
      `Небезопасные временные коды заблокированы: ${result.value.affectedCount} изменено, коды входа скрыты`,
    );
    await loadGovernance();
  }

  async function recordPrepareAccessArtifactRotation() {
    if (!configured) {
      setLastAction("Учебный режим: замена доступа подготовлена локально, секреты доступа не раскрыты");
      setOperationResult({
        operation: "prepare_access_artifact_rotation",
        status: "no_op",
        affectedCount: 0,
        skippedActiveCount: governance.operations.sessionLifecycle.active,
        expiringIn24hCount: governance.operations.sessionLifecycle.expiringIn24h,
        skippedMissingExpiryCount: governance.operations.sessionLifecycle.missingExpiry,
        limit: 9,
        auditAction: "patient_photo_protocol.release_governance.prepare_access_artifact_rotation",
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
          rawCredentialExposed: false,
          credentialHashExposed: false,
          credentialFingerprintExposed: false,
        },
      });
      return;
    }
    setRotationOperationBusy(true);
    const result = await executeSelfHostedPatientPhotoProtocolGovernancePrepareAccessArtifactRotation({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: { confirm: true, limit: 9 },
    });
    setRotationOperationBusy(false);
    if (!result.ok || !result.value) {
      setLastAction(
        governancePublicError(
          result.error,
          "Не удалось подготовить замену доступа. Повторите попытку.",
        ),
      );
      return;
    }
    setOperationResult(result.value);
    setLastAction(
      `Замена доступа подготовлена: ${result.value.affectedCount} записей, секреты доступа скрыты`,
    );
    await loadGovernance();
  }

  async function recordIssueAccessCredentialHash() {
    if (!configured) {
      setLastAction("Учебный режим: ключ доступа подготовлен локально, секрет доступа и коды входа не раскрыты");
      setOperationResult({
        operation: "issue_access_credential_hash",
        status: "no_op",
        affectedCount: 0,
        skippedActiveCount: governance.operations.sessionLifecycle.active,
        expiringIn24hCount: governance.operations.sessionLifecycle.expiringIn24h,
        skippedMissingExpiryCount: governance.operations.sessionLifecycle.missingExpiry,
        limit: 7,
        auditAction: "patient_photo_protocol.release_governance.issue_access_credential_hash",
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
          rawCredentialExposed: false,
          credentialHashExposed: false,
          credentialFingerprintExposed: false,
        },
      });
      return;
    }
    setCredentialHashOperationBusy(true);
    const result = await executeSelfHostedPatientPhotoProtocolGovernanceIssueAccessCredentialHash({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: { confirm: true, limit: 7 },
    });
    setCredentialHashOperationBusy(false);
    if (!result.ok || !result.value) {
      setLastAction(
        governancePublicError(
          result.error,
          "Не удалось подготовить ключ доступа. Повторите попытку.",
        ),
      );
      return;
    }
    setOperationResult(result.value);
    setLastAction(
      `Ключ доступа подготовлен: ${result.value.affectedCount} записей, секрет доступа и коды входа скрыты`,
    );
    await loadGovernance();
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Управление доступом"
        subtitle="Пациентская выдача фото-протокола: правила, сроки хранения и журнал действий."
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
                Без секретных ключей, ссылок, фото, диагнозов и пациентских строк. Страница показывает только готовность,
                правила выдачи, сроки доступа и препятствия рабочего режима.
              </p>
            </div>
          </div>
        </section>

        {status === "loading" && (
          <Card className="p-3 text-[12px] text-muted-foreground">Загружаем контур доступа из системы клиники…</Card>
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
            Система клиники не подключена. Показан учебный срез без сетевых действий и без пациентских данных.
          </Card>
        )}

        <DeliveryDecisionPanel
          governance={governance}
          onDecisionAction={recordDeliveryDecisionAction}
          onSaveDecision={saveGovernanceDecision}
        />
        {decisionReceipt && <GovernanceDecisionReceiptCard receipt={decisionReceipt} />}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={FileCheck2}
            label="Правила выдачи"
            value={policyReady}
            hint="готовы к окну доступа"
          />
          <Metric
            icon={Clock3}
            label="Сеансы пациента"
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
            label="Заблокированные выдачи"
            value={governance.summary.blocked}
            hint="требуют разбора"
          />
        </div>

        <GovernanceActionFeedback lastAction={lastAction} operationResult={operationResult} />

        <Accordion type="multiple" defaultValue={["required-actions"]} className="space-y-3">
          <GovernanceDisclosure
            value="required-actions"
            title="Требует действий"
            hint="Открытые правила, сроки, файлы и сеансы"
            status={formatBlockerCount(blockerCount)}
          >
            <DeliveryGateDrilldownPanel
              governance={governance}
              retentionOperationBusy={retentionOperationBusy}
              missingExpiryOperationBusy={missingExpiryOperationBusy}
              revokeOperationBusy={revokeOperationBusy}
              onRetentionReview={recordRetentionReview}
              onBlockUnapprovedRetention={recordBlockUnapprovedRetention}
              onBlockMissingExpiry={recordBlockMissingExpiry}
              onRevokeReview={recordRevokeReview}
            />
            <DeliverySessionDrilldownPanel
              governance={governance}
              unsafeSessionArtifactOperationBusy={unsafeSessionArtifactOperationBusy}
              rotationOperationBusy={rotationOperationBusy}
              credentialHashOperationBusy={credentialHashOperationBusy}
              onFileChannelReview={recordFileChannelReview}
              onBlockUnsafeSessionArtifacts={recordBlockUnsafeSessionArtifacts}
              onPrepareAccessArtifactRotation={recordPrepareAccessArtifactRotation}
              onIssueAccessCredentialHash={recordIssueAccessCredentialHash}
            />
          </GovernanceDisclosure>

          <GovernanceDisclosure
            value="clinic-decision"
            title="Решение клиники"
            hint="Акты, условия утверждения и запрет запуска"
            status={`${openGateCount} проверок открыто`}
          >
            <PreReleaseReadinessReceiptPanel
              governance={governance}
              onReceiptReview={recordPreReleaseReceiptReview}
            />
            <PreLaunchBlockerPanel
              gates={deliveryGates}
              onBlockerReview={recordPreLaunchBlockerReview}
            />
            <ClinicDecisionPackagePanel
              gates={deliveryGates}
              onDecisionPackageReview={recordClinicDecisionPackageReview}
            />
            <ClinicLaunchApprovalGatePanel
              gates={deliveryGates}
              onLaunchApprovalReview={recordClinicLaunchApprovalReview}
            />
            <PatientDeliveryApprovalRequirementsPanel
              gates={deliveryGates}
              onApprovalRequirementsReview={recordPatientDeliveryApprovalRequirementsReview}
            />
          </GovernanceDisclosure>

          <GovernanceDisclosure
            value="history-safety"
            title="История и безопасность"
            hint="Безопасные агрегаты и журнал локальных проверок"
            status="данные скрыты"
          >
            <DataSafetySummaryPanel governance={governance} onDataSafetyReview={recordDataSafetyReview} />
            <LocalReadinessHistoryPanel
              gates={deliveryGates}
              lastAction={lastAction}
              operationResult={operationResult}
              onHistoryReview={recordReadinessHistoryReview}
            />
            <PatientDeliveryAuditReceiptPanel
              gates={deliveryGates}
              lastAction={lastAction}
              onAuditReceiptReview={recordPatientDeliveryAuditReceiptReview}
            />
          </GovernanceDisclosure>

          <GovernanceDisclosure
            value="approval-queue"
            title="Очередь утверждений"
            hint="Служебные строки без пациентов и внутренних кодов"
            status={`строк: ${governance.queue.length}`}
          >
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
              <SectionCard title="Очередь утверждений" hint="служебные строки без пациентов и внутренних кодов">
                <div className="space-y-2">
                  {governance.queue.map((item) => (
                    <QueueRow key={item.queueNumber} item={item} onReview={() => recordReview(item)} />
                  ))}
                </div>
              </SectionCard>

              <div className="grid gap-3">
                <SectionCard title="Сеансы пациента" hint="сроки и отзывы">
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

                <SectionCard title="Безопасность данных" hint="показываются только безопасные итоги">
                  <BoundaryList governance={governance} />
                </SectionCard>

                <SectionCard title="Что мешает запуску" hint="что нельзя считать закрытым">
                  <ul className="grid gap-2 text-[12px] text-muted-foreground">
                    <li className="flex gap-2">
                      <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      Нужны утверждённые правила хранения и срок доступа.
                    </li>
                    <li className="flex gap-2">
                      <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      Нужна проверенная пациентская копия без врачебной версии.
                    </li>
                    <li className="flex gap-2">
                      <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      Файловая выдача работает только через защищённый канал клиники.
                    </li>
                  </ul>
                </SectionCard>
              </div>
            </div>
          </GovernanceDisclosure>
        </Accordion>
      </div>
    </div>
  );
}
