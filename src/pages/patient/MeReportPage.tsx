import { useParams } from "react-router-dom";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import MeReportPageLive from "./MeReportPageLive";

export default function MeReportPage() {
  const session = useSelfHostedApiSession();
  const { id } = useParams();
  return <MeReportPageLive key={`${session.revision}:${id}`} />;
}
