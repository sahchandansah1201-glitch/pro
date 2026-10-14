import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import CapturePageLive from "./CapturePageLive";

export default function CapturePage() {
  const session = useSelfHostedApiSession();
  return <CapturePageLive key={session.revision} />;
}
