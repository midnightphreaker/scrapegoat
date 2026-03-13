import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "../../../../services/trpcService";

const getApiUrl = () => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/trpc`;
  }
  return "http://localhost:6281/api/trpc";
};

export const trpc = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: getApiUrl(),
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});
