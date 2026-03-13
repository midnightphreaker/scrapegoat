import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import type { AnyRouter } from "@trpc/server";

const getApiUrl = () => {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/trpc`;
  }
  return "http://localhost:6281/api/trpc";
};

export const trpc = createTRPCProxyClient<AnyRouter>({
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
