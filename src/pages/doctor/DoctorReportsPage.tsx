import { isProductionAppMode } from "@/lib/app-mode";
import DoctorReportsPageDemo from "@/pages/doctor/DoctorReportsPageDemo";
import DoctorReportsPageLive from "@/pages/doctor/DoctorReportsPageLive";

export default function DoctorReportsPage() {
  return isProductionAppMode() ? <DoctorReportsPageLive /> : <DoctorReportsPageDemo />;
}
