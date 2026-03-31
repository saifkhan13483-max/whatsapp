import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { PulsingDot } from "./PulsingDot";

interface Props {
  name: string;
  size?: number;
  isOnline?: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function hashColor(name: string): string {
  const colors = ["#25D366", "#128C7E", "#34B7F1", "#7C4DFF", "#FF3B30", "#FFC107", "#FF6B35", "#4CAF50"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export function AvatarCircle({ name, size = 48, isOnline }: Props) {
  const colors = useColors();
  const bg = hashColor(name);
  const fontSize = size * 0.38;

  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
        <Text style={{ color: "#fff", fontSize, fontFamily: "Inter_600SemiBold" }}>
          {getInitials(name)}
        </Text>
      </View>
      {isOnline !== undefined && (
        <View style={[styles.badge, { bottom: 0, right: 0 }]}>
          <PulsingDot size={11} color={isOnline ? colors.online : colors.offline} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    borderRadius: 8,
  },
});
