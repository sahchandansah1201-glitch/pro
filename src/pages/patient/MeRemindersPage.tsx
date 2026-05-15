import { isProductionAppMode } from "@/lib/app-mode";
import MeRemindersPageDemo from "./MeRemindersPageDemo";
import MeRemindersPageLive from "./MeRemindersPageLive";

export default function MeRemindersPage() {
  return isProductionAppMode() ? <MeRemindersPageLive /> : <MeRemindersPageDemo />;
}
