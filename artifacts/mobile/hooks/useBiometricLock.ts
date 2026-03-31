import { useState, useEffect, useCallback } from "react";
import { getItem, setItem, StorageKeys } from "@/lib/storage";

let localAuth: typeof import("expo-local-authentication") | null = null;
try {
  localAuth = require("expo-local-authentication");
} catch {}

export function useBiometricLock() {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const [storedEnabled, isAvailable] = await Promise.all([
          getItem<boolean>(StorageKeys.BIOMETRIC_LOCK),
          localAuth?.hasHardwareAsync().catch(() => false) ?? Promise.resolve(false),
        ]);
        setSupported(!!isAvailable);
        setEnabled(storedEnabled ?? false);
        if (!storedEnabled) setIsAuthenticated(true);
      } catch {
        setIsAuthenticated(true);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!localAuth || !enabled) {
      setIsAuthenticated(true);
      return true;
    }
    try {
      const result = await localAuth.authenticateAsync({
        promptMessage: "Authenticate to access WaTracker",
        fallbackLabel: "Use Passcode",
      });
      if (result.success) {
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [enabled]);

  const toggle = useCallback(async (value: boolean) => {
    setEnabled(value);
    await setItem(StorageKeys.BIOMETRIC_LOCK, value);
    if (!value) setIsAuthenticated(true);
  }, []);

  return { enabled, supported, isAuthenticated, isLoading, authenticate, toggle };
}
