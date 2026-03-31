import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { formatHour } from "@/lib/formatters";

interface Props {
  data: number[];
  maxValue?: number;
  color?: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function HeatmapGrid({ data, maxValue, color }: Props) {
  const colors = useColors();
  const max = maxValue ?? Math.max(...data, 1);
  const tint = color ?? colors.primary;

  const HOURS_SHOWN = [0, 3, 6, 9, 12, 15, 18, 21];

  return (
    <View style={styles.container}>
      <View style={styles.hoursRow}>
        <View style={{ width: 28 }} />
        {HOURS_SHOWN.map((h) => (
          <View key={h} style={styles.hourCell}>
            <Text style={[styles.hourText, { color: colors.secondaryText }]}>{formatHour(h)}</Text>
          </View>
        ))}
      </View>
      {DAYS.map((day, di) => (
        <View key={day} style={styles.row}>
          <Text style={[styles.dayLabel, { color: colors.secondaryText }]}>{day}</Text>
          {Array.from({ length: 24 }).map((_, hi) => {
            const val = data[di * 24 + hi] ?? 0;
            const ratio = max > 0 ? val / max : 0;
            const opacity = 0.08 + ratio * 0.92;
            return (
              <View
                key={hi}
                style={[styles.cell, { backgroundColor: tint, opacity }]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%" },
  hoursRow: { flexDirection: "row", marginBottom: 4 },
  hourCell: { flex: 1, alignItems: "center" },
  hourText: { fontSize: 8, fontFamily: "Inter_400Regular" },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  dayLabel: { width: 28, fontSize: 9, fontFamily: "Inter_400Regular" },
  cell: { flex: 1, height: 10, borderRadius: 2, marginHorizontal: 0.5 },
});
