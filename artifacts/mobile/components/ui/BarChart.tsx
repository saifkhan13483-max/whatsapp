import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { formatHour } from "@/lib/formatters";

interface DataPoint {
  hour?: number;
  label?: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  maxValue?: number;
  height?: number;
  color?: string;
}

export function BarChart({ data, maxValue, height = 100, color }: Props) {
  const colors = useColors();
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);
  const tint = color ?? colors.primary;

  return (
    <View style={[styles.container, { height: height + 24 }]}>
      <View style={[styles.bars, { height }]}>
        {data.map((item, i) => {
          const ratio = max > 0 ? item.value / max : 0;
          return (
            <View key={i} style={styles.barWrap}>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.bar,
                    { height: `${Math.max(ratio * 100, 2)}%`, backgroundColor: tint },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {data.map((item, i) => {
          const label = item.label ?? (item.hour !== undefined ? formatHour(item.hour) : String(i));
          const showLabel = i % Math.ceil(data.length / 6) === 0;
          return (
            <View key={i} style={styles.labelWrap}>
              {showLabel ? (
                <Text style={[styles.labelText, { color: colors.secondaryText }]} numberOfLines={1}>
                  {label}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%" },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  barWrap: { flex: 1, height: "100%", justifyContent: "flex-end" },
  barBg: { width: "100%", height: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 3 },
  labels: { flexDirection: "row", marginTop: 4 },
  labelWrap: { flex: 1, alignItems: "center" },
  labelText: { fontSize: 9, fontFamily: "Inter_400Regular" },
});
