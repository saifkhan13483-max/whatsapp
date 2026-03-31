import React from "react";
import { TouchableOpacity, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/constants/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  icon?: string;
  onPress: () => void;
  color?: string;
  size?: number;
  style?: ViewStyle;
  bottom?: number;
}

export function FloatingActionButton({
  icon = "add",
  onPress,
  color,
  size = 56,
  style,
  bottom,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bg = color ?? colors.primary;

  return (
    <TouchableOpacity
      style={[
        styles.fab,
        {
          backgroundColor: bg,
          width: size,
          height: size,
          borderRadius: size / 2,
          bottom: (bottom ?? 0) + insets.bottom + 24,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons name={icon as any} size={size * 0.43} color="#fff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 20,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
