import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/format";
import { useMemo, useState } from "react";
import { usePatientPortalOverview } from "./usePatientPortalOverview";

export default function MeReportsPageLive() {
  const { status, overview, error } = usePatientPortalOverview();
  const [query, setQuery] = useState("");
  const reports = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (overview?.reports || []).filter((report) => {
      if (!q) return true;
      return [
        report.summary,
        report.patientSafeText,
        report.clinic.name,
        report.doctor.displayName,
      ].some((value) => String(value || "").toLowerCase().includes(q));
    });
  }, [overview?.reports, query]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Заключения" subtitle="Production · patient-safe reports from self-hosted backend" />
      <div className="space-y-3 p-3 sm:p-4">
        {status === "missing_session" && (
          <Card className="p-4">
            <div className="text-[13px] text-muted-foreground">Войдите в production, чтобы увидеть заключения.</div>
            <Button asChild className="mt-3 min-h-[44px] sm:min-h-[36px]">
              <Link to="/self-hosted/login">Войти</Link>
            </Button>
          </Card>
        )}
        {status === "loading" && <Card className="p-4 text-[13px] text-muted-foreground">Загружаем заключения…</Card>}
        {status === "error" && <Card className="p-4 text-[13px] text-destructive" role="alert">{error}</Card>}
        {overview && (
          <>
            <Input
              aria-label="Поиск по заключениям"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по тексту, клинике или врачу"
              className="max-w-xl"
            />
            <Card className="overflow-hidden">
              {reports.length === 0 ? (
                <div className="p-4 text-[13px] text-muted-foreground">Заключения не найдены.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {reports.map((report) => (
                    <li key={report.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[13px] font-semibold">
                          <FileText className="h-4 w-4" aria-hidden />
                          {formatDate(report.visitDate)} · {report.clinic.name || "Клиника"}
                        </div>
                        <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{report.summary || report.patientSafeText}</p>
                      </div>
                      <Button asChild variant="outline" className="min-h-[44px] shrink-0 sm:min-h-[36px]">
                        <Link to={`/me/reports/${report.id}`}>Открыть</Link>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
