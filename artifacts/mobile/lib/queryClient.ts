import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export function getApiUrl(path: string = ""): string {
  return `${BASE_URL}/api${path}`;
}
