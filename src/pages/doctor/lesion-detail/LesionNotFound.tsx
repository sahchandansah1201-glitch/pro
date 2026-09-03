import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";

export function LesionNotFound({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex h-full flex-col">
      <PageHeader title={title} subtitle={hint} />
      <div className="p-4">
        <Button asChild size="sm" variant="secondary" className="min-h-[44px] text-[12px] sm:min-h-[32px]">
          <Link to="/patients">К списку пациентов</Link>
        </Button>
      </div>
    </div>
  );
}
