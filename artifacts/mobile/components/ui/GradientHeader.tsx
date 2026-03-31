import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "@/constants/spacing";
import { typography } from "@/constants/typography";

interface Props {
  title: string;
  subtitle?: string;
  rightAction?: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void };
  leftAction?: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void };
}

export function GradientHeader({ title, subtitle, rightAction, leftAction }: Props) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <LinearGradient
      colors={["#075E54", "#128C7E"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: topPad + spacing.md }]}
    >
      <View style={styles.row}>
        {leftAction ? (
          <TouchableOpacity onPress={leftAction.onPress} style={styles.iconBtn}>
            <Ionicons name={leftAction.icon} size={24} color="#fff" />
          </TouchableOpacity>
        ) : <View style={styles.iconBtn} />}
        <View style={styles.center}>
          <Text style={[typography.h3, { color: "#fff" }]}>{title}</Text>
          {subtitle ? (
            <Text style={[typography.small, { color: "rgba(255,255,255,0.8)" }]}>{subtitle}</Text>
          ) : null}
        </View>
        {rightAction ? (
          <TouchableOpacity onPress={rightAction.onPress} style={styles.iconBtn}>
            <Ionicons name={rightAction.icon} size={24} color="#fff" />
          </TouchableOpacity>
        ) : <View style={styles.iconBtn} />}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: spacing.base,
    paddingHorizontal: spacing.base,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  center: { flex: 1, alignItems: "center" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});
