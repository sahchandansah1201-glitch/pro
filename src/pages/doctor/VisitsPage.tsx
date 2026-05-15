import { isProductionAppMode } from "@/lib/app-mode";
import VisitsPageDemo from "@/pages/doctor/VisitsPageDemo";
import VisitsPageLive from "@/pages/doctor/VisitsPageLive";

export default function VisitsPage() {
  return isProductionAppMode() ? <VisitsPageLive /> : <VisitsPageDemo />;
}
