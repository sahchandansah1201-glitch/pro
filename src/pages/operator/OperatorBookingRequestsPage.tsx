import { isProductionAppMode } from "@/lib/app-mode";
import OperatorBookingRequestsPageDemo from "@/pages/operator/OperatorBookingRequestsPageDemo";
import OperatorBookingRequestsPageLive from "@/pages/operator/OperatorBookingRequestsPageLive";

export default function OperatorBookingRequestsPage() {
  return isProductionAppMode() ? <OperatorBookingRequestsPageLive /> : <OperatorBookingRequestsPageDemo />;
}
