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
        subtitle="Демо-режим · production очередь доступна после self-hosted входа"
        actions={
          <Button asChild size="sm" variant="outline" className="h-8 text-[12px]">
            <Link to="/self-hosted/login">Self-hosted вход</Link>
          </Button>
        }
      />
      <div className="p-6">
        <Card className="max-w-3xl p-5">
          <div className="flex items-center gap-2 text-[14px] font-semibold">
            <CalendarPlus className="h-4 w-4" aria-hidden />
            Очередь заявок включается в production
          </div>
          <p className="mt-2 text-[13px] text-muted-foreground">
            В demo/dev данные не пишутся в клиническую очередь. В production эта страница читает и обновляет
            только self-hosted endpoint `/api/v1/clinic/booking-requests`.
          </p>
        </Card>
      </div>
    </div>
  );
}
