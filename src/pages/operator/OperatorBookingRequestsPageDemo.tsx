import { Link } from "react-router-dom";
import { CalendarPlus } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function OperatorBookingRequestsPageDemo() {
  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title="Запросы на запись"
        subtitle="Демо-режим · рабочая очередь доступна после входа в систему"
        actions={
          <Button asChild size="sm" variant="outline" className="min-h-[44px] text-[12px]">
            <Link to="/self-hosted/login">Вход в систему</Link>
          </Button>
        }
      />
      <div className="p-6">
        <Card className="max-w-3xl p-5">
          <div className="flex items-center gap-2 text-[14px] font-semibold">
            <CalendarPlus className="h-4 w-4" aria-hidden />
            Очередь заявок включается в рабочем режиме
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">
            В демо-режиме данные не пишутся в клиническую очередь. В рабочем режиме эта
            страница читает и обновляет только защищённую очередь клиники.
          </p>
        </Card>
      </div>
    </div>
  );
}
