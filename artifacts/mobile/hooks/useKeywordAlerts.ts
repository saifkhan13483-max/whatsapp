import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface KeywordAlert {
  id: number;
  keyword: string;
  severity: "low" | "medium" | "high";
  createdAt: string;
}

export function useKeywordAlerts() {
  return useQuery<KeywordAlert[]>({
    queryKey: ["keyword-alerts"],
    queryFn: () => apiFetch<KeywordAlert[]>("/alerts/keywords").catch(() => []),
  });
}

export function useAddKeyword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { keyword: string; severity: string }) =>
      apiFetch("/alerts/keyword", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keyword-alerts"] }),
  });
}

export function useDeleteKeyword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/alerts/keyword/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keyword-alerts"] }),
  });
}
