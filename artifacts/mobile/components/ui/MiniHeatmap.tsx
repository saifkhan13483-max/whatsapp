import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/constants/colors";

interface Props {
  data: number[];
  rows?: number;
  cols?: number;
  cellSize?: number;
  color?: string;
  showLabels?: boolean;
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

export function MiniHeatmap({
  data,
  rows = 7,
  cols = 4,
  cellSize = 10,
  color,
  showLabels = false,
}: Props) {
  const colors = useColors();
  const baseColor = color ?? colors.primary;
  const max = Math.max(...data, 1);
  const gap = 2;

  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const idx = r * cols + c;
      return data[idx] ?? 0;
    })
  );

  return (
    <View style={styles.container}>
      {grid.map((row, r) => (
        <View key={r} style={styles.row}>
          {showLabels && (
            <Text style={[styles.dayLabel, { color: colors.secondaryText }]}>
              {DAY_LABELS[r % 7]}
            </Text>
          )}
          {row.map((val, c) => {
            const opacity = val === 0 ? 0.08 : 0.2 + (val / max) * 0.8;
            return (
              <View
                key={c}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    borderRadius: 2,
                    backgroundColor: baseColor,
                    opacity,
                    marginLeft: c > 0 ? gap : 0,
                  },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  dayLabel: {
    width: 14,
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    marginRight: 2,
  },
  cell: {},
});
