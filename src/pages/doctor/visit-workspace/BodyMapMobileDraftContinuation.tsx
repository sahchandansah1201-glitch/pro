import { Button } from "@/components/ui/button";

interface BodyMapMobileDraftContinuationProps {
  zoneLabel: string;
  onContinue: () => void;
}

export function BodyMapMobileDraftContinuation({
  zoneLabel,
  onContinue,
}: BodyMapMobileDraftContinuationProps) {
  return (
    <div className="border-t border-primary/30 bg-primary/5 p-3 lg:hidden">
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="whitespace-normal break-words text-[13px] font-medium text-foreground">{zoneLabel} выбрана</p>
          <p className="text-[12px] text-muted-foreground">Черновик не сохранён</p>
        </div>
        <Button
          type="button"
          size="sm"
          className="min-h-11 w-full shrink-0 text-[12px] sm:w-auto"
          onClick={onContinue}
        >
          Продолжить оформление
        </Button>
      </div>
    </div>
  );
}
