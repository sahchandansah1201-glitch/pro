import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import MeBookingPageLive from "./MeBookingPageLive";

export default function MeBookingPage() {
  const session = useSelfHostedApiSession();
  return <MeBookingPageLive key={session.revision} />;
}
