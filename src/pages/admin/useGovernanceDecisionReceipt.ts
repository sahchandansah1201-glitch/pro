import { useEffect, useState } from "react";
import type { SelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  GOVERNANCE_DECISION_RECEIPT_STORAGE_KEY,
  governanceContextFingerprint,
  isGovernanceDecisionReceipt,
  type GovernanceDecisionReceipt,
} from "./governance-decision-receipt";

interface UseGovernanceDecisionReceiptOptions {
  session: SelfHostedApiSession;
  loading: boolean;
  openGateCount: number;
  blockerCount: number;
  onStatus: (message: string) => void;
}

export function useGovernanceDecisionReceipt({
  session,
  loading,
  openGateCount,
  blockerCount,
  onStatus,
}: UseGovernanceDecisionReceiptOptions) {
  const [decisionReceipt, setDecisionReceipt] = useState<GovernanceDecisionReceipt | null>(null);

  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    void governanceContextFingerprint(session).then((contextFingerprint) => {
      if (cancelled) return;
      const raw = window.sessionStorage.getItem(GOVERNANCE_DECISION_RECEIPT_STORAGE_KEY);
      if (!raw || !contextFingerprint) {
        window.sessionStorage.removeItem(GOVERNANCE_DECISION_RECEIPT_STORAGE_KEY);
        setDecisionReceipt(null);
        return;
      }
      try {
        const parsed: unknown = JSON.parse(raw);
        if (
          isGovernanceDecisionReceipt(parsed)
          && parsed.contextFingerprint === contextFingerprint
          && parsed.openGateCount === openGateCount
          && parsed.blockerCount === blockerCount
        ) {
          setDecisionReceipt(parsed);
          return;
        }
      } catch {
        // Invalid browser-local data is discarded below.
      }
      window.sessionStorage.removeItem(GOVERNANCE_DECISION_RECEIPT_STORAGE_KEY);
      setDecisionReceipt(null);
    });
    return () => {
      cancelled = true;
    };
  }, [blockerCount, loading, openGateCount, session]);

  async function saveGovernanceDecision() {
    const contextFingerprint = await governanceContextFingerprint(session);
    if (!contextFingerprint) {
      window.sessionStorage.removeItem(GOVERNANCE_DECISION_RECEIPT_STORAGE_KEY);
      setDecisionReceipt(null);
      onStatus("Временная заметка не сохранена: не удалось безопасно привязать её к текущему входу");
      return;
    }
    const receipt: GovernanceDecisionReceipt = {
      schemaVersion: 2,
      savedAt: new Date().toISOString(),
      decision: openGateCount > 0 ? "delivery_blocked" : "awaiting_clinic_approval",
      contextFingerprint,
      openGateCount,
      blockerCount,
      patientDeliveryAllowed: false,
    };
    window.sessionStorage.setItem(GOVERNANCE_DECISION_RECEIPT_STORAGE_KEY, JSON.stringify(receipt));
    setDecisionReceipt(receipt);
    onStatus(
      openGateCount > 0
        ? "Временная заметка сохранена в этой вкладке: выдача пациенту остаётся выключенной до закрытия проверок"
        : "Временная заметка сохранена в этой вкладке: выдача пациенту остаётся выключенной до отдельного утверждения клиники",
    );
  }

  return { decisionReceipt, saveGovernanceDecision };
}
