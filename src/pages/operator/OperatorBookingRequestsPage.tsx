import OperatorBookingRequestsPageLive from "@/pages/operator/OperatorBookingRequestsPageLive";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";

export default function OperatorBookingRequestsPage() {
  const session = useSelfHostedApiSession();
  return <OperatorBookingRequestsPageLive key={session.revision} />;
}
