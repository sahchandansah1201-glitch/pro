import { isProductionAppMode } from "@/lib/app-mode";
import MeHistoryPageDemo from "./MeHistoryPageDemo";
import MeHistoryPageLive from "./MeHistoryPageLive";

export default function MeHistoryPage() {
  return isProductionAppMode() ? <MeHistoryPageLive /> : <MeHistoryPageDemo />;
}
