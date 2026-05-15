import { isProductionAppMode } from "@/lib/app-mode";
import MeReportPageDemo from "./MeReportPageDemo";
import MeReportPageLive from "./MeReportPageLive";

export default function MeReportPage() {
  return isProductionAppMode() ? <MeReportPageLive /> : <MeReportPageDemo />;
}
