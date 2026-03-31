import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/query-client";
import { API } from "@/constants/api";

export type ConnectionStatus = "not_connected" | "pending_pairing" | "connected" | "disconnected";
export type PairingStatus = "waiting" | "accepted" | "expired" | "error";

export interface ConnectionStatusData {
  status: ConnectionStatus;
  phoneNumber?: string;
  connectedAt?: string;
  pairingCode?: string;
  pairingCodeExpiresAt?: string;
}

export interface PairingCodeStatusData {
  accepted: boolean;
  status: PairingStatus;
}

async function fetchConnectionStatus(): Promise<ConnectionStatusData> {
  try {
    const res = await fetch(getApiUrl(API.WHATSAPP.CONNECTION_STATUS), {
      credentials: "include",
    });
    if (res.status === 404) return { status: "not_connected" };
    if (!res.ok) return { status: "not_connected" };
    return res.json();
  } catch {
    return { status: "not_connected" };
  }
}

async function fetchPairingCodeStatus(): Promise<PairingCodeStatusData> {
  try {
    const res = await fetch(getApiUrl(API.WHATSAPP.PAIRING_CODE_STATUS), {
      credentials: "include",
    });
    if (res.status === 404) return { accepted: false, status: "waiting" };
    if (!res.ok) return { accepted: false, status: "error" };
    return res.json();
  } catch {
    return { accepted: false, status: "waiting" };
  }
}

export function useWhatsAppConnection(isPolling = false) {
  const queryClient = useQueryClient();
  const [pollingActive, setPollingActive] = useState(isPolling);

  const {
    data: connectionStatus,
    isLoading: isLoadingStatus,
    refetch: refetchStatus,
  } = useQuery<ConnectionStatusData>({
    queryKey: ["whatsapp-connection-status"],
    queryFn: fetchConnectionStatus,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const {
    data: pairingCodeStatus,
  } = useQuery<PairingCodeStatusData>({
    queryKey: ["whatsapp-pairing-code-status"],
    queryFn: fetchPairingCodeStatus,
    enabled: pollingActive && connectionStatus?.status === "pending_pairing",
    refetchInterval: pollingActive ? 3000 : false,
  });

  const requestPairingCodeMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const res = await fetch(getApiUrl(API.WHATSAPP.REQUEST_PAIRING_CODE), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to request pairing code.");
      }
      return data as { pairingCode: string; expiresAt: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connection-status"] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(getApiUrl(API.WHATSAPP.DISCONNECT), {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to disconnect.");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connection-status"] });
    },
  });

  const reconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(getApiUrl(API.WHATSAPP.RECONNECT), {
        method: "POST",
        credentials: "include",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connection-status"] });
    },
  });

  return {
    connectionStatus,
    isLoadingStatus,
    refetchStatus,
    pairingCodeStatus,
    requestPairingCode: requestPairingCodeMutation.mutateAsync,
    isRequestingCode: requestPairingCodeMutation.isPending,
    disconnect: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
    reconnect: reconnectMutation.mutateAsync,
    isReconnecting: reconnectMutation.isPending,
    isPolling: pollingActive,
    setIsPolling: setPollingActive,
  };
}
