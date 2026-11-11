import { QueryClient } from "@tanstack/react-query";

// Exported so lib/session can wipe it at session boundaries — cached data outlives logout.
// offlineFirst: requests still go out without signal so the service worker can answer
// from its last good copy (athlete card + family QR at the counter).
export const queryClient = new QueryClient({ defaultOptions: { queries: { networkMode: "offlineFirst" } } });
