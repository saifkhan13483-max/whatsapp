import { useState, useEffect, useRef } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import { apiFetch } from "@/lib/api";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function checkConnectivity() {
    try {
      await apiFetch("/health", { method: "HEAD" }).catch(() => apiFetch("/health"));
      setIsOnline(true);
    } catch {
      setIsOnline(false);
    }
  }

  useEffect(() => {
    if (Platform.OS === "web") {
      setIsOnline(typeof window !== "undefined" ? window.navigator.onLine : true);
      function onOnline() { setIsOnline(true); }
      function onOffline() { setIsOnline(false); }
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
      return () => {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      };
    } else {
      checkConnectivity();
      intervalRef.current = setInterval(checkConnectivity, 15000);
      function handleAppState(state: AppStateStatus) {
        if (state === "active") checkConnectivity();
      }
      const sub = AppState.addEventListener("change", handleAppState);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        sub.remove();
      };
    }
  }, []);

  return isOnline;
}
