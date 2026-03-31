import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/constants/colors";

export type ToastType = "success" | "error" | "info" | "warning";

interface Props {
  visible: boolean;
  type?: ToastType;
  message: string;
  duration?: number;
  onHide: () => void;
}

const iconMap: Record<ToastType, string> = {
  success: "checkmark-circle",
  error: "alert-circle",
  warning: "warning",
  info: "information-circle",
};

export function ToastMessage({
  visible,
  type = "info",
  message,
  duration = 3000,
  onHide,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-120);

  const bgMap: Record<ToastType, string> = {
    success: colors.success,
    error: colors.danger,
    warning: colors.warning,
    info: colors.info,
  };

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 14 });
      translateY.value = withDelay(
        duration,
        withTiming(-120, { duration: 300 }, (done) => {
          if (done) runOnJS(onHide)();
        })
      );
    } else {
      translateY.value = -120;
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + 12, backgroundColor: bgMap[type] },
        animStyle,
      ]}
    >
      <Ionicons name={iconMap[type] as any} size={20} color="#fff" />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  text: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
