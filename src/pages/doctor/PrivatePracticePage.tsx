import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import PrivatePracticePageLive from "@/pages/doctor/PrivatePracticePageLive";

export default function PrivatePracticePage() {
  const session = useSelfHostedApiSession();
  return <PrivatePracticePageLive key={session.revision} />;
}
