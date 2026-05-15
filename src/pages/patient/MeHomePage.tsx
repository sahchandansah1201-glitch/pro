import { isProductionAppMode } from "@/lib/app-mode";
import MeHomePageDemo from "./MeHomePageDemo";
import MeHomePageLive from "./MeHomePageLive";

export default function MeHomePage() {
  return isProductionAppMode() ? <MeHomePageLive /> : <MeHomePageDemo />;
}
