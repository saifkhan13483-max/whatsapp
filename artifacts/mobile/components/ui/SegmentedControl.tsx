import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useColors } from "@/constants/colors";

interface Props {
  options: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
}

export function SegmentedControl({ options, selectedIndex, onChange }: Props) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.inputBg }]}>
      {options.map((opt, i) => {
        const active = i === selectedIndex;
        return (
          <TouchableOpacity
            key={i}
            style={[
              styles.segment,
              active && [styles.activeSegment, { backgroundColor: colors.primary }],
            ]}
            onPress={() => onChange(i)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.label,
                { color: active ? "#fff" : colors.secondaryText },
              ]}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 8,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    alignItems: "center",
    borderRadius: 6,
  },
  activeSegment: {},
  label: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
