import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { useColors } from "@/constants/colors";

interface Props {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}

export function ActivityRing({
  value,
  max = 100,
  size = 100,
  strokeWidth = 10,
  color,
  label,
  sublabel,
}: Props) {
  const colors = useColors();
  const ringColor = color ?? colors.primary;
  const progress = useSharedValue(0);
  const pct = Math.min(value / Math.max(max, 1), 1);

  useEffect(() => {
    progress.value = withTiming(pct, { duration: 1000, easing: Easing.out(Easing.cubic) });
  }, [pct]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 360}deg` }],
    opacity: 0.3 + progress.value * 0.7,
  }));

  const radius = (size - strokeWidth) / 2;
  const innerSize = size - strokeWidth * 2;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View
        style={[
          styles.track,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: ringColor + "33",
          },
        ]}
      />
      <Animated.View
        style={[
          styles.fill,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: ringColor,
            borderRightColor: "transparent",
            borderBottomColor: "transparent",
          },
          animStyle,
        ]}
      />
      {(label || sublabel) && (
        <View style={styles.center}>
          {label && (
            <Text style={[styles.label, { color: colors.text, fontSize: size * 0.16 }]}>
              {label}
            </Text>
          )}
          {sublabel && (
            <Text style={[styles.sublabel, { color: colors.secondaryText, fontSize: size * 0.1 }]}>
              {sublabel}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    position: "absolute",
  },
  fill: {
    position: "absolute",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: "Inter_700Bold",
  },
  sublabel: {
    fontFamily: "Inter_400Regular",
  },
});
