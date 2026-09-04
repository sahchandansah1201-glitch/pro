export function BodyMapPlacementBindingWarning({
  onRefine,
}: {
  onRefine: () => void;
}) {
  return (
    <div className="mt-2 rounded-sm border border-warning/40 bg-warning/10 px-2 py-2">
      <div className="text-[11px] font-medium text-foreground">
        Точное положение требует уточнения
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Точная метка скрыта: сохранённая привязка не совпадает с текущей моделью.
      </p>
      <button
        type="button"
        className="mt-2 inline-flex min-h-11 items-center rounded-sm border border-border bg-surface px-3 text-[12px] font-medium text-foreground outline-none hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={(event) => {
          event.stopPropagation();
          onRefine();
        }}
      >
        Уточнить положение
      </button>
    </div>
  );
}
