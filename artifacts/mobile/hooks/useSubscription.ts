import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Plan } from "@/components/ui/PlanCard";

export interface CurrentSubscription {
  planId: string;
  planName: string;
  expiresAt: string;
  isActive: boolean;
}

export function usePlans() {
  return useQuery<Plan[]>({
    queryKey: ["subscription", "plans"],
    queryFn: () => apiFetch<Plan[]>("/subscription/plans"),
  });
}

export function useCurrentSubscription() {
  return useQuery<CurrentSubscription>({
    queryKey: ["subscription", "current"],
    queryFn: () => apiFetch<CurrentSubscription>("/subscription/current"),
  });
}

export function useUpgradePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) =>
      apiFetch("/subscription/upgrade", { method: "POST", body: JSON.stringify({ planId }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscription"] }),
  });
}
