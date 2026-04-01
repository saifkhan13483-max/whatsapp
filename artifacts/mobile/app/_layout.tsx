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
import Toast from "react-native-toast-message";

// Suppress fontfaceobserver "Xms timeout exceeded" unhandled rejections BEFORE
// Expo's error overlay registers its own handler. Must run at module scope.
if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener(
    "unhandledrejection",
    (e: PromiseRejectionEvent) => {
      const msg: string =
        e?.reason?.message ?? e?.reason?.toString?.() ?? "";
      if (
        msg.includes("timeout exceeded") ||
        msg.toLowerCase().includes("fontface")
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );
}

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BiometricGate } from "@/components/ui/BiometricGate";
import { NetworkBanner } from "@/components/ui/NetworkBanner";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { NotificationProvider } from "@/providers/NotificationProvider";
import { queryClient, getApiUrl } from "@/lib/queryClient";
import { getItem, StorageKeys } from "@/lib/storage";
import { useBiometricLock } from "@/hooks/useBiometricLock";
import { setBaseUrl } from "@workspace/api-client-react";

setBaseUrl(getApiUrl().replace(/\/api\/?$/, ""));

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
      <Stack.Screen name="connect-whatsapp" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  // On web, pass an empty map so useFonts returns [true, null] instantly —
  // this completely avoids fontfaceobserver and its 6-second timeout error.
  // Inter is loaded via a CSS <link> injected below instead.
  const [fontsLoaded, fontError] = useFonts(
    Platform.OS === "web"
      ? {}
      : {
          Inter_400Regular,
          Inter_500Medium,
          Inter_600SemiBold,
          Inter_700Bold,
        }
  );

  // Inject Inter via CSS on web — fast, no fontfaceobserver involved.
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const id = "inter-google-font";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

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
      <Toast />
    </GestureHandlerRootView>
  );
}
