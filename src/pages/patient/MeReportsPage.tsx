import { isProductionAppMode } from "@/lib/app-mode";
import MeReportsPageDemo from "./MeReportsPageDemo";
import MeReportsPageLive from "./MeReportsPageLive";

export default function MeReportsPage() {
  return isProductionAppMode() ? <MeReportsPageLive /> : <MeReportsPageDemo />;
}
