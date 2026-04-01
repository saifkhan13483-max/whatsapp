import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/queryClient";
import { API } from "@/constants/api";
import type {
  WhatsAppConnectionStatus as ConnectionStatusData,
  WhatsAppPairingCodeStatus as PairingCodeStatusData,
  WhatsAppRequestPairingCodeResponse,
} from "@workspace/api-client-react";

export type ConnectionStatus =
  | "not_connected"
  | "pending_pairing"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error";

export type PairingStatus = "waiting" | "accepted" | "expired" | "error";

export type { ConnectionStatusData, PairingCodeStatusData };

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

function useCodeCountdown(expiresAt: string | undefined): number {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      setSecondsLeft(0);
      return;
    }

    const expiryMs = new Date(expiresAt).getTime();

    const tick = () => {
      const remaining = Math.max(0, Math.round((expiryMs - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [expiresAt]);

  return secondsLeft;
}

function friendlyError(msg: string | undefined, httpStatus?: number): string {
  if (!msg) {
    return httpStatus === 429
      ? "Too many attempts. Please wait 10 minutes and try again."
      : "Something went wrong. Please try again.";
  }

  const lower = msg.toLowerCase();
  if (lower.includes("invalid phone") || lower.includes("valid number")) {
    return "Invalid phone number. Include your country code (e.g. +923001234567).";
  }
  if (lower.includes("already linked")) {
    return "This WhatsApp account is already linked.";
  }
  if (lower.includes("too many")) {
    return "Too many attempts. Please wait 10 minutes.";
  }
  if (lower.includes("expired")) {
    return "Code expired. Please request a new one.";
  }
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("408")) {
    return "Could not reach WhatsApp servers. Check your internet connection.";
  }
  if (lower.includes("connection failed") || lower.includes("pairing failed")) {
    return "Connection failed. Make sure the code was entered correctly and try again.";
  }
  return msg;
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
    staleTime: 10_000,
    refetchInterval: pollingActive ? 5_000 : false,
    refetchOnWindowFocus: true,
  });

  const {
    data: pairingCodeStatus,
  } = useQuery<PairingCodeStatusData>({
    queryKey: ["whatsapp-pairing-code-status"],
    queryFn: fetchPairingCodeStatus,
    enabled: pollingActive && connectionStatus?.status === "pending_pairing",
    refetchInterval: pollingActive ? 3_000 : false,
  });

  const codeSecondsLeft = useCodeCountdown(
    connectionStatus?.pairingCodeExpiresAt ??
      pairingCodeStatus?.expiresAt
  );

  const isCodeExpired =
    connectionStatus?.status === "pending_pairing" && codeSecondsLeft === 0;

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
        // Handle both legacy {error} and new {code, message} response shapes
        const rawMsg = data.message ?? data.error;
        const err = new Error(friendlyError(rawMsg, res.status)) as any;
        err.httpStatus = res.status;
        err.code = data.code;
        throw err;
      }
      return data as WhatsAppRequestPairingCodeResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connection-status"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-pairing-code-status"] });
    },
  });

  const refreshCode = useCallback(
    async (phoneNumber: string) => {
      return requestPairingCodeMutation.mutateAsync(phoneNumber);
    },
    [requestPairingCodeMutation]
  );

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
      setPollingActive(false);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-connection-status"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-pairing-code-status"] });
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
    codeSecondsLeft,
    isCodeExpired,
    refreshCode,
    requestPairingCode: requestPairingCodeMutation.mutateAsync,
    requestPairingCodeError:
      requestPairingCodeMutation.error instanceof Error
        ? requestPairingCodeMutation.error.message
        : undefined,
    isRequestingCode: requestPairingCodeMutation.isPending,
    disconnect: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
    reconnect: reconnectMutation.mutateAsync,
    isReconnecting: reconnectMutation.isPending,
    isPolling: pollingActive,
    setIsPolling: setPollingActive,
  };
}
