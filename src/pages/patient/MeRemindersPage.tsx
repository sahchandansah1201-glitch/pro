import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import MeRemindersPageLive from "./MeRemindersPageLive";

export default function MeRemindersPage() {
  const session = useSelfHostedApiSession();
  return <MeRemindersPageLive key={session.revision} />;
}
