import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { typography } from "@/constants/typography";
import { spacing } from "@/constants/spacing";

interface Props {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  color?: string;
  subtitle?: string;
}

export function StatCard({ label, value, icon, color, subtitle }: Props) {
  const colors = useColors();
  const tint = color ?? colors.primary;

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.iconWrap, { backgroundColor: tint + "20" }]}>
        <Ionicons name={icon} size={22} color={tint} />
      </View>
      <Text style={[typography.h2, { color: colors.text, marginTop: spacing.sm }]}>{value}</Text>
      <Text style={[typography.caption, { color: colors.secondaryText }]}>{label}</Text>
      {subtitle ? (
        <Text style={[typography.small, { color: tint, marginTop: 2 }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.base,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 130,
    flex: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});
