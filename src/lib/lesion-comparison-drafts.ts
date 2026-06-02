export type LesionComparisonAction = "retake" | "excluded" | "report_limit";

export type LesionComparisonDecisionDraft = {
  version: 1;
  lesionId: string;
  pairKey: string;
  imageIds: [string, string];
  action: LesionComparisonAction;
  comparability: "comparable" | "not_comparable";
  reasons: string[];
  savedAt: string;
  patientDeliveryAllowed: false;
  protectedFieldsExposed: false;
};

export const LESION_COMPARISON_DRAFTS_STORAGE_KEY = "skindoctor:lesion-comparison-drafts";

export function buildLesionComparisonDraftKey(lesionId: string, imageIds: string[]) {
  return `${lesionId}:${[...imageIds].sort().join("+")}`;
}

function isComparisonDraft(value: unknown): value is LesionComparisonDecisionDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<LesionComparisonDecisionDraft>;
  return (
    draft.version === 1
    && typeof draft.lesionId === "string"
    && typeof draft.pairKey === "string"
    && Array.isArray(draft.imageIds)
    && draft.imageIds.length === 2
    && draft.imageIds.every((id) => typeof id === "string")
    && draft.action !== undefined
    && ["retake", "excluded", "report_limit"].includes(draft.action)
    && (draft.comparability === "comparable" || draft.comparability === "not_comparable")
    && Array.isArray(draft.reasons)
    && draft.reasons.every((reason) => typeof reason === "string")
    && typeof draft.savedAt === "string"
    && draft.patientDeliveryAllowed === false
    && draft.protectedFieldsExposed === false
  );
}

function readComparisonDrafts() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(LESION_COMPARISON_DRAFTS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => isComparisonDraft(value)),
    ) as Record<string, LesionComparisonDecisionDraft>;
  } catch {
    return {};
  }
}

function writeComparisonDrafts(drafts: Record<string, LesionComparisonDecisionDraft>) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(LESION_COMPARISON_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
    return true;
  } catch {
    return false;
  }
}

export function loadLesionComparisonDraft(pairKey: string) {
  return readComparisonDrafts()[pairKey] ?? null;
}

export function saveLesionComparisonDraft(draft: LesionComparisonDecisionDraft) {
  const drafts = readComparisonDrafts();
  drafts[draft.pairKey] = draft;
  return writeComparisonDrafts(drafts);
}

export function clearLesionComparisonDraft(pairKey: string) {
  const drafts = readComparisonDrafts();
  delete drafts[pairKey];
  return writeComparisonDrafts(drafts);
}

export function createLesionComparisonDecisionDraft(input: {
  lesionId: string;
  pairKey: string;
  imageIds: [string, string];
  action: LesionComparisonAction;
  isComparable: boolean;
  reasons: string[];
}): LesionComparisonDecisionDraft {
  return {
    version: 1,
    lesionId: input.lesionId,
    pairKey: input.pairKey,
    imageIds: input.imageIds,
    action: input.action,
    comparability: input.isComparable ? "comparable" : "not_comparable",
    reasons: input.reasons,
    savedAt: new Date().toISOString(),
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
  };
}
