import { isProductionAppMode } from "@/lib/app-mode";
import MeBookingPageDemo from "./MeBookingPageDemo";
import MeBookingPageLive from "./MeBookingPageLive";

export default function MeBookingPage() {
  return isProductionAppMode() ? <MeBookingPageLive /> : <MeBookingPageDemo />;
}
