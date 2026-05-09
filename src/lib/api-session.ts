// Stage 1G-A · Compatibility shim.
//
// The Stage 1F localStorage parser has been replaced by the AuthContext-backed
// hook in `./use-api-session`. This module is kept only so existing callers
// (e.g. VisitWorkspacePage) continue to import from `@/lib/api-session`.

export { useApiSession, type ApiSession } from "@/lib/use-api-session";
