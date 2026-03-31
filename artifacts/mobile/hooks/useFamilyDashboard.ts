import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface FamilyMember {
  id: number;
  name: string;
  isOnline: boolean;
  minutesToday: number;
  minutesYesterday: number;
  lastSeen?: string;
  sessions?: Array<{ startTime: string; endTime: string }>;
}

export interface FamilySummary {
  totalContacts: number;
  onlineNow: number;
  totalMinutesToday: number;
  totalLimitMinutes: number;
  alerts: number;
  members: FamilyMember[];
}

export function useFamilyDashboard() {
  return useQuery<FamilySummary>({
    queryKey: ["family-summary"],
    queryFn: () =>
      apiFetch<FamilySummary>("/activity/family-summary").catch(() => ({
        totalContacts: 0,
        onlineNow: 0,
        totalMinutesToday: 0,
        totalLimitMinutes: 480,
        alerts: 0,
        members: [],
      })),
    refetchInterval: 30000,
  });
}
