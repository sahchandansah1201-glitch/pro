import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import MeHomePageLive from "./MeHomePageLive";

export default function MeHomePage() {
  const session = useSelfHostedApiSession();
  return <MeHomePageLive key={session.revision} />;
}
