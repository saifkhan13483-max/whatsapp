import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/queryClient";
import { API } from "@/constants/api";
import type {
  TrackerSessionStatus,
  PairingCodeResponse,
  PairingVerifyGetResponse,
  PairingVerifyPostResponse,
  StartSessionResponse,
} from "@workspace/api-client-react";

export type {
  TrackerSessionStatus,
  PairingCodeResponse,
  PairingVerifyGetResponse,
  PairingVerifyPostResponse,
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(getApiUrl(path), {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error((data as any)?.error ?? `HTTP ${res.status}`) as any;
    err.httpStatus = res.status;
    throw err;
  }
  return data as T;
}

export function useTrackerSession() {
  const queryClient = useQueryClient();

  const {
    data: sessionStatus,
    isLoading: isLoadingSession,
    refetch: refetchSession,
  } = useQuery<TrackerSessionStatus>({
    queryKey: ["tracker-session-status"],
    queryFn: () => apiFetch<TrackerSessionStatus>(API.TRACKER.SESSION_STATUS),
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });

  const startSessionMutation = useMutation<StartSessionResponse>({
    mutationFn: () =>
      apiFetch<StartSessionResponse>(API.TRACKER.SESSION_START, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracker-session-status"] });
    },
  });

  const requestPairingCodeMutation = useMutation<
    PairingCodeResponse,
    Error,
    string
  >({
    mutationFn: (phoneNumber: string) =>
      apiFetch<PairingCodeResponse>(API.TRACKER.SESSION_PAIRING_CODE, {
        method: "POST",
        body: JSON.stringify({ phoneNumber }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracker-session-status"] });
      queryClient.invalidateQueries({ queryKey: ["tracker-pairing-status"] });
    },
  });

  const {
    data: pairingStatus,
    refetch: refetchPairingStatus,
  } = useQuery<PairingVerifyGetResponse>({
    queryKey: ["tracker-pairing-status"],
    queryFn: () => apiFetch<PairingVerifyGetResponse>(API.TRACKER.SESSION_VERIFY),
    enabled:
      sessionStatus?.status === "pairing_code" ||
      sessionStatus?.status === "loading",
    refetchInterval: 3_000,
  });

  const verifyConnectionMutation = useMutation<PairingVerifyPostResponse>({
    mutationFn: () =>
      apiFetch<PairingVerifyPostResponse>(API.TRACKER.SESSION_VERIFY, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracker-session-status"] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>("/tracker/session", { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracker-session-status"] });
      queryClient.invalidateQueries({ queryKey: ["tracker-pairing-status"] });
    },
  });

  const requestPairingCode = useCallback(
    (phoneNumber: string) => requestPairingCodeMutation.mutateAsync(phoneNumber),
    [requestPairingCodeMutation]
  );

  return {
    sessionStatus,
    isLoadingSession,
    refetchSession,

    startSession: startSessionMutation.mutateAsync,
    isStartingSession: startSessionMutation.isPending,

    requestPairingCode,
    isRequestingCode: requestPairingCodeMutation.isPending,
    requestPairingCodeError:
      requestPairingCodeMutation.error instanceof Error
        ? requestPairingCodeMutation.error.message
        : undefined,

    pairingStatus,
    refetchPairingStatus,

    verifyConnection: verifyConnectionMutation.mutateAsync,
    isVerifying: verifyConnectionMutation.isPending,

    disconnect: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
  };
}
