import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { spacing } from "@/constants/spacing";

interface Option {
  label: string;
  value: string;
}

interface Props {
  options: Option[];
  selected: string;
  onSelect: (value: string) => void;
}

export function ChipFilter({ options, selected, onSelect }: Props) {
  const colors = useColors();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
    >
      {options.map((opt) => {
        const isActive = opt.value === selected;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(opt.value);
            }}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? colors.primary : colors.card,
                borderColor: isActive ? colors.primary : colors.border,
              },
            ]}
            accessibilityLabel={opt.label}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text
              style={{
                fontFamily: "Inter_500Medium",
                fontSize: 13,
                color: isActive ? "#fff" : colors.secondaryText,
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
