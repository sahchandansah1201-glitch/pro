import { Link } from "react-router-dom";

export function SysJournalTabs({ active }: { active: "audit" | "access" }) {
  const tabs = [
    { key: "audit" as const, label: "Системный аудит", to: "/sys/audit" },
    { key: "access" as const, label: "Доступ к картам", to: "/sys/access-events" },
  ];

  return (
    <nav
      aria-label="Разделы журнала и доступа"
      className="flex flex-wrap gap-1.5 border-b border-border bg-surface px-4 py-2"
    >
      {tabs.map((tab) => {
        const isCurrent = tab.key === active;
        return (
          <Link
            key={tab.key}
            to={tab.to}
            aria-current={isCurrent ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-md border px-3 text-[12px] font-medium transition-colors sm:min-h-9 ${
              isCurrent
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:bg-muted"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
