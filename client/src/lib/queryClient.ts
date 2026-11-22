import { QueryClient } from "@tanstack/react-query";

// Every query declares its own queryFn (Supabase SDK or apiRequest from lib/api-client).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
