import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface GeofenceZone {
  id: number;
  name: string;
  lat: number;
  lng: number;
  radius: number;
  createdAt: string;
}

export function useGeofenceZones() {
  return useQuery<GeofenceZone[]>({
    queryKey: ["geofence", "zones"],
    queryFn: () =>
      apiFetch<GeofenceZone[]>("/geofence/zones").catch(() => [] as GeofenceZone[]),
  });
}

export function useCreateGeofenceZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; lat: number; lng: number; radius: number }) =>
      apiFetch<GeofenceZone>("/geofence/zones", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["geofence"] }),
  });
}
