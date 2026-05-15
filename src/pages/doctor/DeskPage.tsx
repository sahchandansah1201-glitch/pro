import { isProductionAppMode } from "@/lib/app-mode";
import DeskPageDemo from "@/pages/doctor/DeskPageDemo";
import DeskPageLive from "@/pages/doctor/DeskPageLive";

export default function DeskPage() {
  return isProductionAppMode() ? <DeskPageLive /> : <DeskPageDemo />;
}
