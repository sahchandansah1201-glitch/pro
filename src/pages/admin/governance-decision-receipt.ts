import type { SelfHostedApiSession } from "@/lib/self-hosted-api-session";

export const GOVERNANCE_DECISION_RECEIPT_STORAGE_KEY = "skindoctor.admin.governance.safe-decision.v1";

export interface GovernanceDecisionReceipt {
  schemaVersion: 2;
  savedAt: string;
  decision: "delivery_blocked" | "awaiting_clinic_approval";
  contextFingerprint: string;
  openGateCount: number;
  blockerCount: number;
  patientDeliveryAllowed: false;
}

export function isGovernanceDecisionReceipt(value: unknown): value is GovernanceDecisionReceipt {
  if (!value || typeof value !== "object") return false;
  const receipt = value as Record<string, unknown>;
  return receipt.schemaVersion === 2
    && typeof receipt.savedAt === "string"
    && (receipt.decision === "delivery_blocked" || receipt.decision === "awaiting_clinic_approval")
    && typeof receipt.contextFingerprint === "string"
    && receipt.contextFingerprint.length > 0
    && Number.isInteger(receipt.openGateCount)
    && Number.isInteger(receipt.blockerCount)
    && receipt.patientDeliveryAllowed === false;
}

export async function governanceContextFingerprint(
  session: SelfHostedApiSession,
): Promise<string | null> {
  if (!session.apiToken) return "demo";
  if (!globalThis.crypto?.subtle) return null;
  const clinicBindings = (session.user?.roleBindings ?? [])
    .map((binding) => [binding.role, binding.clinicId, binding.clinicSlug])
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const source = JSON.stringify([
    session.apiBaseUrl,
    session.apiToken,
    session.user?.id ?? null,
    session.user?.roles ?? [],
    clinicBindings,
  ]);
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
