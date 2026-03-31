import React from "react";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

type FilterProps = {
  label: string;
  active?: boolean;
  onPress: () => void;
  minutes?: never;
};

type DisplayProps = {
  minutes: number;
  label?: never;
  active?: never;
  onPress?: never;
};

type Props = FilterProps | DisplayProps;

function formatMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

export function DurationChip(props: Props) {
  const colors = useColors();

  if (props.minutes !== undefined) {
    return (
      <View
        style={[
          styles.chip,
          {
            backgroundColor: colors.primary + "15",
            borderColor: colors.primary + "40",
          },
        ]}
      >
        <Text style={[styles.label, { color: colors.primary }]}>
          {formatMinutes(props.minutes)}
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.chip,
        {
          backgroundColor: props.active ? colors.primary : colors.inputBg,
          borderColor: props.active ? colors.primary : colors.border,
        },
      ]}
      onPress={props.onPress}
      activeOpacity={0.8}
    >
      <Text
        style={[
          styles.label,
          { color: props.active ? "#fff" : colors.secondaryText },
        ]}
      >
        {props.label}
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
