import { ShieldAlert } from "lucide-react";

/**
 * Постоянный баннер: учебный режим, доступ — учебная симуляция, не реальная защита.
 * Должен оставаться видимым во всём рабочем месте на время первого продукта.
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
        Учебный режим. Переключение ролей и доступ — не настоящая безопасность.
        Не используйте реальные данные пациентов.
      </span>
    </div>
  );
}
