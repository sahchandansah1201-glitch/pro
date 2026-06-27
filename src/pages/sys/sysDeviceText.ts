export function sysDeviceText(value: string | undefined): string {
  if (!value) return "нет данных";
  const normalized = value.trim();
  const labels: Record<string, string> = {
    "Worker heartbeat telemetry": "Связь службы моста",
    "Worker health pressure": "Давление состояния службы",
    "Command queue pressure": "Очередь команд",
    "Command recovery policy": "Разбор восстановления команд",
    "Audit and replay visibility": "Журнал и повтор команд",
    "Safe audit export": "Безопасная выгрузка журнала",
    "1 bridge worker visible.": "Мост на связи: 1.",
    "1 stale worker.": "Устаревших служб: 1.",
    "Incident drill register": "Реестр учений по инцидентам",
    "Incident drills are repository-defined.": "Учения по инцидентам описаны в проекте.",
    "Incident drills are repository-defined and operator-reviewed.": "Учения по инцидентам описаны и проверяются администратором.",
    "Telemetry retention register": "Срок хранения данных службы",
    "Retention uses backend metadata only; raw worker payloads stay server-side.": "Хранятся только служебные итоги; сырые данные службы не выводятся.",
    "Continuity checklist": "Проверка непрерывности",
    "Backend continuity endpoint": "Рабочая проверка непрерывности",
    "OpenAPI and nginx publishing": "Доступность рабочего контура",
    "Frontend continuity adapter": "Отображение в интерфейсе",
    "System devices continuity UI": "Экран контроля устройств",
    "Safe export preview": "Безопасная выгрузка",
    "Drift guard": "Контроль расхождений",
    "Workflow gate": "Контроль перед включением",
    "Project-memory refresh": "Запись рабочего итога",
    "Next batch handoff": "Передача следующего шага",
    "Stage 9B-9D remains a hypothesis.": "Следующий шаг пока не включён в интерфейс.",
    "Stage 9N-9Z remains a hypothesis.": "Следующий шаг пока не включён в интерфейс.",
    "Stage 10A-10L remains a hypothesis.": "Следующий шаг пока не включён в интерфейс.",
    "Stage 9B-9D remains a hypothesis until repository files define it.": "Следующий шаг пока не включён в интерфейс.",
    "Stage 9N-9Z remains a hypothesis until repository files define it.": "Следующий шаг пока не включён в интерфейс.",
    "Stage 10A-10L remains a hypothesis until repository files define it.": "Следующий шаг пока не включён в интерфейс.",
    "Production readiness available": "Рабочая готовность проверена",
    "Incident pressure reviewed": "Давление инцидентов проверено",
    "Stale workers reviewed": "Устаревшие службы проверены",
    "Audit signal available": "Журнал действий доступен",
    "Self-hosted product boundary": "Граница продукта клиники",
    "none/none.": "внешние зависимости отсутствуют.",
    "Fleet reliability register": "Реестр надёжности парка",
    "Fleet reliability is repository-defined.": "Надёжность парка описана в проекте.",
    "Fleet reliability is repository-defined and sourced from backend continuity metadata.": "Надёжность парка считается по безопасным служебным итогам.",
    "Fleet signal available": "Состояние парка доступно",
    "Worker SLO policy": "Срок реакции службы",
    "Command queue SLO policy": "Норма обработки очереди",
    "Backend reliability endpoint": "Рабочая проверка надёжности",
    "Frontend reliability adapter": "Отображение надёжности",
    "System devices reliability UI": "Экран надёжности устройств",
    "Safe reliability export preview": "Безопасная выгрузка надёжности",
    "Worker SLO reviewed": "Срок реакции службы проверен",
    "Command SLO reviewed": "Норма обработки команд проверена",
    "Continuity gates reviewed": "Проверки непрерывности пройдены",
    "Lifecycle assurance register": "Реестр жизненного цикла",
    "Lifecycle assurance is repository-defined.": "Жизненный цикл описан в проекте.",
    "Lifecycle assurance is repository-defined and derived from backend fleet reliability metadata.": "Жизненный цикл считается по безопасным служебным итогам.",
    "Maintenance window policy": "Правила обслуживания",
    "Worker upgrade posture": "Готовность обновления службы",
    "Audit retention closure": "Закрытие хранения журнала",
    "Backend assurance endpoint": "Рабочая проверка жизненного цикла",
    "Frontend assurance adapter": "Отображение жизненного цикла",
    "System devices assurance UI": "Экран жизненного цикла устройств",
    "Safe closure export preview": "Безопасная выгрузка итога",
    "Maintenance window reviewed": "Окно обслуживания проверено",
    "Worker upgrade posture reviewed": "Готовность обновления проверена",
    "Audit retention reviewed": "Хранение журнала проверено",
    "Closure debt reviewed": "Открытые проверки закрыты",
    "Fleet reliability available": "Надёжность парка доступна",
    "Review required.": "Нужен разбор.",
    "No maintenance review window is currently required.": "Окно обслуживания сейчас не требуется.",
    "No retention exception is visible in repository metadata.": "Исключений по хранению журнала не видно.",
    "No maintenance window is currently required by safe metadata.": "Окно обслуживания сейчас не требуется.",
    "Managed runtime/database dependency remains none; browser hardware APIs remain disabled.": "Внешних зависимостей нет; аппаратный доступ браузера выключен.",
    "Managed runtime/database dependency remains none; browser hardware APIs remain disabled; payload visibility remains backend-only.": "Внешних зависимостей нет; аппаратный доступ браузера выключен; данные команд скрыты.",
    backend_only: "только рабочая система",
    "backend-only": "только рабочая система",
    audit: "аудит",
    manual: "вручную",
    manual_system_admin: "вручную системным администратором",
    none: "нет",
  };
  if (labels[normalized]) return labels[normalized];

  const bridgeTelemetry = normalized.match(/^(\d+) bridge worker\(s\) visible in PostgreSQL telemetry\.$/);
  if (bridgeTelemetry) return `Мостов на связи: ${bridgeTelemetry[1]}.`;
  const fleetTelemetry = normalized.match(/^(\d+) Device Bridge worker\(s\) (?:are visible|contribute).*\.$/);
  if (fleetTelemetry) return `Мостов на связи: ${fleetTelemetry[1]}.`;
  if (/^No Device Bridge worker(?: heartbeat)? telemetry (?:is visible yet|is available|is visible)\.$/.test(normalized)) {
    return "Мосты устройств пока не передали состояние.";
  }
  const workerPressure = normalized.match(/^(\d+) offline worker\(s\), (\d+) degraded worker\(s\), (\d+) stale worker\(s\)\.$/);
  if (workerPressure) return `Не в сети: ${workerPressure[1]}, нестабильных: ${workerPressure[2]}, устаревших: ${workerPressure[3]}.`;
  const queuePressure = normalized.match(/^(\d+) queued, (\d+) failed, (\d+) stuck; max queue age (\d+)s\.$/);
  if (queuePressure) return `В очереди: ${queuePressure[1]}, с ошибкой: ${queuePressure[2]}, зависли: ${queuePressure[3]}, возраст очереди: ${queuePressure[4]} с.`;
  const recoveryPressure = normalized.match(/^(\d+) retryable and (\d+) cancellable command\(s\) require operator review\.$/);
  if (recoveryPressure) return `Можно повторить: ${recoveryPressure[1]}, можно отменить: ${recoveryPressure[2]}.`;
  const auditVisibility = normalized.match(/^Audit events: (\d+); payload visibility: .*$/);
  if (auditVisibility) return `Событий аудита: ${auditVisibility[1]}; данные команд скрыты.`;
  if (normalized === "Command audit export remains metadata-only; raw command payloads and results stay backend-side.") {
    return "Выгрузка журнала содержит только безопасные строки; сырые команды и результаты скрыты.";
  }
  const readinessGates = normalized.match(/^(\d+) readiness gate\(s\) need review\.$/);
  if (readinessGates) return `Проверок к разбору: ${readinessGates[1]}.`;
  const commandAttention = normalized.match(/^(\d+) command\(s\) need operator attention\.$/);
  if (commandAttention) return `Команд к разбору: ${commandAttention[1]}.`;
  const queueReview = normalized.match(/^(\d+) command\(s\) require queue review\.$/);
  if (queueReview) return `Команд в очереди к разбору: ${queueReview[1]}.`;
  const commandCount = normalized.match(/^(\d+) command\(s\)\.$/);
  if (commandCount) return `команд: ${commandCount[1]}.`;
  const commandBreakdown = normalized.match(/^(\d+) failed, (\d+) stuck, (\d+) retryable, (\d+) cancellable command\(s\)\.$/);
  if (commandBreakdown) return `С ошибкой: ${commandBreakdown[1]}, зависли: ${commandBreakdown[2]}, можно повторить: ${commandBreakdown[3]}, можно отменить: ${commandBreakdown[4]}.`;
  const staleReview = normalized.match(/^(\d+) stale worker\(s\)(?:; target review window is (\d+) minutes| require (?:operator|SLO) review)?\.$/);
  if (staleReview) return `Устаревших служб: ${staleReview[1]}.`;
  const maintenancePressure = normalized.match(/^(\d+) stale worker\(s\), (\d+) queued\/recovery command signal\(s\), (\d+) inherited gate\(s\)\.$/);
  if (maintenancePressure) return `Устаревших служб: ${maintenancePressure[1]}, сигналов очереди: ${maintenancePressure[2]}, открытых проверок: ${maintenancePressure[3]}.`;
  const upgradePosture = normalized.match(/^(\d+) stale worker\(s\) and (\d+) stuck command\(s\) influence upgrade posture\.$/);
  if (upgradePosture) return `Устаревших служб: ${upgradePosture[1]}, зависших команд: ${upgradePosture[2]}.`;
  const workerCommandSignals = normalized.match(/^(\d+) worker\/command signal\(s\) influence upgrade posture\.$/);
  if (workerCommandSignals) return `Сигналов к разбору перед обновлением: ${workerCommandSignals[1]}.`;
  const auditOk = normalized.match(/^(\d+) audit event\(s\); no retention exception is visible\.$/);
  if (auditOk) return `Событий аудита: ${auditOk[1]}; исключений по хранению нет.`;
  const auditRetention = normalized.match(/^(\d+) audit event\(s\) exist while command pressure is non-zero\.$/);
  if (auditRetention) return `Событий аудита: ${auditRetention[1]}; очередь команд требует разбора.`;
  const assuranceOpen = normalized.match(/^(\d+) lifecycle assurance signal\(s\) remain open\.$/);
  if (assuranceOpen) return `Открытых проверок жизненного цикла: ${assuranceOpen[1]}.`;
  const reliabilitySignals = normalized.match(/^(\d+) reliability signal\(s\) need operator attention\.$/);
  if (reliabilitySignals) return `Сигналов надёжности к разбору: ${reliabilitySignals[1]}.`;
  const assuranceSignals = normalized.match(/^(\d+) lifecycle assurance signal\(s\) need review\.$/);
  if (assuranceSignals) return `Сигналов жизненного цикла к разбору: ${assuranceSignals[1]}.`;
  if (/^\/api\/v1\//.test(normalized)) return "Рабочий контур отвечает.";
  if (/^\/openapi\./.test(normalized)) return "Описание рабочего контура доступно.";
  if (/^The browser reads/i.test(normalized)) return "Экран получает только безопасные данные рабочей системы.";
  if (/^Only metadata counts/i.test(normalized)) return "Показываются только безопасные агрегаты и статусы.";
  if (/^Only safe lifecycle/i.test(normalized)) return "Показываются только безопасные итоги жизненного цикла.";
  if (/^Repository guard scans/i.test(normalized)) return "Контроль расхождений включён.";
  if (/^CI runs/i.test(normalized)) return "Проверка перед включением выполняется.";
  if (/^Project-memory records/i.test(normalized)) return "Итог проверки записывается в рабочий журнал.";
  if (/^A maintenance review window is required before closure\.$/.test(normalized)) return "Перед закрытием нужно проверить окно обслуживания.";
  if (/^Audit retention evidence should be reviewed externally\.$/.test(normalized)) return "Хранение журнала нужно проверить отдельно.";

  if (
    /Device Bridge|Command|Worker|Stage|backend|self-hosted|metadata|policy|readiness|workflow|evidence|rollout|monitoring|validation|governance|payload|OpenAPI|nginx|PostgreSQL|SLO|repository|CI|project-memory|frontend|hypothesis/i.test(normalized)
  ) {
    return "Служебные подробности скрыты; ориентируйтесь на статус проверки.";
  }
  return normalized;
}
