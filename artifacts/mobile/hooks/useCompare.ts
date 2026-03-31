import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface ComparisonData {
  contactId: number;
  name: string;
  phoneNumber: string;
  avatarUrl?: string;
  totalOnlineMinutes: number;
  sessionsCount: number;
  avgSessionDuration: number;
  peakHour: number;
  weeklyData: number[];
}

export function useCompare(contactIds: number[]) {
  const ids = contactIds.join(",");
  return useQuery<ComparisonData[]>({
    queryKey: ["activity", "comparisons", ids],
    queryFn: () =>
      apiFetch<ComparisonData[]>(`/activity/comparisons?contactIds=${ids}`).catch(
        () => [] as ComparisonData[]
      ),
    enabled: contactIds.length >= 2,
  });
}

export function useActivityTimeline(date?: string) {
  return useQuery({
    queryKey: ["activity", "timeline", date],
    queryFn: () =>
      apiFetch<{ contactId: number; name: string; events: { time: string; status: "online" | "offline" }[] }[]>(
        `/activity/timeline${date ? `?date=${date}` : ""}`
      ).catch(() => []),
  });
}

export function useActivityPatterns(contactId: number) {
  return useQuery({
    queryKey: ["contacts", contactId, "patterns"],
    queryFn: () =>
      apiFetch<{ hour: number; likelihood: number; label: string }[]>(
        `/contacts/${contactId}/patterns`
      ).catch(() => []),
    enabled: !!contactId,
  });
}
