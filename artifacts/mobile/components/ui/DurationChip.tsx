import React from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { useColors } from "@/constants/colors";

interface Props {
  label: string;
  active?: boolean;
  onPress: () => void;
}

export function DurationChip({ label, active = false, onPress }: Props) {
  const colors = useColors();

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.inputBg,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text
        style={[
          styles.label,
          { color: active ? "#fff" : colors.secondaryText },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 24,
    borderWidth: 1,
  },
  label: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
});
