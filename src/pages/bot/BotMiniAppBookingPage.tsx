import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import BotMiniAppBookingPageLive from "./BotMiniAppBookingPageLive";

export default function BotMiniAppBookingPage() {
  const session = useSelfHostedApiSession();
  return <BotMiniAppBookingPageLive key={session.revision} />;
}
