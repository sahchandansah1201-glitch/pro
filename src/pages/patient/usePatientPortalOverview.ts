import { useCallback, useEffect, useState } from "react";
import {
  fetchSelfHostedPatientPortal,
  type SelfHostedPatientPortalOverview,
} from "@/lib/self-hosted-patient-portal-api";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";

type Status = "missing_session" | "loading" | "ready" | "error";

export function usePatientPortalOverview() {
  const session = useSelfHostedApiSession();
  const [status, setStatus] = useState<Status>(() => session.apiToken ? "loading" : "missing_session");
  const [overview, setOverview] = useState<SelfHostedPatientPortalOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session.apiToken) {
      setStatus("missing_session");
      setOverview(null);
      setError(null);
      return;
    }
    setStatus("loading");
    const result = await fetchSelfHostedPatientPortal({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
    });
    if (result.ok) {
      setOverview(result.value);
      setError(null);
      setStatus("ready");
      return;
    }
    setOverview(null);
    setError(result.error.message);
    setStatus("error");
  }, [session.apiBaseUrl, session.apiToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return { session, status, overview, error, reload: load };
}
