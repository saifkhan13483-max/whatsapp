import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useColors } from "@/constants/colors";
import type { ComparisonData } from "@/hooks/useCompare";

const COLORS = ["#25D366", "#34B7F1", "#7C4DFF", "#FFC107", "#FF3B30"];

interface Props {
  data: ComparisonData[];
  metric?: "totalOnlineMinutes" | "sessionsCount" | "avgSessionDuration";
}

function fmtMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export function ComparisonChart({ data, metric = "totalOnlineMinutes" }: Props) {
  const colors = useColors();
  if (!data.length) return null;

  const max = Math.max(...data.map((d) => d[metric] as number), 1);

  const label =
    metric === "totalOnlineMinutes"
      ? "Total Online Time"
      : metric === "sessionsCount"
      ? "Sessions"
      : "Avg Session";

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <Text style={[styles.heading, { color: colors.text }]}>{label}</Text>
      <View style={styles.bars}>
        {data.map((d, i) => {
          const pct = ((d[metric] as number) / max) * 100;
          const color = COLORS[i % COLORS.length];
          const val =
            metric === "totalOnlineMinutes" || metric === "avgSessionDuration"
              ? fmtMinutes(d[metric] as number)
              : String(d[metric]);
          return (
            <View key={d.contactId} style={styles.barRow}>
              <Text style={[styles.name, { color: colors.secondaryText }]} numberOfLines={1}>
                {d.name}
              </Text>
              <View style={[styles.track, { backgroundColor: colors.border }]}>
                <View style={[styles.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
              </View>
              <Text style={[styles.val, { color: color }]}>{val}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  heading: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  bars: { gap: 12 },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  name: {
    width: 80,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  track: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 5,
  },
  val: {
    width: 48,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
  },
});
