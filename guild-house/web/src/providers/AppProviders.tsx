import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { StrictMode, type ReactNode } from "react";
import { fetchHealth } from "../lib/api";
import { queryKeys } from "../lib/queryKeys";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </StrictMode>
  );
}

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: fetchHealth,
    refetchInterval: 30_000,
  });
}
