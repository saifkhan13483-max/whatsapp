import { useQuery } from "@tanstack/react-query";
import { apiFetch, getApiUrl } from "@/lib/api";

export interface Report {
  contactId: number;
  contactName: string;
  range: string;
  totalSessions: number;
  totalMinutes: number;
  peakHour: number;
  dailyBreakdown: Array<{ date: string; minutes: number; sessions: number }>;
}

export function useReport(contactId: number, range: string) {
  return useQuery<Report>({
    queryKey: ["reports", contactId, range],
    queryFn: () => apiFetch<Report>(`/reports/${contactId}?range=${range}`),
    enabled: !!contactId,
  });
}

export function getReportExportUrl(contactId: number, format: "csv" = "csv"): string {
  return getApiUrl(`/reports/${contactId}/export?format=${format}`);
}

export async function exportReport(contactId: number, format: "csv" = "csv"): Promise<Blob> {
  const url = getApiUrl(`/reports/${contactId}/export?format=${format}`);
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.blob();
}
