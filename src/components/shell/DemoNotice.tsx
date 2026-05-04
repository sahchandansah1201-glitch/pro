import { ShieldAlert } from "lucide-react";

/**
 * Постоянный баннер: демо-режим, доступ — UX-симуляция, не реальная защита.
 * Должен оставаться видимым во всём рабочем месте на время MVP.
 */
export function DemoNotice() {
  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-warning/30 bg-warning/10 px-3 py-1.5 text-[12px]"
      style={{
        background: "hsl(var(--warning) / 0.08)",
        borderColor: "hsl(var(--warning) / 0.30)",
        color: "hsl(var(--warning))",
      }}
    >
      <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        Демо-режим. Переключение ролей и доступ — UX-симуляция, не настоящая безопасность.
        Не используйте реальные данные пациентов.
      </span>
    </div>
  );
}
