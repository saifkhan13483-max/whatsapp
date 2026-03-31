import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface FamilySummary {
  totalContacts: number;
  onlineNow: number;
  totalMinutesToday: number;
  alerts: number;
  members: Array<{
    id: number;
    name: string;
    isOnline: boolean;
    minutesToday: number;
    lastSeen?: string;
  }>;
}

export function useFamilyDashboard() {
  return useQuery<FamilySummary>({
    queryKey: ["family-summary"],
    queryFn: () => apiFetch<FamilySummary>("/activity/family-summary").catch(() => ({
      totalContacts: 0,
      onlineNow: 0,
      totalMinutesToday: 0,
      alerts: 0,
      members: [],
    })),
  });
}
