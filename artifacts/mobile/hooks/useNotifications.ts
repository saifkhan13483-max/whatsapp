import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { AppNotification } from "@/components/ui/NotificationRow";

export function useNotifications(filter?: string) {
  return useQuery<AppNotification[]>({
    queryKey: ["notifications", filter],
    queryFn: () => apiFetch<AppNotification[]>(`/notifications${filter ? `?filter=${filter}` : ""}`),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/notifications/mark-read/${id}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/notifications/mark-all-read", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useClearNotifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/notifications/clear", { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
