import React from "react";
import { View, Text, StyleSheet, PanResponder } from "react-native";
import { useColors } from "@/constants/colors";

interface Props {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}

export function SliderInput({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  onChange,
}: Props) {
  const colors = useColors();
  const percent = ((value - min) / (max - min)) * 100;

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (e, gs) => {},
    onPanResponderMove: (e, gs) => {},
    onPanResponderRelease: () => {},
  });

  const steps = Math.round((max - min) / step);
  const markers = Array.from({ length: steps + 1 }, (_, i) => min + i * step);

  return (
    <View style={styles.container}>
      {label && (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.value, { color: colors.primary }]}>
            {value}
            {unit}
          </Text>
        </View>
      )}
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View
          style={[styles.fill, { width: `${percent}%` as any, backgroundColor: colors.primary }]}
        />
        {markers.map((m, i) => (
          <View
            key={i}
            style={[
              styles.marker,
              { left: `${((m - min) / (max - min)) * 100}%` as any, backgroundColor: colors.border },
            ]}
          />
        ))}
        <View style={[styles.thumb, { left: `${percent}%` as any, backgroundColor: colors.primary }]} />
      </View>
      <View style={styles.minMax}>
        <Text style={[styles.minMaxText, { color: colors.secondaryText }]}>
          {min}
          {unit}
        </Text>
        <Text style={[styles.minMaxText, { color: colors.secondaryText }]}>
          {max}
          {unit}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  value: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  track: {
    height: 6,
    borderRadius: 3,
    position: "relative",
    justifyContent: "center",
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 3,
  },
  thumb: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 10,
    top: -7,
    marginLeft: -10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  marker: {
    position: "absolute",
    width: 2,
    height: 6,
    borderRadius: 1,
  },
  minMax: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  minMaxText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
});
