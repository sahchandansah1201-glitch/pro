import OperatorConsolePageLive from "@/pages/operator/OperatorConsolePageLive";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";

export default function OperatorConsolePage() {
  const session = useSelfHostedApiSession();
  return <OperatorConsolePageLive key={session.revision} />;
}
