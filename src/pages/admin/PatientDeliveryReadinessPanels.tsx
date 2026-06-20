import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type {
  SelfHostedPatientPhotoProtocolGovernanceOperationResultDTO,
} from "@/lib/self-hosted-clinical-report-package-api";

export type PatientDeliveryGate = {
  id: string;
  title: string;
  detail: string;
  blockerCount: number;
  ready: boolean;
  nextAction: string;
};

function ReadinessLine({
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

function findGate(gates: PatientDeliveryGate[], id: string) {
  return gates.find((gate) => gate.id === id);
}

export function LocalReadinessHistoryPanel({
  gates,
  lastAction,
  operationResult,
  onHistoryReview,
}: {
  gates: PatientDeliveryGate[];
  lastAction: string | null;
  operationResult: SelfHostedPatientPhotoProtocolGovernanceOperationResultDTO | null;
  onHistoryReview: () => void;
}) {
  const readyCount = gates.filter((gate) => gate.ready).length;
  const blockerCount = gates.reduce((sum, gate) => sum + gate.blockerCount, 0);
  const retentionGate = findGate(gates, "retention");
  const accessWindowGate = findGate(gates, "access-window");
  const fileGate = findGate(gates, "file-channel");
  const sessionGate = findGate(gates, "session");
  const safetyGate = findGate(gates, "safe-boundary");
  const hiddenItems = [
    "пациентские строки",
    "фото и файлы",
    "ссылки и пути",
    "коды входа",
    "номера сеансов",
    "врачебный текст",
  ];
  const historyRows = [
    {
      title: "Решение о выдаче",
      detail: "главный статус не открывает доступ пациенту",
      value: "выключена",
    },
    {
      title: "Хранение и сроки",
      detail: `${retentionGate?.blockerCount ?? 0} требуют правил · ${accessWindowGate?.blockerCount ?? 0} без срока`,
      value: (retentionGate?.blockerCount ?? 0) + (accessWindowGate?.blockerCount ?? 0),
    },
    {
      title: "Файлы и сеансы",
      detail: `${fileGate?.blockerCount ?? 0} требуют канала · ${sessionGate?.blockerCount ?? 0} проверок сеанса`,
      value: (fileGate?.blockerCount ?? 0) + (sessionGate?.blockerCount ?? 0),
    },
    {
      title: "Безопасность данных",
      detail: "секреты, файлы, ссылки и врачебный текст скрыты",
      value: safetyGate?.blockerCount ?? 0,
    },
    {
      title: "Предварительный акт",
      detail: `${readyCount} из ${gates.length} проверок закрыто`,
      value: `${readyCount}/${gates.length}`,
    },
  ];

  return (
    <Card role="region" aria-label="История локальных проверок готовности" className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase text-muted-foreground">
            История локальных проверок
          </div>
          <h2 className="mt-1 text-[16px] font-semibold leading-tight">Что уже проверили на этом экране</h2>
          <p className="mt-1 max-w-3xl text-[13px] text-muted-foreground">
            История показывает только локальные служебные итоги. Пациенты, файлы, ссылки, коды входа и номера сеансов не выводятся.
          </p>
        </div>
        <Badge variant="outline" className="min-h-[28px] px-2.5 py-1 text-[12px]">
          выдача выключена
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {historyRows.map((row) => (
            <div key={row.title} className="rounded-md border p-3">
              <div className="text-[13px] font-semibold leading-snug">{row.title}</div>
              <div className="mt-1 text-[12px] leading-snug text-muted-foreground">{row.detail}</div>
              <div className="mt-2 inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold tabular-nums">
                {row.value}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 rounded-md border p-3">
          <div>
            <div className="text-[13px] font-semibold">Последняя локальная проверка</div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {lastAction ?? "Пока не зафиксирована в этой сессии"}
            </p>
          </div>
          <div className="grid gap-2">
            <ReadinessLine label="Закрыто проверок" value={`${readyCount}/${gates.length}`} tone={readyCount === gates.length ? "success" : "default"} />
            <ReadinessLine label="Открыто препятствий" value={blockerCount} tone={blockerCount > 0 ? "warning" : "success"} />
            <ReadinessLine label="Последнее системное действие" value={operationResult ? operationResult.affectedCount : "нет"} />
          </div>
          <div className="rounded-md border px-3 py-2 text-[12px]">
            <div className="font-semibold">Система не раскрывала</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {hiddenItems.map((item) => (
                <span key={item} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {item}
                </span>
              ))}
            </div>
          </div>
          <Button variant="outline" className="min-h-[44px] justify-center sm:min-h-[36px]" onClick={onHistoryReview}>
            Обновить историю проверки
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function PreLaunchBlockerPanel({
  gates,
  onBlockerReview,
}: {
  gates: PatientDeliveryGate[];
  onBlockerReview: () => void;
}) {
  const openGates = gates.filter((gate) => !gate.ready);
  const blockerCount = gates.reduce((sum, gate) => sum + gate.blockerCount, 0);
  const firstBlocker = openGates[0] ?? null;

  return (
    <Card role="region" aria-label="Предзапусковые препятствия выдачи" className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase text-muted-foreground">
            Предзапусковые препятствия
          </div>
          <h2 className="mt-1 text-[16px] font-semibold leading-tight">Что ещё нельзя включать</h2>
          <p className="mt-1 max-w-3xl text-[13px] text-muted-foreground">
            Список нужен для рабочего разбора. Он не включает доступ пациенту и не показывает пациентов, файлы, ссылки,
            коды входа или номера сеансов.
          </p>
        </div>
        <Badge variant={blockerCount > 0 ? "secondary" : "outline"} className="min-h-[28px] px-2.5 py-1 text-[12px]">
          {blockerCount > 0 ? `${blockerCount} препятств.` : "препятствий нет"}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {gates.map((gate) => (
            <div key={gate.id} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold leading-snug">{gate.title}</div>
                  <div className="mt-1 text-[12px] leading-snug text-muted-foreground">
                    {gate.ready ? gate.detail : gate.nextAction}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded border px-2 py-0.5 text-[11px] ${
                    gate.ready
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-warning/40 bg-warning/10 text-warning"
                  }`}
                >
                  {gate.ready ? "закрыто" : "нужно закрыть"}
                </span>
              </div>
              {!gate.ready && (
                <div className="mt-2 text-[12px] text-muted-foreground">Препятствий: {gate.blockerCount}</div>
              )}
            </div>
          ))}
        </div>

        <div className="grid gap-3 rounded-md border p-3">
          <div>
            <div className="text-[13px] font-semibold">Первое действие</div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {firstBlocker ? firstBlocker.nextAction : "Перед запуском нужен отдельный рабочий акт клиники"}
            </p>
          </div>
          <div className="grid gap-2">
            <ReadinessLine label="Открытые проверки" value={openGates.length} tone={openGates.length > 0 ? "warning" : "success"} />
            <ReadinessLine label="Всего препятствий" value={blockerCount} tone={blockerCount > 0 ? "warning" : "success"} />
            <ReadinessLine label="Выдача пациенту" value="выключена" tone="success" />
          </div>
          <Button variant="outline" className="min-h-[44px] justify-center sm:min-h-[36px]" onClick={onBlockerReview}>
            Сформировать список препятствий
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ClinicDecisionPackagePanel({
  gates,
  onDecisionPackageReview,
}: {
  gates: PatientDeliveryGate[];
  onDecisionPackageReview: () => void;
}) {
  const readyCount = gates.filter((gate) => gate.ready).length;
  const blockerCount = gates.reduce((sum, gate) => sum + gate.blockerCount, 0);
  const packageRows = [
    {
      title: "Служебная сводка",
      detail: "только счётчики готовности и препятствий",
      status: "готовится локально",
    },
    {
      title: "Ответственный клиники",
      detail: "рабочее решение нужно принять отдельно",
      status: "нужно решение",
    },
    {
      title: "Данные для пациента",
      detail: "текст, файлы, ссылки и коды остаются скрыты",
      status: "не опубликованы",
    },
    {
      title: "Повторная проверка",
      detail: "перед включением нужен повторный просмотр правил",
      status: "обязательна",
    },
  ];

  return (
    <Card role="region" aria-label="Пакет решения клиники по выдаче" className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase text-muted-foreground">
            Пакет решения клиники
          </div>
          <h2 className="mt-1 text-[16px] font-semibold leading-tight">Что передать на рабочее решение</h2>
          <p className="mt-1 max-w-3xl text-[13px] text-muted-foreground">
            Это локальная подготовка для администратора. Она не публикует файлы, не создаёт ссылку и не открывает вход
            пациенту.
          </p>
        </div>
        <Badge variant="outline" className="min-h-[28px] px-2.5 py-1 text-[12px]">
          доступ не открыт
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {packageRows.map((row) => (
            <div key={row.title} className="rounded-md border p-3">
              <div className="text-[13px] font-semibold leading-snug">{row.title}</div>
              <div className="mt-1 text-[12px] leading-snug text-muted-foreground">{row.detail}</div>
              <div className="mt-2 inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold">
                {row.status}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 rounded-md border p-3">
          <div>
            <div className="text-[13px] font-semibold">Итог перед решением</div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Пакет можно подготовить только как локальную памятку. Запуск требует отдельного утверждения клиники.
            </p>
          </div>
          <div className="grid gap-2">
            <ReadinessLine label="Проверки закрыты" value={`${readyCount}/${gates.length}`} tone={readyCount === gates.length ? "success" : "default"} />
            <ReadinessLine label="Открыто препятствий" value={blockerCount} tone={blockerCount > 0 ? "warning" : "success"} />
            <ReadinessLine label="Публикация файлов" value="выключена" tone="success" />
          </div>
          <Button variant="outline" className="min-h-[44px] justify-center sm:min-h-[36px]" onClick={onDecisionPackageReview}>
            Подготовить пакет решения
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function ClinicLaunchApprovalGatePanel({
  gates,
  onLaunchApprovalReview,
}: {
  gates: PatientDeliveryGate[];
  onLaunchApprovalReview: () => void;
}) {
  const readyCount = gates.filter((gate) => gate.ready).length;
  const blockerCount = gates.reduce((sum, gate) => sum + gate.blockerCount, 0);
  const approvalRows = [
    {
      title: "Решение клиники",
      detail: "отдельное утверждение ещё не принято",
      status: "не принято",
    },
    {
      title: "Запуск выдачи",
      detail: "запрещён до рабочего решения клиники",
      status: "запрещён",
    },
    {
      title: "Файлы и доступ",
      detail: "файлы не опубликованы, вход пациенту не открыт",
      status: "выключены",
    },
    {
      title: "Повторная проверка",
      detail: "перед запуском нужен повторный просмотр всех правил",
      status: `${readyCount}/${gates.length}`,
    },
  ];

  return (
    <Card role="region" aria-label="Запрет запуска без решения клиники" className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase text-muted-foreground">
            Финальный стоп-гейт
          </div>
          <h2 className="mt-1 text-[16px] font-semibold leading-tight">Решение клиники не принято</h2>
          <p className="mt-1 max-w-3xl text-[13px] text-muted-foreground">
            Запуск запрещён без отдельного утверждения клиники. Этот блок только фиксирует запрет запуска и не открывает
            доступ пациенту.
          </p>
        </div>
        <Badge variant="secondary" className="min-h-[28px] px-2.5 py-1 text-[12px]">
          запуск запрещён
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {approvalRows.map((row) => (
            <div key={row.title} className="rounded-md border p-3">
              <div className="text-[13px] font-semibold leading-snug">{row.title}</div>
              <div className="mt-1 text-[12px] leading-snug text-muted-foreground">{row.detail}</div>
              <div className="mt-2 inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold">
                {row.status}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 rounded-md border p-3">
          <div>
            <div className="text-[13px] font-semibold">Итог перед запуском</div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Администратор может зафиксировать только запрет запуска. Включение выдачи требует отдельного утверждения
              вне этого экрана.
            </p>
          </div>
          <div className="grid gap-2">
            <ReadinessLine label="Решение клиники" value="не принято" tone="warning" />
            <ReadinessLine label="Запуск выдачи" value="запрещён" tone="warning" />
            <ReadinessLine label="Открыто препятствий" value={blockerCount} tone={blockerCount > 0 ? "warning" : "success"} />
            <ReadinessLine label="Публикация файлов" value="выключена" tone="success" />
          </div>
          <Button variant="outline" className="min-h-[44px] justify-center sm:min-h-[36px]" onClick={onLaunchApprovalReview}>
            Зафиксировать запрет запуска
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function PatientDeliveryAuditReceiptPanel({
  gates,
  lastAction,
  onAuditReceiptReview,
}: {
  gates: PatientDeliveryGate[];
  lastAction: string | null;
  onAuditReceiptReview: () => void;
}) {
  const readyCount = gates.filter((gate) => gate.ready).length;
  const blockerCount = gates.reduce((sum, gate) => sum + gate.blockerCount, 0);
  const receiptRows = [
    {
      title: "Статус выдачи",
      detail: "доступ пациенту не открыт",
      value: "выключена",
    },
    {
      title: "Решение клиники",
      detail: "рабочее утверждение не принято",
      value: "не принято",
    },
    {
      title: "Проверки",
      detail: "закрытые проверки и открытые препятствия",
      value: `${readyCount}/${gates.length} · ${blockerCount}`,
    },
    {
      title: "Скрытые данные",
      detail: "пациенты, файлы, ссылки, коды и сеансы не выводились",
      value: "скрыты",
    },
  ];

  return (
    <Card role="region" aria-label="Итоговый акт запрета выдачи" className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[12px] font-semibold uppercase text-muted-foreground">
            Итоговый журнал
          </div>
          <h2 className="mt-1 text-[16px] font-semibold leading-tight">Что останется в журнале проверки</h2>
          <p className="mt-1 max-w-3xl text-[13px] text-muted-foreground">
            Акт фиксирует только локальные служебные итоги: запуск запрещён, решение клиники не принято, пациентские
            строки и файлы не раскрывались.
          </p>
        </div>
        <Badge variant="outline" className="min-h-[28px] px-2.5 py-1 text-[12px]">
          журнал без данных пациента
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {receiptRows.map((row) => (
            <div key={row.title} className="rounded-md border p-3">
              <div className="text-[13px] font-semibold leading-snug">{row.title}</div>
              <div className="mt-1 text-[12px] leading-snug text-muted-foreground">{row.detail}</div>
              <div className="mt-2 inline-flex rounded border px-2 py-0.5 text-[11px] font-semibold">
                {row.value}
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 rounded-md border p-3">
          <div>
            <div className="text-[13px] font-semibold">Последняя запись</div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {lastAction ?? "Итоговый акт ещё не фиксировался"}
            </p>
          </div>
          <div className="grid gap-2">
            <ReadinessLine label="Запуск выдачи" value="запрещён" tone="warning" />
            <ReadinessLine label="Пациентские строки" value="скрыты" tone="success" />
            <ReadinessLine label="Файлы и ссылки" value="не опубликованы" tone="success" />
            <ReadinessLine label="Коды входа" value="не раскрывались" tone="success" />
          </div>
          <Button variant="outline" className="min-h-[44px] justify-center sm:min-h-[36px]" onClick={onAuditReceiptReview}>
            Зафиксировать итоговый акт
          </Button>
        </div>
      </div>
    </Card>
  );
}
