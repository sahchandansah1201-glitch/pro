import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  History,
  LogOut,
  Pencil,
  RotateCcw,
  Search,
  ServerCog,
  SlidersHorizontal,
  Trash2,
  UserPlus,
} from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { APPOINTMENTS, LESIONS, PATIENTS, VISITS } from "@/lib/mock-data";
import { formatCardNumber } from "@/lib/card-number";
import { calcAge, formatDate, sexShort } from "@/lib/format";
import type { Patient, Phototype, Sex } from "@/lib/domain";
import {
  archiveSelfHostedPatient,
  createSelfHostedPatient,
  getSelfHostedPatient,
  listSelfHostedPatients,
  selfHostedPatientToDomain,
  updateSelfHostedPatient,
  type SelfHostedApiError,
} from "@/lib/self-hosted-patient-api";
import {
  clearSelfHostedApiSession,
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";
import { isProductionAppMode } from "@/lib/app-mode";

const PHOTOTYPES: Phototype[] = ["I", "II", "III", "IV", "V", "VI"];
const PATIENT_EDIT_DEMO_TODAY = "2026-05-11";
const PATIENT_DEMO_GATE_MESSAGE =
  "новые записи и удаление не меняют данные клиники.";
const PATIENT_DEMO_CREATE_BLOCKED_MESSAGE =
  "Создание пациента доступно только после входа в систему клиники. Реальные данные пациентов здесь не вводите.";
const PATIENT_DEMO_GATE_ID = "patients-demo-gate-note";
const PATIENT_LIVE_GATE_MESSAGE =
  "список, создание, редактирование и архивирование идут через систему клиники.";
const PATIENT_PRODUCTION_GATE_MESSAGE =
  "пациенты загружаются только из системы клиники.";

type ConsentFilter = "any" | "yes" | "no";
type LesionsFilter = "any" | "with_active" | "without_active";
type SortMode =
  | "name_asc"
  | "name_desc"
  | "age_asc"
  | "age_desc"
  | "last_visit_desc";

const PAGE_SIZE_OPTIONS = [4, 8] as const;

interface Row {
  patient: Patient;
  age: number;
  lesionCount: number;
  hasActive: boolean;
  lastVisit: string | null;
  nextVisit: string | null;
}

interface PatientEditDraft {
  id: string;
  fullName: string;
  birthDate: string;
  sex: Sex;
  phototype: Phototype;
  imagingConsent: boolean;
}

interface AdvancedSearchState {
  code: string;
  name: string;
  ageFrom: string;
  ageTo: string;
}

interface ChangeLogEntry {
  id: string;
  action: "edit" | "delete" | "restore";
  patientCode: string;
  patientName: string;
  message: string;
}

interface DeletedPatientSnapshot {
  patient: Patient;
}

type BackendLoadState = "idle" | "loading" | "ready" | "error";

function buildRow(patient: Patient): Row {
  const lesions = LESIONS.filter((l) => l.patientId === patient.id);
  const visits = VISITS.filter((v) => v.patientId === patient.id);
  const past = visits
    .filter((v) => v.status === "closed" && v.closedAt)
    .map((v) => v.closedAt!)
    .sort()
    .reverse();
  const future = [
    ...visits.filter((v) => v.status === "scheduled").map((v) => v.startedAt),
    ...APPOINTMENTS.filter(
      (a) =>
        a.patientId === patient.id &&
        (a.status === "planned" || a.status === "confirmed"),
    ).map((a) => a.slotAt),
  ].sort();

  return {
    patient,
    age: calcAge(patient.birthDate),
    lesionCount: lesions.length,
    hasActive: lesions.some(
      (l) => l.status === "active" || l.status === "monitoring",
    ),
    lastVisit: past[0] ?? null,
    nextVisit: future[0] ?? null,
  };
}

function patientToDraft(patient: Patient): PatientEditDraft {
  return {
    id: patient.id,
    fullName: patient.fullName,
    birthDate: patient.birthDate,
    sex: patient.sex,
    phototype: patient.phototype,
    imagingConsent: patient.consents.imaging,
  };
}

function validatePatientDraft(draft: PatientEditDraft): string | null {
  const fullName = draft.fullName.trim();
  if (!fullName) return "Укажите ФИО пациента.";
  if (fullName.split(/\s+/).length < 2)
    return "Укажите фамилию и имя пациента.";
  if (!draft.birthDate) return "Укажите дату рождения пациента.";
  if (draft.birthDate < "1900-01-01")
    return "Дата рождения выглядит слишком ранней.";
  if (draft.birthDate > PATIENT_EDIT_DEMO_TODAY)
    return "Дата рождения не может быть в будущем.";
  return null;
}

function compareNullableIsoDesc(a: string | null, b: string | null): number {
  if (a && b) return b.localeCompare(a);
  if (a) return -1;
  if (b) return 1;
  return 0;
}

function sortRows(rows: Row[], mode: SortMode): Row[] {
  return [...rows].sort((a, b) => {
    switch (mode) {
      case "name_asc":
        return a.patient.fullName.localeCompare(b.patient.fullName, "ru");
      case "name_desc":
        return b.patient.fullName.localeCompare(a.patient.fullName, "ru");
      case "age_asc":
        return (
          a.age - b.age ||
          a.patient.fullName.localeCompare(b.patient.fullName, "ru")
        );
      case "age_desc":
        return (
          b.age - a.age ||
          a.patient.fullName.localeCompare(b.patient.fullName, "ru")
        );
      case "last_visit_desc":
        return (
          compareNullableIsoDesc(a.lastVisit, b.lastVisit) ||
          a.patient.fullName.localeCompare(b.patient.fullName, "ru")
        );
    }
  });
}

function formatChangeLogExport(entries: ChangeLogEntry[]): string {
  if (entries.length === 0) return "Журнал изменений пуст.";
  return entries
    .map(
      (entry, index) =>
        `${index + 1}. ${formatCardNumber(entry.patientCode)} ${entry.patientName}: ${entry.message}`,
    )
    .join("\n");
}

function initialPatientDraft(): PatientEditDraft {
  return {
    id: "new-patient",
    fullName: "",
    birthDate: "",
    sex: "female",
    phototype: "II",
    imagingConsent: false,
  };
}

function patientDraftToPayload(draft: PatientEditDraft) {
  return {
    fullName: draft.fullName.trim(),
    birthDate: draft.birthDate || null,
    sex: draft.sex,
    phototype: draft.phototype,
    imagingConsent: draft.imagingConsent,
  };
}

function patientApiErrorText(
  error: SelfHostedApiError | null | undefined,
): string {
  if (!error) return "Система клиники не вернула описание ошибки.";
  if (error.status === 401) return "Система клиники требует повторного входа.";
  if (error.status === 403)
    return "Недостаточно прав для действия с пациентами.";
  if (error.kind === "validation" && error.details?.length) {
    return error.details
      .map((item) => `${item.field}: ${item.message}`)
      .join("; ");
  }
  return error.message;
}

export default function PatientsPage() {
  const navigate = useNavigate();
  const selfHostedSession = useSelfHostedApiSession();
  const productionMode = isProductionAppMode();
  const liveBackend = isSelfHostedApiConfigured(selfHostedSession);
  const [patients, setPatients] = useState<Patient[]>(() =>
    productionMode ? [] : PATIENTS,
  );
  const [query, setQuery] = useState("");
  const [advancedSearch, setAdvancedSearch] = useState<AdvancedSearchState>({
    code: "",
    name: "",
    ageFrom: "",
    ageTo: "",
  });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [phototype, setPhototype] = useState<"any" | Phototype>("any");
  const [consent, setConsent] = useState<ConsentFilter>("any");
  const [lesionsFilter, setLesionsFilter] = useState<LesionsFilter>("any");
  const [sortMode, setSortMode] = useState<SortMode>("name_asc");
  const [pageSize, setPageSize] =
    useState<(typeof PAGE_SIZE_OPTIONS)[number]>(4);
  const [page, setPage] = useState(1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [previewPatient, setPreviewPatient] = useState<Patient | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<Patient | null>(null);
  const [lastDeleted, setLastDeleted] = useState<DeletedPatientSnapshot | null>(
    null,
  );
  const [createDraft, setCreateDraft] = useState<PatientEditDraft | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<PatientEditDraft | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [backendLoadState, setBackendLoadState] =
    useState<BackendLoadState>("idle");
  const [saving, setSaving] = useState(false);
  const [busyPatientId, setBusyPatientId] = useState<string | null>(null);

  useEffect(() => {
    if (!liveBackend) {
      setPatients(productionMode ? [] : PATIENTS);
      setBackendLoadState("idle");
      return;
    }

    let cancelled = false;
    setBackendLoadState("loading");
    if (productionMode) setPatients([]);
    listSelfHostedPatients({
      apiBaseUrl: selfHostedSession.apiBaseUrl,
      apiToken: selfHostedSession.apiToken,
      limit: 200,
    }).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setPatients((result.value ?? []).map(selfHostedPatientToDomain));
        setBackendLoadState("ready");
        setLastDeleted(null);
        return;
      }
      setBackendLoadState("error");
      if (productionMode) setPatients([]);
      setStatusMessage(
        `Не удалось загрузить пациентов из системы клиники: ${patientApiErrorText(result.error)}`,
      );
    });

    return () => {
      cancelled = true;
    };
  }, [
    liveBackend,
    productionMode,
    selfHostedSession.apiBaseUrl,
    selfHostedSession.apiToken,
  ]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const code = advancedSearch.code.trim().toLowerCase();
    const name = advancedSearch.name.trim().toLowerCase();
    const ageFrom = Number.parseInt(advancedSearch.ageFrom, 10);
    const ageTo = Number.parseInt(advancedSearch.ageTo, 10);
    return patients.map(buildRow).filter(({ patient, hasActive }) => {
      if (q) {
        const consentText = patient.consents.imaging
          ? "согласие есть"
          : "согласия нет";
        const sexText = patient.sex === "female" ? "женский ж" : "мужской м";
        const hay = [
          patient.fullName,
          patient.code,
          patient.phototype,
          sexText,
          consentText,
          patient.riskFactors.join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (code && !patient.code.toLowerCase().includes(code)) return false;
      if (name && !patient.fullName.toLowerCase().includes(name)) return false;
      const age = calcAge(patient.birthDate);
      if (!Number.isNaN(ageFrom) && age < ageFrom) return false;
      if (!Number.isNaN(ageTo) && age > ageTo) return false;
      if (phototype !== "any" && patient.phototype !== phototype) return false;
      if (consent === "yes" && !patient.consents.imaging) return false;
      if (consent === "no" && patient.consents.imaging) return false;
      if (lesionsFilter === "with_active" && !hasActive) return false;
      if (lesionsFilter === "without_active" && hasActive) return false;
      return true;
    });
  }, [advancedSearch, patients, query, phototype, consent, lesionsFilter]);
  const rows = useMemo(
    () => sortRows(filteredRows, sortMode),
    [filteredRows, sortMode],
  );
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(
    () => rows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, pageSize, rows],
  );
  const changeLogExport = useMemo(
    () => formatChangeLogExport(changeLog),
    [changeLog],
  );
  const previewRow = useMemo(
    () => (previewPatient ? buildRow(previewPatient) : null),
    [previewPatient],
  );
  const firstActionRow = rows[0] ?? null;
  const activeRowsCount = rows.filter((row) => row.hasActive).length;
  const noImagingConsentRowsCount = rows.filter(
    (row) => !row.patient.consents.imaging,
  ).length;
  const upcomingRowsCount = rows.filter((row) => row.nextVisit).length;

  function handleCreateOpen() {
    setStatusMessage(null);
    setLastDeleted(null);
    if (!liveBackend) {
      setStatusMessage(PATIENT_DEMO_CREATE_BLOCKED_MESSAGE);
      return;
    }
    setCreateError(null);
    setCreateDraft(initialPatientDraft());
  }

  async function handleCreateSave() {
    if (!createDraft) return;
    const validationError = validatePatientDraft(createDraft);
    if (validationError) {
      setCreateError(validationError);
      return;
    }
    setSaving(true);
    const result = await createSelfHostedPatient({
      apiBaseUrl: selfHostedSession.apiBaseUrl,
      apiToken: selfHostedSession.apiToken,
      payload: patientDraftToPayload(createDraft),
    });
    setSaving(false);
    if (!result.ok || !result.value) {
      setCreateError(patientApiErrorText(result.error));
      return;
    }
    const patient = selfHostedPatientToDomain(result.value);
    setPatients((current) => [
      patient,
      ...current.filter((item) => item.id !== patient.id),
    ]);
    setStatusMessage(`Пациент ${patient.fullName} создан в системе клиники.`);
    setChangeLog((current) => [
      {
        id: `create-${patient.id}-${current.length + 1}`,
        action: "edit",
        patientCode: patient.code,
        patientName: patient.fullName,
        message: "Создан в системе клиники.",
      },
      ...current,
    ]);
    setCreateDraft(null);
    setCreateError(null);
  }

  function handleEditOpen(patient: Patient) {
    setStatusMessage(null);
    setEditError(null);
    setEditDraft(patientToDraft(patient));
  }

  async function handlePreviewOpen(patient: Patient) {
    if (!liveBackend) {
      setPreviewPatient(patient);
      return;
    }
    setBusyPatientId(patient.id);
    const result = await getSelfHostedPatient({
      apiBaseUrl: selfHostedSession.apiBaseUrl,
      apiToken: selfHostedSession.apiToken,
      patientId: patient.id,
    });
    setBusyPatientId(null);
    if (!result.ok || !result.value) {
      setStatusMessage(
        `Не удалось открыть карточку из системы клиники: ${patientApiErrorText(result.error)}`,
      );
      return;
    }
    setPreviewPatient(selfHostedPatientToDomain(result.value));
  }

  async function handleEditSave() {
    if (!editDraft) return;
    const validationError = validatePatientDraft(editDraft);
    if (validationError) {
      setEditError(validationError);
      return;
    }
    const fullName = editDraft.fullName.trim();
    const previous = patients.find((patient) => patient.id === editDraft.id);

    if (liveBackend) {
      setSaving(true);
      const result = await updateSelfHostedPatient({
        apiBaseUrl: selfHostedSession.apiBaseUrl,
        apiToken: selfHostedSession.apiToken,
        patientId: editDraft.id,
        payload: patientDraftToPayload(editDraft),
      });
      setSaving(false);
      if (!result.ok || !result.value) {
        setEditError(patientApiErrorText(result.error));
        return;
      }
      const updated = selfHostedPatientToDomain(result.value);
      setPatients((current) =>
        current.map((patient) =>
          patient.id === updated.id ? updated : patient,
        ),
      );
      setStatusMessage(
        `Изменения по пациенту ${updated.fullName} сохранены в системе клиники.`,
      );
      setChangeLog((current) => [
        {
          id: `edit-${updated.id}-${current.length + 1}`,
          action: "edit",
          patientCode: updated.code,
          patientName: updated.fullName,
          message: "Обновлены данные пациента в системе клиники.",
        },
        ...current,
      ]);
      setEditDraft(null);
      setEditError(null);
      return;
    }

    setPatients((current) =>
      current.map((patient) =>
        patient.id === editDraft.id
          ? {
              ...patient,
              fullName,
              birthDate: editDraft.birthDate,
              sex: editDraft.sex,
              phototype: editDraft.phototype,
              consents: {
                ...patient.consents,
                imaging: editDraft.imagingConsent,
              },
            }
          : patient,
      ),
    );
    setStatusMessage(
      `Изменения по пациенту ${fullName} сохранены только на этом экране.`,
    );
    setChangeLog((current) => [
      {
        id: `edit-${editDraft.id}-${current.length + 1}`,
        action: "edit",
        patientCode: previous?.code ?? editDraft.id,
        patientName: fullName,
        message: "Обновлены данные пациента на этом экране.",
      },
      ...current,
    ]);
    setEditDraft(null);
    setEditError(null);
  }

  async function handleDeleteConfirm() {
    if (!deleteCandidate) return;
    const patient = deleteCandidate;

    if (liveBackend) {
      setSaving(true);
      const result = await archiveSelfHostedPatient({
        apiBaseUrl: selfHostedSession.apiBaseUrl,
        apiToken: selfHostedSession.apiToken,
        patientId: patient.id,
      });
      setSaving(false);
      if (!result.ok) {
        setStatusMessage(
          `Не удалось архивировать пациента в системе клиники: ${patientApiErrorText(result.error)}`,
        );
        setDeleteCandidate(null);
        return;
      }
      setPatients((current) => current.filter((p) => p.id !== patient.id));
      setPreviewPatient((current) =>
        current?.id === patient.id ? null : current,
      );
      setEditDraft((current) => (current?.id === patient.id ? null : current));
      setLastDeleted(null);
      setStatusMessage(
        `Пациент ${patient.fullName} архивирован в системе клиники.`,
      );
      setChangeLog((current) => [
        {
          id: `archive-${patient.id}-${current.length + 1}`,
          action: "delete",
          patientCode: patient.code,
          patientName: patient.fullName,
          message: "Архивирован в системе клиники.",
        },
        ...current,
      ]);
      setDeleteCandidate(null);
      return;
    }

    setPatients((current) => current.filter((p) => p.id !== patient.id));
    setPreviewPatient((current) =>
      current?.id === patient.id ? null : current,
    );
    setEditDraft((current) => (current?.id === patient.id ? null : current));
    setLastDeleted({ patient });
    setStatusMessage(
      `Пациент ${patient.fullName} скрыт только на этом экране.`,
    );
    setChangeLog((current) => [
      {
        id: `delete-${patient.id}-${current.length + 1}`,
        action: "delete",
        patientCode: patient.code,
        patientName: patient.fullName,
        message: "Скрыт на этом экране.",
      },
      ...current,
    ]);
    setDeleteCandidate(null);
  }

  function handleUndoDelete() {
    if (!lastDeleted) return;
    const restored = lastDeleted.patient;
    setPatients((current) => {
      if (current.some((patient) => patient.id === restored.id)) return current;
      const order = new Map(
        PATIENTS.map((patient, index) => [patient.id, index]),
      );
      return [...current, restored].sort(
        (a, b) =>
          (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
          (order.get(b.id) ?? Number.MAX_SAFE_INTEGER),
      );
    });
    setStatusMessage(`Скрытие пациента ${restored.fullName} отменено.`);
    setChangeLog((current) => [
      {
        id: `restore-${restored.id}-${current.length + 1}`,
        action: "restore",
        patientCode: restored.code,
        patientName: restored.fullName,
        message: "Скрытие отменено.",
      },
      ...current,
    ]);
    setLastDeleted(null);
  }

  function updateAdvancedSearch<K extends keyof AdvancedSearchState>(
    key: K,
    value: AdvancedSearchState[K],
  ) {
    setPage(1);
    setAdvancedSearch((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title="Пациенты"
        subtitle={`В списке: ${patients.length}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {productionMode && !liveBackend ? (
              <Button
                asChild
                type="button"
                size="sm"
                className="min-h-11 gap-1.5 text-[12px] sm:min-h-9"
              >
                <Link
                  to="/self-hosted/login"
                  aria-label="Войти в систему клиники"
                >
                  <ServerCog className="h-3.5 w-3.5" aria-hidden />
                  Войти
                </Link>
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="min-h-11 gap-1.5 text-[12px] sm:min-h-9"
              aria-describedby={PATIENT_DEMO_GATE_ID}
              onClick={handleCreateOpen}
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
              Новый пациент
            </Button>
            {liveBackend ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11 gap-1.5 text-[12px] sm:min-h-9"
                aria-label="Выйти из системы клиники"
                onClick={() => {
                  clearSelfHostedApiSession();
                  setStatusMessage(
                    "Рабочий вход завершён. Открыт учебный режим.",
                  );
                  navigate("/self-hosted/login");
                }}
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                Выйти
              </Button>
            ) : !productionMode ? (
              <Button
                asChild
                type="button"
                size="sm"
                variant="outline"
                className="min-h-11 gap-1.5 text-[12px] sm:min-h-9"
              >
                <Link
                  to="/self-hosted/login"
                  aria-label="Войти в систему клиники"
                >
                  <ServerCog className="h-3.5 w-3.5" aria-hidden />
                  Войти
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <section
        id={PATIENT_DEMO_GATE_ID}
        role="note"
        aria-label="Режим работы списка пациентов"
        className="border-b border-border bg-surface px-6 py-2 text-[12px] text-muted-foreground"
      >
        <span className="font-medium text-foreground">
          {productionMode || liveBackend
            ? "Рабочий режим: "
            : "Учебный режим: "}
        </span>
        {productionMode
          ? liveBackend
            ? PATIENT_PRODUCTION_GATE_MESSAGE
            : "Войдите в систему клиники, чтобы открыть рабочий список пациентов."
          : liveBackend
            ? PATIENT_LIVE_GATE_MESSAGE
            : PATIENT_DEMO_GATE_MESSAGE}
      </section>

      <section
        role="region"
        aria-label="Что делать с пациентами сейчас"
        className="border-b border-border bg-surface px-6 py-3 text-[12px]"
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">
              Что делать сейчас
            </p>
            <h2 className="mt-1 text-[14px] font-semibold">
              {firstActionRow
                ? "Открыть карточку пациента"
                : "Уточнить поиск пациента"}
            </h2>
            <p className="mt-1 text-muted-foreground">
              Найдено:{" "}
              <span className="font-medium text-foreground">{rows.length}</span>{" "}
              · активное наблюдение:{" "}
              <span className="font-medium text-foreground">
                {activeRowsCount}
              </span>{" "}
              · без согласия на съёмку:{" "}
              <span className="font-medium text-foreground">
                {noImagingConsentRowsCount}
              </span>{" "}
              · с ближайшим приёмом:{" "}
              <span className="font-medium text-foreground">
                {upcomingRowsCount}
              </span>
              .
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2 lg:justify-end">
            {firstActionRow ? (
              <Button asChild className="min-h-11 text-[12px]">
                <Link to={`/patients/${firstActionRow.patient.id}`}>
                  Открыть карточку
                </Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 text-[12px]"
                onClick={() => {
                  setQuery("");
                  setAdvancedSearch({
                    code: "",
                    name: "",
                    ageFrom: "",
                    ageTo: "",
                  });
                  setPhototype("any");
                  setConsent("any");
                  setLesionsFilter("any");
                  setPage(1);
                }}
              >
                Сбросить фильтры
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="min-h-11 text-[12px]"
              onClick={handleCreateOpen}
            >
              Создать пациента
            </Button>
          </div>
        </div>
      </section>

      {liveBackend && backendLoadState === "loading" && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label="Статус загрузки пациентов из системы клиники"
          className="border-b border-border bg-info/10 px-6 py-2 text-[12px] text-info"
        >
          Загружаем пациентов из системы клиники…
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-label="Статус действий с пациентами"
          className="flex flex-wrap items-center gap-2 border-b border-border bg-warning/10 px-6 py-2 text-[12px] text-warning"
        >
          <span>{statusMessage}</span>
          {lastDeleted && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 gap-1.5 border-warning/40 bg-surface text-[12px] text-warning hover:bg-warning/10 sm:min-h-8"
              onClick={handleUndoDelete}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Отменить скрытие
            </Button>
          )}
        </div>
      )}

      {/* Тулбар фильтров */}
      <div className="border-b border-border bg-surface px-6 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setPage(1);
                setQuery(e.target.value);
              }}
              placeholder="Поиск по ФИО, номеру карты, полу, фототипу"
              className="min-h-11 pl-7 text-[13px] sm:min-h-8"
              aria-label="Поиск пациента"
            />
          </div>

          <FilterSelect
            label="Фототип"
            value={phototype}
            onChange={(v) => {
              setPage(1);
              setPhototype(v as typeof phototype);
            }}
            options={[
              { value: "any", label: "Любой фототип" },
              ...PHOTOTYPES.map((p) => ({ value: p, label: `Фототип ${p}` })),
            ]}
          />

          <FilterSelect
            label="Согласие на съёмку"
            value={consent}
            onChange={(v) => {
              setPage(1);
              setConsent(v as ConsentFilter);
            }}
            options={[
              { value: "any", label: "Любое согласие" },
              { value: "yes", label: "Согласие есть" },
              { value: "no", label: "Согласия нет" },
            ]}
          />

          <FilterSelect
            label="Очаги"
            value={lesionsFilter}
            onChange={(v) => {
              setPage(1);
              setLesionsFilter(v as LesionsFilter);
            }}
            options={[
              { value: "any", label: "Все пациенты" },
              { value: "with_active", label: "С очагами в наблюдении" },
              { value: "without_active", label: "Без активных" },
            ]}
          />

          <FilterSelect
            label="Сортировка пациентов"
            value={sortMode}
            onChange={(v) => {
              setPage(1);
              setSortMode(v as SortMode);
            }}
            options={[
              { value: "name_asc", label: "ФИО А-Я" },
              { value: "name_desc", label: "ФИО Я-А" },
              { value: "age_asc", label: "Возраст по возрастанию" },
              { value: "age_desc", label: "Возраст по убыванию" },
              { value: "last_visit_desc", label: "Сначала недавний визит" },
            ]}
          />

          <FilterSelect
            label="Строк на странице"
            value={String(pageSize)}
            onChange={(v) => {
              setPage(1);
              setPageSize(Number(v) as (typeof PAGE_SIZE_OPTIONS)[number]);
            }}
            options={PAGE_SIZE_OPTIONS.map((value) => ({
              value: String(value),
              label: `${value} строки`,
            }))}
          />

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 gap-1.5 text-[12px] sm:min-h-8"
                aria-label="Расширенный поиск пациентов"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
                Расширенный поиск
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>

          <span className="ml-auto text-meta">
            Найдено:{" "}
            <span className="text-foreground tabular-nums">{rows.length}</span>
          </span>
        </div>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleContent>
            <div
              className="mt-2 grid gap-2 rounded-md border border-border bg-surface-muted p-3 sm:grid-cols-4"
              aria-label="Поля расширенного поиска"
            >
              <Input
                value={advancedSearch.code}
                onChange={(e) => updateAdvancedSearch("code", e.target.value)}
                placeholder="Номер карты"
                className="min-h-11 text-[13px] sm:min-h-8"
                aria-label="Расширенный поиск по номеру карты"
              />
              <Input
                value={advancedSearch.name}
                onChange={(e) => updateAdvancedSearch("name", e.target.value)}
                placeholder="ФИО"
                className="min-h-11 text-[13px] sm:min-h-8"
                aria-label="Расширенный поиск по ФИО"
              />
              <Input
                value={advancedSearch.ageFrom}
                onChange={(e) =>
                  updateAdvancedSearch("ageFrom", e.target.value)
                }
                placeholder="Возраст от"
                inputMode="numeric"
                className="min-h-11 text-[13px] sm:min-h-8"
                aria-label="Возраст пациента от"
              />
              <Input
                value={advancedSearch.ageTo}
                onChange={(e) => updateAdvancedSearch("ageTo", e.target.value)}
                placeholder="Возраст до"
                inputMode="numeric"
                className="min-h-11 text-[13px] sm:min-h-8"
                aria-label="Возраст пациента до"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {changeLog.length > 0 && (
        <section
          aria-label="Журнал изменений пациентов"
          className="border-b border-border bg-surface px-6 py-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-[12px] font-medium text-foreground">
              <History
                className="h-3.5 w-3.5 text-muted-foreground"
                aria-hidden
              />
              Журнал изменений
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="ml-auto min-h-11 gap-1.5 text-[12px] sm:min-h-8"
              onClick={() => setExportOpen(true)}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Экспорт журнала
            </Button>
          </div>
          <ul className="mt-1 space-y-1 text-[12px] text-muted-foreground">
            {changeLog.slice(0, 3).map((entry) => (
              <li key={entry.id}>
                <span className="text-[11px] text-muted-foreground">
                  {formatCardNumber(entry.patientCode)}
                </span>{" "}
                <span className="text-foreground">{entry.patientName}</span>:{" "}
                {entry.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex-1 overflow-auto px-6 py-6">
        {rows.length === 0 ? (
          <div className="surface-card p-12 text-center text-row text-muted-foreground">
            {productionMode && backendLoadState === "error"
              ? "Система клиники недоступна. Рабочий режим не показывает учебные данные."
              : "Под текущие фильтры пациентов не найдено."}
          </div>
        ) : (
          <>
            {/* Desktop таблица */}
            <div className="surface-card hidden overflow-hidden md:block">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-[120px]">Номер</th>
                      <th>ФИО</th>
                      <th className="w-[60px]">Возр.</th>
                      <th className="w-[50px]">Пол</th>
                      <th className="w-[80px]">Фототип</th>
                      <th className="w-[110px]">Отметки</th>
                      <th className="w-[130px]">Согласие</th>
                      <th className="w-[100px]">Очаги</th>
                      <th className="w-[120px]">Посл. визит</th>
                      <th className="w-[120px]">След. визит</th>
                      <th className="w-[120px]" aria-label="Действия" />
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((r) => (
                      <tr key={r.patient.id}>
                        <td className="text-[12px] text-muted-foreground">
                          {formatCardNumber(r.patient.code)}
                        </td>
                        <td>
                          <Link
                            to={`/patients/${r.patient.id}`}
                            className="font-medium hover:underline"
                          >
                            {r.patient.fullName}
                          </Link>
                        </td>
                        <td className="tabular-nums">{r.age}</td>
                        <td>{sexShort(r.patient.sex)}</td>
                        <td>{r.patient.phototype}</td>
                        <td className="tabular-nums">
                          {r.patient.riskFactors.length}
                        </td>
                        <td>
                          <ConsentChip ok={r.patient.consents.imaging} />
                        </td>
                        <td className="tabular-nums">{r.lesionCount}</td>
                        <td className="text-[12px] text-muted-foreground tabular-nums">
                          {formatDate(r.lastVisit)}
                        </td>
                        <td className="text-[12px] text-muted-foreground tabular-nums">
                          {formatDate(r.nextVisit)}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              aria-label={`Просмотреть пациента ${r.patient.fullName}`}
                              onClick={() => void handlePreviewOpen(r.patient)}
                              disabled={busyPatientId === r.patient.id}
                            >
                              <Eye className="h-4 w-4" aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              aria-label={`Редактировать пациента ${r.patient.fullName}`}
                              onClick={() => handleEditOpen(r.patient)}
                            >
                              <Pencil className="h-4 w-4" aria-hidden />
                            </Button>
                            <Link
                              to={`/patients/${r.patient.id}`}
                              aria-label={`Открыть карточку ${r.patient.fullName}`}
                              className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                            >
                              <ChevronRight className="h-4 w-4" aria-hidden />
                            </Link>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              aria-label={`Скрыть пациента ${r.patient.fullName}`}
                              onClick={() => setDeleteCandidate(r.patient)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile стек */}
            <ul className="space-y-2 md:hidden">
              {pagedRows.map((r) => (
                <li key={r.patient.id}>
                  <div className="surface-card p-3">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/patients/${r.patient.id}`}
                        className="min-w-0 flex-1 active:bg-surface-muted"
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-row font-medium">
                            {r.patient.fullName}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatCardNumber(r.patient.code)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-meta">
                          {sexShort(r.patient.sex)} · {r.age} лет · фототип{" "}
                          {r.patient.phototype} · очагов {r.lesionCount}
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <ConsentChip ok={r.patient.consents.imaging} />
                          <span className="tabular-nums">
                            Посл. {formatDate(r.lastVisit)}
                          </span>
                          <span className="tabular-nums">
                            След. {formatDate(r.nextVisit)}
                          </span>
                        </div>
                      </Link>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="min-h-11 min-w-11 text-muted-foreground hover:text-foreground"
                          aria-label={`Просмотреть пациента ${r.patient.fullName}`}
                          onClick={() => void handlePreviewOpen(r.patient)}
                          disabled={busyPatientId === r.patient.id}
                        >
                          <Eye className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="min-h-11 min-w-11 text-muted-foreground hover:text-foreground"
                          aria-label={`Редактировать пациента ${r.patient.fullName}`}
                          onClick={() => handleEditOpen(r.patient)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="min-h-11 min-w-11 text-muted-foreground hover:text-destructive"
                          aria-label={`Скрыть пациента ${r.patient.fullName}`}
                          onClick={() => setDeleteCandidate(r.patient)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
        {rows.length > 0 && (
          <nav
            className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground"
            aria-label="Пагинация пациентов"
          >
            <span>
              Страница{" "}
              <span className="text-foreground tabular-nums">
                {currentPage}
              </span>{" "}
              из{" "}
              <span className="text-foreground tabular-nums">{totalPages}</span>
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 text-[12px] sm:min-h-8"
                onClick={() => setPage((n) => Math.max(1, n - 1))}
                disabled={currentPage === 1}
              >
                Назад
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 text-[12px] sm:min-h-8"
                onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
                disabled={currentPage === totalPages}
              >
                Вперёд
              </Button>
            </div>
          </nav>
        )}
      </div>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Экспорт журнала изменений</DialogTitle>
            <DialogDescription>
              Текст подготовлен для ручного копирования без доступа к буферу
              обмена или файловой системе.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            readOnly
            value={changeLogExport}
            aria-label="Текст экспорта журнала изменений"
            className="min-h-48 font-mono text-[12px]"
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button">Закрыть</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewRow}
        onOpenChange={(open) => {
          if (!open) setPreviewPatient(null);
        }}
      >
        {previewRow && (
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Просмотр пациента</DialogTitle>
              <DialogDescription>
                Быстрый просмотр карточки без изменения данных.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3 text-[13px] sm:grid-cols-2">
              <PreviewField
                label="Номер карты"
                value={formatCardNumber(previewRow.patient.code)}
              />
              <PreviewField label="ФИО" value={previewRow.patient.fullName} />
              <PreviewField label="Возраст" value={`${previewRow.age} лет`} />
              <PreviewField
                label="Пол"
                value={sexShort(previewRow.patient.sex)}
              />
              <PreviewField
                label="Фототип"
                value={previewRow.patient.phototype}
              />
              <PreviewField
                label="Согласие на съёмку"
                value={previewRow.patient.consents.imaging ? "Есть" : "Нет"}
              />
              <PreviewField
                label="Очаги"
                value={String(previewRow.lesionCount)}
              />
              <PreviewField
                label="Последний визит"
                value={formatDate(previewRow.lastVisit)}
              />
              <PreviewField
                label="Следующий визит"
                value={formatDate(previewRow.nextVisit)}
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Закрыть
                </Button>
              </DialogClose>
              <Button asChild>
                <Link to={`/patients/${previewRow.patient.id}`}>
                  Открыть карточку
                </Link>
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>

      <AlertDialog
        open={!!deleteCandidate}
        onOpenChange={(open) => {
          if (!open) setDeleteCandidate(null);
        }}
      >
        {deleteCandidate && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {liveBackend
                  ? "Архивировать пациента?"
                  : "Скрыть пациента на этом экране?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {liveBackend
                  ? `Пациент ${deleteCandidate.fullName} будет архивирован в системе клиники. Физическое удаление не выполняется.`
                  : `Пациент ${deleteCandidate.fullName} будет скрыт только на этой странице. Реальные данные клиники не изменяются.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отмена</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => void handleDeleteConfirm()}
                disabled={saving}
              >
                {liveBackend ? "Архивировать" : "Скрыть на этом экране"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>

      <Dialog
        open={!!createDraft}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDraft(null);
            setCreateError(null);
          }
        }}
      >
        {createDraft && (
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Новый пациент</DialogTitle>
              <DialogDescription>
                Пациент будет создан в системе клиники. Не используйте форму без
                рабочего входа.
              </DialogDescription>
            </DialogHeader>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreateSave();
              }}
            >
              <PatientDraftFields
                draft={createDraft}
                setDraft={setCreateDraft}
                clearError={() => setCreateError(null)}
              />

              {createError && (
                <div role="alert" className="text-[12px] text-destructive">
                  {createError}
                </div>
              )}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Отмена
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={saving}>
                  {saving ? "Создаём…" : "Создать пациента"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      <Dialog
        open={!!editDraft}
        onOpenChange={(open) => {
          if (!open) {
            setEditDraft(null);
            setEditError(null);
          }
        }}
      >
        {editDraft && (
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Редактировать пациента</DialogTitle>
              <DialogDescription>
                {liveBackend
                  ? "Изменения сохраняются в системе клиники."
                  : "Изменения сохраняются только на этом экране."}
              </DialogDescription>
            </DialogHeader>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void handleEditSave();
              }}
            >
              <PatientDraftFields
                draft={editDraft}
                setDraft={setEditDraft}
                clearError={() => setEditError(null)}
                liveBackend={liveBackend}
              />

              {editError && (
                <div role="alert" className="text-[12px] text-destructive">
                  {editError}
                </div>
              )}

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Отмена
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={saving}>
                  {saving ? "Сохраняем…" : "Сохранить изменения"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

function PreviewField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-muted p-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-foreground ${mono ? "font-mono text-[12px]" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function PatientDraftFields({
  draft,
  setDraft,
  clearError,
  liveBackend = false,
}: {
  draft: PatientEditDraft;
  setDraft: Dispatch<SetStateAction<PatientEditDraft | null>>;
  clearError: () => void;
  liveBackend?: boolean;
}) {
  const prefix = draft.id === "new-patient" ? "patient-create" : "patient-edit";
  return (
    <>
      <div className="grid gap-2">
        <Label htmlFor={`${prefix}-full-name`}>ФИО</Label>
        <Input
          id={`${prefix}-full-name`}
          value={draft.fullName}
          onChange={(e) => {
            clearError();
            setDraft((current) =>
              current ? { ...current, fullName: e.target.value } : current,
            );
          }}
          className="h-9 text-[13px]"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor={`${prefix}-birth-date`}>Дата рождения</Label>
          <Input
            id={`${prefix}-birth-date`}
            type="date"
            value={draft.birthDate}
            onChange={(e) =>
              setDraft((current) =>
                current ? { ...current, birthDate: e.target.value } : current,
              )
            }
            className="h-9 text-[13px]"
          />
        </div>

        <div className="grid gap-2">
          <Label>Пол</Label>
          <Select
            value={draft.sex}
            onValueChange={(value) =>
              setDraft((current) =>
                current ? { ...current, sex: value as Sex } : current,
              )
            }
          >
            <SelectTrigger
              className="h-9 text-[13px]"
              aria-label="Пол пациента"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="female">Женский</SelectItem>
              <SelectItem value="male">Мужской</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Фототип</Label>
          <Select
            value={draft.phototype}
            onValueChange={(value) =>
              setDraft((current) =>
                current
                  ? { ...current, phototype: value as Phototype }
                  : current,
              )
            }
          >
            <SelectTrigger
              className="h-9 text-[13px]"
              aria-label="Фототип пациента"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PHOTOTYPES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-border bg-surface-muted p-3">
        <Checkbox
          id={`${prefix}-imaging-consent`}
          checked={draft.imagingConsent}
          onCheckedChange={(checked) =>
            setDraft((current) =>
              current
                ? { ...current, imagingConsent: checked === true }
                : current,
            )
          }
        />
        <div className="grid gap-1">
          <Label htmlFor={`${prefix}-imaging-consent`} className="text-[13px]">
            Согласие на медицинскую съёмку
          </Label>
          <p className="text-[12px] text-muted-foreground">
            {liveBackend
              ? "Значение будет сохранено в системе клиники."
              : "В учебном режиме меняется только отображение на текущей странице."}
          </p>
        </div>
      </div>
    </>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className="min-h-11 min-w-[160px] text-[12px] sm:min-h-8"
        aria-label={label}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-[12px]">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ConsentChip({ ok }: { ok: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium leading-none"
      style={
        ok
          ? {
              background: "hsl(var(--success) / 0.1)",
              color: "hsl(var(--success))",
              borderColor: "hsl(var(--success) / 0.35)",
            }
          : {
              background: "hsl(var(--muted))",
              color: "hsl(var(--muted-foreground))",
              borderColor: "hsl(var(--border))",
            }
      }
    >
      {ok ? "Есть" : "Нет"}
    </span>
  );
}
