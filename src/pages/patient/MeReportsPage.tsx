import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import MeReportsPageLive from "./MeReportsPageLive";

export default function MeReportsPage() {
  const session = useSelfHostedApiSession();
  return <MeReportsPageLive key={session.revision} />;
}
