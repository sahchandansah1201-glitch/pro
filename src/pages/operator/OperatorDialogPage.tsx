import { useParams } from "react-router-dom";
import OperatorDialogPageLive from "@/pages/operator/OperatorDialogPageLive";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";

export default function OperatorDialogPage() {
  const session = useSelfHostedApiSession();
  const { id = "" } = useParams();
  return <OperatorDialogPageLive key={`${session.revision}:${id}`} />;
}
