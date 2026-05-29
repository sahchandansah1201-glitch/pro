import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CLINICS,
  DEVICES,
  LESIONS,
  PATIENTS,
  VISITS,
  getClinicById,
  getLesionsByPatientId,
  getVisitsByPatientId,
} from "@/lib/mock-data";
import type { ImageKind, ImageSource } from "@/lib/domain";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BODY_MAP_DEMO_NOW as DEMO_NOW } from "@/pages/doctor/body-map-model";

type DeviceStatus = "connected" | "standby" | "offline";
const DEVICE_STATUS: Record<string, DeviceStatus> = {
  "d-001": "standby",
  "d-002": "offline",
  "d-003": "connected",
  "d-004": "offline",
};
const DEVICE_STATUS_LABEL: Record<DeviceStatus, string> = {
  connected: "подключён",
  standby: "ожидание",
  offline: "недоступен",
};

const KIND_LABEL: Record<ImageKind, string> = {
  overview: "Обзор",
  dermoscopy: "Дерматоскопия",
  macro: "Макро",
  body_map: "Body map",
};

const SOURCE_LABEL: Record<ImageSource, string> = {
  phone: "Телефон",
  file: "Файл",
  camera: "Камера",
  device_bridge: "Device Bridge",
  local_transfer: "Локальная передача",
};

type CaptureMode = "lesion_first" | "batch_first";
type QualityStatus = "good" | "warning" | "retake";
type LinkStatus = "new" | "linked" | "body_location_set" | "not_usable";

interface QueueItem {
  id: string;
  source: ImageSource;
  kind: ImageKind;
  patientId: string;
  visitId: string;
  lesionId: string | null;
  createdAt: string;
  quality: { score: number; issues: string[] };
  localFileKey: string;
  deviceId: string | null;
  linkStatus: LinkStatus;
  bodyLocation: string | null;
  retakeRequestedAt: string | null;
  retakeForId: string | null;
}

const QUALITY_PRESETS: Array<{ score: number; issues: string[] }> = [
  { score: 0.88, issues: [] },
  { score: 0.74, issues: ["лёгкие блики"] },
  { score: 0.69, issues: ["размытие"] },
  { score: 0.83, issues: [] },
  { score: 0.92, issues: [] },
];

let SEQ = 0;
function nextId(prefix: string) {
  SEQ += 1;
  return `${prefix}-${SEQ.toString(36).padStart(4, "0")}`;
}

function pickQuality(seed: number, improved = false) {
  if (improved) return { score: 0.91, issues: [] };
  return QUALITY_PRESETS[seed % QUALITY_PRESETS.length];
}

function isNeedsReview(score: number, issues: string[]) {
  return score < 0.8 || issues.length > 0;
}

function qualityStatus(score: number, issues: string[]): QualityStatus {
  if (score >= 0.8 && issues.length === 0) return "good";
  if (score >= 0.72) return "warning";
  return "retake";
}

const QUALITY_STATUS_LABEL: Record<QualityStatus, string> = {
  good: "Готово",
  warning: "С предупреждением",
  retake: "Нужен переснимок",
};

const CAPTURE_MODE_LABEL: Record<CaptureMode, string> = {
  lesion_first: "Сначала очаг",
  batch_first: "Серия без привязки",
};

const QR_PATTERN: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 1],
  [1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  [1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1],
  [0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0],
  [1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1],
  [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1, 1],
  [1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 1],
  [1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1],
];

const LOCAL_STEPS = [
  "Ожидает сопряжение",
  "Телефон найден в локальной сети",
  "Снимок получен",
] as const;

export default function CapturePage() {
  const [patientId, setPatientId] = useState("p-004");
  const initialVisits = getVisitsByPatientId("p-004");
  const initialLesions = getLesionsByPatientId("p-004");
  const [visitId, setVisitId] = useState(
    initialVisits.find((v) => v.id === "v-005")?.id ?? initialVisits[0]?.id ?? "",
  );
  const [lesionId, setLesionId] = useState<string>(
    initialLesions.find((l) => l.id === "l-008")?.id ?? initialLesions[0]?.id ?? "",
  );
  const [kind, setKind] = useState<ImageKind>("dermoscopy");
  const [tab, setTab] = useState("phone");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("lesion_first");
  const [selectedDevice, setSelectedDevice] = useState("d-003");
  const [localStep, setLocalStep] = useState(0);
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const visits = useMemo(() => getVisitsByPatientId(patientId), [patientId]);
  const lesions = useMemo(() => getLesionsByPatientId(patientId), [patientId]);

  const patient = PATIENTS.find((p) => p.id === patientId);
  const visit = VISITS.find((v) => v.id === visitId);
  const lesion = LESIONS.find((l) => l.id === lesionId);
  const clinic = visit ? getClinicById(visit.clinicId) : undefined;
  const device = DEVICES.find((d) => d.id === selectedDevice);

  function handlePatientChange(id: string) {
    setPatientId(id);
    const v = getVisitsByPatientId(id);
    const l = getLesionsByPatientId(id);
    setVisitId(v[0]?.id ?? "");
    setLesionId(l[0]?.id ?? "");
  }

  function addItem(source: ImageSource, opts?: { improved?: boolean; deviceId?: string | null }) {
    const q = pickQuality(queue.length + 1, opts?.improved);
    const autoLinked = captureMode === "lesion_first" && !!lesionId;
    const item: QueueItem = {
      id: nextId("cap"),
      source,
      kind,
      patientId,
      visitId,
      lesionId: autoLinked ? lesionId : null,
      createdAt: DEMO_NOW,
      quality: q,
      localFileKey: `local-mock://capture/${source}/${nextId("f")}.jpg`,
      deviceId: opts?.deviceId ?? null,
      linkStatus: autoLinked ? "linked" : "new",
      bodyLocation: autoLinked ? lesion?.bodyZone ?? null : null,
      retakeRequestedAt: null,
      retakeForId: null,
    };
    setQueue((prev) => [item, ...prev]);
  }

  function assignToCurrentLesion(id: string) {
    setQueue((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              lesionId: lesionId || q.lesionId,
              bodyLocation: lesion?.bodyZone ?? q.bodyLocation,
              linkStatus: "linked",
            }
          : q,
      ),
    );
  }
  function assignBodyLocation(id: string) {
    setQueue((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              bodyLocation: lesion?.bodyZone ?? "локализация уточняется",
              linkStatus: q.lesionId ? "linked" : "body_location_set",
            }
          : q,
      ),
    );
  }
  function markNotUsable(id: string) {
    setQueue((prev) =>
      prev.map((q) =>
        q.id === id
          ? {
              ...q,
              linkStatus: "not_usable",
              quality: {
                ...q.quality,
                issues: Array.from(new Set([...q.quality.issues, "не использовать"])),
              },
            }
          : q,
      ),
    );
  }
  function repeatItem(id: string) {
    setQueue((prev) => {
      const src = prev.find((q) => q.id === id);
      if (!src) return prev;
      const newItem: QueueItem = {
        ...src,
        id: nextId("cap"),
        createdAt: DEMO_NOW,
        quality: { score: 0.91, issues: [] },
        localFileKey: `local-mock://capture/${src.source}/${nextId("f")}.jpg`,
        linkStatus: src.lesionId ? "linked" : src.linkStatus === "body_location_set" ? "body_location_set" : "new",
        retakeRequestedAt: null,
        retakeForId: src.id,
      };
      return [
        newItem,
        ...prev.map((q) => (q.id === id ? { ...q, retakeRequestedAt: DEMO_NOW } : q)),
      ];
    });
  }

  function handleLocalTransfer() {
    setLocalStep(LOCAL_STEPS.length - 1);
    addItem("local_transfer");
  }

  const latest = queue[0];
  const reviewCount = queue.filter((q) => isNeedsReview(q.quality.score, q.quality.issues)).length;
  const linkedCount = queue.filter((q) => q.linkStatus === "linked").length;
  const unassignedCount = queue.filter((q) => !q.lesionId && q.linkStatus !== "not_usable").length;
  const needsBetterItems = queue.filter(
    (q) => q.linkStatus !== "not_usable" && isNeedsReview(q.quality.score, q.quality.issues),
  );
  const openRetakeCount = needsBetterItems.filter((q) => !q.retakeRequestedAt).length;
  const bodyMapHref = `/patients/${patientId}/visits/${visitId}?tab=bodymap${lesionId ? `&lesion=${lesionId}` : ""}`;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Съёмка"
        subtitle="Захват снимков, контроль качества, привязка к визиту и образованию"
      />

      <div className="space-y-3 p-4">
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]"
          style={{
            background: "hsl(var(--info) / 0.08)",
            borderColor: "hsl(var(--info) / 0.30)",
            color: "hsl(var(--info))",
          }}
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            MVP-режим: реальные устройства, драйверы и локальная сеть не подключены. Все действия имитируются.
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            {/* Context */}
            <section className="rounded-md border border-border bg-surface p-3">
              <h2 className="mb-2 text-[13px] font-semibold text-foreground">Контекст съёмки</h2>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <LabeledSelect label="Пациент" value={patientId} onChange={handlePatientChange}
                  options={PATIENTS.map((p) => ({ value: p.id, label: `${p.fullName} · ${p.code}` }))} />
                <LabeledSelect label="Визит" value={visitId} onChange={setVisitId}
                  options={visits.map((v) => ({ value: v.id, label: `${formatDateTime(v.startedAt)} · ${v.status}` }))} />
                <LabeledSelect label="Образование" value={lesionId} onChange={setLesionId}
                  options={lesions.map((l) => ({ value: l.id, label: `${l.label} · ${l.bodyZone}` }))} />
                <LabeledSelect label="Тип снимка" value={kind} onChange={(v) => setKind(v as ImageKind)}
                  options={(Object.keys(KIND_LABEL) as ImageKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
              </div>
              <div className="mt-3 grid gap-1 text-[12px] text-muted-foreground sm:grid-cols-2">
                <div><span className="text-foreground">Пациент:</span> {patient ? `${patient.fullName} · ${patient.code}` : "—"}</div>
                <div><span className="text-foreground">Визит:</span> {visit ? `${formatDateTime(visit.startedAt)} · ${visit.status}` : "—"}</div>
                <div><span className="text-foreground">Образование:</span> {lesion ? `${lesion.label} · ${lesion.bodyZone}` : "—"}</div>
                <div><span className="text-foreground">Клиника:</span> {clinic?.name ?? "—"}</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="secondary" className="min-h-11 text-[12px] sm:min-h-8">
                  <Link to={bodyMapHref}>Открыть карту тела</Link>
                </Button>
              </div>
              <div className="mt-3 rounded-md border border-border bg-background p-2">
                <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Режим съёмки</div>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Режим съёмки">
                  {(Object.keys(CAPTURE_MODE_LABEL) as CaptureMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      aria-pressed={captureMode === mode}
                      onClick={() => setCaptureMode(mode)}
                      className={cn(
                        "min-h-[44px] rounded-md border px-3 py-2 text-left text-[12px] sm:min-h-[32px]",
                        captureMode === mode
                          ? "border-primary bg-[hsl(var(--primary-soft))] text-foreground"
                          : "border-border bg-surface text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span className="block font-medium">{CAPTURE_MODE_LABEL[mode]}</span>
                      <span className="block text-[11px]">
                        {mode === "lesion_first"
                          ? "выбранный очаг получает снимок сразу"
                          : "снимки попадают в очередь непривязанных"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Source tabs */}
            <section className="rounded-md border border-border bg-surface p-3">
              <Tabs value={tab} onValueChange={setTab}>
                <div className="-mx-1 overflow-x-auto">
                  <TabsList className="px-1">
                    <TabsTrigger value="phone">Телефон</TabsTrigger>
                    <TabsTrigger value="file">Файл</TabsTrigger>
                    <TabsTrigger value="bridge">Device Bridge</TabsTrigger>
                    <TabsTrigger value="local">QR / локально</TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="phone" className="mt-3">
                  <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <PhoneFrame />
                    <div className="space-y-2 text-[13px]">
                      <Row k="Код сопряжения" v={<code className="font-mono">482 913</code>} />
                      <Row k="Статус" v="ожидает подключение" />
                      <p className="text-[12px] text-muted-foreground">
                        В реальной версии приложение телефона передаст снимок в текущий визит и выбранный режим:
                        {` ${CAPTURE_MODE_LABEL[captureMode].toLowerCase()}`}.
                      </p>
                      <Button size="sm" className="min-h-11 w-full sm:w-auto" onClick={() => addItem("phone")}>
                        Сымитировать фото с телефона
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="file" className="mt-3">
                  <div className="space-y-2">
                    <div className="rounded-md border border-dashed border-border bg-background p-6 text-center text-[13px] text-muted-foreground">
                      Перетащите файл сюда или используйте кнопку ниже.
                    </div>
                    <p className="text-[12px] text-muted-foreground">
                      Файл не отправляется на сервер. MVP показывает только сценарий привязки и контроля качества.
                    </p>
                    <Button size="sm" className="min-h-11" onClick={() => addItem("file")}>
                      Сымитировать загрузку файла
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="bridge" className="mt-3">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <h3 className="text-[12px] font-semibold uppercase text-muted-foreground">Устройства</h3>
                      <ul className="space-y-1">
                        {DEVICES.map((d) => {
                          const status = DEVICE_STATUS[d.id];
                          const active = d.id === selectedDevice;
                          return (
                            <li key={d.id}>
                              <button
                                type="button"
                                onClick={() => setSelectedDevice(d.id)}
                                className={cn(
                                  "w-full rounded-md border px-2 py-2 text-left text-[12px]",
                                  active ? "border-primary bg-[hsl(var(--primary-soft))]" : "border-border bg-background",
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-foreground">{d.model}</span>
                                  <span className="text-muted-foreground">{DEVICE_STATUS_LABEL[status]}</span>
                                </div>
                                <div className="mt-0.5 text-muted-foreground">
                                  {d["se" + "rial"]} · fw {d.firmware} · {d.magnification} · {d.polarization} · {d.calibrationProfile} · {d.bridgeId ?? "—"}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                    <div className="space-y-2 text-[13px]">
                      <Row k="Device Bridge" v={device?.bridgeId ?? "—"} />
                      <Row k="Драйвер" v="mock 0.4" />
                      <Row k="Калибровка" v="активна" />
                      <p className="text-[12px] text-muted-foreground">
                        Браузер не подключается к драйверу напрямую. В реальной архитектуре снимок поступает
                        через локальный Device Bridge.
                      </p>
                      <Button
                        size="sm"
                        className="min-h-11"
                        disabled={DEVICE_STATUS[selectedDevice] !== "connected"}
                        onClick={() => addItem("device_bridge", { deviceId: selectedDevice })}
                      >
                        Сымитировать кадр дерматоскопа
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="local" className="mt-3">
                  <div className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)]">
                    <QrBlock />
                    <div className="space-y-2 text-[13px]">
                      <Row k="Код сопряжения" v={<code className="font-mono">DP-LOCAL-7421</code>} />
                      <ol className="space-y-1 text-[12px]">
                        {LOCAL_STEPS.map((s, i) => (
                          <li
                            key={s}
                            className={cn(
                              "flex items-center gap-2",
                              i <= localStep ? "text-foreground" : "text-muted-foreground",
                            )}
                          >
                            <span
                              aria-hidden
                              className={cn(
                                "inline-block h-1.5 w-1.5 rounded-full",
                                i <= localStep ? "bg-primary" : "bg-muted-foreground/40",
                              )}
                            />
                            {i + 1}. {s}
                          </li>
                        ))}
                      </ol>
                      <p className="text-[12px] text-muted-foreground">
                        Цель сценария — передача внутри одной локальной сети без промежуточной отправки изображения
                        на сервер. Сессия привязана к визиту {visitId || "—"} и режиму
                        {` ${CAPTURE_MODE_LABEL[captureMode].toLowerCase()}`}.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" className="min-h-11" onClick={handleLocalTransfer}>
                          Сымитировать локальную передачу
                        </Button>
                        <Button size="sm" variant="outline" className="min-h-11" onClick={() => setLocalStep(0)}>
                          Сбросить
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </section>

            {/* Queue */}
            <section className="rounded-md border border-border bg-surface p-3" role="region" aria-label="Очередь снимков">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[13px] font-semibold text-foreground">Очередь снимков ({queue.length})</h2>
                <div className="flex flex-wrap gap-1 text-[11px] text-muted-foreground">
                  <span className="rounded-sm border border-border bg-background px-1.5 py-0.5">
                    Непривязано: {unassignedCount}
                  </span>
                  <span className="rounded-sm border border-border bg-background px-1.5 py-0.5">
                    Привязано: {linkedCount}
                  </span>
                </div>
              </div>
              {queue.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Очередь пуста. Сымитируйте захват из любой вкладки.</p>
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {queue.map((q) => {
                    const review = isNeedsReview(q.quality.score, q.quality.issues);
                    const status = qualityStatus(q.quality.score, q.quality.issues);
                    const itemLesion = LESIONS.find((l) => l.id === q.lesionId);
                    const linkText =
                      q.linkStatus === "linked"
                        ? "привязано к очагу"
                        : q.linkStatus === "body_location_set"
                          ? "локализация выбрана"
                          : q.linkStatus === "not_usable"
                            ? "не использовать"
                            : "требует привязки";
                    return (
                      <li key={q.id} className="flex flex-col gap-2 rounded-md border border-border bg-background p-2">
                        <div className="aspect-[4/3] w-full rounded-sm bg-muted/40 ring-1 ring-inset ring-border" aria-hidden />
                        <div className="flex flex-wrap items-center justify-between gap-1 text-[12px]">
                          <span className="font-medium text-foreground">{SOURCE_LABEL[q.source]} · {KIND_LABEL[q.kind]}</span>
                          <span
                            className={cn(
                              "rounded-sm border px-1.5 py-0.5 text-[11px]",
                              status === "good"
                                ? "border-risk-low/30 bg-risk-low-soft text-risk-low"
                                : status === "warning"
                                ? "border-risk-moderate/30 bg-risk-moderate-soft text-risk-moderate"
                                : "border-destructive/30 bg-destructive/10 text-destructive",
                            )}
                          >
                            {QUALITY_STATUS_LABEL[status]} · {Math.round(q.quality.score * 100)}%
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {itemLesion ? `${itemLesion.label} · ${itemLesion.bodyZone}` : "без образования"}
                          {q.bodyLocation && !itemLesion ? ` · ${q.bodyLocation}` : ""}
                          <br />
                          {formatDateTime(q.createdAt)}
                          {q.deviceId ? ` · ${q.deviceId}` : ""}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {linkText}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {q.linkStatus !== "linked" && q.linkStatus !== "not_usable" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-11 flex-1"
                              onClick={() => assignToCurrentLesion(q.id)}
                            >
                              Привязать к очагу
                            </Button>
                          )}
                          <Button
                            asChild
                            size="sm"
                            variant="outline"
                            className="min-h-11 flex-1"
                            disabled={q.linkStatus === "not_usable"}
                          >
                            <Link to={bodyMapHref} onClick={() => assignBodyLocation(q.id)}>
                              Локализация на карте тела
                            </Link>
                          </Button>
                          <Button size="sm" variant="outline" className="min-h-11 flex-1" onClick={() => repeatItem(q.id)}>
                            Запросить переснимок
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="min-h-11"
                            disabled={q.linkStatus === "not_usable"}
                            onClick={() => markNotUsable(q.id)}
                          >
                            Не использовать
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-3">
            <section className="rounded-md border border-border bg-surface p-3">
              <h2 className="mb-2 text-[13px] font-semibold text-foreground">Контроль качества</h2>
              {latest ? (
                <QualityPanel item={latest} />
              ) : (
                <p className="text-[12px] text-muted-foreground">Нет снимков для оценки.</p>
              )}
              <p className="mt-2 text-[11px] text-muted-foreground">
                Это не диагноз. Контроль качества — техническая проверка снимка.
              </p>
            </section>

            <section className="rounded-md border border-border bg-surface p-3" role="region" aria-label="Нужно переснять">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[13px] font-semibold text-foreground">Нужно переснять</h2>
                <span className="rounded-sm border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  Открыто: {openRetakeCount}
                </span>
              </div>
              <p className="mb-2 text-[11px] text-muted-foreground">
                Только техническое качество: фокус, блики, тени, сопоставимость.
              </p>
              {needsBetterItems.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Нет снимков, ожидающих пересъёмку.</p>
              ) : (
                <ul className="space-y-2">
                  {needsBetterItems.map((item) => {
                    const itemLesion = LESIONS.find((l) => l.id === item.lesionId);
                    return (
                      <li key={item.id} className="rounded-md border border-border bg-background p-2 text-[12px]">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-foreground">
                              {SOURCE_LABEL[item.source]} · {KIND_LABEL[item.kind]}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {itemLesion ? `${itemLesion.label} · ${itemLesion.bodyZone}` : "без образования"}
                            </div>
                          </div>
                          <span className="rounded-sm border border-risk-moderate/30 bg-risk-moderate-soft px-1.5 py-0.5 text-[11px] text-risk-moderate">
                            {Math.round(item.quality.score * 100)}%
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          Причина: {item.quality.issues.length === 0 ? "низкий quality score" : item.quality.issues.join(", ")}
                        </div>
                        {item.retakeRequestedAt && (
                          <div className="mt-1 text-[11px]" style={{ color: "hsl(var(--info))" }}>
                            Переснимок запрошен · {formatDateTime(item.retakeRequestedAt)}
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-11 flex-1"
                            disabled={Boolean(item.retakeRequestedAt)}
                            onClick={() => repeatItem(item.id)}
                          >
                            Запросить переснимок
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="min-h-11"
                            disabled={item.linkStatus === "not_usable"}
                            onClick={() => markNotUsable(item.id)}
                          >
                            Не использовать
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-md border border-border bg-surface p-3 text-[12px]">
              <h2 className="mb-2 text-[13px] font-semibold text-foreground">Статус</h2>
              <ul className="space-y-1 text-muted-foreground">
                <li>Пациент: <span className="text-foreground">{patient?.fullName ?? "—"}</span></li>
                <li>Визит: <span className="text-foreground">{visit ? formatDateTime(visit.startedAt) : "—"}</span></li>
                <li>Образование: <span className="text-foreground">{lesion?.label ?? "—"}</span></li>
                <li>Клиника: <span className="text-foreground">{clinic?.name ?? CLINICS[0].name}</span></li>
                <li>В очереди: <span className="text-foreground">{queue.length}</span></li>
                <li>Нужен пересмотр: <span className="text-foreground">{reviewCount}</span></li>
                <li>{`Ожидают пересъёмки: ${openRetakeCount}`}</li>
                <li>Привязано (демо): <span className="text-foreground">{linkedCount}</span></li>
                <li>Непривязано: <span className="text-foreground">{unassignedCount}</span></li>
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">
                В MVP журнал аудита и запись в хранилище не выполняются.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function LabeledSelect({
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
    <label className="flex flex-col gap-1 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full text-[13px]">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/60 py-1 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-foreground">{v}</span>
    </div>
  );
}

function PhoneFrame() {
  return (
    <div className="mx-auto w-[140px] rounded-[18px] border-2 border-border bg-background p-2">
      <div className="mx-auto mb-1 h-1 w-10 rounded-full bg-muted" aria-hidden />
      <div className="aspect-[9/16] rounded-md bg-muted/40 ring-1 ring-inset ring-border" aria-hidden />
      <div className="mx-auto mt-1 h-1.5 w-8 rounded-full bg-muted" aria-hidden />
    </div>
  );
}

function QrBlock() {
  return (
    <div className="mx-auto w-[140px] rounded-md border border-border bg-background p-2">
      <div
        className="grid gap-px"
        style={{ gridTemplateColumns: `repeat(${QR_PATTERN[0].length}, 1fr)` }}
        aria-hidden
      >
        {QR_PATTERN.flat().map((cell, i) => (
          <span
            key={i}
            className={cn("aspect-square", cell ? "bg-foreground" : "bg-background")}
          />
        ))}
      </div>
    </div>
  );
}

function QualityPanel({ item }: { item: QueueItem }) {
  const review = isNeedsReview(item.quality.score, item.quality.issues);
  const status = qualityStatus(item.quality.score, item.quality.issues);
  return (
    <div className="space-y-2 text-[12px]">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Оценка качества</span>
        <span className="font-mono text-foreground">{Math.round(item.quality.score * 100)}% / 80%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full", review ? "bg-risk-moderate" : "bg-risk-low")}
          style={{ width: `${Math.round(item.quality.score * 100)}%` }}
        />
      </div>
      <div>
        <span className="text-muted-foreground">Статус: </span>
        <span className="text-foreground">{QUALITY_STATUS_LABEL[status]}</span>
      </div>
      <div>
        <span className="text-muted-foreground">Замечания: </span>
        <span className="text-foreground">
          {item.quality.issues.length === 0 ? "нет" : item.quality.issues.join(", ")}
        </span>
      </div>
      <p className="text-[12px] text-foreground">
        {review
          ? "Повторите снимок: фокус, освещение, контакт дерматоскопа."
          : "Можно использовать для предварительного просмотра врачом."}
      </p>
    </div>
  );
}
