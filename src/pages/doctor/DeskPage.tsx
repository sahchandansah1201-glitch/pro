import DeskPageLive from "@/pages/doctor/DeskPageLive";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";

export default function DeskPage() {
  const session = useSelfHostedApiSession();
  return <DeskPageLive key={session.revision} />;
}
