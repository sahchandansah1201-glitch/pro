import { isProductionAppMode } from "@/lib/app-mode";
import OperatorConsolePageDemo from "@/pages/operator/OperatorConsolePageDemo";
import OperatorConsolePageLive from "@/pages/operator/OperatorConsolePageLive";

export default function OperatorConsolePage() {
  return isProductionAppMode() ? <OperatorConsolePageLive /> : <OperatorConsolePageDemo />;
}
