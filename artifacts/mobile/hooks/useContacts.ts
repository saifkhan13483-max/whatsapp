import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { Contact } from "@/components/ui/ContactCard";

export function useContacts() {
  return useQuery<Contact[]>({
    queryKey: ["contacts"],
    queryFn: () => apiFetch<Contact[]>("/contacts"),
  });
}

export function useContact(id: number) {
  return useQuery<Contact>({
    queryKey: ["contacts", id],
    queryFn: () => apiFetch<Contact>(`/contacts/${id}`),
    enabled: !!id,
  });
}

export function useAddContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; phoneNumber: string }) =>
      apiFetch<Contact>("/contacts", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; name?: string; notes?: string; alertEnabled?: boolean }) =>
      apiFetch<Contact>(`/contacts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiFetch(`/contacts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contacts"] }),
  });
}

export function useFavoriteContacts() {
  return useQuery<Contact[]>({
    queryKey: ["contacts", "favorites"],
    queryFn: () => apiFetch<Contact[]>("/contacts/favorites").catch(() => []),
  });
}

export function useToggleFavorite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/contacts/${id}/favorite`, { method: "POST" }).catch(() => {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts", "favorites"] });
    },
  });
}
