import React, { useEffect } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export function NetworkBanner() {
  const isOnline = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 0 : insets.top;
  const translateY = useSharedValue(-80);

  useEffect(() => {
    translateY.value = withTiming(isOnline ? -80 : 0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [isOnline]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.banner,
        { paddingTop: topInset > 0 ? topInset + 4 : 12 },
        animStyle,
      ]}
      accessibilityLiveRegion="polite"
      accessibilityLabel="No internet connection"
    >
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text style={styles.text}>No internet connection</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#D32F2F",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 10,
    paddingHorizontal: 16,
    zIndex: 9999,
  },
  text: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
