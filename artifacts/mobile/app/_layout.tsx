import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BiometricGate } from "@/components/ui/BiometricGate";
import { NetworkBanner } from "@/components/ui/NetworkBanner";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { NotificationProvider } from "@/providers/NotificationProvider";
import { queryClient } from "@/lib/queryClient";
import { getItem, StorageKeys } from "@/lib/storage";
import { useBiometricLock } from "@/hooks/useBiometricLock";

SplashScreen.preventAutoHideAsync();

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const { enabled: biometricEnabled, isAuthenticated: biometricPassed } = useBiometricLock();
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    async function route() {
      if (authLoading) return;

      const done = !!(await getItem<boolean>(StorageKeys.ONBOARDING_DONE));
      setReady(true);

      const inAuthScreen = segments[0] === "auth";
      const inOnboardingScreen = segments[0] === "onboarding";

      if (!user && !inAuthScreen) {
        router.replace("/auth" as any);
      } else if (user && !done && !inOnboardingScreen) {
        router.replace("/onboarding" as any);
      } else if (user && done && (inAuthScreen || inOnboardingScreen)) {
        router.replace("/(tabs)" as any);
      }
    }
    route();
  }, [user, authLoading, segments]);

  if (user && ready && biometricEnabled && !biometricPassed) {
    return (
      <View style={{ flex: 1 }}>
        {children}
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <BiometricGate>{null}</BiometricGate>
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

function RootNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="contact/[id]" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="chat/[id]" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="reports" options={{ headerShown: false }} />
      <Stack.Screen name="subscription" options={{ headerShown: false }} />
      <Stack.Screen name="family-dashboard" options={{ headerShown: false }} />
      <Stack.Screen name="keyword-alerts" options={{ headerShown: false }} />
      <Stack.Screen name="contact-groups" options={{ headerShown: false }} />
      <Stack.Screen name="compare" options={{ headerShown: false }} />
      <Stack.Screen name="activity-timeline" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [fontTimeout, setFontTimeout] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Suppress the fontfaceobserver "Xms timeout exceeded" unhandled rejection
  // that fires on web when Google Fonts CDN is unreachable. The app already
  // has its own graceful fallback timeout below — this just stops the dev
  // error overlay from appearing.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const msg: string =
        event?.reason?.message ??
        event?.reason?.toString?.() ??
        "";
      if (msg.includes("timeout exceeded") || msg.toLowerCase().includes("fontface")) {
        event.preventDefault();
      }
    }

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => window.removeEventListener("unhandledrejection", handleUnhandledRejection);
  }, []);

  // Show app with system fonts after 2 s if Google Fonts CDN hasn't responded.
  // This fires well before fontfaceobserver's own 6 s timeout, preventing the
  // unhandled-rejection from ever being queued.
  useEffect(() => {
    timeoutRef.current = setTimeout(() => setFontTimeout(true), 2000);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError || fontTimeout) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, fontTimeout]);

  if (!fontsLoaded && !fontError && !fontTimeout) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ThemeProvider>
                <NotificationProvider>
                  <AuthGate>
                    <View style={{ flex: 1 }}>
                      <RootNavigator />
                      <NetworkBanner />
                    </View>
                  </AuthGate>
                </NotificationProvider>
              </ThemeProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
