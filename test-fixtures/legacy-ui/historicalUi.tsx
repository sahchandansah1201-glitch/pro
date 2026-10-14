import type { ComponentType } from "react";
import { isSelfHostedApiConfigured, useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import { isProductionAppMode } from "./app-mode";

// Keep historical render assertions separate. All configured-session cases use
// the actual working page, not the archived implementation or a mocked loader.
export function historicalUi(Working: ComponentType, Historical: ComponentType): ComponentType {
  return function HistoricalOrWorkingTestPage() {
    const session = useSelfHostedApiSession();
    const Page = isProductionAppMode() || isSelfHostedApiConfigured(session) ? Working : Historical;
    return <Page />;
  };
}
