import { isProductionAppMode } from "@/lib/app-mode";
import OperatorDialogPageDemo from "@/pages/operator/OperatorDialogPageDemo";
import OperatorDialogPageLive from "@/pages/operator/OperatorDialogPageLive";

export default function OperatorDialogPage() {
  return isProductionAppMode() ? <OperatorDialogPageLive /> : <OperatorDialogPageDemo />;
}
