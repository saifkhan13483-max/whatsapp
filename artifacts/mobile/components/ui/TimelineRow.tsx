import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/constants/colors";

interface Props {
  time: string;
  label: string;
  status: "online" | "offline";
  duration?: string;
  isLast?: boolean;
}

export function TimelineRow({ time, label, status, duration, isLast = false }: Props) {
  const colors = useColors();
  const dotColor = status === "online" ? colors.online : colors.offline;

  return (
    <View style={styles.row}>
      <View style={styles.timeCol}>
        <Text style={[styles.time, { color: colors.secondaryText }]}>{time}</Text>
      </View>
      <View style={styles.lineCol}>
        <View style={[styles.dot, { backgroundColor: dotColor }]} />
        {!isLast && <View style={[styles.line, { backgroundColor: colors.border }]} />}
      </View>
      <View style={styles.contentCol}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        {duration && (
          <Text style={[styles.duration, { color: colors.secondaryText }]}>{duration}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    minHeight: 48,
  },
  timeCol: {
    width: 56,
    alignItems: "flex-end",
    paddingRight: 12,
    paddingTop: 2,
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  lineCol: {
    width: 20,
    alignItems: "center",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  line: {
    flex: 1,
    width: 2,
    marginTop: 4,
  },
  contentCol: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 16,
    paddingTop: 2,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  duration: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
