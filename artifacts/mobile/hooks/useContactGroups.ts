import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface ContactGroup {
  id: number;
  name: string;
  contactIds: number[];
  createdAt: string;
}

export function useContactGroups() {
  return useQuery<ContactGroup[]>({
    queryKey: ["contact-groups"],
    queryFn: () =>
      apiFetch<ContactGroup[]>("/contacts/groups").catch(() => [] as ContactGroup[]),
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; contactIds: number[] }) =>
      apiFetch<ContactGroup>("/contacts/groups", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-groups"] }),
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: number;
      name?: string;
      contactIds?: number[];
    }) =>
      apiFetch<ContactGroup>(`/contacts/groups/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-groups"] }),
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/contacts/groups/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-groups"] }),
  });
}
