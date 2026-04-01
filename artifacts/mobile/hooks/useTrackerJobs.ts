import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/queryClient";
import { API } from "@/constants/api";
import type {
  TrackerJob,
  TrackResponse,
  ActivityResponse,
  StatsResponse,
} from "@workspace/api-client-react";

export type { TrackerJob, TrackResponse, ActivityResponse, StatsResponse };

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

export interface TrackJobPayload {
  phoneNumber: string;
  label?: string;
  pollIntervalSeconds?: number;
}

export function useTrackerJobs() {
  const queryClient = useQueryClient();

  const {
    data: jobsData,
    isLoading: isLoadingJobs,
    refetch: refetchJobs,
  } = useQuery<{ success: boolean; jobs: TrackerJob[] }>({
    queryKey: ["tracker-jobs"],
    queryFn: () =>
      apiFetch<{ success: boolean; jobs: TrackerJob[] }>(API.TRACKER.JOBS),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const trackMutation = useMutation<TrackResponse, Error, TrackJobPayload>({
    mutationFn: (payload) =>
      apiFetch<TrackResponse>(API.TRACKER.TRACK, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracker-jobs"] });
    },
  });

  const untrackMutation = useMutation<{ success: boolean }, Error, number>({
    mutationFn: (jobId: number) =>
      apiFetch<{ success: boolean }>(API.TRACKER.UNTRACK(jobId), {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracker-jobs"] });
    },
  });

  const startTracking = useCallback(
    (payload: TrackJobPayload) => trackMutation.mutateAsync(payload),
    [trackMutation]
  );

  const stopTracking = useCallback(
    (jobId: number) => untrackMutation.mutateAsync(jobId),
    [untrackMutation]
  );

  return {
    jobs: jobsData?.jobs ?? [],
    isLoadingJobs,
    refetchJobs,

    startTracking,
    isStartingTracking: trackMutation.isPending,
    startTrackingError:
      trackMutation.error instanceof Error
        ? trackMutation.error.message
        : undefined,

    stopTracking,
    isStoppingTracking: untrackMutation.isPending,
  };
}

export function useTrackerActivity(
  phoneNumber: string,
  options?: { limit?: number; since?: string; enabled?: boolean }
) {
  return useQuery<ActivityResponse>({
    queryKey: ["tracker-activity", phoneNumber, options?.limit, options?.since],
    queryFn: () => {
      const params = new URLSearchParams();
      if (options?.limit) params.set("limit", String(options.limit));
      if (options?.since) params.set("since", options.since);
      const qs = params.toString();
      return apiFetch<ActivityResponse>(
        `${API.TRACKER.ACTIVITY(phoneNumber)}${qs ? `?${qs}` : ""}`
      );
    },
    enabled: options?.enabled !== false && !!phoneNumber,
    staleTime: 30_000,
  });
}

export function useTrackerStats(
  phoneNumber: string,
  options?: { enabled?: boolean }
) {
  return useQuery<StatsResponse>({
    queryKey: ["tracker-stats", phoneNumber],
    queryFn: () =>
      apiFetch<StatsResponse>(API.TRACKER.STATS(phoneNumber)),
    enabled: options?.enabled !== false && !!phoneNumber,
    staleTime: 60_000,
  });
}
