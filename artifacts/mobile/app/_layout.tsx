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
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BiometricGate } from "@/components/ui/BiometricGate";
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
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    getItem<string>(StorageKeys.ONBOARDING_DONE).then((val) => {
      setOnboardingDone(val === "true");
    });
  }, []);

  useEffect(() => {
    if (authLoading || onboardingDone === null) return;

    const inAuthScreen = segments[0] === "auth";
    const inOnboardingScreen = segments[0] === "onboarding";

    if (!user && !inAuthScreen) {
      router.replace("/auth" as any);
    } else if (user && !onboardingDone && !inOnboardingScreen) {
      router.replace("/onboarding" as any);
    } else if (user && onboardingDone && (inAuthScreen || inOnboardingScreen)) {
      router.replace("/(tabs)" as any);
    }
  }, [user, authLoading, onboardingDone, segments]);

  if (user && onboardingDone && biometricEnabled && !biometricPassed) {
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
                    <RootNavigator />
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
