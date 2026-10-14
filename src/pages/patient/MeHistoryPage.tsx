import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import MeHistoryPageLive from "./MeHistoryPageLive";

export default function MeHistoryPage() {
  const session = useSelfHostedApiSession();
  return <MeHistoryPageLive key={session.revision} />;
}
