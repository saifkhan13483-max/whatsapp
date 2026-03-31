import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/constants/colors";

export type Severity = "low" | "medium" | "high";

interface Props {
  keyword: string;
  severity: Severity;
}

const severityColors: Record<Severity, string> = {
  low: "#4CAF50",
  medium: "#FFC107",
  high: "#FF3B30",
};

const severityLabels: Record<Severity, string> = {
  low: "Low",
  medium: "Med",
  high: "High",
};

export function KeywordBadge({ keyword, severity }: Props) {
  const colors = useColors();
  const sc = severityColors[severity];

  return (
    <View style={[styles.container, { backgroundColor: sc + "18", borderColor: sc + "44" }]}>
      <View style={[styles.dot, { backgroundColor: sc }]} />
      <Text style={[styles.keyword, { color: colors.text }]}>{keyword}</Text>
      <View style={[styles.badge, { backgroundColor: sc }]}>
        <Text style={styles.badgeText}>{severityLabels[severity]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  keyword: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
});
