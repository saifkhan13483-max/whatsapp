import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface ContactStats {
  totalSessions: number;
  totalMinutes: number;
  avgSessionMinutes: number;
  peakHour: number;
  onlineStreak: number;
}

export interface HourlyData {
  hour: number;
  value: number;
}

export interface Session {
  id: number;
  contactId: number;
  startTime: string;
  endTime: string;
  durationMinutes: number;
}

export function useContactStats(id: number, range: "today" | "week" | "month" = "today") {
  return useQuery<ContactStats>({
    queryKey: ["contacts", id, "stats", range],
    queryFn: () => apiFetch<ContactStats>(`/contacts/${id}/stats?range=${range}`),
    enabled: !!id,
  });
}

export function useHourlyData(id: number) {
  return useQuery<HourlyData[]>({
    queryKey: ["contacts", id, "hourly"],
    queryFn: () => apiFetch<HourlyData[]>(`/contacts/${id}/hourly`),
    enabled: !!id,
  });
}

export function useContactSessions(
  id: number,
  opts?: { from?: string; to?: string }
) {
  const params = new URLSearchParams();
  if (opts?.from) params.set("from", opts.from);
  if (opts?.to) params.set("to", opts.to);
  const qs = params.toString();
  return useQuery<Session[]>({
    queryKey: ["contacts", id, "sessions", opts],
    queryFn: () => apiFetch<Session[]>(`/contacts/${id}/sessions${qs ? `?${qs}` : ""}`),
    enabled: !!id,
  });
}

export function useUpdateContactStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: "online" | "offline" }) =>
      apiFetch(`/contacts/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["contacts", id] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}
