type TimelineQaGroupLink = {
  label: string;
  hint: string;
  href: string;
};

const TIMELINE_QA_GROUPS: TimelineQaGroupLink[] = [
  {
    label: "Данные и запуск",
    hint: "снимки, протокол, старт проверки",
    href: "#timeline-rollout-details",
  },
  {
    label: "Правила и подтверждения",
    hint: "чек-лист, доказательства, ответственный",
    href: "#timeline-sop-evidence",
  },
  {
    label: "Наблюдение и проверка",
    hint: "результаты, инциденты, контроль",
    href: "#timeline-monitoring-validation",
  },
  {
    label: "Закрытая проверка",
    hint: "работа с защищёнными снимками",
    href: "#timeline-protected-review",
  },
  {
    label: "Рабочий запуск",
    hint: "рабочие данные и проверка",
    href: "#timeline-production-review",
  },
];

export function TimelineQaGroupNav() {
  return (
    <nav
      aria-label="Разделы проверки истории"
      className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5"
    >
      {TIMELINE_QA_GROUPS.map((group) => (
        <a
          key={group.href}
          href={group.href}
          className="min-w-0 rounded-sm border border-border bg-surface px-2.5 py-2 text-foreground transition-colors hover:bg-surface-muted"
        >
          <span className="block truncate text-[12px] font-semibold">{group.label}</span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{group.hint}</span>
        </a>
      ))}
    </nav>
  );
}

export function TimelineQaGroupHeader({
  id,
  title,
  hint,
}: {
  id?: string;
  title: string;
  hint: string;
}) {
  return (
    <div
      id={id}
      className="mt-4 scroll-mt-4 rounded-sm border border-border bg-surface px-2.5 py-2"
    >
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">
        Контур проверки
      </p>
      <h4 className="mt-1 text-[13px] font-semibold">{title}</h4>
      <p className="mt-0.5 text-muted-foreground">{hint}</p>
    </div>
  );
}
