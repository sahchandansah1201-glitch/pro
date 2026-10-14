import VisitsPageLive from "@/pages/doctor/VisitsPageLive";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";

export default function VisitsPage() {
  const session = useSelfHostedApiSession();
  return <VisitsPageLive key={session.revision} />;
}
