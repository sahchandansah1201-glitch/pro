import DoctorReportsPageLive from "@/pages/doctor/DoctorReportsPageLive";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";

export default function DoctorReportsPage() {
  const session = useSelfHostedApiSession();
  return <DoctorReportsPageLive key={session.revision} />;
}
