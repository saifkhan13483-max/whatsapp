import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface AppSettings {
  notificationsEnabled: boolean;
  onlineAlerts: boolean;
  offlineAlerts: boolean;
  reportFrequency: string;
  dndEnabled: boolean;
}

export interface DndRule {
  id: number;
  startTime: string;
  endTime: string;
  label: string;
}

export function useSettings() {
  return useQuery<AppSettings>({
    queryKey: ["settings"],
    queryFn: () => apiFetch<AppSettings>("/settings"),
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<AppSettings>) =>
      apiFetch<AppSettings>("/settings", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useDndRules() {
  return useQuery<DndRule[]>({
    queryKey: ["settings", "dnd"],
    queryFn: () => apiFetch<DndRule[]>("/settings/dnd").catch(() => []),
  });
}

export function useAddDnd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { startTime: string; endTime: string; label: string }) =>
      apiFetch("/settings/dnd", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useDeleteDnd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/settings/dnd/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}
